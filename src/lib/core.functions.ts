import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ============== PUBLIC: CHECK EMAIL ==============
// Helpers puros e testáveis (sem o wrapper de createServerFn).
export async function emailExistsIn(admin: any, email: string): Promise<boolean> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    if (users.some((u: any) => (u.email ?? "").toLowerCase() === target)) return true;
    if (users.length < 200) break;
  }
  return false;
}

// Política de senha (server-side, fonte da verdade)
export const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(72, "A senha deve ter no máximo 72 caracteres.")
  .refine((v) => /[A-Z]/.test(v), "Inclua ao menos uma letra maiúscula.")
  .refine((v) => /[a-z]/.test(v), "Inclua ao menos uma letra minúscula.")
  .refine((v) => /[0-9]/.test(v), "Inclua ao menos um número.")
  .refine((v) => /[^A-Za-z0-9]/.test(v), "Inclua ao menos um caractere especial.");

export function validatePasswordStrength(password: string): { ok: boolean; errors: string[] } {
  const r = passwordSchema.safeParse(password);
  if (r.success) return { ok: true, errors: [] };
  return { ok: false, errors: r.error.issues.map((i) => i.message) };
}

export async function registerUserCore(
  admin: any,
  input: { email: string; password: string; nome: string; empresa_nome: string },
) {
  const email = input.email.toLowerCase();
  if (await emailExistsIn(admin, email)) throw new Error("EMAIL_TAKEN");
  // Exige confirmação por e-mail: NÃO marcar email_confirm
  const { error } = await admin.auth.admin.createUser({
    email, password: input.password, email_confirm: false,
    user_metadata: { nome: input.nome, empresa_nome: input.empresa_nome },
  });
  if (error) {
    if (/already (registered|exists)/i.test(error.message)) throw new Error("EMAIL_TAKEN");
    throw error;
  }
  return { ok: true };
}

export const checkEmailRegistered = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return { exists: await emailExistsIn(supabaseAdmin, data.email) };
  });

// Backend hard-block: cadastra somente se o e-mail ainda não existir e a senha for forte.
export const registerUser = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string; nome: string; empresa_nome: string }) =>
    z.object({
      email: z.string().email(),
      password: passwordSchema,
      nome: z.string().trim().min(1).max(120),
      empresa_nome: z.string().trim().min(1).max(120),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await registerUserCore(supabaseAdmin, data);
    // Dispara o e-mail de confirmação (Supabase envia ao gerar o link de signup)
    try {
      await supabaseAdmin.auth.admin.generateLink({
        type: "signup",
        email: data.email.toLowerCase(),
        password: data.password,
      });
    } catch { /* envio best-effort */ }
    return { ok: true };
  });

// Reenviar e-mail de verificação
export const resendVerification = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    let alreadyConfirmed = false;
    let found = false;
    for (let page = 1; page <= 25; page++) {
      const { data: pg, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const u = (pg?.users ?? []).find((x: any) => (x.email ?? "").toLowerCase() === email);
      if (u) { found = true; alreadyConfirmed = !!u.email_confirmed_at; break; }
      if ((pg?.users ?? []).length < 200) break;
    }
    if (!found) throw new Error("EMAIL_NOT_FOUND");
    if (alreadyConfirmed) return { ok: true, alreadyConfirmed: true };
    const { createClient } = await import("@supabase/supabase-js");
    const pub = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await pub.auth.resend({ type: "signup", email });
    if (error) throw error;
    return { ok: true, alreadyConfirmed: false };
  });

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
  .inputValidator((d: { logo_url: string | null; storage_path?: string | null; mime_type?: string | null; tamanho_bytes?: number | null; width?: number | null; height?: number | null }) =>
    z.object({
      logo_url: z.string().url().nullable(),
      storage_path: z.string().nullable().optional(),
      mime_type: z.string().nullable().optional(),
      tamanho_bytes: z.number().int().nullable().optional(),
      width: z.number().int().nullable().optional(),
      height: z.number().int().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Apenas administradores podem REMOVER o logotipo
    if (data.logo_url === null) {
      await assertAdminOrMaster(supabase, userId);
    }
    const me = await supabase.from("profiles").select("empresa_id").eq("id", userId).maybeSingle();
    if (!me.data) throw new Error("Sem empresa");
    const { error } = await (supabase.from("empresas") as any)
      .update({ logo_url: data.logo_url })
      .eq("id", me.data.empresa_id);
    if (error) throw error;
    if (data.logo_url) {
      await (supabase.from("empresa_logo_versions") as any).insert({
        empresa_id: me.data.empresa_id,
        autor_id: userId,
        logo_url: data.logo_url,
        storage_path: data.storage_path ?? null,
        mime_type: data.mime_type ?? null,
        tamanho_bytes: data.tamanho_bytes ?? null,
        width: data.width ?? null,
        height: data.height ?? null,
      });
    }
    // Auditoria
    await (supabase.from("audit_logs_usuarios") as any).insert({
      empresa_id: me.data.empresa_id,
      autor_id: userId,
      acao: data.logo_url === null ? "logo_removido" : "logo_atualizado",
      detalhes: {
        storage_path: data.storage_path ?? null,
        mime_type: data.mime_type ?? null,
        tamanho_bytes: data.tamanho_bytes ?? null,
        width: data.width ?? null,
        height: data.height ?? null,
      },
    });
    return { ok: true };
  });

export const listLogoVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const me = await supabase.from("profiles").select("empresa_id").eq("id", userId).maybeSingle();
    if (!me.data) return [];
    const { data, error } = await (supabase.from("empresa_logo_versions") as any)
      .select("id, logo_url, storage_path, mime_type, tamanho_bytes, width, height, created_at, autor_id")
      .eq("empresa_id", me.data.empresa_id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    const rows = (data ?? []) as any[];
    const autorIds = Array.from(new Set(rows.map((r) => r.autor_id).filter(Boolean)));
    let nomesById: Record<string, { id: string; nome: string | null }> = {};
    if (autorIds.length > 0) {
      const { data: profs } = await (supabase.from("profiles") as any)
        .select("id, nome")
        .in("id", autorIds);
      nomesById = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    }
    return rows.map((r) => ({ ...r, autor: r.autor_id ? (nomesById[r.autor_id] ?? { id: r.autor_id, nome: null }) : null }));
  });

