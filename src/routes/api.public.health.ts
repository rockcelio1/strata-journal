import { createFileRoute } from "@tanstack/react-router";

// Health check público. NÃO retorna secrets, connection strings ou stack traces.
// Usado por monitoramento externo e status page.
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const started = Date.now();
        const services: Record<string, "ok" | "degraded" | "unknown"> = {
          app: "ok",
          database: "unknown",
          storage: "unknown",
        };
        // Ping leve ao Postgres via Data API — apenas verifica se a URL está acessível.
        try {
          const url = process.env.SUPABASE_URL;
          const key = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (url && key) {
            const res = await fetch(`${url}/rest/v1/`, {
              headers: { apikey: key, Authorization: `Bearer ${key}` },
              signal: AbortSignal.timeout(3000),
            });
            services.database = res.ok || res.status === 404 ? "ok" : "degraded";
            services.storage = res.ok || res.status === 404 ? "ok" : "degraded";
          }
        } catch {
          services.database = "degraded";
          services.storage = "degraded";
        }
        const allOk = Object.values(services).every((v) => v === "ok");
        const body = {
          status: allOk ? "ok" : "degraded",
          timestamp: new Date().toISOString(),
          version: process.env.APP_VERSION ?? "unknown",
          latency_ms: Date.now() - started,
          services,
        };
        return new Response(JSON.stringify(body), {
          status: allOk ? 200 : 503,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
