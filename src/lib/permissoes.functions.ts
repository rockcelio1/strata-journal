import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { exigirPermissao } from "./security/permissao.server";
import type { Database } from "@/integrations/supabase/types";

export type AppResource = Database["public"]["Enums"]["app_resource"];
export type AppAction = Database["public"]["Enums"]["app_action"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export const RESOURCES: AppResource[] = [
  "obras",
  "rdos",
  "usuarios",
  "relatorios",
  "equipamentos",
  "mao_de_obra",
  "ocorrencias",
  "convites",
  "empresa",
  "permissoes",
  "templates_tarefas",
  "listas_tarefas",
];

export const ACTIONS: AppAction[] = [
  "ver",
  "criar",
  "editar",
  "excluir",
  "aprovar",
  "exportar",
  "importar",
  "solicitar_revisao",
];

export const ROLES: AppRole[] = ["admin", "master", "gestor_acessos", "engenheiro", "mestre", "visualizador"];

export const RESOURCE_LABELS: Record<AppResource, string> = {
  obras: "Obras",
  rdos: "Diário (RDOs)",
  usuarios: "Usuários",
  relatorios: "Relatórios",
  equipamentos: "Equipamentos",
  mao_de_obra: "Mão de obra",
  ocorrencias: "Ocorrências",
  convites: "Convites",
  empresa: "Empresa",
  permissoes: "Permissões",
  templates_tarefas: "Templates de tarefas",
  listas_tarefas: "Listas de tarefas",
};

export const ACTION_LABELS: Record<AppAction, string> = {
  ver: "Ver",
  criar: "Criar",
  editar: "Editar",
  excluir: "Excluir",
  aprovar: "Aprovar",
  exportar: "Exportar",
  importar: "Importar",
  solicitar_revisao: "Solicitar revisão",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  master: "Master",
  gestor_acessos: "Gestor de Acessos",
  engenheiro: "Engenheiro",
  mestre: "Mestre de Obras",
  visualizador: "Visualizador",
};

const resourceEnum = z.enum([
  "obras",
  "rdos",
  "usuarios",
  "relatorios",
  "equipamentos",
  "mao_de_obra",
  "ocorrencias",
  "convites",
  "empresa",
  "permissoes",
  "templates_tarefas",
  "listas_tarefas",
]);
const actionEnum = z.enum(["ver", "criar", "editar", "excluir", "aprovar", "exportar", "importar", "solicitar_revisao"]);
const roleEnum = z.enum(["admin", "master", "gestor_acessos", "engenheiro", "mestre", "visualizador"]);

async function getEmpresaId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase.from("profiles").select("empresa_id").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!data?.empresa_id) throw new Error("Empresa não encontrada");
  return data.empresa_id as string;
}

async function assertCanEditPerms(supabase: any, userId: string) {
  await exigirPermissao(supabase, userId, "permissoes", "editar");
}

// ============== Minhas permissões (para o cliente) ==============
export const minhasPermissoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const empresaId = await getEmpresaId(supabase, userId);

    const [rolesRes, defaultsRes, overridesRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).eq("empresa_id", empresaId),
      supabase.from("role_permissions").select("role,resource,action,allowed").eq("empresa_id", empresaId),
      supabase
        .from("user_permission_overrides")
        .select("resource,action,allowed")
        .eq("user_id", userId)
        .eq("empresa_id", empresaId),
    ]);
    if (rolesRes.error) throw rolesRes.error;
    if (defaultsRes.error) throw defaultsRes.error;
    if (overridesRes.error) throw overridesRes.error;

    const myRoles = new Set((rolesRes.data ?? []).map((r: any) => r.role as AppRole));
    const allowed = new Set<string>();
    for (const row of defaultsRes.data ?? []) {
      if (!row.allowed) continue;
      if (myRoles.has(row.role as AppRole)) allowed.add(`${row.resource}.${row.action}`);
    }
    for (const ov of overridesRes.data ?? []) {
      const key = `${ov.resource}.${ov.action}`;
      if (ov.allowed) allowed.add(key);
      else allowed.delete(key);
    }
    return {
      empresa_id: empresaId,
      roles: Array.from(myRoles),
      permissions: Array.from(allowed),
    };
  });

