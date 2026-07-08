import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ============ LEITURA ============
export const listHelpCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("help_categories")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const listHelpArticles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        category_slug: z.string().optional(),
        featured_only: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        include_drafts: z.boolean().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("help_articles")
      .select("id, slug, title, summary, module_key, route_path, is_featured, sort_order, tags, category_id, status, updated_at, help_categories(slug, name, icon)")
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false });
    if (!data.include_drafts) q = q.eq("status", "publicado");
    if (data.featured_only) q = q.eq("is_featured", true);
    if (data.limit) q = q.limit(data.limit);
    const { data: rows, error } = await q;
    if (error) throw error;
    let out = rows ?? [];
    if (data.category_slug) {
      out = out.filter((r: any) => r.help_categories?.slug === data.category_slug);
    }
    return out;
  });

export const getHelpArticle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("help_articles")
      .select("*, help_categories(slug, name)")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Artigo não encontrado");
    return row;
  });

export const searchHelp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q: string }) => z.object({ q: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    const term = data.q.trim();
    const like = `%${term}%`;
    const { data: rows, error } = await context.supabase
      .from("help_articles")
      .select("id, slug, title, summary, module_key, route_path, tags")
      .eq("status", "publicado")
      .or(`title.ilike.${like},summary.ilike.${like},content.ilike.${like}`)
      .limit(30);
    if (error) throw error;
    // Log da busca (best-effort)
    try {
      const me = await context.supabase
        .from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
      await context.supabase.from("help_search_logs").insert({
        empresa_id: me.data?.empresa_id ?? null,
        user_id: context.userId,
        search_term: term,
        results_count: rows?.length ?? 0,
      });
    } catch { /* ignora */ }
    return rows ?? [];
  });

// ============ CHANGELOG ============
export const listChangelog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ limit: z.number().int().min(1).max(200).optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("system_changelog")
      .select("*, help_articles(slug, title)")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw error;
    return rows ?? [];
  });

// ============ TUTORIAIS ============
export const getTutorialBySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: tut, error } = await context.supabase
      .from("help_tutorials")
      .select("*, help_tutorial_steps(*)")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (error) throw error;
    return tut;
  });

export const getMyTutorialProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tutorial_id: string }) => z.object({ tutorial_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: row } = await context.supabase
      .from("help_user_progress")
      .select("*")
      .eq("user_id", context.userId)
      .eq("tutorial_id", data.tutorial_id)
      .maybeSingle();
    return row;
  });

export const saveTutorialProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tutorial_id: z.string().uuid(),
        status: z.enum(["nao_iniciado", "em_andamento", "concluido", "dispensado"]),
        do_not_show_again: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    const payload: any = {
      empresa_id: me.data?.empresa_id ?? null,
      user_id: context.userId,
      tutorial_id: data.tutorial_id,
      status: data.status,
      do_not_show_again: data.do_not_show_again ?? false,
      completed_at: data.status === "concluido" ? new Date().toISOString() : null,
      dismissed_at: data.status === "dispensado" ? new Date().toISOString() : null,
    };
    const { error } = await context.supabase
      .from("help_user_progress")
      .upsert(payload, { onConflict: "user_id,tutorial_id" });
    if (error) throw error;
    return { ok: true };
  });

// ============ FEEDBACK ============
export const submitArticleFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        article_id: z.string().uuid(),
        helpful: z.boolean(),
        comment: z.string().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    const { error } = await context.supabase.from("help_article_feedback").insert({
      empresa_id: me.data?.empresa_id ?? null,
      article_id: data.article_id,
      user_id: context.userId,
      helpful: data.helpful,
      comment: data.comment ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });

// ============ ADMIN ============
const articleSchema = z.object({
  category_id: z.string().uuid().nullable().optional(),
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().nullable().optional(),
  content: z.string().default(""),
  module_key: z.string().nullable().optional(),
  route_path: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(["rascunho", "publicado", "arquivado"]).default("rascunho"),
  is_featured: z.boolean().default(false),
  sort_order: z.number().int().default(0),
  version: z.string().nullable().optional(),
});

export const upsertHelpArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => articleSchema.extend({ id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase
        .from("help_articles")
        .update({
          ...rest,
          updated_by: context.userId,
          published_at: rest.status === "publicado" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await context.supabase.from("help_articles").insert({
        ...data,
        empresa_id: me.data?.empresa_id ?? null,
        created_by: context.userId,
        updated_by: context.userId,
        published_at: data.status === "publicado" ? new Date().toISOString() : null,
      });
      if (error) throw error;
    }
    return { ok: true };
  });

export const deleteHelpArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("help_articles").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

const changelogSchema = z.object({
  version: z.string().nullable().optional(),
  change_type: z.enum(["novo", "correcao", "melhoria", "seguranca", "integracao", "visual"]),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  how_to_use: z.string().nullable().optional(),
  module_key: z.string().nullable().optional(),
  route_path: z.string().nullable().optional(),
  help_article_id: z.string().uuid().nullable().optional(),
});

export const createChangelogEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => changelogSchema.parse(d))
  .handler(async ({ context, data }) => {
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    const { error } = await context.supabase.from("system_changelog").insert({
      ...data,
      empresa_id: me.data?.empresa_id ?? null,
      created_by: context.userId,
    });
    if (error) throw error;
    return { ok: true };
  });

export const listAllHelpArticlesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("help_articles")
      .select("id, slug, title, status, is_featured, updated_at, help_categories(slug, name)")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return data ?? [];
  });
