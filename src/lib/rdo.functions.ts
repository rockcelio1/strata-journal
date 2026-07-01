import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const climaEnum = z.enum(["ensolarado", "nublado", "chuvoso", "chuva_forte", "impraticavel"]).nullable().optional();

const atividadeSchema = z.object({ descricao: z.string().min(1), pct_executado: z.number().min(0).max(100).default(0) });
const maoItemSchema = z.object({ mao_de_obra_id: z.string().uuid(), horas: z.number().min(0).default(8), atividade: z.string().nullable().optional() });
const equipItemSchema = z.object({ equipamento_id: z.string().uuid(), horas_uso: z.number().min(0).default(0), status_uso: z.string().nullable().optional() });
const ocItemSchema = z.object({ tipo_ocorrencia_id: z.string().uuid().nullable().optional(), descricao: z.string().min(1), foto_url: z.string().nullable().optional() });

const rdoSchema = z.object({
  obra_id: z.string().uuid(),
  data: z.string(),
  clima_manha: climaEnum,
  clima_tarde: climaEnum,
  clima_noite: climaEnum,
  observacoes: z.string().nullable().optional(),
  atividades: z.array(atividadeSchema).default([]),
  mao_de_obra: z.array(maoItemSchema).default([]),
  equipamentos: z.array(equipItemSchema).default([]),
  ocorrencias: z.array(ocItemSchema).default([]),
  enviar: z.boolean().default(false),
});

export const listRdos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("rdos")
      .select(`
        id, numero, data, status, created_at, autor_id, aprovado_por, disabled_at,
        obras(id, nome, codigo, cliente),
        autor:profiles!rdos_autor_id_profiles_fkey(id, nome, email),
        aprovador:profiles!rdos_aprovado_por_profiles_fkey(id, nome, email),
        rdo_assinaturas(user_id)
      `)
      .is("deleted_at", null)
      // Rascunhos só aparecem para o próprio autor; demais status seguem a RLS da empresa.
      .or(`status.neq.rascunho,autor_id.eq.${context.userId}`)
      .order("data", { ascending: false });
    if (error) throw error;

    const signerIds = Array.from(new Set(
      (data ?? []).flatMap((r: any) => (r.rdo_assinaturas ?? []).map((a: any) => a.user_id).filter(Boolean)),
    ));

    if (!signerIds.length) return data;

    const { data: profiles, error: profilesError } = await context.supabase
      .from("profiles")
      .select("id, nome, email")
      .in("id", signerIds);
    if (profilesError) throw profilesError;

    const profilesById = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
    return (data ?? []).map((rdo: any) => ({
      ...rdo,
      rdo_assinaturas: (rdo.rdo_assinaturas ?? []).map((assinatura: any) => ({
        ...assinatura,
        signatario: profilesById.get(assinatura.user_id) ?? null,
      })),
    }));
  });

export const adminDeleteRdo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("admin_soft_delete_rdo", { _rdo_id: data.id });
    if (error) {
      if (error.code === "42501") throw new Error("Apenas administrador ou master podem excluir qualquer RDO.");
      if (error.code === "P0002") throw new Error("RDO não encontrado ou já excluído.");
      throw new Error(`Falha ao excluir RDO: ${error.message}`);
    }
    return { ok: true };
  });

export const adminDisableRdo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; disable: boolean }) =>
    z.object({ id: z.string().uuid(), disable: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("admin_disable_rdo", { _rdo_id: data.id, _disable: data.disable });
    if (error) {
      if (error.code === "42501") throw new Error("Apenas administrador ou master podem desabilitar RDO.");
      throw new Error(`Falha ao desabilitar RDO: ${error.message}`);
    }
    return { ok: true };
  });

