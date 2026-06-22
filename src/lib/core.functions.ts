import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ============== ME / EMPRESA ==============
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, roles] = await Promise.all([
      supabase.from("profiles").select("*, empresas(*)").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    if (profile.error) throw profile.error;
    return {
      profile: profile.data,
      empresa: (profile.data as any)?.empresas ?? null,
      roles: (roles.data ?? []).map((r) => r.role),
    };
  });

export const updateEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { nome: string; cnpj?: string | null }) =>
    z.object({ nome: z.string().min(1), cnpj: z.string().nullable().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const me = await supabase.from("profiles").select("empresa_id").eq("id", userId).maybeSingle();
    if (!me.data) throw new Error("Sem empresa");
    const { error } = await supabase.from("empresas").update({ nome: data.nome, cnpj: data.cnpj ?? null }).eq("id", me.data.empresa_id);
    if (error) throw error;
    return { ok: true };
  });

export const listMembros = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.from("profiles").select("id, nome, email, cargo, user_roles(role)");
    if (error) throw error;
    return data;
  });

// ============== DASHBOARD ==============
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [obras, rdosPendentes, rdosTotal, ocorrencias, recentRdos] = await Promise.all([
      supabase.from("obras").select("id, nome, status, avanco_pct"),
      supabase.from("rdos").select("id", { count: "exact", head: true }).eq("status", "enviado"),
      supabase.from("rdos").select("id, status, data"),
      supabase.from("rdo_ocorrencias").select("id, created_at"),
      supabase.from("rdos").select("id, numero, data, status, obras(nome)").order("created_at", { ascending: false }).limit(6),
    ]);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000);
    return {
      obras: obras.data ?? [],
      obras_ativas: (obras.data ?? []).filter((o) => o.status === "em_andamento").length,
      obras_total: (obras.data ?? []).length,
      rdos_pendentes: rdosPendentes.count ?? 0,
      rdos_total: (rdosTotal.data ?? []).length,
      rdos_aprovados: (rdosTotal.data ?? []).filter((r) => r.status === "aprovado").length,
      ocorrencias_semana: (ocorrencias.data ?? []).filter((o) => new Date(o.created_at) > sevenDaysAgo).length,
      ocorrencias_total: (ocorrencias.data ?? []).length,
      recent_rdos: recentRdos.data ?? [],
    };
  });
