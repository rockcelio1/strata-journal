import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Grupos de tabelas disponíveis para backup/restauração.
// Todas são escopadas por empresa_id, exceto onde indicado.
export const BACKUP_GROUPS = [
  {
    key: "obras",
    label: "Obras e vínculos",
    tables: [
      "obras",
      "obra_anexos",
      "obra_fotos",
      "obra_equipamentos_permitidos",
      "obra_funcoes_permitidas",
      "obra_listas_tarefas",
      "obra_tarefa_itens",
    ],
  },
  {
    key: "rdos",
    label: "RDOs (relatórios diários)",
    tables: [
      "rdos",
      "rdo_atividades",
      "rdo_equipamentos",
      "rdo_mao_de_obra",
      "rdo_ocorrencias",
      "rdo_anexos",
      "rdo_assinaturas",
      "rdo_signatarios_requeridos",
      "rdo_tarefa_avancos",
      "rdo_acessos",
    ],
  },
  {
    key: "cadastros",
    label: "Cadastros (equipamentos, mão de obra, ocorrências)",
    tables: ["equipamentos", "mao_de_obra", "tipos_ocorrencia"],
  },
  {
    key: "tarefas",
    label: "Templates e listas de tarefas",
    tables: ["templates_tarefas", "template_tarefa_itens", "lista_tarefas_itens"],
  },
  {
    key: "grupos",
    label: "Grupos e equipes",
    tables: ["grupos", "grupo_membros"],
  },
  {
    key: "usuarios",
    label: "Usuários, papéis e permissões",
    tables: [
      "profiles",
      "user_roles",
      "user_permission_overrides",
      "role_permissions",
      "convites",
    ],
  },
  {
    key: "empresa",
    label: "Dados da empresa (perfil, logotipo)",
    tables: ["empresas", "empresa_logo_versions"],
  },
  {
    key: "ajuda",
    label: "Central de ajuda (artigos, categorias, tutoriais)",
    tables: [
      "help_categories",
      "help_articles",
      "help_article_media",
      "help_tutorials",
      "help_tutorial_steps",
    ],
  },
  {
    key: "aparencia",
    label: "Aparência e efeitos (skeleton, botões)",
    tables: ["skeleton_loading_settings", "button_effect_settings"],
  },
] as const;

export type BackupGroupKey = (typeof BACKUP_GROUPS)[number]["key"];

async function ensureMasterOrAdmin(supabase: any, userId: string) {
  const { data: rows, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
  const roles = (rows ?? []).map((r: any) => r.role as string);
  if (!roles.includes("master") && !roles.includes("admin")) {
    throw new Error("Apenas administrador ou master pode executar backup/restauração.");
  }
}

async function getEmpresaId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase.from("profiles").select("empresa_id").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!data?.empresa_id) throw new Error("Empresa não encontrada para o usuário.");
  return data.empresa_id as string;
}

export const listBackupGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureMasterOrAdmin(context.supabase, context.userId);
    return BACKUP_GROUPS.map((g) => ({ key: g.key, label: g.label, tables: [...g.tables] }));
  });

export const exportBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { groups: string[]; includeAuthUsers?: boolean }) =>
    z
      .object({
        groups: z.array(z.string()).min(1),
        includeAuthUsers: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMasterOrAdmin(context.supabase, context.userId);
    const empresaId = await getEmpresaId(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const selected = BACKUP_GROUPS.filter((g) => data.groups.includes(g.key));
    const payload: Record<string, any[]> = {};
    const errors: Record<string, string> = {};

    for (const group of selected) {
      for (const table of group.tables) {
        try {
          let query: any = (supabaseAdmin as any).from(table).select("*");
          if (table === "empresas") {
            query = query.eq("id", empresaId);
          } else {
            // Todas as tabelas de domínio possuem empresa_id
            query = query.eq("empresa_id", empresaId);
          }
          const { data: rows, error } = await query;
          if (error) throw error;
          payload[table] = rows ?? [];
        } catch (e: any) {
          errors[table] = e.message ?? String(e);
          payload[table] = [];
        }
      }
    }

    // Usuários da autenticação (email, metadata, timestamps) — sem senhas.
    let authUsers: any[] = [];
    if (data.includeAuthUsers && data.groups.includes("usuarios")) {
      try {
        const profileIds = new Set((payload["profiles"] ?? []).map((p: any) => p.id));
        for (let page = 1; page <= 25; page++) {
          const { data: pageData, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
          if (error) throw error;
          const users = pageData?.users ?? [];
          for (const u of users) {
            if (profileIds.has(u.id)) {
              authUsers.push({
                id: u.id,
                email: u.email,
                phone: u.phone,
                email_confirmed_at: u.email_confirmed_at,
                user_metadata: u.user_metadata,
                created_at: u.created_at,
              });
            }
          }
          if (users.length < 200) break;
        }
      } catch (e: any) {
        errors["auth.users"] = e.message ?? String(e);
      }
    }

    const totals = Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, v.length]));

    return {
      meta: {
        version: 1,
        empresa_id: empresaId,
        generated_at: new Date().toISOString(),
        generated_by: context.userId,
        groups: data.groups,
        includeAuthUsers: !!data.includeAuthUsers,
        totals,
        errors,
      },
      tables: payload,
      auth_users: authUsers,
    };
  });