export const getRdo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const [rdo, ativ, mao, equip, oc] = await Promise.all([
      context.supabase.from("rdos").select("*, obras(id, nome, endereco), autor:profiles!rdos_autor_id_profiles_fkey(id, nome), aprovador:profiles!rdos_aprovado_por_profiles_fkey(id, nome)").eq("id", data.id).maybeSingle(),
      context.supabase.from("rdo_atividades").select("*").eq("rdo_id", data.id),
      context.supabase.from("rdo_mao_de_obra").select("*, mao_de_obra(nome, funcao)").eq("rdo_id", data.id),
      context.supabase.from("rdo_equipamentos").select("*, equipamentos(nome, tipo)").eq("rdo_id", data.id),
      context.supabase.from("rdo_ocorrencias").select("*, tipos_ocorrencia(nome, severidade)").eq("rdo_id", data.id),
    ]);
    if (rdo.error) throw rdo.error;
    if (!rdo.data) throw new Error("RDO não encontrado");
    if ((rdo.data as any).deleted_at) throw new Error("Este RDO foi excluído");
    return {
      rdo: rdo.data,
      atividades: ativ.data ?? [],
      mao_de_obra: mao.data ?? [],
      equipamentos: equip.data ?? [],
      ocorrencias: oc.data ?? [],
    };
  });

import { assertRowsValid, sanitizeRdoPayload, type SanitizeResult } from "./rdo-validate";
export { assertRowsValid };

/** Pure helper exposto para teste: sanitiza, valida e parseia o payload de
 *  createRdo. Retorna o payload validado + relatório de descartes para
 *  auditoria. Lança quando há erros estruturais (obra_id inválido, etc.). */
export function prepareCreateRdoInput(d: unknown): {
  data: z.infer<typeof rdoSchema>;
  sanitize: SanitizeResult<any>;
} {
  const sanitize = sanitizeRdoPayload((d ?? {}) as any);
  assertRowsValid(sanitize.sane);
  return { data: rdoSchema.parse(sanitize.sane), sanitize };
}

export const createRdo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    // Defesa em profundidade: descarta linhas inválidas (UUID quebrado /
    // descrição vazia) ANTES do zod, evitando 400 quando o cliente envia
    // linhas em branco vindas de auto-save ou fila offline antiga.
    const { data, sanitize } = prepareCreateRdoInput(d);
    // anexa o relatório de descartes no payload para o handler auditar
    (data as any).__sanitize = sanitize;
    return data;
  })
  .handler(async ({ context, data }) => {
    const sanitize: SanitizeResult<any> | undefined = (data as any).__sanitize;
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (!me.data) throw new Error("Sem empresa");

    const { data: rdo, error } = await context.supabase.from("rdos").insert({
      empresa_id: me.data.empresa_id,
      obra_id: data.obra_id,
      data: data.data,
      autor_id: context.userId,
      clima_manha: data.clima_manha ?? null,
      clima_tarde: data.clima_tarde ?? null,
      clima_noite: data.clima_noite ?? null,
      observacoes: data.observacoes ?? null,
      status: data.enviar ? "enviado" : "rascunho",
      enviado_em: data.enviar ? new Date().toISOString() : null,
    }).select().single();
    if (error) throw error;

    const rdoId = rdo.id;
    if (data.atividades.length) {
      await context.supabase.from("rdo_atividades").insert(data.atividades.map((a) => ({ ...a, rdo_id: rdoId })));
    }
    if (data.mao_de_obra.length) {
      await context.supabase.from("rdo_mao_de_obra").insert(data.mao_de_obra.map((m) => ({ ...m, rdo_id: rdoId })));
    }
    if (data.equipamentos.length) {
      await context.supabase.from("rdo_equipamentos").insert(data.equipamentos.map((e) => ({ ...e, rdo_id: rdoId })));
    }
    if (data.ocorrencias.length) {
      await context.supabase.from("rdo_ocorrencias").insert(data.ocorrencias.map((o) => ({ ...o, rdo_id: rdoId })));
    }

    // Auditoria: registra quais linhas foram descartadas pelo sanitize.
    if (sanitize && sanitize.total_dropped > 0) {
      try {
        await context.supabase.from("rdo_audit_logs").insert({
          rdo_id: rdoId,
          empresa_id: me.data.empresa_id,
          autor_id: context.userId,
          acao: "payload_sanitizado",
          status_anterior: rdo.status,
          status_novo: rdo.status,
          motivo:
            `Linhas descartadas no envio — equipamentos: ${sanitize.dropped.equipamentos}, ` +
            `ocorrências: ${sanitize.dropped.ocorrencias}, mão de obra: ${sanitize.dropped.mao_de_obra}, ` +
            `atividades: ${sanitize.dropped.atividades} (total: ${sanitize.total_dropped})`,
        });
      } catch (e) {
        // não bloqueia o fluxo se a auditoria falhar
        console.warn("[createRdo] falha ao registrar auditoria de sanitize", e);
      }
    }
    return rdo;
  });

