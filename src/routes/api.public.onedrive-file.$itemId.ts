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

        const { verifyOneDriveProxyUrl } = await import("@/lib/onedrive-proxy-token.server");
        if (!itemId || !Number.isFinite(expiresAt) || !verifyOneDriveProxyUrl({ itemId, expiresAt, mimeType, sig })) {
          return new Response("Link inválido ou expirado", { status: 401 });
        }

        const apiKey = process.env.LOVABLE_API_KEY;
        const connKey = process.env.MICROSOFT_ONEDRIVE_API_KEY;
        if (!apiKey || !connKey) {
          return new Response("OneDrive não conectado", { status: 503 });
        }

        const graphUrl = `${GATEWAY_URL}/me/drive/items/${encodeURIComponent(itemId)}/content`;
        const upstream = await fetch(graphUrl, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "X-Connection-Api-Key": connKey,
          },
        });

        if (!upstream.ok) {
          const body = await upstream.text().catch(() => "");
          console.error(`[onedrive-proxy] ${upstream.status}: ${body}`);
          return new Response("Falha ao carregar anexo", { status: upstream.status });
        }

        const headers = new Headers();
        headers.set("Content-Type", upstream.headers.get("content-type") || mimeType);
        headers.set("Cache-Control", "private, max-age=3600, stale-while-revalidate=86400");
        headers.set("Content-Disposition", `inline; filename="${asciiFilename(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`);
        headers.set("X-Content-Type-Options", "nosniff");

        return new Response(upstream.body, { status: 200, headers });
      },
    },
  },
});