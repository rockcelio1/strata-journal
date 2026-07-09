// IP rate limit helper para uso EXCLUSIVO no servidor (server routes/serverFn),
// pois usa supabaseAdmin (service_role) para invocar public.check_ip_rate_limit.
// Não importar deste arquivo no bundle do cliente.

import { createHash } from "crypto";

const SALT = process.env.RATE_LIMIT_IP_SALT ?? "rdo-rate-limit-v1";

/**
 * Extrai o IP do cliente com preferência para cabeçalhos de proxy conhecidos.
 * Retorna string vazia se não for possível determinar.
 */
export function getClientIp(request: Request): string {
  const h = request.headers;
  const candidates = [
    h.get("cf-connecting-ip"),
    h.get("x-real-ip"),
    (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim(),
    h.get("fly-client-ip"),
  ];
  for (const c of candidates) {
    if (c && c.length > 0) return c;
  }
  return "";
}

/** SHA-256(ip + salt) — nunca persistimos IP em claro. */
export function hashIp(ip: string): string {
  if (!ip) return "";
  return createHash("sha256").update(`${ip}::${SALT}`).digest("hex");
}

export class IpRateLimitError extends Error {
  status = 429;
  code = "IP_RATE_LIMITED";
  resetAt?: string;
  limit?: number;
  current?: number;
  constructor(msg: string, extra?: { resetAt?: string; limit?: number; current?: number }) {
    super(msg);
    this.resetAt = extra?.resetAt;
    this.limit = extra?.limit;
    this.current = extra?.current;
  }
}

/**
 * Consome 1 crédito da janela IP+rota. Fail-open com log se a RPC falhar
 * (rate limit é defesa em profundidade). Lança IpRateLimitError se estourar.
 */
export async function checkIpRateLimit(
  request: Request,
  route: string,
  maxRequests = 30,
  windowSeconds = 60,
): Promise<{ current: number; limit: number; resetAt: string }> {
  const ip = getClientIp(request);
  const ipHash = hashIp(ip);
  if (!ipHash) {
    // Sem IP identificável — não bloqueia, apenas loga.
    console.warn("[ip-rate-limit] no client ip; skipping", { route });
    return { current: 0, limit: maxRequests, resetAt: new Date().toISOString() };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("check_ip_rate_limit" as any, {
    _ip_hash: ipHash,
    _route: route,
    _max_requests: maxRequests,
    _window_seconds: windowSeconds,
  });
  if (error) {
    console.warn("[ip-rate-limit] rpc error", { route, message: error.message });
    return { current: 0, limit: maxRequests, resetAt: new Date().toISOString() };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { current: 0, limit: maxRequests, resetAt: new Date().toISOString() };
  if (!row.allowed) {
    throw new IpRateLimitError(
      "Muitas requisições deste IP. Tente novamente em instantes.",
      { resetAt: row.reset_at, limit: row.limit_value, current: row.current_count },
    );
  }
  return { current: row.current_count, limit: row.limit_value, resetAt: row.reset_at };
}

/** Constrói a Response 429 padronizada a partir do IpRateLimitError. */
export function rateLimitResponse(err: IpRateLimitError): Response {
  const retryAfter = err.resetAt
    ? Math.max(1, Math.ceil((new Date(err.resetAt).getTime() - Date.now()) / 1000))
    : 30;
  return new Response(
    JSON.stringify({ error: err.code, message: err.message, resetAt: err.resetAt }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(retryAfter),
        "x-ratelimit-limit": String(err.limit ?? ""),
        "x-ratelimit-current": String(err.current ?? ""),
      },
    },
  );
}