export const submitRdo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("rdos").update({ status: "enviado", enviado_em: new Date().toISOString() }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const approveRdo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; aprovar: boolean; motivo?: string }) =>
    z.object({ id: z.string().uuid(), aprovar: z.boolean(), motivo: z.string().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("rdos").update({
      status: data.aprovar ? "aprovado" : "reprovado",
      aprovado_por: context.userId,
      aprovado_em: new Date().toISOString(),
      motivo_reprovacao: data.aprovar ? null : (data.motivo ?? null),
    }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteRdo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("soft_delete_rdo", { _rdo_id: data.id });
    if (error) {
      const msg = error.message || "";
      if (error.code === "42501" || /permiss/i.test(msg)) {
        throw new Error("Você não tem permissão para excluir este rascunho. Apenas o autor, administradores ou master podem excluir.");
      }
      if (error.code === "P0002" || /não encontrado/i.test(msg)) {
        throw new Error("RDO não encontrado ou já foi excluído.");
      }
      if (/rascunho/i.test(msg)) {
        throw new Error("Apenas RDOs em rascunho podem ser excluídos.");
      }
      throw new Error(`Falha ao excluir rascunho: ${msg}`);
    }
    return { ok: true };
  });

// ============== AUDIT LOGS ==============
export const listRdoLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    rdo_id: string;
    limit?: number;
    offset?: number;
    autor_id?: string | null;
    acao?: string | null;
    from?: string | null;
    to?: string | null;
  }) =>
    z.object({
      rdo_id: z.string().uuid(),
      limit: z.number().int().min(1).max(200).default(25),
      offset: z.number().int().min(0).default(0),
      autor_id: z.string().uuid().nullable().optional(),
      acao: z.string().nullable().optional(),
      from: z.string().nullable().optional(),
      to: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("rdo_audit_logs")
      .select("*, autor:profiles!rdo_audit_logs_autor_id_profiles_fkey(id, nome, email)", { count: "exact" })
      .eq("rdo_id", data.rdo_id);
    if (data.autor_id) q = q.eq("autor_id", data.autor_id);
    if (data.acao) q = q.eq("acao", data.acao);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error, count } = await q
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (error) throw error;
    return { rows: rows ?? [], total: count ?? 0 };
  });

/** Lista logs de toda a empresa do usuário com filtros (autor, ação, intervalo). */
export const listEmpresaRdoLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      autor_id: z.string().uuid().nullable().optional(),
      acao: z.string().nullable().optional(),
      from: z.string().nullable().optional(),
      to: z.string().nullable().optional(),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (!me.data) throw new Error("Sem empresa");
    let q = context.supabase
      .from("rdo_audit_logs")
      .select("*, autor:profiles!rdo_audit_logs_autor_id_profiles_fkey(id, nome, email), rdo:rdos(id, numero)", { count: "exact" })
      .eq("empresa_id", me.data.empresa_id);
    if (data.autor_id) q = q.eq("autor_id", data.autor_id);
    if (data.acao) q = q.eq("acao", data.acao);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error, count } = await q
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (error) throw error;
    return { rows: rows ?? [], total: count ?? 0 };
  });



// ============== ANEXOS ==============
export const listRdoAnexos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rdo_id: string }) => z.object({ rdo_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("rdo_anexos").select("*, autor:profiles!rdo_anexos_autor_id_profiles_fkey(id, nome)")
      .eq("rdo_id", data.rdo_id).order("created_at", { ascending: false });
    if (error) throw error;
    const withUrls = await Promise.all((rows ?? []).map(async (a: any) => {
      if (a.storage_provider === "onedrive") {
        return { ...a, url: a.onedrive_download_url ?? a.onedrive_web_url ?? null };
      }
      const signed = await context.supabase.storage.from("rdo-anexos").createSignedUrl(a.storage_path, 3600);
      return { ...a, url: signed.data?.signedUrl ?? null };
    }));
    return withUrls;
  });


