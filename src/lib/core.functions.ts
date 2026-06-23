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
  const r = await supabase.rpc("has_admin_access", { _user_id: userId });
  if (!r.data) throw new Error("Acesso negado: apenas administrador ou master");
}

async function getMyEmpresaId(supabase: any, userId: string): Promise<string> {
  const me = await supabase.from("profiles").select("empresa_id").eq("id", userId).maybeSingle();
  if (!me.data) throw new Error("Sem empresa");
  return me.data.empresa_id;
}

async function assertSameEmpresa(supabase: any, userId: string, targetUserId: string) {
  const meEmp = await getMyEmpresaId(supabase, userId);
  const t = await supabase.from("profiles").select("empresa_id").eq("id", targetUserId).maybeSingle();
  if (!t.data || t.data.empresa_id !== meEmp) throw new Error("Usuário fora da empresa");
  return meEmp;
}

async function logAudit(supabase: any, p: {
  empresa_id: string; acao: string; alvo_user_id?: string | null; alvo_email?: string | null; detalhes?: any;
}) {
  await supabase.from("audit_logs_usuarios").insert({
    empresa_id: p.empresa_id,
    acao: p.acao,
    alvo_user_id: p.alvo_user_id ?? null,
    alvo_email: p.alvo_email ?? null,
    detalhes: p.detalhes ?? null,
  });
}

export const adminSetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; password: string }) =>
    z.object({ user_id: z.string().uuid(), password: z.string().min(8).max(72) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    const empresa_id = await assertSameEmpresa(context.supabase, context.userId, data.user_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw error;
    await logAudit(context.supabase, { empresa_id, acao: "senha_definida", alvo_user_id: data.user_id });
    return { ok: true };
  });

export const adminSendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    const empresa_id = await getMyEmpresaId(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email);
    if (error) throw error;
    await logAudit(context.supabase, { empresa_id, acao: "senha_reset_enviado", alvo_email: data.email });
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("Não é possível excluir a si mesmo");
    const empresa_id = await assertSameEmpresa(context.supabase, context.userId, data.user_id);
    const target = await context.supabase.from("profiles").select("email").eq("id", data.user_id).maybeSingle();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw error;
    await logAudit(context.supabase, { empresa_id, acao: "usuario_excluido", alvo_user_id: data.user_id, alvo_email: target.data?.email });
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
    const empresa_id = await assertSameEmpresa(context.supabase, context.userId, data.user_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.disabled ? "876000h" : "none",
    } as any);
    if (error) throw error;
    await logAudit(context.supabase, {
      empresa_id, acao: data.disabled ? "usuario_desabilitado" : "usuario_habilitado", alvo_user_id: data.user_id,
    });
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
    const empresa_id = await getMyEmpresaId(context.supabase, context.userId);
    const emailLower = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Convite ativo para que handle_new_user use empresa+role corretos e marque aprovado
    await context.supabase.from("convites").insert({ empresa_id, email: emailLower, role: data.role as any });
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (error) {
      if (/already (registered|exists)/i.test(error.message)) throw new Error("Já existe um usuário com esse e-mail");
      throw error;
    }
    await logAudit(context.supabase, {
      empresa_id, acao: "usuario_criado", alvo_user_id: created.user?.id, alvo_email: emailLower,
      detalhes: { role: data.role, nome: data.nome },
    });
    return { ok: true, user_id: created.user?.id };
  });

export const adminUpdateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; nome: string; cargo?: string | null }) =>
    z.object({ user_id: z.string().uuid(), nome: z.string().min(1).max(120), cargo: z.string().nullable().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    const empresa_id = await assertSameEmpresa(context.supabase, context.userId, data.user_id);
    const { error } = await context.supabase.from("profiles")
      .update({ nome: data.nome, cargo: data.cargo ?? null }).eq("id", data.user_id);
    if (error) throw error;
    await logAudit(context.supabase, {
      empresa_id, acao: "usuario_editado", alvo_user_id: data.user_id, detalhes: { nome: data.nome, cargo: data.cargo },
    });
    return { ok: true };
  });

export const aprovarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; aprovado: boolean }) =>
    z.object({ user_id: z.string().uuid(), aprovado: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    const empresa_id = await assertSameEmpresa(context.supabase, context.userId, data.user_id);
    const { error } = await (context.supabase.from("profiles") as any)
      .update({ aprovado: data.aprovado, aprovado_por: context.userId, aprovado_em: data.aprovado ? new Date().toISOString() : null })
      .eq("id", data.user_id);
    if (error) throw error;
    await logAudit(context.supabase, {
      empresa_id, acao: data.aprovado ? "usuario_aprovado" : "usuario_reprovado", alvo_user_id: data.user_id,
    });
    return { ok: true };
  });

