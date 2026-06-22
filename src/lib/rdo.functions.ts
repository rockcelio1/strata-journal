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
      .select("id, numero, data, status, created_at, obras(id, nome)")
      .order("data", { ascending: false });
    if (error) throw error;
    return data;
  });

export const getRdo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const [rdo, ativ, mao, equip, oc] = await Promise.all([
      context.supabase.from("rdos").select("*, obras(id, nome), autor:profiles!rdos_autor_id_fkey(id, nome), aprovador:profiles!rdos_aprovado_por_fkey(id, nome)").eq("id", data.id).maybeSingle(),
      context.supabase.from("rdo_atividades").select("*").eq("rdo_id", data.id),
      context.supabase.from("rdo_mao_de_obra").select("*, mao_de_obra(nome, funcao)").eq("rdo_id", data.id),
      context.supabase.from("rdo_equipamentos").select("*, equipamentos(nome, tipo)").eq("rdo_id", data.id),
      context.supabase.from("rdo_ocorrencias").select("*, tipos_ocorrencia(nome, severidade)").eq("rdo_id", data.id),
    ]);
    if (rdo.error) throw rdo.error;
    if (!rdo.data) throw new Error("RDO não encontrado");
    return {
      rdo: rdo.data,
      atividades: ativ.data ?? [],
      mao_de_obra: mao.data ?? [],
      equipamentos: equip.data ?? [],
      ocorrencias: oc.data ?? [],
    };
  });

export const createRdo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rdoSchema.parse(d))
  .handler(async ({ context, data }) => {
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
    const { error } = await context.supabase.from("rdos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============== AUDIT LOGS ==============
export const listRdoLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rdo_id: string }) => z.object({ rdo_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("rdo_audit_logs")
      .select("*, autor:profiles!rdo_audit_logs_autor_id_fkey(id, nome)")
      .eq("rdo_id", data.rdo_id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return rows;
  });

// ============== ANEXOS ==============
export const listRdoAnexos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rdo_id: string }) => z.object({ rdo_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("rdo_anexos").select("*, autor:profiles!rdo_anexos_autor_id_fkey(id, nome)")
      .eq("rdo_id", data.rdo_id).order("created_at", { ascending: false });
    if (error) throw error;
    const withUrls = await Promise.all((rows ?? []).map(async (a: any) => {
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
    const row = await context.supabase.from("rdo_anexos").select("storage_path").eq("id", data.id).maybeSingle();
    if (row.data?.storage_path) {
      await context.supabase.storage.from("rdo-anexos").remove([row.data.storage_path]);
    }
    const { error } = await context.supabase.from("rdo_anexos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