export const registrarAnexo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rdo_id: string; nome: string; storage_path: string; mime_type?: string; tamanho_bytes?: number }) =>
    z.object({
      rdo_id: z.string().uuid(),
      nome: z.string().min(1),
      storage_path: z.string().min(1),
      mime_type: z.string().optional(),
      tamanho_bytes: z.number().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (!me.data) throw new Error("Sem empresa");
    // Bloqueia arquivos de tipo desconhecido — só Fotos/Vídeos/PDFs/Assinaturas
    const hint = `${data.storage_path ?? ""} ${data.nome ?? ""}`.toLowerCase();
    const isAssinatura = hint.includes("assinatura-") || hint.includes("/assinatura");
    const mime = data.mime_type ?? "";
    const tipoOk = isAssinatura || mime.startsWith("image/") || mime.startsWith("video/") || mime === "application/pdf";
    if (!tipoOk) {
      throw new Error("Tipo de arquivo não suportado. Envie apenas imagens, vídeos, PDFs ou assinaturas.");
    }
    const { error, data: created } = await context.supabase.from("rdo_anexos").insert({
      rdo_id: data.rdo_id,
      empresa_id: me.data.empresa_id,
      autor_id: context.userId,
      nome: data.nome,
      storage_path: data.storage_path,
      mime_type: data.mime_type ?? null,
      tamanho_bytes: data.tamanho_bytes ?? null,
    }).select().single();
    if (error) throw error;
    return created;
  });

export const removerAnexo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const row = await context.supabase.from("rdo_anexos").select("storage_path, storage_provider, onedrive_item_id").eq("id", data.id).maybeSingle();
    if (row.data?.storage_provider === "supabase" && row.data?.storage_path) {
      await context.supabase.storage.from("rdo-anexos").remove([row.data.storage_path]);
    } else if (row.data?.storage_provider === "onedrive" && row.data?.onedrive_item_id) {
      const apiKey = process.env.LOVABLE_API_KEY;
      const connKey = process.env.MICROSOFT_ONEDRIVE_API_KEY;
      if (apiKey && connKey) {
        await fetch(`https://connector-gateway.lovable.dev/microsoft_onedrive/me/drive/items/${encodeURIComponent(row.data.onedrive_item_id)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${apiKey}`, "X-Connection-Api-Key": connKey },
        }).catch(() => {});
      }
    }
    const { error } = await context.supabase.from("rdo_anexos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });


// ============== GALERIA (mídias da empresa, com filtros) ==============
export const listGaleria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { obra_id?: string; data?: string; rdo_id?: string; tipo?: "imagem" | "video" | "pdf" | "assinatura" } = {}) =>
    z.object({
      obra_id: z.string().uuid().optional(),
      data: z.string().optional(),
      rdo_id: z.string().uuid().optional(),
      tipo: z.enum(["imagem", "video", "pdf", "assinatura"]).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("rdo_anexos")
      .select("id, nome, legenda, storage_path, storage_provider, onedrive_web_url, onedrive_download_url, thumbnail_url, mime_type, tamanho_bytes, created_at, rdo_id, rdos!inner(id, numero, data, obra_id, obras(id, nome)), autor:profiles!rdo_anexos_autor_id_profiles_fkey(id, nome)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.rdo_id) q = q.eq("rdo_id", data.rdo_id);
    if (data.obra_id) q = q.eq("rdos.obra_id", data.obra_id);
    if (data.data) q = q.eq("rdos.data", data.data);
    const { data: rows, error } = await q;
    if (error) throw error;

    const tipoDe = (mime?: string | null, path?: string | null, nome?: string | null): "imagem" | "video" | "pdf" | "assinatura" | null => {
      const hint = `${path ?? ""} ${nome ?? ""}`.toLowerCase();
      if (hint.includes("assinatura-") || hint.includes("/assinatura")) return "assinatura";
      if (!mime) return null;
      if (mime.startsWith("image/")) return "imagem";
      if (mime.startsWith("video/")) return "video";
      if (mime === "application/pdf") return "pdf";
      return null;
    };
    const filtered = (rows ?? []).filter((r: any) => {
      const t = tipoDe(r.mime_type, r.storage_path, r.nome);
      if (!t) return false;
      return !data.tipo || t === data.tipo;
    });

    const withUrls = await Promise.all(filtered.map(async (a: any) => {
      let url: string | null = null;
      if (a.storage_provider === "onedrive") {
        url = a.onedrive_download_url ?? a.onedrive_web_url ?? null;
      } else {
        const signed = await context.supabase.storage.from("rdo-anexos").createSignedUrl(a.storage_path, 3600);
        url = signed.data?.signedUrl ?? null;
      }
      return { ...a, tipo: tipoDe(a.mime_type, a.storage_path, a.nome), url };
    }));
    return withUrls;
  });


// ============== AUDITORIA: visualização / edição ==============
export const logRdoView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rdo_id: string }) => z.object({ rdo_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const r = await context.supabase.from("rdos").select("empresa_id, autor_id").eq("id", data.rdo_id).maybeSingle();
    if (!r.data) return { ok: false };
    // Não registra se o próprio autor abrir (evita ruído); registra para todos os outros
    if (r.data.autor_id === context.userId) return { ok: true, skipped: true };
    await context.supabase.from("rdo_audit_logs").insert({
      rdo_id: data.rdo_id,
      empresa_id: r.data.empresa_id,
      autor_id: context.userId,
      acao: "visualizado",
    });
    return { ok: true };
  });


