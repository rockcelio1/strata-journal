import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { exigirPermissao } from "./security/permissao.server";

const BUCKET = "obra-fotos";
const SIGNED_TTL = 3600;

async function getEmpresaId(ctx: any) {
  const me = await ctx.supabase.from("profiles").select("empresa_id").eq("id", ctx.userId).maybeSingle();
  if (!me.data?.empresa_id) throw new Error("Sem empresa");
  return me.data.empresa_id as string;
}

async function signMany(ctx: any, paths: string[]) {
  if (!paths.length) return {} as Record<string, string>;
  const { data } = await ctx.supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
  const out: Record<string, string> = {};
  for (const r of data ?? []) if (r.path && r.signedUrl) out[r.path] = r.signedUrl;
  return out;
}

export const listObraFotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { obra_id: string }) =>
    z.object({ obra_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: fotos, error } = await context.supabase
      .from("obra_fotos")
      .select("id, storage_path, nome, mime_type, blur_data_url, largura, altura, ordem, created_at, uploaded_by")
      .eq("obra_id", data.obra_id)
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;

    const obra = await context.supabase
      .from("obras")
      .select("foto_capa_path, foto_capa_blur")
      .eq("id", data.obra_id)
      .maybeSingle();

    const paths = Array.from(new Set([
      ...(fotos ?? []).map((f: any) => f.storage_path),
      ...(obra.data?.foto_capa_path ? [obra.data.foto_capa_path] : []),
    ]));
    const urls = await signMany(context, paths);

    return {
      fotos: (fotos ?? []).map((f: any) => ({ ...f, url: urls[f.storage_path] ?? null })),
      capa: obra.data?.foto_capa_path
        ? { path: obra.data.foto_capa_path, blur: obra.data.foto_capa_blur, url: urls[obra.data.foto_capa_path] ?? null }
        : null,
    };
  });

export const registerObraFoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obra_id: z.string().uuid(),
      storage_path: z.string().min(1),
      nome: z.string().nullable().optional(),
      mime_type: z.string().nullable().optional(),
      largura: z.number().int().nullable().optional(),
      altura: z.number().int().nullable().optional(),
      tamanho_bytes: z.number().int().nullable().optional(),
      blur_data_url: z.string().nullable().optional(),
      set_capa: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "obras", "editar");
    const empresa_id = await getEmpresaId(context);
    const { data: row, error } = await context.supabase
      .from("obra_fotos")
      .insert({
        obra_id: data.obra_id,
        empresa_id,
        storage_path: data.storage_path,
        nome: data.nome ?? null,
        mime_type: data.mime_type ?? null,
        largura: data.largura ?? null,
        altura: data.altura ?? null,
        tamanho_bytes: data.tamanho_bytes ?? null,
        blur_data_url: data.blur_data_url ?? null,
        uploaded_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw error;

    if (data.set_capa) {
      await context.supabase
        .from("obras")
        .update({ foto_capa_path: data.storage_path, foto_capa_blur: data.blur_data_url ?? null })
        .eq("id", data.obra_id);
    }
    return { id: row.id };
  });

export const setObraCapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ obra_id: z.string().uuid(), foto_id: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "obras", "editar");
    if (!data.foto_id) {
      const { error } = await context.supabase
        .from("obras")
        .update({ foto_capa_path: null, foto_capa_blur: null })
        .eq("id", data.obra_id);
      if (error) throw error;
      return { ok: true };
    }
    const { data: foto, error: fErr } = await context.supabase
      .from("obra_fotos")
      .select("storage_path, blur_data_url, obra_id")
      .eq("id", data.foto_id)
      .maybeSingle();
    if (fErr) throw fErr;
    if (!foto || foto.obra_id !== data.obra_id) throw new Error("Foto não encontrada");
    const { error } = await context.supabase
      .from("obras")
      .update({ foto_capa_path: foto.storage_path, foto_capa_blur: foto.blur_data_url })
      .eq("id", data.obra_id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteObraFoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ foto_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "obras", "excluir");
    const { data: foto, error: fErr } = await context.supabase
      .from("obra_fotos")
      .select("id, obra_id, storage_path")
      .eq("id", data.foto_id)
      .maybeSingle();
    if (fErr) throw fErr;
    if (!foto) throw new Error("Foto não encontrada");

    await context.supabase.storage.from(BUCKET).remove([foto.storage_path]);
    const { error } = await context.supabase.from("obra_fotos").delete().eq("id", foto.id);
    if (error) throw error;

    // se era a capa, limpa
    await context.supabase
      .from("obras")
      .update({ foto_capa_path: null, foto_capa_blur: null })
      .eq("id", foto.obra_id)
      .eq("foto_capa_path", foto.storage_path);

    return { ok: true };
  });