export const restoreLogoVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { version_id: string }) => z.object({ version_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdminOrMaster(supabase, userId);
    const empresa_id = await getMyEmpresaId(supabase, userId);
    const v = await (supabase.from("empresa_logo_versions") as any).select("logo_url, empresa_id").eq("id", data.version_id).maybeSingle();
    if (!v.data || v.data.empresa_id !== empresa_id) throw new Error("Versão não encontrada");
    const { error } = await (supabase.from("empresas") as any).update({ logo_url: v.data.logo_url }).eq("id", empresa_id);
    if (error) throw error;
    await (supabase.from("audit_logs_usuarios") as any).insert({
      empresa_id, autor_id: userId, acao: "logo_restaurado",
      detalhes: { version_id: data.version_id },
    });
    return { ok: true, logo_url: v.data.logo_url };
  });

export const updateLogoWallpaper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { opacity: number }) =>
    z.object({ opacity: z.number().int().min(0).max(100) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdminOrMaster(supabase, userId);
    const empresa_id = await getMyEmpresaId(supabase, userId);
    const { error } = await (supabase.from("empresas") as any)
      .update({ logo_wallpaper_opacity: data.opacity })
      .eq("id", empresa_id);
    if (error) throw error;
    await (supabase.from("audit_logs_usuarios") as any).insert({
      empresa_id, autor_id: userId, acao: "logo_wallpaper_atualizado",
      detalhes: { opacity: data.opacity },
    });
    return { ok: true };
  });
export const listMembros = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [profilesRes, rolesRes] = await Promise.all([
      (supabase.from("profiles") as any).select("id, nome, email, cargo, aprovado, aprovado_em, created_at"),
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
    return (profilesRes.data ?? []).map((p: any) => ({
      ...p,
      user_roles: (rolesByUser.get(p.id) ?? []).map((role) => ({ role })),
    }));
  });


