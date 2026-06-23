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

export const updateEmpresaLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { logo_url: string | null }) =>
    z.object({ logo_url: z.string().url().nullable() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const me = await supabase.from("profiles").select("empresa_id").eq("id", userId).maybeSingle();
    if (!me.data) throw new Error("Sem empresa");
    const { error } = await (supabase.from("empresas") as any)
      .update({ logo_url: data.logo_url })
      .eq("id", me.data.empresa_id);
    if (error) throw error;
    return { ok: true };
  });

export const listMembros = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("id, nome, email, cargo"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (profilesRes.error) throw profilesRes.error;
    if (rolesRes.error) throw rolesRes.error;
    const rolesByUser = new Map<string, string[]>();
    for (const r of rolesRes.data ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }
    return (profilesRes.data ?? []).map((p) => ({
      ...p,
      user_roles: (rolesByUser.get(p.id) ?? []).map((role) => ({ role })),
    }));
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

// ============== CONVITES / MEMBROS ==============
const roleEnum = z.enum(["master", "admin", "engenheiro", "mestre", "visualizador"]);

async function assertAdminOrMaster(supabase: any, userId: string) {
  const [adm, mst] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "master" }),
  ]);
  if (!adm.data && !mst.data) throw new Error("Acesso negado");
}

export const adminSetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; password: string }) =>
    z.object({ user_id: z.string().uuid(), password: z.string().min(8).max(72) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    const target = await context.supabase.from("profiles").select("empresa_id").eq("id", data.user_id).maybeSingle();
    if (!me.data || !target.data || me.data.empresa_id !== target.data.empresa_id) throw new Error("Usuário fora da empresa");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw error;
    return { ok: true };
  });

export const adminSendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email);
    if (error) throw error;
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("Não é possível excluir a si mesmo");
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    const target = await context.supabase.from("profiles").select("empresa_id").eq("id", data.user_id).maybeSingle();
    if (!me.data || !target.data || me.data.empresa_id !== target.data.empresa_id) throw new Error("Usuário fora da empresa");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw error;
    return { ok: true };
  });

export const adminToggleUserDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; disabled: boolean }) =>
    z.object({ user_id: z.string().uuid(), disabled: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("Não é possível desabilitar a si mesmo");
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    const target = await context.supabase.from("profiles").select("empresa_id").eq("id", data.user_id).maybeSingle();
    if (!me.data || !target.data || me.data.empresa_id !== target.data.empresa_id) throw new Error("Usuário fora da empresa");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // ban_duration: '876000h' (~100y) para desabilitar; 'none' para reabilitar
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.disabled ? "876000h" : "none",
    } as any);
    if (error) throw error;
    return { ok: true };
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string; nome: string; role: string }) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(8).max(72),
      nome: z.string().min(1).max(120),
      role: roleEnum,
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (!me.data) throw new Error("Sem empresa");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Cria convite ativo para que o trigger handle_new_user use a empresa+role correta
    await context.supabase.from("convites").insert({
      empresa_id: me.data.empresa_id,
      email: data.email.toLowerCase(),
      role: data.role as any,
    });
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (error) throw error;
    return { ok: true, user_id: created.user?.id };
  });

export const adminUpdateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; nome: string; cargo?: string | null }) =>
    z.object({ user_id: z.string().uuid(), nome: z.string().min(1).max(120), cargo: z.string().nullable().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("profiles")
      .update({ nome: data.nome, cargo: data.cargo ?? null })
      .eq("id", data.user_id);
    if (error) throw error;
    return { ok: true };
  });

export const listConvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("convites")
      .select("id, email, role, aceito, expires_at, created_at, token")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const criarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; role: string }) =>
    z.object({ email: z.string().email(), role: roleEnum }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (!me.data) throw new Error("Sem empresa");
    const isAdmin = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin.data) throw new Error("Somente administradores");
    const { data: created, error } = await context.supabase.from("convites").insert({
      empresa_id: me.data.empresa_id,
      email: data.email.toLowerCase(),
      role: data.role as any,
    }).select().single();
    if (error) throw error;
    return created;
  });

export const revogarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("convites").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const atualizarPapelMembro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; role: string }) =>
    z.object({ user_id: z.string().uuid(), role: roleEnum }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (!me.data) throw new Error("Sem empresa");
    // Remove papéis anteriores e insere o novo (modelo de papel único por usuário/empresa)
    await context.supabase.from("user_roles").delete().eq("user_id", data.user_id).eq("empresa_id", me.data.empresa_id);
    const { error } = await context.supabase.from("user_roles").insert({
      user_id: data.user_id,
      empresa_id: me.data.empresa_id,
      role: data.role as any,
    });
    if (error) throw error;
    return { ok: true };
  });

export const removerMembro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    if (data.user_id === context.userId) throw new Error("Você não pode remover a si mesmo");
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (!me.data) throw new Error("Sem empresa");
    const { error } = await context.supabase.from("user_roles").delete()
      .eq("user_id", data.user_id).eq("empresa_id", me.data.empresa_id);
    if (error) throw error;
    return { ok: true };
  });

// ============== SEED DEMO FACOM (apenas admin) ==============
export const seedDemoFacom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const isAdmin = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin.data) throw new Error("Somente administradores");
    const me = await supabase.from("profiles").select("empresa_id").eq("id", userId).maybeSingle();
    if (!me.data) throw new Error("Sem empresa");
    const eid = me.data.empresa_id;

    await supabase.from("empresas").update({ nome: "FACOM Construções" }).eq("id", eid);

    const obras = [
      { empresa_id: eid, nome: "Residencial Aurora", endereco: "Av. das Palmeiras, 1200", status: "em_andamento", avanco_pct: 42 },
      { empresa_id: eid, nome: "Edifício Comercial Norte", endereco: "Rua Industrial, 87", status: "em_andamento", avanco_pct: 18 },
      { empresa_id: eid, nome: "Galpão Logístico Sul", endereco: "Rod. BR-101, km 312", status: "planejamento", avanco_pct: 0 },
    ];
    await supabase.from("obras").insert(obras as any);

    const mao = [
      { empresa_id: eid, nome: "João Pereira", funcao: "Mestre de obras" },
      { empresa_id: eid, nome: "Maria Santos", funcao: "Pedreira" },
      { empresa_id: eid, nome: "Carlos Lima", funcao: "Eletricista" },
      { empresa_id: eid, nome: "Ana Souza", funcao: "Engenheira civil" },
    ];
    const equip = [
      { empresa_id: eid, nome: "Betoneira 400L", tipo: "Equipamento" },
      { empresa_id: eid, nome: "Andaime tubular", tipo: "Estrutura" },
      { empresa_id: eid, nome: "Compressor 10HP", tipo: "Equipamento" },
    ];
    const tipos = [
      { empresa_id: eid, nome: "Atraso por chuva", severidade: "media" },
      { empresa_id: eid, nome: "Falta de material", severidade: "alta" },
      { empresa_id: eid, nome: "Acidente leve", severidade: "alta" },
    ];
    await Promise.all([
      supabase.from("mao_de_obra").insert(mao as any),
      supabase.from("equipamentos").insert(equip as any),
      supabase.from("tipos_ocorrencia").insert(tipos as any),
    ]);
    return { ok: true };
  });
