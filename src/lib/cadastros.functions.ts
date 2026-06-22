import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// =============== MAO DE OBRA ===============
const maoSchema = z.object({
  nome: z.string().min(1),
  funcao: z.string().min(1),
  empresa_terceira: z.string().nullable().optional(),
  contato: z.string().nullable().optional(),
  ativo: z.boolean().default(true),
});

export const listMaoDeObra = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("mao_de_obra").select("*").order("nome");
    if (error) throw error;
    return data;
  });

export const upsertMaoDeObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => maoSchema.extend({ id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (!me.data) throw new Error("Sem empresa");
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("mao_de_obra").update(rest).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await context.supabase.from("mao_de_obra").insert({ ...data, empresa_id: me.data.empresa_id });
      if (error) throw error;
    }
    return { ok: true };
  });

export const deleteMaoDeObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("mao_de_obra").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// =============== EQUIPAMENTOS ===============
const equipSchema = z.object({
  nome: z.string().min(1),
  tipo: z.string().nullable().optional(),
  identificacao: z.string().nullable().optional(),
  status: z.enum(["disponivel", "em_uso", "manutencao"]).default("disponivel"),
  observacoes: z.string().nullable().optional(),
  ativo: z.boolean().default(true),
});

export const listEquipamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("equipamentos").select("*").order("nome");
    if (error) throw error;
    return data;
  });

export const upsertEquipamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => equipSchema.extend({ id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (!me.data) throw new Error("Sem empresa");
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("equipamentos").update(rest).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await context.supabase.from("equipamentos").insert({ ...data, empresa_id: me.data.empresa_id });
      if (error) throw error;
    }
    return { ok: true };
  });

export const deleteEquipamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("equipamentos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// =============== TIPOS DE OCORRENCIA ===============
const tipoOcSchema = z.object({
  nome: z.string().min(1),
  severidade: z.enum(["baixa", "media", "alta", "critica"]).default("media"),
  descricao: z.string().nullable().optional(),
  ativo: z.boolean().default(true),
});

export const listTiposOcorrencia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("tipos_ocorrencia").select("*").order("nome");
    if (error) throw error;
    return data;
  });

export const upsertTipoOcorrencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tipoOcSchema.extend({ id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (!me.data) throw new Error("Sem empresa");
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("tipos_ocorrencia").update(rest).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await context.supabase.from("tipos_ocorrencia").insert({ ...data, empresa_id: me.data.empresa_id });
      if (error) throw error;
    }
    return { ok: true };
  });

export const deleteTipoOcorrencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("tipos_ocorrencia").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