export const updateEmpresaAppLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { app_ios_url?: string | null; app_android_url?: string | null }) =>
    z.object({
      app_ios_url: z.string().url().nullable().optional(),
      app_android_url: z.string().url().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    const empresa_id = await getMyEmpresaId(context.supabase, context.userId);
    const { error } = await (context.supabase.from("empresas") as any)
      .update({ app_ios_url: data.app_ios_url ?? null, app_android_url: data.app_android_url ?? null })
      .eq("id", empresa_id);
    if (error) throw error;
    return { ok: true };
  });

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("audit_logs_usuarios")
      .select("id, acao, alvo_user_id, alvo_email, detalhes, created_at, autor_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
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
    await assertAdminOrMaster(context.supabase, context.userId);
    const empresa_id = await getMyEmpresaId(context.supabase, context.userId);
    const emailLower = data.email.toLowerCase();
    // Bloqueia se já existe usuário na empresa com este e-mail
    const existing = await context.supabase.from("profiles").select("id").eq("email", emailLower).eq("empresa_id", empresa_id).maybeSingle();
    if (existing.data) throw new Error("Já existe um usuário com este e-mail");
    const dup = await context.supabase.from("convites").select("id").eq("email", emailLower).eq("empresa_id", empresa_id).eq("aceito", false).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (dup.data) throw new Error("Já existe um convite pendente para este e-mail");
    const { data: created, error } = await context.supabase.from("convites").insert({
      empresa_id, email: emailLower, role: data.role as any,
    }).select().single();
    if (error) throw error;
    await logAudit(context.supabase, { empresa_id, acao: "convite_criado", alvo_email: emailLower, detalhes: { role: data.role } });
    return created;
  });

export const reenviarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    const empresa_id = await getMyEmpresaId(context.supabase, context.userId);
    const conv = await context.supabase.from("convites").select("id, email, aceito, empresa_id").eq("id", data.id).maybeSingle();
    if (!conv.data || conv.data.empresa_id !== empresa_id) throw new Error("Convite não encontrado");
    if (conv.data.aceito) throw new Error("Convite já foi aceito");
    const newExpires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const { error } = await context.supabase.from("convites").update({ expires_at: newExpires }).eq("id", data.id);
    if (error) throw error;
    await logAudit(context.supabase, { empresa_id, acao: "convite_reenviado", alvo_email: conv.data.email });
    return { ok: true, expires_at: newExpires };
  });

export const revogarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    const empresa_id = await getMyEmpresaId(context.supabase, context.userId);
    const conv = await context.supabase.from("convites").select("email, empresa_id").eq("id", data.id).maybeSingle();
    if (!conv.data || conv.data.empresa_id !== empresa_id) throw new Error("Convite não encontrado");
    const { error } = await context.supabase.from("convites").delete().eq("id", data.id);
    if (error) throw error;
    await logAudit(context.supabase, { empresa_id, acao: "convite_revogado", alvo_email: conv.data.email });
    return { ok: true };
  });

export const atualizarPapelMembro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; role: string }) =>
    z.object({ user_id: z.string().uuid(), role: roleEnum }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    const empresa_id = await assertSameEmpresa(context.supabase, context.userId, data.user_id);
    const prev = await context.supabase.from("user_roles").select("role").eq("user_id", data.user_id).eq("empresa_id", empresa_id);
    await context.supabase.from("user_roles").delete().eq("user_id", data.user_id).eq("empresa_id", empresa_id);
    const { error } = await context.supabase.from("user_roles").insert({
      user_id: data.user_id, empresa_id, role: data.role as any,
    });
    if (error) throw error;
    await logAudit(context.supabase, {
      empresa_id, acao: "papel_alterado", alvo_user_id: data.user_id,
      detalhes: { de: (prev.data ?? []).map((r: any) => r.role), para: data.role },
    });
    return { ok: true };
  });

export const removerMembro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("Você não pode remover a si mesmo");
    const empresa_id = await assertSameEmpresa(context.supabase, context.userId, data.user_id);
    const { error } = await context.supabase.from("user_roles").delete()
      .eq("user_id", data.user_id).eq("empresa_id", empresa_id);
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
