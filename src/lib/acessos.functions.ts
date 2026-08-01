import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PermScope = "proprio" | "equipe" | "empresa" | "global";

export const SCOPES: PermScope[] = ["proprio", "equipe", "empresa", "global"];

export const SCOPE_LABELS: Record<PermScope, string> = {
  proprio: "Só o que ele criou",
  equipe: "Da equipe / obras dele",
  empresa: "De toda a empresa",
  global: "De todas as empresas",
};

export const SCOPE_HINTS: Record<PermScope, string> = {
  proprio: "Enxerga apenas os registros que ele mesmo lançou.",
  equipe: "Enxerga os registros das obras e grupos em que participa.",
  empresa: "Enxerga tudo dentro da empresa dele.",
  global: "Enxerga dados de todas as empresas (use com muito cuidado).",
};

export const ACAO_LABELS: Record<string, string> = {
  ver: "Ver",
  criar: "Criar",
  editar: "Editar",
  excluir: "Excluir",
  aprovar: "Aprovar",
  exportar: "Exportar",
  importar: "Importar",
  solicitar_revisao: "Solicitar revisão",
  atribuir: "Atribuir",
  comentar: "Comentar",
  encerrar: "Encerrar",
};

export function acaoLabel(a: string) {
  return ACAO_LABELS[a] ?? a;
}

const scopeEnum = z.enum(["proprio", "equipe", "empresa", "global"]);
const roleEnum = z.enum(["admin", "master", "gestor_acessos", "engenheiro", "mestre", "visualizador"]);

async function getEmpresaId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase.from("profiles").select("empresa_id").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!data?.empresa_id) throw new Error("Empresa não encontrada");
  return data.empresa_id as string;
}

async function assertPode(supabase: any, userId: string, acao: "ver" | "editar") {
  const { exigirPermissao } = await import("@/lib/security/permissao.server");
  await exigirPermissao(supabase, userId, "admin.permissoes", acao);
}

// ===================== Meus acessos (cliente) =====================
export const meusAcessos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const empresaId = await getEmpresaId(supabase, userId);

    const [acessosRes, rolesRes, escoposRes] = await Promise.all([
      supabase.rpc("meus_acessos"),
      supabase.from("user_roles").select("role").eq("user_id", userId).eq("empresa_id", empresaId),
      supabase
        .from("perm_user_scopes")
        .select("escopo_tipo,escopo_id,escopo_key")
        .eq("user_id", userId)
        .eq("empresa_id", empresaId),
    ]);
    if (acessosRes.error) throw acessosRes.error;
    if (rolesRes.error) throw rolesRes.error;
    if (escoposRes.error) throw escoposRes.error;

    return {
      empresa_id: empresaId,
      roles: (rolesRes.data ?? []).map((r: any) => r.role as string),
      acessos: (acessosRes.data ?? []) as Array<{ recurso_key: string; acao: string; scope: PermScope }>,
      escopos: (escoposRes.data ?? []) as Array<{ escopo_tipo: string; escopo_id: string | null; escopo_key: string | null }>,
    };
  });

// ===================== Catálogo de módulos/recursos =====================
export const listarCatalogoAcessos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [modRes, recRes] = await Promise.all([
      supabase.from("app_modulos").select("*").order("ordem"),
      supabase.from("app_recursos").select("*").order("ordem"),
    ]);
    if (modRes.error) throw modRes.error;
    if (recRes.error) throw recRes.error;
    return { modulos: modRes.data ?? [], recursos: recRes.data ?? [] };
  });

// ===================== Matriz completa (admin) =====================
export const listarMatrizAcessos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const empresaId = await getEmpresaId(supabase, userId);
    await assertPode(supabase, userId, "ver");

    const [roleRes, userRes, scopesRes, usuariosRes, rolesRes, obrasRes, gruposRes] = await Promise.all([
      supabase.from("perm_role_grants").select("role,recurso_key,acao,allowed,scope").eq("empresa_id", empresaId),
      supabase
        .from("perm_user_grants")
        .select("user_id,recurso_key,acao,allowed,scope,motivo")
        .eq("empresa_id", empresaId),
      supabase.from("perm_user_scopes").select("user_id,escopo_tipo,escopo_id").eq("empresa_id", empresaId),
      supabase.from("profiles").select("id,nome,email,aprovado").eq("empresa_id", empresaId).order("nome"),
      supabase.from("user_roles").select("user_id,role").eq("empresa_id", empresaId),
      supabase.from("obras").select("id,nome").eq("empresa_id", empresaId).order("nome"),
      supabase.from("grupos").select("id,nome").eq("empresa_id", empresaId).order("nome"),
    ]);
    for (const r of [roleRes, userRes, scopesRes, usuariosRes, rolesRes, obrasRes, gruposRes]) {
      if (r.error) throw r.error;
    }

    const rolesByUser = new Map<string, string[]>();
    for (const r of rolesRes.data ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }

    return {
      empresa_id: empresaId,
      roleGrants: roleRes.data ?? [],
      userGrants: userRes.data ?? [],
      userScopes: scopesRes.data ?? [],
      obras: obrasRes.data ?? [],
      grupos: gruposRes.data ?? [],
      usuarios: (usuariosRes.data ?? []).map((u: any) => ({ ...u, roles: rolesByUser.get(u.id) ?? [] })),
    };
  });

