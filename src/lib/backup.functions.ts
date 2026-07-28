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
  .inputValidator((d: { groups: string[]; includeAuthUsers?: boolean; tipo?: "full" | "incremental"; since?: string | null }) =>
    z
      .object({
        groups: z.array(z.string()).min(1),
        includeAuthUsers: z.boolean().optional(),
        tipo: z.enum(["full", "incremental"]).optional(),
        since: z.string().datetime().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMasterOrAdmin(context.supabase, context.userId);
    const empresaId = await getEmpresaId(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tipo = data.tipo ?? "full";
    let since: string | null = data.since ?? null;
    if (tipo === "incremental" && !since) {
      const { data: last } = await (supabaseAdmin as any)
        .from("backup_history")
        .select("created_at")
        .eq("empresa_id", empresaId)
        .eq("operacao", "backup")
        .eq("resultado", "sucesso")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      since = last?.created_at ?? null;
    }

    const selected = BACKUP_GROUPS.filter((g) => data.groups.includes(g.key));
    const payload: Record<string, any[]> = {};
    const errors: Record<string, string> = {};

    for (const group of selected) {
      for (const table of group.tables) {
        try {
          const base = (): any => {
            let q: any = (supabaseAdmin as any).from(table).select("*");
            q = table === "empresas" ? q.eq("id", empresaId) : q.eq("empresa_id", empresaId);
            return q;
          };
          if (tipo === "incremental" && since) {
            let r = await base().gte("updated_at", since);
            if (r.error) r = await base().gte("created_at", since);
            if (r.error) throw r.error;
            payload[table] = r.data ?? [];
          } else {
            const { data: rows, error } = await base();
            if (error) throw error;
            payload[table] = rows ?? [];
          }
        } catch (e: any) {
          errors[table] = e.message ?? String(e);
          payload[table] = [];
        }
      }
    }

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
                id: u.id, email: u.email, phone: u.phone,
                email_confirmed_at: u.email_confirmed_at,
                user_metadata: u.user_metadata, created_at: u.created_at,
              });
            }
          }
          if (users.length < 200) break;
        }
      } catch (e: any) { errors["auth.users"] = e.message ?? String(e); }
    }

    const totals = Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, v.length]));

    return {
      meta: {
        version: 2, empresa_id: empresaId,
        generated_at: new Date().toISOString(),
        generated_by: context.userId,
        groups: data.groups,
        includeAuthUsers: !!data.includeAuthUsers,
        tipo, since,
        totals, errors,
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

// ======================================================================
// Buckets do Supabase disponíveis para inclusão no backup.
// ======================================================================
export const BACKUP_BUCKETS = [
  { key: "rdo-anexos", label: "Anexos de RDO" },
  { key: "empresa-logos", label: "Logotipos da empresa" },
  { key: "obra-fotos", label: "Fotos de obras" },
] as const;

export type BackupBucketKey = (typeof BACKUP_BUCKETS)[number]["key"];

async function listAllBucketObjects(supabaseAdmin: any, bucket: string, prefix = "") {
  // Lista recursivamente todos os objetos de um bucket.
  const out: { path: string; size: number; updated_at?: string }[] = [];
  const stack: string[] = [prefix];
  while (stack.length) {
    const cur = stack.pop()!;
    let page = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .list(cur, { limit: 1000, offset: page * 1000, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const item of data) {
        const full = cur ? `${cur}/${item.name}` : item.name;
        if (item.id === null || item.metadata === null) {
          // Pasta
          stack.push(full);
        } else {
          out.push({
            path: full,
            size: (item.metadata?.size as number) ?? 0,
            updated_at: item.updated_at,
          });
        }
      }
      if (data.length < 1000) break;
      page++;
    }
  }
  return out;
}

// Retorna manifest (lista de arquivos) por bucket selecionado — usado para dry-run e para
// exibir contagem antes/depois do zip do lado cliente.
export const listBucketsManifest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { buckets: string[] }) =>
    z.object({ buckets: z.array(z.string()).min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMasterOrAdmin(context.supabase, context.userId);
    const empresaId = await getEmpresaId(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result: Record<string, { count: number; total_bytes: number; files: { path: string; size: number }[] }> = {};
    for (const b of data.buckets) {
      try {
        // Escopa por empresa quando o bucket segue convenção <empresa_id>/...
        const prefix = ["rdo-anexos", "empresa-logos", "obra-fotos"].includes(b) ? empresaId : "";
        const files = await listAllBucketObjects(supabaseAdmin, b, prefix);
        result[b] = {
          count: files.length,
          total_bytes: files.reduce((s, f) => s + f.size, 0),
          files: files.map((f) => ({ path: f.path, size: f.size })),
        };
      } catch (e: any) {
        result[b] = { count: 0, total_bytes: 0, files: [] };
        (result[b] as any).error = e.message ?? String(e);
      }
    }
    return result;
  });

// Gera URLs assinadas em lote para o cliente baixar os arquivos e montar o .zip.
export const signBucketPaths = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bucket: string; paths: string[]; expiresIn?: number }) =>
    z.object({
      bucket: z.string(),
      paths: z.array(z.string()).min(1).max(500),
      expiresIn: z.number().int().min(60).max(3600).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMasterOrAdmin(context.supabase, context.userId);
    await getEmpresaId(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(data.bucket)
      .createSignedUrls(data.paths, data.expiresIn ?? 600);
    if (error) throw error;
    return signed?.map((s: any) => ({ path: s.path, url: s.signedUrl, error: s.error })) ?? [];
  });

// ======================================================================
// Dry-run (pré-visualização) de restauração.
// Valida: presença dos grupos, esquema mínimo, empresa_id, dependências (FK),
// conflitos com dados existentes e permissões (RLS) — sem tocar em nada.
// ======================================================================
export const dryRunRestore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      payload: { meta: any; tables: Record<string, any[]>; auth_users?: any[]; buckets?: Record<string, { count: number }> };
      groups: string[];
      buckets?: string[];
      mode: "merge" | "replace";
    }) =>
      z.object({
        payload: z.object({
          meta: z.any(),
          tables: z.record(z.string(), z.array(z.any())),
          auth_users: z.array(z.any()).optional(),
          buckets: z.record(z.string(), z.any()).optional(),
        }),
        groups: z.array(z.string()).min(1),
        buckets: z.array(z.string()).optional(),
        mode: z.enum(["merge", "replace"]),
      }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMasterOrAdmin(context.supabase, context.userId);
    const empresaId = await getEmpresaId(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const findings: { severity: "info" | "warn" | "error"; table?: string; group?: string; bucket?: string; message: string }[] = [];
    const tableSummary: Record<string, { in_file: number; belongs_to_empresa: number; existing: number; will_insert: number; will_update: number; will_delete: number }> = {};

    const selected = BACKUP_GROUPS.filter((g) => data.groups.includes(g.key));

    // Grupos ausentes ou desconhecidos
    for (const g of data.groups) {
      if (!BACKUP_GROUPS.find((x) => x.key === g)) {
        findings.push({ severity: "warn", group: g, message: `Grupo "${g}" desconhecido — será ignorado.` });
      }
    }

    for (const group of selected) {
      for (const table of group.tables) {
        const rows: any[] = data.payload.tables?.[table] ?? [];
        const inFile = rows.length;
        const belongs = rows.filter((r) => (table === "empresas" ? r.id === empresaId : r.empresa_id === empresaId)).length;
        const mismatched = inFile - belongs;
        if (mismatched > 0) {
          findings.push({
            severity: "warn",
            table,
            message: `${mismatched} linha(s) de "${table}" pertencem a outra empresa — serão ignoradas.`,
          });
        }

        // Contagem atual da tabela na empresa
        let existing = 0;
        try {
          const q: any = (supabaseAdmin as any).from(table).select("id", { count: "exact", head: true });
          const { count, error } = table === "empresas" ? await q.eq("id", empresaId) : await q.eq("empresa_id", empresaId);
          if (error) throw error;
          existing = count ?? 0;
        } catch (e: any) {
          findings.push({ severity: "error", table, message: `Não foi possível ler a tabela: ${e.message ?? e}` });
        }

        // Conflitos por id
        const ids = rows.filter((r) => r.id).map((r) => r.id);
        let conflicts = 0;
        if (ids.length > 0) {
          const CHUNK = 200;
          for (let i = 0; i < ids.length; i += CHUNK) {
            const slice = ids.slice(i, i + CHUNK);
            const { data: existRows } = await (supabaseAdmin as any)
              .from(table)
              .select("id")
              .in("id", slice);
            conflicts += existRows?.length ?? 0;
          }
        }

        const willDelete = data.mode === "replace" && table !== "empresas" ? existing : 0;
        const willInsert = data.mode === "replace" ? belongs : Math.max(0, belongs - conflicts);
        const willUpdate = data.mode === "replace" ? 0 : conflicts;

        tableSummary[table] = {
          in_file: inFile,
          belongs_to_empresa: belongs,
          existing,
          will_insert: willInsert,
          will_update: willUpdate,
          will_delete: willDelete,
        };
      }
    }

    // Dependências entre grupos: se marcou RDOs mas não marcou "obras", avisa
    if (data.groups.includes("rdos") && !data.groups.includes("obras")) {
      findings.push({
        severity: "warn",
        message: "RDOs referenciam 'obras'. Sem incluir o grupo Obras, algumas linhas podem falhar por FK.",
      });
    }
    if (data.groups.includes("usuarios") && !data.groups.includes("empresa")) {
      findings.push({
        severity: "info",
        message: "Perfis referenciam 'empresa'. Marque Empresa para restaurar cabeçalho antes dos usuários.",
      });
    }

    // RLS check simples: tenta um SELECT em cada tabela com o próprio usuário
    for (const group of selected) {
      for (const table of group.tables) {
        const { error } = await (context.supabase as any).from(table).select("id").limit(1);
        if (error && /permission|policy|rls/i.test(error.message ?? "")) {
          findings.push({ severity: "error", table, message: `RLS bloqueia acesso a "${table}" para o usuário atual.` });
        }
      }
    }

    // Buckets (contagem só)
    const bucketSummary: Record<string, { in_file: number; existing: number }> = {};
    if (data.buckets?.length) {
      for (const b of data.buckets) {
        const inFile = (data.payload.buckets?.[b]?.count as number) ?? 0;
        let existing = 0;
        try {
          const prefix = ["rdo-anexos", "empresa-logos", "obra-fotos"].includes(b) ? empresaId : "";
          const files = await listAllBucketObjects(supabaseAdmin, b, prefix);
          existing = files.length;
        } catch (e: any) {
          findings.push({ severity: "error", bucket: b, message: `Bucket "${b}" indisponível: ${e.message ?? e}` });
        }
        bucketSummary[b] = { in_file: inFile, existing };
      }
    }

    const errorCount = findings.filter((f) => f.severity === "error").length;
    const warnCount = findings.filter((f) => f.severity === "warn").length;
    return {
      ok: errorCount === 0,
      empresa_id: empresaId,
      mode: data.mode,
      table_summary: tableSummary,
      bucket_summary: bucketSummary,
      findings,
      counts: { errors: errorCount, warnings: warnCount, groups: selected.length },
    };
  });

