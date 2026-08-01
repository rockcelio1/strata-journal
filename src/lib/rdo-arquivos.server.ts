/**
 * Anexos de RDO no OneDrive — regras de negócio (somente servidor).
 *
 * O frontend nunca fala com a Microsoft: envia o arquivo para a API do RDO,
 * que valida, autentica no Graph com a identidade do aplicativo e grava
 * apenas metadados no banco.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  OneDriveConfigError,
  OneDriveGraphError,
  enviarArquivo,
  excluirItem,
  obterDriveId,
  linkDownload,
  nomeFisico,
  pastaRdo,
  sanitizarSegmento,
} from "@/lib/onedrive-app.server";

export const LIMITE_ARQUIVO_BYTES = 100 * 1024 * 1024;

export const MIMES_PERMITIDOS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
]);

/** Assinaturas de conteúdo (magic numbers) para validar além da extensão. */
const ASSINATURAS: Array<{ mime: RegExp; bytes: number[]; offset?: number }> = [
  { mime: /^image\/jpeg$/, bytes: [0xff, 0xd8, 0xff] },
  { mime: /^image\/png$/, bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: /^image\/gif$/, bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: /^application\/pdf$/, bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: /^application\/zip$/, bytes: [0x50, 0x4b] },
  {
    mime: /^application\/vnd\.openxmlformats/,
    bytes: [0x50, 0x4b],
  },
];

export class ArquivoInvalido extends Error {
  readonly status = 400;
}

export function validarConteudo(mime: string, bytes: Uint8Array) {
  if (!MIMES_PERMITIDOS.has(mime)) {
    throw new ArquivoInvalido(`Tipo de arquivo não permitido: ${mime}.`);
  }
  if (bytes.byteLength === 0) throw new ArquivoInvalido("Arquivo vazio.");
  if (bytes.byteLength > LIMITE_ARQUIVO_BYTES) {
    throw new ArquivoInvalido(
      `Arquivo acima do limite de ${Math.round(LIMITE_ARQUIVO_BYTES / (1024 * 1024))} MB.`,
    );
  }
  const regra = ASSINATURAS.find((a) => a.mime.test(mime));
  if (regra) {
    const ok = regra.bytes.every((b, i) => bytes[(regra.offset ?? 0) + i] === b);
    if (!ok) throw new ArquivoInvalido("O conteúdo do arquivo não corresponde ao tipo informado.");
  }
}

export async function hashSha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Ctx = { supabase: SupabaseClient<Database>; userId: string; empresaId: string | null };

async function carregarRdo(ctx: Ctx, rdoId: string) {
  const { data, error } = await ctx.supabase
    .from("rdos")
    .select("id, data, empresa_id, obras(nome)")
    .eq("id", rdoId)
    .maybeSingle();
  if (error || !data) throw new ArquivoInvalido("RDO não encontrado ou sem acesso.");
  return data as any;
}