// ===================== Salvar concessões por papel =====================
export const salvarGrantsPapel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        role: roleEnum,
        itens: z
          .array(
            z.object({
              recurso_key: z.string().min(1).max(120),
              acao: z.string().min(1).max(40),
              allowed: z.boolean(),
              scope: scopeEnum,
            }),
          )
          .min(1)
          .max(2000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const empresaId = await getEmpresaId(supabase, userId);
    await assertPode(supabase, userId, "editar");

    const rows = data.itens.map((i) => ({
      empresa_id: empresaId,
      role: data.role,
      recurso_key: i.recurso_key,
      acao: i.acao,
      allowed: i.allowed,
      scope: i.scope,
    }));

    const { error } = await supabase
      .from("perm_role_grants")
      .upsert(rows, { onConflict: "empresa_id,role,recurso_key,acao" });
    if (error) throw error;
    return { ok: true, total: rows.length };
  });

// ===================== Exceções por usuário =====================
export const salvarGrantUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        recurso_key: z.string().min(1).max(120),
        acao: z.string().min(1).max(40),
        allowed: z.boolean().nullable(),
        scope: scopeEnum.nullable().optional(),
        motivo: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const empresaId = await getEmpresaId(supabase, userId);
    await assertPode(supabase, userId, "editar");

    if (data.allowed === null) {
      const { error } = await supabase
        .from("perm_user_grants")
        .delete()
        .eq("empresa_id", empresaId)
        .eq("user_id", data.user_id)
        .eq("recurso_key", data.recurso_key)
        .eq("acao", data.acao);
      if (error) throw error;
      return { ok: true, removido: true };
    }

    const { error } = await supabase.from("perm_user_grants").upsert(
      {
        empresa_id: empresaId,
        user_id: data.user_id,
        recurso_key: data.recurso_key,
        acao: data.acao,
        allowed: data.allowed,
        scope: data.scope ?? null,
        motivo: data.motivo ?? null,
        created_by: userId,
      },
      { onConflict: "empresa_id,user_id,recurso_key,acao" },
    );
    if (error) throw error;
    return { ok: true };
  });

export const limparGrantsUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const empresaId = await getEmpresaId(supabase, userId);
    await assertPode(supabase, userId, "editar");
    const { error } = await supabase
      .from("perm_user_grants")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("user_id", data.user_id);
    if (error) throw error;
    return { ok: true };
  });

// ===================== Escopos (de quem) =====================
export const salvarEscoposUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        obras: z.array(z.string().uuid()).max(500),
        grupos: z.array(z.string().uuid()).max(500),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const empresaId = await getEmpresaId(supabase, userId);
    await assertPode(supabase, userId, "editar");

    const del = await supabase
      .from("perm_user_scopes")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("user_id", data.user_id)
      .in("escopo_tipo", ["obra", "grupo"]);
    if (del.error) throw del.error;

    const rows = [
      ...data.obras.map((id) => ({
        empresa_id: empresaId,
        user_id: data.user_id,
        escopo_tipo: "obra",
        escopo_id: id,
        created_by: userId,
      })),
      ...data.grupos.map((id) => ({
        empresa_id: empresaId,
        user_id: data.user_id,
        escopo_tipo: "grupo",
        escopo_id: id,
        created_by: userId,
      })),
    ];
    if (rows.length) {
      const { error } = await supabase.from("perm_user_scopes").insert(rows);
      if (error) throw error;
    }
    return { ok: true, total: rows.length };
  });

// ===================== Crescimento: novos módulos/recursos =====================
export const salvarModulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        key: z.string().regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e _").max(40),
        nome: z.string().min(1).max(80),
        descricao: z.string().max(200).optional(),
        rota: z.string().max(120).optional(),
        ordem: z.number().int().min(0).max(999).default(100),
        ativo: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertPode(supabase, userId, "editar");
    const { error } = await supabase.from("app_modulos").upsert(
      {
        key: data.key,
        nome: data.nome,
        descricao: data.descricao ?? null,
        rota: data.rota ?? null,
        ordem: data.ordem,
        ativo: data.ativo,
      },
      { onConflict: "key" },
    );
    if (error) throw error;
    return { ok: true };
  });

export const salvarRecurso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        modulo_key: z.string().min(1).max(40),
        key: z.string().regex(/^[a-z0-9_.]+$/, "Use apenas letras minúsculas, números, . e _").max(120),
        nome: z.string().min(1).max(120),
        rota: z.string().max(160).optional(),
        acoes: z.array(z.string().min(1).max(40)).min(1).max(20),
        ordem: z.number().int().min(0).max(999).default(100),
        ativo: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertPode(supabase, userId, "editar");
    const { error } = await supabase.from("app_recursos").upsert(
      {
        modulo_key: data.modulo_key,
        key: data.key,
        nome: data.nome,
        rota: data.rota ?? null,
        acoes: data.acoes,
        ordem: data.ordem,
        ativo: data.ativo,
      },
      { onConflict: "key" },
    );
    if (error) throw error;
    return { ok: true };
  });