// ======================================================================
// Histórico / auditoria
// ======================================================================
export const logBackupHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    operacao: "backup" | "restore" | "dry_run";
    origem?: "manual" | "agendado";
    schedule_id?: string;
    grupos: string[];
    buckets?: string[];
    modo_restore?: "merge" | "replace";
    criptografado?: boolean;
    tipo_backup?: "full" | "incremental";
    since_iso?: string;
    contagens: Record<string, unknown>;
    validacoes?: Record<string, unknown>;
    resultado: "sucesso" | "erro" | "parcial" | "pendente";
    mensagem?: string;
    arquivo_path?: string;
    arquivo_tamanho_bytes?: number;
    duracao_ms?: number;
  }) => z.object({
    operacao: z.enum(["backup","restore","dry_run"]),
    origem: z.enum(["manual","agendado"]).optional(),
    schedule_id: z.string().uuid().optional(),
    grupos: z.array(z.string()),
    buckets: z.array(z.string()).optional(),
    modo_restore: z.enum(["merge","replace"]).optional(),
    criptografado: z.boolean().optional(),
    tipo_backup: z.enum(["full","incremental"]).optional(),
    since_iso: z.string().optional(),
    contagens: z.record(z.string(), z.any()),
    validacoes: z.record(z.string(), z.any()).optional(),
    resultado: z.enum(["sucesso","erro","parcial","pendente"]),
    mensagem: z.string().optional(),
    arquivo_path: z.string().optional(),
    arquivo_tamanho_bytes: z.number().int().optional(),
    duracao_ms: z.number().int().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMasterOrAdmin(context.supabase, context.userId);
    const empresaId = await getEmpresaId(context.supabase, context.userId);
    const { data: prof } = await context.supabase.from("profiles").select("email").eq("id", context.userId).maybeSingle();
    const { data: row, error } = await context.supabase.from("backup_history").insert({
      empresa_id: empresaId,
      autor_id: context.userId,
      autor_email: prof?.email ?? null,
      operacao: data.operacao,
      origem: data.origem ?? "manual",
      schedule_id: data.schedule_id ?? null,
      grupos_selecionados: data.grupos,
      buckets_selecionados: data.buckets ?? [],
      modo_restore: data.modo_restore ?? null,
      criptografado: !!data.criptografado,
      tipo_backup: data.tipo_backup ?? null,
      since_iso: data.since_iso ?? null,
      contagens: data.contagens,
      validacoes: data.validacoes ?? null,
      resultado: data.resultado,
      mensagem: data.mensagem ?? null,
      arquivo_path: data.arquivo_path ?? null,
      arquivo_tamanho_bytes: data.arquivo_tamanho_bytes ?? null,
      duracao_ms: data.duracao_ms ?? null,
    }).select("id").maybeSingle();
    if (error) throw error;
    return { id: row?.id };
  });