export async function listarArquivosRdo(ctx: Ctx, rdoId: string) {
  await carregarRdo(ctx, rdoId);
  const { data, error } = await ctx.supabase
    .from("rdo_anexos")
    .select(
      "id, rdo_id, nome, legenda, mime_type, tamanho_bytes, storage_provider, onedrive_item_id, onedrive_drive_id, onedrive_path, sha256, upload_status, upload_erro, autor_id, created_at",
    )
    .eq("rdo_id", rdoId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function enviarArquivoRdo(
  ctx: Ctx,
  args: { rdoId: string; nome: string; mimeType: string; bytes: Uint8Array; legenda?: string | null; raiz?: string },
) {
  const rdo = await carregarRdo(ctx, args.rdoId);
  validarConteudo(args.mimeType, args.bytes);
  const sha = await hashSha256(args.bytes);

  // Idempotência: mesmo conteúdo já enviado para o mesmo RDO.
  const existente = await ctx.supabase
    .from("rdo_anexos")
    .select("id, nome, onedrive_item_id, onedrive_path")
    .eq("rdo_id", args.rdoId)
    .eq("sha256", sha)
    .maybeSingle();
  if (existente.data) return { ...existente.data, duplicado: true as const };

  const pasta = pastaRdo({
    data: rdo.data ?? new Date(),
    obra: rdo.obras?.nome ?? "OBRA",
    rdo: `RDO-${String(args.rdoId).slice(0, 8).toUpperCase()}`,
    raiz: args.raiz,
  });
  const caminho = `${pasta}/${nomeFisico(args.nome)}`;

  let enviado;
  try {
    enviado = await enviarArquivo({ caminho, bytes: args.bytes, mimeType: args.mimeType });
  } catch (e) {
    // Compensação: registra a falha sem segredos e devolve mensagem amigável.
    await ctx.supabase.from("rdo_anexos").insert({
      rdo_id: args.rdoId,
      empresa_id: rdo.empresa_id ?? ctx.empresaId,
      autor_id: ctx.userId,
      nome: sanitizarSegmento(args.nome),
      legenda: args.legenda ?? null,
      storage_path: caminho,
      onedrive_path: caminho,
      mime_type: args.mimeType,
      tamanho_bytes: args.bytes.byteLength,
      storage_provider: "onedrive",
      sha256: sha,
      upload_status: "erro",
      upload_erro: (e as Error).message.slice(0, 500),
    } as any);
    throw e;
  }

  const { data, error } = await ctx.supabase
    .from("rdo_anexos")
    .insert({
      rdo_id: args.rdoId,
      empresa_id: rdo.empresa_id ?? ctx.empresaId,
      autor_id: ctx.userId,
      nome: args.legenda ? `${args.nome} — ${args.legenda}` : args.nome,
      legenda: args.legenda ?? null,
      storage_path: enviado.caminho,
      onedrive_path: enviado.caminho,
      mime_type: args.mimeType,
      tamanho_bytes: enviado.tamanho,
      storage_provider: "onedrive",
      onedrive_item_id: enviado.itemId,
      onedrive_drive_id: enviado.driveId,
      onedrive_web_url: enviado.webUrl,
      sha256: sha,
      upload_status: "concluido",
    } as any)
    .select()
    .single();
  if (error) {
    // Banco falhou depois do upload: remove o arquivo para não deixar órfão.
    await excluirItem(enviado.driveId ?? (await obterDriveId()), enviado.itemId).catch(() => undefined);
    throw error;
  }
  return { ...data, duplicado: false as const };
}

export async function downloadArquivoRdo(ctx: Ctx, rdoId: string, arquivoId: string) {
  const { data, error } = await ctx.supabase
    .from("rdo_anexos")
    .select("id, nome, mime_type, tamanho_bytes, onedrive_item_id, storage_provider")
    .eq("id", arquivoId)
    .eq("rdo_id", rdoId)
    .maybeSingle();
  if (error || !data) throw new ArquivoInvalido("Arquivo não encontrado.");
  if (data.storage_provider !== "onedrive" || !data.onedrive_item_id) {
    throw new ArquivoInvalido("Este arquivo não está armazenado no OneDrive.");
  }
  const link = await linkDownload(await obterDriveId(), data.onedrive_item_id);
  return { url: link as string, nome: data.nome, mimeType: data.mime_type, tamanho: data.tamanho_bytes ?? null };
}

export async function excluirArquivoRdo(ctx: Ctx, rdoId: string, arquivoId: string) {
  const { data, error } = await ctx.supabase
    .from("rdo_anexos")
    .select("id, onedrive_item_id")
    .eq("id", arquivoId)
    .eq("rdo_id", rdoId)
    .maybeSingle();
  if (error || !data) throw new ArquivoInvalido("Arquivo não encontrado.");
  if (data.onedrive_item_id) {
    await excluirItem(await obterDriveId(), data.onedrive_item_id).catch((e) => {
      console.error("[onedrive] falha ao excluir item:", (e as Error).message);
    });
  }
  const del = await ctx.supabase.from("rdo_anexos").delete().eq("id", arquivoId);
  if (del.error) throw del.error;
  return { ok: true as const };
}

/** Converte qualquer falha em resposta HTTP segura (sem segredos/tokens). */
export function respostaFalha(e: unknown): Response {
  if (e instanceof ArquivoInvalido) {
    return Response.json({ error: "ARQUIVO_INVALIDO", message: e.message }, { status: 400 });
  }
  if (e instanceof OneDriveConfigError) {
    return Response.json({ error: "INTEGRACAO_NAO_CONFIGURADA", message: e.message }, { status: 503 });
  }
  if (e instanceof OneDriveGraphError) {
    const status = e.status === 0 ? 503 : e.status === 401 ? 502 : e.status;
    return Response.json({ error: "ONEDRIVE", message: e.message, requestId: e.requestId }, { status });
  }
  console.error("[rdo-arquivos] falha inesperada:", (e as Error)?.message);
  return Response.json(
    { error: "ERRO_INTERNO", message: "Não foi possível concluir a operação. Tente novamente." },
    { status: 500 },
  );
}