export const logRdoAuditView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rdo_id: string }) => z.object({ rdo_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const r = await context.supabase.from("rdos").select("empresa_id").eq("id", data.rdo_id).maybeSingle();
    if (!r.data) return { ok: false };
    await context.supabase.from("rdo_audit_logs").insert({
      rdo_id: data.rdo_id,
      empresa_id: r.data.empresa_id,
      autor_id: context.userId,
      acao: "auditoria_visualizada",
    });
    return { ok: true };
  });


export const logRdoEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rdo_id: string; detalhes?: string }) =>
    z.object({ rdo_id: z.string().uuid(), detalhes: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const r = await context.supabase.from("rdos").select("empresa_id").eq("id", data.rdo_id).maybeSingle();
    if (!r.data) return { ok: false };
    await context.supabase.from("rdo_audit_logs").insert({
      rdo_id: data.rdo_id,
      empresa_id: r.data.empresa_id,
      autor_id: context.userId,
      acao: "editado",
      motivo: data.detalhes ?? null,
    });
    return { ok: true };
  });

export const logRdoClimaUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rdo_id: string; endereco?: string | null; local?: string | null; ok: boolean; erro?: string | null }) =>
    z.object({
      rdo_id: z.string().uuid(),
      endereco: z.string().max(500).nullable().optional(),
      local: z.string().max(200).nullable().optional(),
      ok: z.boolean(),
      erro: z.string().max(500).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const r = await context.supabase.from("rdos").select("empresa_id, obra_id").eq("id", data.rdo_id).maybeSingle();
    if (!r.data) return { ok: false };
    const motivo = JSON.stringify({
      endereco: data.endereco ?? null,
      local: data.local ?? null,
      ok: data.ok,
      erro: data.erro ?? null,
      ts: new Date().toISOString(),
    });
    await context.supabase.from("rdo_audit_logs").insert({
      rdo_id: data.rdo_id,
      empresa_id: r.data.empresa_id,
      autor_id: context.userId,
      acao: data.ok ? "clima_atualizado" : "clima_falhou",
      motivo,
    });
    return { ok: true };
  });