export const importBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      payload: { meta: any; tables: Record<string, any[]>; auth_users?: any[] };
      groups: string[];
      mode: "merge" | "replace";
      restoreAuthUsers?: boolean;
    }) =>
      z
        .object({
          payload: z.object({
            meta: z.any(),
            tables: z.record(z.string(), z.array(z.any())),
            auth_users: z.array(z.any()).optional(),
          }),
          groups: z.array(z.string()).min(1),
          mode: z.enum(["merge", "replace"]),
          restoreAuthUsers: z.boolean().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMasterOrAdmin(context.supabase, context.userId);
    const empresaId = await getEmpresaId(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const selected = BACKUP_GROUPS.filter((g) => data.groups.includes(g.key));
    const report: Record<string, { inserted: number; deleted: number; error?: string }> = {};

    // Recriar usuários auth ausentes (email/nome apenas). Senha padrão temporária: força troca.
    const createdUsers: string[] = [];
    if (data.restoreAuthUsers && data.groups.includes("usuarios") && data.payload.auth_users?.length) {
      for (const u of data.payload.auth_users) {
        try {
          if (!u.email) continue;
          const { data: exists } = await supabaseAdmin.auth.admin.getUserById(u.id).catch(() => ({ data: null }));
          if (exists?.user) continue;
          const tmpPass = `Restore@${Math.random().toString(36).slice(2, 10)}A1!`;
          const { error } = await supabaseAdmin.auth.admin.createUser({
            email: u.email,
            password: tmpPass,
            email_confirm: !!u.email_confirmed_at,
            user_metadata: u.user_metadata ?? {},
          });
          if (!error) createdUsers.push(u.email);
        } catch {
          /* segue */
        }
      }
    }

    // Aplica tabela por tabela. Em modo "replace", apaga tudo da empresa antes.
    // Ordem: respeita a ordem declarada dos grupos/tabelas (pais antes de filhos).
    for (const group of selected) {
      for (const table of group.tables) {
        const rows = (data.payload.tables?.[table] ?? []).filter((r: any) => {
          if (table === "empresas") return r.id === empresaId;
          return r.empresa_id === empresaId;
        });

        try {
          let deleted = 0;
          if (data.mode === "replace" && table !== "empresas") {
            const { count, error } = await (supabaseAdmin as any)
              .from(table)
              .delete({ count: "exact" })
              .eq("empresa_id", empresaId);
            if (error) throw error;
            deleted = count ?? 0;
          }

          let inserted = 0;
          if (rows.length > 0) {
            // Upsert em lotes de 500 por id
            const chunkSize = 500;
            for (let i = 0; i < rows.length; i += chunkSize) {
              const chunk = rows.slice(i, i + chunkSize);
              const { error } = await (supabaseAdmin as any).from(table).upsert(chunk, { onConflict: "id" });
              if (error) throw error;
              inserted += chunk.length;
            }
          }
          report[table] = { inserted, deleted };
        } catch (e: any) {
          report[table] = { inserted: 0, deleted: 0, error: e.message ?? String(e) };
        }
      }
    }

    return { ok: true, report, createdUsers };
  });
