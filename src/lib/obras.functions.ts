import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const obraSchema = z.object({
  nome: z.string().min(1),
  codigo: z.string().nullable().optional(),
  cliente: z.string().nullable().optional(),
  endereco: z.string().nullable().optional(),
  data_inicio: z.string().nullable().optional(),
  data_previsao_fim: z.string().nullable().optional(),
  status: z.enum(["planejamento", "em_andamento", "pausada", "concluida"]).default("planejamento"),
  avanco_pct: z.number().min(0).max(100).default(0),
  descricao: z.string().nullable().optional(),
});

export const listObras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("obras").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const getObra = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: obra, error } = await context.supabase
      .from("obras").select("*").eq("id", data.id).maybeSingle();
    if (error) throw error;
    if (!obra) throw new Error("Obra não encontrada");
    const rdos = await context.supabase.from("rdos").select("id, numero, data, status").eq("obra_id", data.id).order("data", { ascending: false }).limit(20);
    return { obra, rdos: rdos.data ?? [] };
  });

export const createObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => obraSchema.parse(d))
  .handler(async ({ context, data }) => {
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (!me.data) throw new Error("Sem empresa");
    const { error, data: created } = await context.supabase.from("obras").insert({ ...data, empresa_id: me.data.empresa_id }).select().single();
    if (error) throw error;
    return created;
  });

export const updateObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => obraSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("obras").update(rest).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("obras").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