export const updateRdoClimaRascunho = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    rdo_id: string;
    clima_manha?: string | null;
    clima_tarde?: string | null;
    clima_noite?: string | null;
    justificativa: string;
  }) =>
    z.object({
      rdo_id: z.string().uuid(),
      clima_manha: climaEnum,
      clima_tarde: climaEnum,
      clima_noite: climaEnum,
      justificativa: z.string().trim().min(5, "Justificativa obrigatória (mín. 5 caracteres)").max(1000),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const cur = await context.supabase
      .from("rdos")
      .select("id, empresa_id, status, autor_id, clima_manha, clima_tarde, clima_noite")
      .eq("id", data.rdo_id)
      .maybeSingle();
    if (cur.error) throw cur.error;
    if (!cur.data) throw new Error("RDO não encontrado");
    if (cur.data.status !== "rascunho") {
      throw new Error("Somente RDOs em rascunho podem ter a previsão do tempo editada.");
    }
    if (cur.data.autor_id !== context.userId) {
      throw new Error("Apenas o autor pode editar a previsão do tempo do próprio rascunho.");
    }

    const before = {
      clima_manha: cur.data.clima_manha ?? null,
      clima_tarde: cur.data.clima_tarde ?? null,
      clima_noite: cur.data.clima_noite ?? null,
    };
    const after = {
      clima_manha: data.clima_manha ?? null,
      clima_tarde: data.clima_tarde ?? null,
      clima_noite: data.clima_noite ?? null,
    };

    const { error: upErr } = await context.supabase
      .from("rdos")
      .update({ ...after, updated_at: new Date().toISOString() })
      .eq("id", data.rdo_id);
    if (upErr) throw upErr;

    const motivo = JSON.stringify({
      justificativa: data.justificativa.trim(),
      antes: before,
      depois: after,
      ts: new Date().toISOString(),
    });

    await context.supabase.from("rdo_audit_logs").insert({
      rdo_id: data.rdo_id,
      empresa_id: cur.data.empresa_id,
      autor_id: context.userId,
      acao: "clima_editado_rascunho",
      motivo,
    });

    return { ok: true };
  });

export const getRdoAuditSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rdo_id: string }) => z.object({ rdo_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const logs = await context.supabase
      .from("rdo_audit_logs")
      .select("acao, autor_id, created_at, autor:profiles!rdo_audit_logs_autor_id_profiles_fkey(id, nome, email)")
      .eq("rdo_id", data.rdo_id);
    if (logs.error) throw logs.error;

    const ACOES_ALTERACAO = new Set(["enviado_para_aprovacao", "aprovado", "reprovado", "status_alterado"]);
    type Row = { user_id: string; nome: string | null; email: string | null; criou: number; visualizou: number; editou: number; alterou: number; ultima: string | null };
    const by = new Map<string, Row>();
    const bump = (uid: string | null, nome: string | null, email: string | null, key: "criou" | "visualizou" | "editou" | "alterou", at: string) => {
      const k = uid ?? "__anon";
      const cur = by.get(k) ?? { user_id: k, nome, email, criou: 0, visualizou: 0, editou: 0, alterou: 0, ultima: null };
      cur[key] += 1;
      cur.nome = cur.nome ?? nome;
      cur.email = cur.email ?? email;
      if (!cur.ultima || at > cur.ultima) cur.ultima = at;
      by.set(k, cur);
    };
    for (const l of (logs.data ?? []) as any[]) {
      const nome = l.autor?.nome ?? null;
      const email = l.autor?.email ?? null;
      if (l.acao === "criado") bump(l.autor_id, nome, email, "criou", l.created_at);
      else if (l.acao === "visualizado") bump(l.autor_id, nome, email, "visualizou", l.created_at);
      else if (l.acao === "editado") bump(l.autor_id, nome, email, "editou", l.created_at);
      else if (ACOES_ALTERACAO.has(l.acao)) bump(l.autor_id, nome, email, "alterou", l.created_at);
    }
    const totais = { criou: 0, visualizou: 0, editou: 0, alterou: 0 };
    for (const r of by.values()) { totais.criou += r.criou; totais.visualizou += r.visualizou; totais.editou += r.editou; totais.alterou += r.alterou; }
    return {
      rows: Array.from(by.values()).sort((a, b) => (b.ultima ?? "").localeCompare(a.ultima ?? "")),
      totais,
    };
  });