// ============== DASHBOARD ==============
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [obras, rdosPendentes, rdosFull, ocorrenciasFull, recentRdos, equipamentos, maoDeObra, tiposOcorrencia, rdoEquip, rdoMao] = await Promise.all([
      supabase.from("obras").select("id, nome, status, avanco_pct"),
      supabase.from("rdos").select("id", { count: "exact", head: true }).eq("status", "enviado"),
      supabase.from("rdos").select("id, status, data, obra_id"),
      supabase.from("rdo_ocorrencias").select("id, created_at, rdo_id, tipo_ocorrencia_id, rdos!inner(obra_id)"),
      supabase.from("rdos").select("id, numero, data, status, obras(nome)").order("created_at", { ascending: false }).limit(6),
      supabase.from("equipamentos").select("id, nome"),
      supabase.from("mao_de_obra").select("id, nome"),
      supabase.from("tipos_ocorrencia").select("id, nome"),
      supabase.from("rdo_equipamentos").select("equipamento_id, rdo_id, rdos!inner(obra_id)"),
      supabase.from("rdo_mao_de_obra").select("mao_de_obra_id, rdo_id, rdos!inner(obra_id)"),
    ]);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000);
    return {
      obras: obras.data ?? [],
      obras_ativas: (obras.data ?? []).filter((o) => o.status === "em_andamento").length,
      obras_total: (obras.data ?? []).length,
      rdos_pendentes: rdosPendentes.count ?? 0,
      rdos_total: (rdosFull.data ?? []).length,
      rdos_aprovados: (rdosFull.data ?? []).filter((r) => r.status === "aprovado").length,
      ocorrencias_semana: (ocorrenciasFull.data ?? []).filter((o: any) => new Date(o.created_at) > sevenDaysAgo).length,
      ocorrencias_total: (ocorrenciasFull.data ?? []).length,
      recent_rdos: recentRdos.data ?? [],
      // dados para filtro avançado
      rdos_all: rdosFull.data ?? [],
      ocorrencias_all: ocorrenciasFull.data ?? [],
      rdo_equipamentos: rdoEquip.data ?? [],
      rdo_mao_de_obra: rdoMao.data ?? [],
      equipamentos: equipamentos.data ?? [],
      mao_de_obra: maoDeObra.data ?? [],
      tipos_ocorrencia: tiposOcorrencia.data ?? [],
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

const auditFiltersSchema = z.object({
  user_id: z.string().uuid().nullable().optional(),
  acao: z.string().nullable().optional(),
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(20),
});

function applyAuditFilters(q: any, f: z.infer<typeof auditFiltersSchema>) {
  if (f.user_id) q = q.or(`autor_id.eq.${f.user_id},alvo_user_id.eq.${f.user_id}`);
  if (f.acao) q = q.eq("acao", f.acao);
  if (f.from) q = q.gte("created_at", f.from);
  if (f.to) q = q.lte("created_at", f.to);
  return q;
}

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => auditFiltersSchema.parse(d ?? {}))
  .handler(async ({ context, data: f }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    const offset = (f.page - 1) * f.pageSize;
    let q = context.supabase
      .from("audit_logs_usuarios")
      .select("id, acao, alvo_user_id, alvo_email, detalhes, created_at, autor_id", { count: "exact" });
    q = applyAuditFilters(q, f).order("created_at", { ascending: false }).range(offset, offset + f.pageSize - 1);
    const { data, error, count } = await q;
    if (error) throw error;
    return { items: data ?? [], total: count ?? 0, page: f.page, pageSize: f.pageSize };
  });

export const exportAuditLogsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => auditFiltersSchema.partial({ page: true, pageSize: true }).parse(d ?? {}))
  .handler(async ({ context, data: f }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    let q = context.supabase
      .from("audit_logs_usuarios")
      .select("id, acao, alvo_user_id, alvo_email, detalhes, created_at, autor_id");
    q = applyAuditFilters(q, { ...f, page: 1, pageSize: 20 } as any).order("created_at", { ascending: false }).limit(5000);
    const { data, error } = await q;
    if (error) throw error;
    const rows = data ?? [];
    const userIds = Array.from(new Set(rows.flatMap((r: any) => [r.autor_id, r.alvo_user_id]).filter(Boolean))) as string[];
    const profilesMap = new Map<string, { nome: string; email: string }>();
    if (userIds.length) {
      const profs = await context.supabase.from("profiles").select("id, nome, email").in("id", userIds);
      for (const p of (profs.data ?? []) as any[]) profilesMap.set(p.id, { nome: p.nome, email: p.email });
    }
    const esc = (v: any) => {
      const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["data", "acao", "autor_nome", "autor_email", "alvo_nome", "alvo_email", "detalhes"].join(",");
    const lines = rows.map((r: any) => {
      const autor = r.autor_id ? profilesMap.get(r.autor_id) : null;
      const alvo = r.alvo_user_id ? profilesMap.get(r.alvo_user_id) : null;
      return [
        esc(new Date(r.created_at).toISOString()),
        esc(r.acao),
        esc(autor?.nome ?? ""),
        esc(autor?.email ?? ""),
        esc(alvo?.nome ?? ""),
        esc(alvo?.email ?? r.alvo_email ?? ""),
        esc(r.detalhes),
      ].join(",");
    });
    return { csv: [header, ...lines].join("\n"), count: rows.length };
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
    // Usa service_role para escrever em user_roles, evitando colisão com RLS
    // (autorização do chamador já foi validada acima).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const prev = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.user_id).eq("empresa_id", empresa_id);
    const del = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("empresa_id", empresa_id);
    if (del.error) throw del.error;
    const { error } = await supabaseAdmin.from("user_roles").insert({
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_roles").delete()
      .eq("user_id", data.user_id).eq("empresa_id", empresa_id);
    if (error) throw error;
    return { ok: true };
  });

// ============== AÇÕES EM MASSA ==============
const bulkIdsSchema = z.object({ user_ids: z.array(z.string().uuid()).min(1).max(200) });

export const bulkAtualizarPapel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_ids: string[]; role: string }) =>
    bulkIdsSchema.extend({ role: roleEnum }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    const empresa_id = await getMyEmpresaId(context.supabase, context.userId);
    // Garante que todos pertencem à mesma empresa
    const profs = await context.supabase.from("profiles").select("id").eq("empresa_id", empresa_id).in("id", data.user_ids);
    const found = new Set((profs.data ?? []).map((p: any) => p.id));
    const validos = data.user_ids.filter((id) => found.has(id));
    if (validos.length === 0) throw new Error("Nenhum usuário válido");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("empresa_id", empresa_id).in("user_id", validos);
    const rows = validos.map((uid) => ({ user_id: uid, empresa_id, role: data.role as any }));
    const { error } = await supabaseAdmin.from("user_roles").insert(rows);
    if (error) throw error;
    await logAudit(context.supabase, {
      empresa_id, acao: "papel_alterado",
      detalhes: { bulk: true, total: validos.length, para: data.role, alvos: validos },
    });
    return { ok: true, count: validos.length };
  });

