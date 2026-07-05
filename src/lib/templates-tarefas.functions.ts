import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const tipoControle = z.enum(["porcentagem", "produtividade", "misto"]);

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("templates_tarefas")
      .select("*")
      .order("nome");
    if (error) throw error;
    return data;
  });

export const getTemplate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const t = await context.supabase.from("templates_tarefas").select("*").eq("id", data.id).maybeSingle();
    if (t.error) throw t.error;
    const itens = await context.supabase
      .from("template_tarefa_itens")
      .select("*")
      .eq("template_id", data.id)
      .order("sort_order");
    if (itens.error) throw itens.error;
    return { template: t.data, itens: itens.data ?? [] };
  });

export const upsertTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      nome: z.string().min(1),
      tipo_controle: tipoControle,
      ativo: z.boolean().default(true),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (!me.data?.empresa_id) throw new Error("Sem empresa");
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("templates_tarefas").update(rest).eq("id", id);
      if (error) throw error;
      return { id };
    }
    const { data: created, error } = await context.supabase
      .from("templates_tarefas")
      .insert({ ...data, empresa_id: me.data.empresa_id, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw error;
    return { id: created.id };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("templates_tarefas").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  item_code: z.string().min(1),
  descricao: z.string().min(1),
  unidade: z.string().nullable().optional(),
  planned_quantity: z.number().nullable().optional(),
  sort_order: z.number().default(0),
});

export const saveItens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      template_id: z.string().uuid(),
      itens: z.array(itemSchema),
      removed_ids: z.array(z.string().uuid()).default([]),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (!me.data?.empresa_id) throw new Error("Sem empresa");
    if (data.removed_ids.length) {
      const { error } = await context.supabase.from("template_tarefa_itens").delete().in("id", data.removed_ids);
      if (error) throw error;
    }
    for (const it of data.itens) {
      if (it.id) {
        const { id, ...rest } = it;
        const { error } = await context.supabase.from("template_tarefa_itens").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { id: _drop, ...rest } = it;
        const { error } = await context.supabase.from("template_tarefa_itens").insert({
          ...rest,
          template_id: data.template_id,
          empresa_id: me.data.empresa_id,
        });
        if (error) throw error;
      }
    }
    return { ok: true };
  });

export const commitImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      template_id: z.string().uuid(),
      file_name: z.string(),
      itens: z.array(itemSchema.omit({ id: true })),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (!me.data?.empresa_id) throw new Error("Sem empresa");
    const job = await context.supabase.from("import_jobs_tarefas").insert({
      empresa_id: me.data.empresa_id,
      template_id: data.template_id,
      file_name: data.file_name,
      import_type: "template",
      status: "processing",
      total_rows: data.itens.length,
      created_by: context.userId,
    }).select("id").single();
    if (job.error) throw job.error;
    let imported = 0;
    const errors: any[] = [];
    for (const it of data.itens) {
      const { error } = await context.supabase.from("template_tarefa_itens").insert({
        ...it,
        template_id: data.template_id,
        empresa_id: me.data.empresa_id,
      });
      if (error) errors.push({ item_code: it.item_code, msg: error.message });
      else imported++;
    }
    await context.supabase.from("import_jobs_tarefas").update({
      status: errors.length ? "completed_with_errors" : "completed",
      imported_rows: imported,
      error_rows: errors.length,
      error_log: errors,
    }).eq("id", job.data.id);
    return { imported, errors };
  });
