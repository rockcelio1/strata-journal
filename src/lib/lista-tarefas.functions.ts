import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  obra_id: z.string().uuid().nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  codigo: z.string().trim().min(1, "Código é obrigatório").max(20),
  nome: z.string().trim().min(2, "Nome é obrigatório"),
  is_etapa: z.boolean().default(false),
  percentual: z.number().min(0).max(100).default(0),
  ordem: z.number().int().default(0),
  ativo: z.boolean().default(true),
});

export const listListaTarefas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ obra_id: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("lista_tarefas_itens")
      .select("*")
      .order("ordem", { ascending: true });
    if (data.obra_id === null) q = q.is("obra_id", null);
    else if (data.obra_id) q = q.eq("obra_id", data.obra_id);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows;
  });

export const listObrasBasic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("obras")
      .select("id, nome")
      .order("nome", { ascending: true });
    if (error) throw error;
    return data;
  });

export const upsertListaTarefaItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => itemSchema.parse(d))
  .handler(async ({ context, data }) => {
    const me = await context.supabase
      .from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (!me.data) throw new Error("Sem empresa");
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase
        .from("lista_tarefas_itens").update(rest).eq("id", id);
      if (error) throw error;
      return { id };
    }
    const { data: ins, error } = await context.supabase
      .from("lista_tarefas_itens")
      .insert({ ...data, empresa_id: me.data.empresa_id })
      .select("id").single();
    if (error) throw error;
    return { id: ins!.id };
  });

export const deleteListaTarefaItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("lista_tarefas_itens").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const reorderListaTarefas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ order: z.array(z.string().uuid()) }).parse(d))
  .handler(async ({ context, data }) => {
    for (let i = 0; i < data.order.length; i++) {
      const { error } = await context.supabase
        .from("lista_tarefas_itens").update({ ordem: i }).eq("id", data.order[i]);
      if (error) throw error;
    }
    return { ok: true };
  });

export const listListaTarefaHistorico = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ item_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("lista_tarefas_progresso_hist")
      .select("id, percentual_anterior, percentual_novo, created_at, autor_id, profiles:autor_id(nome, email)")
      .eq("item_id", data.item_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return rows;
  });
