import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ================= AUDITORIA: falhas de carregamento de mídia =================
export const listMediaFailures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    onedrive_item_id?: string | null;
    reason?: string | null;
    from?: string | null;
    to?: string | null;
    limit?: number;
    offset?: number;
  }) =>
    z.object({
      onedrive_item_id: z.string().max(200).nullable().optional(),
      reason: z.enum(["thumb_404", "timeout", "network", "decode", "unknown"]).nullable().optional(),
      from: z.string().nullable().optional(),
      to: z.string().nullable().optional(),
      limit: z.number().int().min(1).max(500).default(100),
      offset: z.number().int().min(0).default(0),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: prof } = await context.supabase
      .from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    const empresaId = (prof as any)?.empresa_id;
    if (!empresaId) return { rows: [], count: 0 };

    let q = context.supabase
      .from("audit_logs_usuarios")
      .select("id, empresa_id, autor_id, acao, detalhes, created_at", { count: "exact" })
      .eq("empresa_id", empresaId)
      .eq("acao", "galeria_midia_falha")
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    if (data.onedrive_item_id) q = q.contains("detalhes", { onedrive_item_id: data.onedrive_item_id });
    if (data.reason) q = q.contains("detalhes", { reason: data.reason });

    const { data: rows, count, error } = await q;
    if (error) throw error;

    // Enriquecer com nome dos autores
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.autor_id).filter(Boolean)));
    const autores = new Map<string, { nome: string; email: string }>();
    if (ids.length) {
      const { data: perfis } = await context.supabase
        .from("profiles").select("id, nome, email").in("id", ids);
      for (const p of (perfis ?? []) as any[]) autores.set(p.id, { nome: p.nome, email: p.email });
    }
    return {
      rows: (rows ?? []).map((r: any) => ({ ...r, autor: r.autor_id ? autores.get(r.autor_id) ?? null : null })),
      count: count ?? 0,
    };
  });

// ================= MÉTRICAS: painel do Dashboard =================
export const getMediaMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { hours?: number }) =>
    z.object({ hours: z.number().int().min(1).max(24 * 30).default(24) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: prof } = await context.supabase
      .from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    const empresaId = (prof as any)?.empresa_id;
    if (!empresaId) {
      return { avg_ms: 0, hit_rate: 0, miss_rate: 0, by_size: [], failures_by_size: [], total_events: 0, total_failures: 0 };
    }

    const since = new Date(Date.now() - data.hours * 3600 * 1000).toISOString();

    const { data: events } = await context.supabase
      .from("media_load_events")
      .select("thumb_size, cache_status, duration_ms")
      .eq("empresa_id", empresaId)
      .gte("created_at", since)
      .limit(5000);

    const { data: failures } = await context.supabase
      .from("audit_logs_usuarios")
      .select("detalhes")
      .eq("empresa_id", empresaId)
      .eq("acao", "galeria_midia_falha")
      .gte("created_at", since)
      .limit(5000);

    const list = (events ?? []) as any[];
    const total = list.length;
    let hits = 0, misses = 0, sumMs = 0, msCount = 0;
    const bySize = new Map<string, { size: string; hits: number; misses: number; total: number; avg_ms: number; _sum: number; _n: number }>();
    for (const e of list) {
      const sz = e.thumb_size ?? "full";
      const bucket = bySize.get(sz) ?? { size: sz, hits: 0, misses: 0, total: 0, avg_ms: 0, _sum: 0, _n: 0 };
      bucket.total++;
      if (e.cache_status === "HIT") { hits++; bucket.hits++; }
      else if (e.cache_status === "MISS") { misses++; bucket.misses++; }
      if (typeof e.duration_ms === "number") { sumMs += e.duration_ms; msCount++; bucket._sum += e.duration_ms; bucket._n++; }
      bySize.set(sz, bucket);
    }
    const bySizeArr = Array.from(bySize.values()).map((b) => ({
      size: b.size,
      hits: b.hits,
      misses: b.misses,
      total: b.total,
      hit_rate: b.total ? b.hits / b.total : 0,
      avg_ms: b._n ? Math.round(b._sum / b._n) : 0,
    }));

    // Contagem de falhas por thumb_size
    const failMap = new Map<string, number>();
    for (const f of (failures ?? []) as any[]) {
      const sz = (f.detalhes && (f.detalhes.thumb_size as string | null)) ?? "full";
      failMap.set(sz, (failMap.get(sz) ?? 0) + 1);
    }
    const failuresBySize = Array.from(failMap.entries()).map(([size, count]) => ({ size, count }));

    return {
      total_events: total,
      total_failures: (failures ?? []).length,
      avg_ms: msCount ? Math.round(sumMs / msCount) : 0,
      hit_rate: total ? hits / total : 0,
      miss_rate: total ? misses / total : 0,
      by_size: bySizeArr.sort((a, b) => b.total - a.total),
      failures_by_size: failuresBySize.sort((a, b) => b.count - a.count),
    };
  });

// ================= CONFIG DE CACHE por thumb_size =================
export const listCacheSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("onedrive_cache_settings")
      .select("id, thumb_size, max_age_seconds, swr_seconds, ttl_seconds, updated_at")
      .is("empresa_id", null)
      .order("thumb_size", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const upsertCacheSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    thumb_size: "small" | "medium" | "large" | "full";
    max_age_seconds: number;
    swr_seconds: number;
    ttl_seconds: number;
  }) =>
    z.object({
      thumb_size: z.enum(["small", "medium", "large", "full"]),
      max_age_seconds: z.number().int().min(0).max(60 * 60 * 24 * 365),
      swr_seconds: z.number().int().min(0).max(60 * 60 * 24 * 365),
      ttl_seconds: z.number().int().min(0).max(60 * 60 * 24 * 365),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    // Somente admin/master (também garantido por RLS)
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isMaster } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "master" });
    if (!isAdmin && !isMaster) throw new Error("Somente administrador ou master pode alterar as configurações de cache.");

    // Upsert por (empresa_id IS NULL, thumb_size)
    const existing = await context.supabase
      .from("onedrive_cache_settings")
      .select("id")
      .is("empresa_id", null)
      .eq("thumb_size", data.thumb_size)
      .maybeSingle();

    if (existing.data?.id) {
      const { error } = await context.supabase
        .from("onedrive_cache_settings")
        .update({
          max_age_seconds: data.max_age_seconds,
          swr_seconds: data.swr_seconds,
          ttl_seconds: data.ttl_seconds,
        })
        .eq("id", existing.data.id);
      if (error) throw error;
    } else {
      const { error } = await context.supabase.from("onedrive_cache_settings").insert({
        empresa_id: null,
        thumb_size: data.thumb_size,
        max_age_seconds: data.max_age_seconds,
        swr_seconds: data.swr_seconds,
        ttl_seconds: data.ttl_seconds,
      });
      if (error) throw error;
    }
    return { ok: true };
  });