export const bulkSetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_ids: string[]; password: string }) =>
    bulkIdsSchema.extend({ password: z.string().min(8).max(72) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    const empresa_id = await getMyEmpresaId(context.supabase, context.userId);
    const profs = await context.supabase.from("profiles").select("id, email").eq("empresa_id", empresa_id).in("id", data.user_ids);
    const validos = (profs.data ?? []) as any[];
    if (validos.length === 0) throw new Error("Nenhum usuário válido");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let ok = 0; const falhas: string[] = [];
    for (const u of validos) {
      const r = await supabaseAdmin.auth.admin.updateUserById(u.id, { password: data.password });
      if (r.error) falhas.push(u.email); else ok++;
    }
    await logAudit(context.supabase, {
      empresa_id, acao: "senha_definida",
      detalhes: { bulk: true, total: ok, falhas },
    });
    return { ok: true, count: ok, falhas };
  });

export const bulkDeleteUsuarios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_ids: string[] }) => bulkIdsSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    const empresa_id = await getMyEmpresaId(context.supabase, context.userId);
    const alvos = data.user_ids.filter((id) => id !== context.userId);
    if (alvos.length === 0) throw new Error("Nenhum usuário válido (não é possível remover você mesmo)");
    const profs = await context.supabase.from("profiles").select("id, email").eq("empresa_id", empresa_id).in("id", alvos);
    const validos = (profs.data ?? []) as any[];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let ok = 0; const falhas: string[] = [];
    for (const u of validos) {
      const r = await supabaseAdmin.auth.admin.deleteUser(u.id);
      if (r.error) falhas.push(u.email); else ok++;
    }
    await logAudit(context.supabase, {
      empresa_id, acao: "usuario_excluido",
      detalhes: { bulk: true, total: ok, falhas },
    });
    return { ok: true, count: ok, falhas };
  });

export const bulkSendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_ids: string[] }) => bulkIdsSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    const empresa_id = await getMyEmpresaId(context.supabase, context.userId);
    const profs = await context.supabase.from("profiles").select("id, email").eq("empresa_id", empresa_id).in("id", data.user_ids);
    const validos = (profs.data ?? []) as any[];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let ok = 0;
    for (const u of validos) {
      const r = await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email: u.email });
      if (!r.error) ok++;
    }
    await logAudit(context.supabase, {
      empresa_id, acao: "senha_reset_enviado",
      detalhes: { bulk: true, total: ok },
    });
    return { ok: true, count: ok };
  });

export const bulkAtualizarPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_ids: string[]; cargo?: string | null }) =>
    bulkIdsSchema.extend({ cargo: z.string().max(120).nullable().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdminOrMaster(context.supabase, context.userId);
    const empresa_id = await getMyEmpresaId(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error, count } = await supabaseAdmin.from("profiles")
      .update({ cargo: data.cargo ?? null }, { count: "exact" })
      .eq("empresa_id", empresa_id)
      .in("id", data.user_ids);
    if (error) throw error;
    await logAudit(context.supabase, {
      empresa_id, acao: "usuario_editado",
      detalhes: { bulk: true, total: count ?? data.user_ids.length, cargo: data.cargo },
    });
    return { ok: true, count: count ?? 0 };
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