// ============== Matriz completa (para a tela de admin) ==============
export const listarMatrizPermissoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const empresaId = await getEmpresaId(supabase, userId);
    await assertCanEditPerms(supabase, userId);

    const [defaultsRes, overridesRes, usuariosRes] = await Promise.all([
      supabase.from("role_permissions").select("role,resource,action,allowed").eq("empresa_id", empresaId),
      supabase
        .from("user_permission_overrides")
        .select("user_id,resource,action,allowed")
        .eq("empresa_id", empresaId),
      supabase.from("profiles").select("id,nome,email").eq("empresa_id", empresaId).order("nome"),
    ]);
    if (defaultsRes.error) throw defaultsRes.error;
    if (overridesRes.error) throw overridesRes.error;
    if (usuariosRes.error) throw usuariosRes.error;

    const rolesRes = await supabase
      .from("user_roles")
      .select("user_id,role")
      .eq("empresa_id", empresaId);
    if (rolesRes.error) throw rolesRes.error;

    const rolesByUser = new Map<string, AppRole[]>();
    for (const r of rolesRes.data ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesByUser.set(r.user_id, arr);
    }

    return {
      empresa_id: empresaId,
      defaults: defaultsRes.data ?? [],
      overrides: overridesRes.data ?? [],
      usuarios: (usuariosRes.data ?? []).map((u: any) => ({
        ...u,
        roles: rolesByUser.get(u.id) ?? [],
      })),
    };
  });

// ============== Atualizar permissão por papel ==============
export const atualizarPermissaoPapel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { role: AppRole; resource: AppResource; action: AppAction; allowed: boolean }) =>
    z
      .object({ role: roleEnum, resource: resourceEnum, action: actionEnum, allowed: z.boolean() })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const empresaId = await getEmpresaId(supabase, userId);
    await assertCanEditPerms(supabase, userId);

    const { error } = await supabase.from("role_permissions").upsert(
      { empresa_id: empresaId, role: data.role, resource: data.resource, action: data.action, allowed: data.allowed },
      { onConflict: "empresa_id,role,resource,action" },
    );
    if (error) throw error;
    return { ok: true };
  });

// ============== Override por usuário ==============
export const atualizarOverrideUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; resource: AppResource; action: AppAction; allowed: boolean | null }) =>
    z
      .object({
        user_id: z.string().uuid(),
        resource: resourceEnum,
        action: actionEnum,
        allowed: z.boolean().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const empresaId = await getEmpresaId(supabase, userId);
    await assertCanEditPerms(supabase, userId);

    if (data.allowed === null) {
      const { error } = await supabase
        .from("user_permission_overrides")
        .delete()
        .eq("empresa_id", empresaId)
        .eq("user_id", data.user_id)
        .eq("resource", data.resource)
        .eq("action", data.action);
      if (error) throw error;
      return { ok: true, cleared: true };
    }
    const { error } = await supabase.from("user_permission_overrides").upsert(
      {
        empresa_id: empresaId,
        user_id: data.user_id,
        resource: data.resource,
        action: data.action,
        allowed: data.allowed,
      },
      { onConflict: "empresa_id,user_id,resource,action" },
    );
    if (error) throw error;
    return { ok: true };
  });

// ============== Reset overrides de um usuário ==============
export const resetarOverridesUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const empresaId = await getEmpresaId(supabase, userId);
    await assertCanEditPerms(supabase, userId);
    const { error } = await supabase
      .from("user_permission_overrides")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("user_id", data.user_id);
    if (error) throw error;
    return { ok: true };
  });

// ============== Auditoria de alterações ==============
export const listarAuditoriaPermissoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const empresaId = await getEmpresaId(supabase, userId);
    await assertCanEditPerms(supabase, userId);
    const { data, error } = await supabase
      .from("audit_logs_usuarios")
      .select("id,acao,detalhes,autor_id,alvo_user_id,created_at")
      .eq("empresa_id", empresaId)
      .like("acao", "permissao_%")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw error;

    const ids = new Set<string>();
    for (const r of data ?? []) {
      if (r.autor_id) ids.add(r.autor_id);
      if (r.alvo_user_id) ids.add(r.alvo_user_id);
    }
    let nomes = new Map<string, { nome: string; email: string }>();
    if (ids.size > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,nome,email")
        .in("id", Array.from(ids));
      for (const p of profs ?? []) nomes.set(p.id, { nome: p.nome, email: p.email });
    }
    return (data ?? []).map((r: any) => ({
      ...r,
      autor: r.autor_id ? nomes.get(r.autor_id) ?? null : null,
      alvo: r.alvo_user_id ? nomes.get(r.alvo_user_id) ?? null : null,
    }));
  });
