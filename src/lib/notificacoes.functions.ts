import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listNotificacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notificacoes")
      .select("id, tipo, titulo, mensagem, rdo_id, lida_em, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markNotificacaoLida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; all?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const q = supabase.from("notificacoes").update({ lida_em: new Date().toISOString() }).eq("user_id", userId).is("lida_em", null);
    const { error } = data.all ? await q : await q.eq("id", data.id!);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
