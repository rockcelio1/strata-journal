import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const empresaId = async (ctx: any) => {
  const me = await ctx.supabase.from("profiles").select("empresa_id").eq("id", ctx.userId).maybeSingle();
  if (!me.data?.empresa_id) throw new Error("Sem empresa");
  return me.data.empresa_id as string;
};

// ============ LISTAS DE TAREFAS DA OBRA ============
export const listObraTaskLists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { obra_id: string }) => z.object({ obra_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const lists = await context.supabase
      .from("obra_listas_tarefas")
      .select("*, template:templates_tarefas(nome)")
      .eq("obra_id", data.obra_id)
      .order("created_at");
    if (lists.error) throw lists.error;
    const ids = (lists.data ?? []).map((l: any) => l.id);
    let itens: any[] = [];
    if (ids.length) {
      const r = await context.supabase
        .from("obra_tarefa_itens")
        .select("*")
        .in("task_list_id", ids)
        .order("sort_order");
      if (r.error) throw r.error;
      itens = r.data ?? [];
    }
    return { lists: lists.data ?? [], itens };
  });

export const createObraListFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ obra_id: z.string().uuid(), template_id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const emp = await empresaId(context);
    const t = await context.supabase.from("templates_tarefas").select("*").eq("id", data.template_id).maybeSingle();
    if (t.error || !t.data) throw new Error("Template não encontrado");
    const list = await context.supabase.from("obra_listas_tarefas").insert({
      empresa_id: emp, obra_id: data.obra_id, template_id: data.template_id,
      nome: t.data.nome, tipo_controle: t.data.tipo_controle, ativo: true,
    }).select("id").single();
    if (list.error) throw list.error;
    const itens = await context.supabase.from("template_tarefa_itens")
      .select("*").eq("template_id", data.template_id).order("sort_order");
    if (itens.error) throw itens.error;
    if (itens.data?.length) {
      const rows = itens.data.map((it: any, idx: number) => ({
        empresa_id: emp,
        obra_id: data.obra_id,
        task_list_id: list.data.id,
        item_code: it.item_code,
        is_etapa: false,
        unidade: it.unidade,
        planned_quantity: it.planned_quantity,
        realized_quantity: 0,
        percent_complete: 0,
        status: "nao_iniciada",
        sort_order: idx,
        ativo: true,
      }));
      const ins = await context.supabase.from("obra_tarefa_itens").insert(rows);
      if (ins.error) throw ins.error;
    }
    return { id: list.data.id };
  });

export const deleteObraList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("obra_listas_tarefas").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ FUNÇÕES / EQUIPAMENTOS PERMITIDOS ============
export const listRecursos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { obra_id: string }) => z.object({ obra_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const [mo, eq, funcs, equips] = await Promise.all([
      context.supabase.from("mao_de_obra").select("id,nome,funcao,disciplina").eq("ativo", true).order("nome"),
      context.supabase.from("equipamentos").select("id,nome,tipo,disciplina").eq("ativo", true).order("nome"),
      context.supabase.from("obra_funcoes_permitidas").select("id,mao_de_obra_id").eq("obra_id", data.obra_id).eq("ativo", true),
      context.supabase.from("obra_equipamentos_permitidos").select("id,equipamento_id").eq("obra_id", data.obra_id).eq("ativo", true),
    ]);
    return {
      maoDeObra: mo.data ?? [],
      equipamentos: eq.data ?? [],
      funcoesPermitidas: (funcs.data ?? []).map((r: any) => r.mao_de_obra_id),
      equipamentosPermitidos: (equips.data ?? []).map((r: any) => r.equipamento_id),
    };
  });

export const toggleFuncaoPermitida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ obra_id: z.string().uuid(), mao_de_obra_id: z.string().uuid(), enabled: z.boolean() }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const emp = await empresaId(context);
    if (data.enabled) {
      const { error } = await context.supabase.from("obra_funcoes_permitidas").upsert({
        empresa_id: emp, obra_id: data.obra_id, mao_de_obra_id: data.mao_de_obra_id, ativo: true,
      }, { onConflict: "obra_id,mao_de_obra_id" });
      if (error) throw error;
    } else {
      const { error } = await context.supabase.from("obra_funcoes_permitidas")
        .delete().eq("obra_id", data.obra_id).eq("mao_de_obra_id", data.mao_de_obra_id);
      if (error) throw error;
    }
    return { ok: true };
  });

export const toggleEquipamentoPermitido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ obra_id: z.string().uuid(), equipamento_id: z.string().uuid(), enabled: z.boolean() }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const emp = await empresaId(context);
    if (data.enabled) {
      const { error } = await context.supabase.from("obra_equipamentos_permitidos").upsert({
        empresa_id: emp, obra_id: data.obra_id, equipamento_id: data.equipamento_id, ativo: true,
      }, { onConflict: "obra_id,equipamento_id" });
      if (error) throw error;
    } else {
      const { error } = await context.supabase.from("obra_equipamentos_permitidos")
        .delete().eq("obra_id", data.obra_id).eq("equipamento_id", data.equipamento_id);
      if (error) throw error;
    }
    return { ok: true };
  });

// ============ ANEXOS DA OBRA ============
const BUCKET = "obra-fotos";

export const listObraAnexos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { obra_id: string }) => z.object({ obra_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const r = await context.supabase.from("obra_anexos").select("*").eq("obra_id", data.obra_id).order("created_at", { ascending: false });
    if (r.error) throw r.error;
    const rows = r.data ?? [];
    const paths = rows.map((a: any) => a.storage_path);
    let urls: Record<string, string> = {};
    if (paths.length) {
      const s = await context.supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
      (s.data ?? []).forEach((u: any, i: number) => { if (u?.signedUrl) urls[paths[i]] = u.signedUrl; });
    }
    return rows.map((a: any) => ({ ...a, url: urls[a.storage_path] ?? null }));
  });

export const uploadObraAnexo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obra_id: z.string().uuid(),
      file_name: z.string(),
      file_type: z.string(),
      descricao: z.string().nullable().optional(),
      base64: z.string(),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const emp = await empresaId(context);
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const path = `${emp}/${data.obra_id}/anexos/${Date.now()}-${data.file_name.replace(/[^\w.-]/g, "_")}`;
    const up = await context.supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: data.file_type, upsert: false,
    });
    if (up.error) throw up.error;
    const ins = await context.supabase.from("obra_anexos").insert({
      empresa_id: emp, obra_id: data.obra_id, file_name: data.file_name, file_type: data.file_type,
      storage_path: path, descricao: data.descricao ?? null, created_by: context.userId,
    }).select("id").single();
    if (ins.error) throw ins.error;
    return { id: ins.data.id };
  });

export const deleteObraAnexo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const row = await context.supabase.from("obra_anexos").select("storage_path").eq("id", data.id).maybeSingle();
    if (row.data?.storage_path) {
      await context.supabase.storage.from(BUCKET).remove([row.data.storage_path]);
    }
    const { error } = await context.supabase.from("obra_anexos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
