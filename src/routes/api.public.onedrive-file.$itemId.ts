import { createFileRoute } from "@tanstack/react-router";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_onedrive";

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
    // Cloudflare Workers exposes `caches.default`; dev/Node does not.
    const c = (globalThis as any).caches;
    return c && typeof c.default?.match === "function" ? (c.default as Cache) : null;
  } catch {
    return null;
  }
}

function cacheKeyFor(itemId: string, thumbSize: string | null) {
  // Stable key by (item, size). Ignore sig/exp/name so refreshed links share the cached body.
  return new Request(`https://onedrive-cache.internal/v1/${encodeURIComponent(itemId)}/${thumbSize ?? "full"}`);
}

export const Route = createFileRoute("/api/public/onedrive-file/$itemId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const url = new URL(request.url);
        const itemId = params.itemId;
        const expiresAt = Number(url.searchParams.get("exp") ?? "0");
        const mimeType = url.searchParams.get("mime") || "application/octet-stream";
        const sig = url.searchParams.get("sig") || "";
        const name = cleanFilename(url.searchParams.get("name"));
        const thumbRaw = url.searchParams.get("thumb");
        const thumbSize = thumbRaw === "small" || thumbRaw === "medium" || thumbRaw === "large" ? thumbRaw : null;

        const { verifyOneDriveProxyUrl } = await import("@/lib/onedrive-proxy-token.server");
        if (!itemId || !Number.isFinite(expiresAt) || !verifyOneDriveProxyUrl({ itemId, expiresAt, mimeType, sig })) {
          return new Response("Link inválido ou expirado", { status: 401 });
        }

        // 1) Try edge cache first (thumbnails only — full downloads carry per-user disposition).
        const cache = thumbSize ? edgeCache() : null;
        const cacheKey = thumbSize ? cacheKeyFor(itemId, thumbSize) : null;
        if (cache && cacheKey) {
          const hit = await cache.match(cacheKey).catch(() => null);
          if (hit) {
            const h = new Headers(hit.headers);
            h.set("X-Cache", "HIT");
            return new Response(hit.body, { status: hit.status, headers: h });
          }
        }

        const apiKey = process.env.LOVABLE_API_KEY;
        const connKey = process.env.MICROSOFT_ONEDRIVE_API_KEY;
        if (!apiKey || !connKey) {
          return new Response("OneDrive não conectado", { status: 503 });
        }

        const encId = encodeURIComponent(itemId);
        const graphUrl = thumbSize
          ? `${GATEWAY_URL}/me/drive/items/${encId}/thumbnails/0/${thumbSize}/content`
          : `${GATEWAY_URL}/me/drive/items/${encId}/content`;

        const upstream = await fetch(graphUrl, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "X-Connection-Api-Key": connKey,
          },
        });

        if (!upstream.ok) {
          const body = await upstream.text().catch(() => "");
          console.error(`[onedrive-proxy] ${upstream.status} thumb=${thumbSize ?? "no"} item=${itemId}: ${body.slice(0, 200)}`);
          // If thumbnail missing, fall back to full content (some items have no thumb).
          if (thumbSize && upstream.status === 404) {
            const fallback = await fetch(`${GATEWAY_URL}/me/drive/items/${encId}/content`, {
              headers: { Authorization: `Bearer ${apiKey}`, "X-Connection-Api-Key": connKey },
            });
            if (fallback.ok) {
              const h = new Headers();
              h.set("Content-Type", fallback.headers.get("content-type") || mimeType);
              h.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
              const bytes = await fallback.arrayBuffer();
              const resp = new Response(bytes, { status: 200, headers: h });
              if (cache && cacheKey) {
                try { await cache.put(cacheKey, resp.clone()); } catch {}
              }
              return resp;
            }
          }
          return new Response("Falha ao carregar anexo", { status: upstream.status });
        }

        const headers = new Headers();
        headers.set("Content-Type", upstream.headers.get("content-type") || mimeType);
        headers.set(
          "Cache-Control",
          thumbSize
            ? "public, max-age=86400, stale-while-revalidate=604800"
            : "private, max-age=3600, stale-while-revalidate=86400",
        );
        headers.set("Content-Disposition", `inline; filename="${asciiFilename(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`);
        headers.set("X-Content-Type-Options", "nosniff");

        // For cacheable thumbnails, buffer once so we can serve + put into the edge cache.
        if (cache && cacheKey) {
          const bytes = await upstream.arrayBuffer();
          const resp = new Response(bytes, { status: 200, headers });
          try { await cache.put(cacheKey, resp.clone()); } catch (e) {
            console.warn(`[onedrive-proxy] cache put failed item=${itemId}: ${(e as Error).message}`);
          }
          return resp;
        }

        return new Response(upstream.body, { status: 200, headers });
      },
    },
  },
});