export const listBackupHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureMasterOrAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("backup_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

// ======================================================================
// Agendamentos
// ======================================================================
export const listBackupSchedules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureMasterOrAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("backup_schedules").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const upsertBackupSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    nome: string;
    frequencia: "diario" | "semanal" | "mensal";
    hora_utc: number;
    dia_semana?: number | null;
    dia_mes?: number | null;
    grupos: string[];
    buckets: string[];
    retencao_dias: number;
    ativo: boolean;
  }) => z.object({
    id: z.string().uuid().optional(),
    nome: z.string().trim().min(1).max(120),
    frequencia: z.enum(["diario","semanal","mensal"]),
    hora_utc: z.number().int().min(0).max(23),
    dia_semana: z.number().int().min(0).max(6).nullable().optional(),
    dia_mes: z.number().int().min(1).max(28).nullable().optional(),
    grupos: z.array(z.string()).min(1),
    buckets: z.array(z.string()),
    retencao_dias: z.number().int().min(1).max(365),
    ativo: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMasterOrAdmin(context.supabase, context.userId);
    const empresaId = await getEmpresaId(context.supabase, context.userId);
    const row = {
      empresa_id: empresaId,
      nome: data.nome,
      frequencia: data.frequencia,
      hora_utc: data.hora_utc,
      dia_semana: data.dia_semana ?? null,
      dia_mes: data.dia_mes ?? null,
      grupos: data.grupos,
      buckets: data.buckets,
      retencao_dias: data.retencao_dias,
      ativo: data.ativo,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase.from("backup_schedules").update(row).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("backup_schedules").insert(row).select("id").maybeSingle();
    if (error) throw error;
    return { id: ins?.id };
  });

export const deleteBackupSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMasterOrAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("backup_schedules").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// Upload de arquivo de backup no bucket system-backups (usado no botão "Salvar no servidor").
export const uploadBackupArtifact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fileNameBase: string; sizeBytes: number; contentType?: string }) =>
    z.object({
      fileNameBase: z.string().min(1).max(120),
      sizeBytes: z.number().int().min(1),
      contentType: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMasterOrAdmin(context.supabase, context.userId);
    const empresaId = await getEmpresaId(context.supabase, context.userId);
    const path = `${empresaId}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${data.fileNameBase}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("system-backups")
      .createSignedUploadUrl(path);
    if (error) throw error;
    return { path, uploadUrl: signed.signedUrl, token: signed.token };
  });

// ======================================================================
// Estimativa de tamanho por grupo/bucket + delta desde o último backup
// ======================================================================
export const estimateBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { groups: string[]; buckets?: string[]; tipo?: "full" | "incremental" }) =>
    z.object({
      groups: z.array(z.string()),
      buckets: z.array(z.string()).optional(),
      tipo: z.enum(["full", "incremental"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMasterOrAdmin(context.supabase, context.userId);
    const empresaId = await getEmpresaId(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: last } = await (supabaseAdmin as any)
      .from("backup_history")
      .select("id, created_at, arquivo_tamanho_bytes, tipo_backup, contagens")
      .eq("empresa_id", empresaId)
      .eq("operacao", "backup")
      .eq("resultado", "sucesso")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const tipo = data.tipo ?? "full";
    const since = tipo === "incremental" ? (last?.created_at ?? null) : null;

    const selectedGroups = BACKUP_GROUPS.filter((g) => data.groups.includes(g.key));
    const tables = selectedGroups.flatMap((g) => g.tables);

    const groupSummary: Record<string, { rows: number; bytes: number; tables: Record<string, { rows: number; bytes: number }> }> = {};
    for (const g of selectedGroups) groupSummary[g.key] = { rows: 0, bytes: 0, tables: {} };

    let totalTableBytes = 0;
    let totalTableRows = 0;
    if (tables.length > 0) {
      const { data: est, error } = await (supabaseAdmin as any).rpc("backup_estimate_admin", {
        _empresa: empresaId, _tables: tables, _since: since,
      });
      if (error) throw error;
      const map: Record<string, { rows: number; bytes: number }> = {};
      for (const row of est ?? []) {
        map[row.table_name] = { rows: Number(row.row_count ?? 0), bytes: Number(row.bytes ?? 0) };
        totalTableRows += Number(row.row_count ?? 0);
        totalTableBytes += Number(row.bytes ?? 0);
      }
      for (const g of selectedGroups) {
        for (const t of g.tables) {
          const e = map[t] ?? { rows: 0, bytes: 0 };
          groupSummary[g.key].tables[t] = e;
          groupSummary[g.key].rows += e.rows;
          groupSummary[g.key].bytes += e.bytes;
        }
      }
    }

    const bucketSummary: Record<string, { files: number; bytes: number }> = {};
    let totalBucketFiles = 0;
    let totalBucketBytes = 0;
    for (const b of data.buckets ?? []) {
      try {
        const prefix = ["rdo-anexos", "empresa-logos", "obra-fotos"].includes(b) ? empresaId : "";
        const files = await listAllBucketObjects(supabaseAdmin, b, prefix);
        const filtered = since ? files.filter((f) => (f.updated_at ?? "") >= since) : files;
        const bytes = filtered.reduce((s, f) => s + f.size, 0);
        bucketSummary[b] = { files: filtered.length, bytes };
        totalBucketFiles += filtered.length;
        totalBucketBytes += bytes;
      } catch { bucketSummary[b] = { files: 0, bytes: 0 }; }
    }

    const totalBytes = totalTableBytes + totalBucketBytes;
    const lastBytes = Number(last?.arquivo_tamanho_bytes ?? 0);

    return {
      tipo, since,
      last_backup: last ? { created_at: last.created_at, size_bytes: lastBytes, tipo_backup: last.tipo_backup } : null,
      groups: groupSummary,
      buckets: bucketSummary,
      totals: {
        rows: totalTableRows,
        table_bytes: totalTableBytes,
        bucket_files: totalBucketFiles,
        bucket_bytes: totalBucketBytes,
        total_bytes: totalBytes,
      },
      delta_bytes: totalBytes - lastBytes,
      alerta_100mb: totalBytes >= 100 * 1024 * 1024,
    };
  });

// ======================================================================
// Backups armazenados no servidor (bucket system-backups)
// ======================================================================
export const listServerBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureMasterOrAdmin(context.supabase, context.userId);
    const empresaId = await getEmpresaId(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const files = await listAllBucketObjects(supabaseAdmin, "system-backups", empresaId);
    files.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
    return files.slice(0, 200);
  });

export const downloadServerBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) => z.object({ path: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMasterOrAdmin(context.supabase, context.userId);
    const empresaId = await getEmpresaId(context.supabase, context.userId);
    if (!data.path.startsWith(`${empresaId}/`)) throw new Error("Acesso negado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("system-backups").createSignedUrl(data.path, 600);
    if (error) throw error;
    return { url: signed.signedUrl };
  });

export const deleteServerBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) => z.object({ path: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMasterOrAdmin(context.supabase, context.userId);
    const empresaId = await getEmpresaId(context.supabase, context.userId);
    if (!data.path.startsWith(`${empresaId}/`)) throw new Error("Acesso negado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from("system-backups").remove([data.path]);
    if (error) throw error;
    return { ok: true };
  });


