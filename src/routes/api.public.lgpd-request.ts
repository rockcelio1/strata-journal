import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  checkIpRateLimit,
  IpRateLimitError,
  rateLimitResponse,
} from "@/lib/security/ip-rate-limit.server";

const bodySchema = z.object({
  requester_nome: z.string().trim().min(2).max(120),
  requester_email: z.string().trim().email().max(255),
  request_type: z.enum(["acesso", "correcao", "exclusao", "portabilidade", "anonimizacao", "revogacao"]),
  descricao: z.string().trim().min(10).max(2000),
});

export const Route = createFileRoute("/api/public/lgpd-request")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "POST, OPTIONS",
            "access-control-allow-headers": "content-type",
          },
        }),
      POST: async ({ request }) => {
        try {
          // Rate limit: no máx. 5 solicitações por IP em 5 min.
          await checkIpRateLimit(request, "lgpd-request", 5, 300);
        } catch (err) {
          if (err instanceof IpRateLimitError) return rateLimitResponse(err);
          throw err;
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "INVALID_JSON" }, { status: 400 });
        }
        const parsed = bodySchema.safeParse(payload);
        if (!parsed.success) {
          return Response.json(
            { error: "VALIDATION_ERROR", issues: parsed.error.flatten() },
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("lgpd_requests")
          .insert({
            protocolo: "", // gerado pelo trigger
            requester_nome: parsed.data.requester_nome,
            requester_email: parsed.data.requester_email.toLowerCase(),
            request_type: parsed.data.request_type,
            descricao: parsed.data.descricao,
          } as any)
          .select("protocolo")
          .single();

        if (error) {
          console.error("[api.public.lgpd-request] insert failed", error);
          return Response.json({ error: "INTERNAL" }, { status: 500 });
        }

        return Response.json({ protocolo: (data as any)?.protocolo ?? null });
      },
    },
  },
});
