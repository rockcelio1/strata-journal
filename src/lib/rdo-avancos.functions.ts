import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const empresaId = async (ctx: any) => {
  const me = await ctx.supabase.from("profiles").select("empresa_id").eq("id", ctx.userId).maybeSingle();
  if (!me.data?.empresa_id) throw new Error("Sem empresa");
  return me.data.empresa_id as string;
};

// ============ APROVAÇÃO / REVISÃO ============
export const requestRevisionRdo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), motivo: z.string().min(1) }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("rdos").update({
      status: "revisao_solicitada" as const,
      revision_requested_at: new Date().toISOString(),
      revision_requested_by: context.userId,
      revision_reason: data.motivo,
    }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const reopenRdo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("rdos").update({
      status: "reaberto" as const,
      aprovado_por: null,
      aprovado_em: null,
    }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ AVANÇOS DE TAREFAS ============
export const listRdoAvancos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rdo_id: string; obra_id: string }) =>
    z.object({ rdo_id: z.string().uuid(), obra_id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const [itens, avancos] = await Promise.all([
      context.supabase.from("obra_tarefa_itens")
        .select("id,item_code,descricao,unidade,planned_quantity,realized_quantity,percent_complete,status,task_list_id")
        .eq("obra_id", data.obra_id).eq("ativo", true).order("sort_order"),
      context.supabase.from("rdo_tarefa_avancos").select("*").eq("rdo_id", data.rdo_id),
    ]);
    if (itens.error) throw itens.error;
    if (avancos.error) throw avancos.error;
    return { itens: itens.data ?? [], avancos: avancos.data ?? [] };
  });

const avancoSchema = z.object({
  id: z.string().uuid().optional(),
  task_item_id: z.string().uuid().nullable().optional(),
  task_list_id: z.string().uuid().nullable().optional(),
  item_code: z.string().nullable().optional(),
  descricao: z.string().min(1),
  unidade: z.string().nullable().optional(),
  planned_quantity: z.number().nullable().optional(),
  realized_today: z.number().nullable().optional(),
  accumulated_percent: z.number().nullable().optional(),
  status: z.enum(["nao_iniciada", "em_andamento", "concluida", "paralisada", "cancelada"]).optional(),
  total_hours: z.number().nullable().optional(),

  comment: z.string().nullable().optional(),
});

export const saveRdoAvancos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      rdo_id: z.string().uuid(),
      obra_id: z.string().uuid(),
      avancos: z.array(avancoSchema),
      removed_ids: z.array(z.string().uuid()).default([]),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const emp = await empresaId(context);
    if (data.removed_ids.length) {
      const { error } = await context.supabase.from("rdo_tarefa_avancos").delete().in("id", data.removed_ids);
      if (error) throw error;
    }
    for (const a of data.avancos) {
      const row = {
        empresa_id: emp,
        rdo_id: data.rdo_id,
        obra_id: data.obra_id,
        task_list_id: a.task_list_id ?? null,
        task_item_id: a.task_item_id ?? null,
        item_code: a.item_code ?? null,
        descricao: a.descricao,
        unidade: a.unidade ?? null,
        planned_quantity: a.planned_quantity ?? null,
        realized_today: a.realized_today ?? null,
        accumulated_percent: a.accumulated_percent ?? null,
        status: a.status ?? ("em_andamento" as const),
        total_hours: a.total_hours != null ? `${a.total_hours} hours` : null,
        comment: a.comment ?? null,
        created_by: context.userId,
      };
      if (a.id) {
        const { id, ...rest } = { id: a.id, ...row };
        const { error } = await context.supabase.from("rdo_tarefa_avancos").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await context.supabase.from("rdo_tarefa_avancos").insert(row);
        if (error) throw error;
      }
      // Reflete no item da obra (se vinculado)
      if (a.task_item_id && (a.accumulated_percent != null || a.status)) {
        const patch: any = {};
        if (a.accumulated_percent != null) patch.percent_complete = a.accumulated_percent;
        if (a.status) patch.status = a.status;
        if (Object.keys(patch).length) {
          await context.supabase.from("obra_tarefa_itens").update(patch).eq("id", a.task_item_id);
        }
      }
    }
    return { ok: true };
  });
