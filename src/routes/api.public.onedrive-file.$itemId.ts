import { createFileRoute } from "@tanstack/react-router";

const GRAPH_URL = "https://graph.microsoft.com/v1.0";

function cleanFilename(value: string | null) {
  return (value || "anexo")
    .replace(/[\r\n"]/g, "")
    .replace(/[\\/]+/g, "_")
    .slice(0, 180) || "anexo";
}

function asciiFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]+/g, "_")
    .replace(/["\\;]/g, "_") || "anexo";
}

function edgeCache(): Cache | null {
  try {
    const c = (globalThis as any).caches;
    return c && typeof c.default?.match === "function" ? (c.default as Cache) : null;
  } catch {
    return null;
  }
}

function cacheKeyFor(itemId: string, thumbSize: string | null) {
  return new Request(`https://onedrive-cache.internal/v1/${encodeURIComponent(itemId)}/${thumbSize ?? "full"}`);
}

// ---- Cache em memória para configurações de TTL/max-age por thumb_size ----
type CacheRule = { max_age_seconds: number; swr_seconds: number; ttl_seconds: number };
const DEFAULT_RULE: CacheRule = { max_age_seconds: 86400, swr_seconds: 604800, ttl_seconds: 604800 };
let RULES_CACHE: { at: number; byKey: Record<string, CacheRule> } | null = null;

async function getCacheRule(thumbSize: string | null): Promise<CacheRule> {
  const key = thumbSize ?? "full";
  const now = Date.now();
  if (RULES_CACHE && now - RULES_CACHE.at < 60_000) {
    return RULES_CACHE.byKey[key] ?? DEFAULT_RULE;
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("onedrive_cache_settings")
      .select("thumb_size, max_age_seconds, swr_seconds, ttl_seconds")
      .is("empresa_id", null);
    const byKey: Record<string, CacheRule> = {};
    for (const r of (data ?? []) as any[]) {
      byKey[r.thumb_size] = {
        max_age_seconds: r.max_age_seconds,
        swr_seconds: r.swr_seconds,
        ttl_seconds: r.ttl_seconds,
      };
    }
    RULES_CACHE = { at: now, byKey };
    return byKey[key] ?? DEFAULT_RULE;
  } catch {
    return DEFAULT_RULE;
  }
}

async function logEvent(row: {
  empresa_id: string | null;
  onedrive_item_id: string;
  thumb_size: string | null;
  cache_status: "HIT" | "MISS" | "BYPASS" | "ERROR";
  http_status: number | null;
  duration_ms: number;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("media_load_events").insert(row);
  } catch (e) {
    console.warn(`[onedrive-proxy] log event failed: ${(e as Error).message}`);
  }
}

export const Route = createFileRoute("/api/public/onedrive-file/$itemId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const t0 = Date.now();
        const url = new URL(request.url);
        const itemId = params.itemId;
        const expiresAt = Number(url.searchParams.get("exp") ?? "0");
        const mimeType = url.searchParams.get("mime") || "application/octet-stream";
        const sig = url.searchParams.get("sig") || "";
        const name = cleanFilename(url.searchParams.get("name"));
        const empresaId = url.searchParams.get("emp") || null;
        const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
        const thumbRaw = url.searchParams.get("thumb");
        const thumbSize = thumbRaw === "small" || thumbRaw === "medium" || thumbRaw === "large" ? thumbRaw : null;

        const { verifyOneDriveProxyUrl } = await import("@/lib/onedrive-proxy-token.server");
        if (!itemId || !Number.isFinite(expiresAt) || !verifyOneDriveProxyUrl({ itemId, expiresAt, mimeType, sig, empresaId })) {
          return new Response("Link inválido ou expirado", { status: 401 });
        }

        const rule = await getCacheRule(thumbSize);
        const isPdfRequest = !thumbSize && (mimeType.toLowerCase().includes("pdf") || name.toLowerCase().endsWith(".pdf"));
        const cacheControl = isPdfRequest
          ? "private, max-age=300"
          : thumbSize
            ? `public, max-age=${rule.max_age_seconds}, stale-while-revalidate=${rule.swr_seconds}`
            : `private, max-age=${Math.min(rule.max_age_seconds, 3600)}, stale-while-revalidate=${Math.min(rule.swr_seconds, 86400)}`;

        // 1) Edge cache (thumbnails)
        const cache = thumbSize ? edgeCache() : null;
        const cacheKey = thumbSize ? cacheKeyFor(itemId, thumbSize) : null;
        if (cache && cacheKey) {
          const hit = await cache.match(cacheKey).catch(() => null);
          if (hit) {
            const h = new Headers(hit.headers);
            h.set("X-Cache", "HIT");
            if (thumbSize) h.set("X-Cache-Size", thumbSize);
            void logEvent({
              empresa_id: empresaId,
              onedrive_item_id: itemId,
              thumb_size: thumbSize,
              cache_status: "HIT",
              http_status: hit.status,
              duration_ms: Date.now() - t0,
            });
            return new Response(hit.body, { status: hit.status, headers: h });
          }
        }

        let token: string | null = null;
        try {
          const { tokenOrganizacao } = await import("@/lib/onedrive-org.server");
          token = await tokenOrganizacao();
        } catch (e) {
          console.error("[onedrive-proxy] conta do sistema indisponível:", (e as Error)?.message);
        }
        if (!token) {
          void logEvent({
            empresa_id: empresaId, onedrive_item_id: itemId, thumb_size: thumbSize,
            cache_status: "ERROR", http_status: 503, duration_ms: Date.now() - t0,
          });
          return new Response("OneDrive não conectado", { status: 503 });
        }

        const encId = encodeURIComponent(itemId);
        const graphUrl = thumbSize
          ? `${GRAPH_URL}/me/drive/items/${encId}/thumbnails/0/${thumbSize}/content`
          : `${GRAPH_URL}/me/drive/items/${encId}/content`;

        const upstream = await fetch(graphUrl, { headers: { Authorization: `Bearer ${token}` } });

        if (!upstream.ok) {
          const body = await upstream.text().catch(() => "");
          console.error(`[onedrive-proxy] ${upstream.status} thumb=${thumbSize ?? "no"} item=${itemId}: ${body.slice(0, 200)}`);
          if (thumbSize && upstream.status === 404) {
            const fallback = await fetch(`${GRAPH_URL}/me/drive/items/${encId}/content`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (fallback.ok) {
              const h = new Headers();
              h.set("Content-Type", fallback.headers.get("content-type") || mimeType);
              h.set("Cache-Control", cacheControl);
              h.set("X-Cache", "MISS");
              if (thumbSize) h.set("X-Cache-Size", thumbSize);
              const bytes = await fallback.arrayBuffer();
              const resp = new Response(bytes, { status: 200, headers: h });
              if (cache && cacheKey) { try { await cache.put(cacheKey, resp.clone()); } catch {} }
              void logEvent({
                empresa_id: empresaId, onedrive_item_id: itemId, thumb_size: thumbSize,
                cache_status: "MISS", http_status: 200, duration_ms: Date.now() - t0,
              });
              return resp;
            }
          }
          void logEvent({
            empresa_id: empresaId, onedrive_item_id: itemId, thumb_size: thumbSize,
            cache_status: "ERROR", http_status: upstream.status, duration_ms: Date.now() - t0,
          });
          return new Response("Falha ao carregar anexo", { status: upstream.status });
        }

        const headers = new Headers();
        const upstreamContentType = upstream.headers.get("content-type") || mimeType;
        const isPdfResponse = isPdfRequest || upstreamContentType.toLowerCase().includes("pdf");
        headers.set("Content-Type", isPdfResponse ? "application/pdf" : upstreamContentType);
        headers.set("Cache-Control", cacheControl);
        headers.set("Content-Disposition", `${disposition}; filename="${asciiFilename(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`);
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("X-Cache", thumbSize ? "MISS" : "BYPASS");
        if (thumbSize) headers.set("X-Cache-Size", thumbSize);

        if (cache && cacheKey) {
          const bytes = await upstream.arrayBuffer();
          const resp = new Response(bytes, { status: 200, headers });
          try { await cache.put(cacheKey, resp.clone()); } catch (e) {
            console.warn(`[onedrive-proxy] cache put failed item=${itemId}: ${(e as Error).message}`);
          }
          void logEvent({
            empresa_id: empresaId, onedrive_item_id: itemId, thumb_size: thumbSize,
            cache_status: "MISS", http_status: 200, duration_ms: Date.now() - t0,
          });
          return resp;
        }

        void logEvent({
          empresa_id: empresaId, onedrive_item_id: itemId, thumb_size: thumbSize,
          cache_status: thumbSize ? "MISS" : "BYPASS", http_status: 200, duration_ms: Date.now() - t0,
        });
        return new Response(upstream.body, { status: 200, headers });
      },
    },
  },
});
