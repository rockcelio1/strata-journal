// Helpers para consumo das RPCs de rate limit e cota de IA.
// Usar dentro de server functions autenticadas (context.supabase),
// pois as funções SQL usam auth.uid() e SECURITY DEFINER.

import type { SupabaseClient } from "@supabase/supabase-js";

export class RateLimitError extends Error {
  status = 429;
  code = "RATE_LIMITED";
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

export class AiQuotaError extends Error {
  status = 429;
  code = "AI_QUOTA_EXCEEDED";
  used?: number;
  limit?: number;
  remaining?: number;
  constructor(msg: string, extra?: { used?: number; limit?: number; remaining?: number }) {
    super(msg);
    this.used = extra?.used;
    this.limit = extra?.limit;
    this.remaining = extra?.remaining;
  }
}

/**
 * Consome 1 crédito da janela e retorna se está permitido.
 * Lança RateLimitError quando estourar o limite.
 */
export async function checkRateLimit(
  supabase: SupabaseClient<any, any, any>,
  route: string,
  maxRequests = 60,
  windowSeconds = 60,
): Promise<{ allowed: true; current: number; limit: number; resetAt: string }> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    _route: route,
    _max_requests: maxRequests,
    _window_seconds: windowSeconds,
  });
  if (error) {
    // Em falha da RPC, não travamos a operação (fail-open com log).
    // Rate limit é uma defesa em profundidade, não a única.
    // eslint-disable-next-line no-console
    console.warn("[rate-limit] rpc error", { route, message: error.message });
    return { allowed: true, current: 0, limit: maxRequests, resetAt: new Date().toISOString() };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { allowed: true, current: 0, limit: maxRequests, resetAt: new Date().toISOString() };
  if (!row.allowed) {
    throw new RateLimitError(
      `Muitas requisições em ${route}. Tente novamente em instantes.`,
      { resetAt: row.reset_at, limit: row.limit_value, current: row.current_count },
    );
  }
  return {
    allowed: true,
    current: row.current_count,
    limit: row.limit_value,
    resetAt: row.reset_at,
  };
}

/**
 * Consome 1 requisição de IA (opcionalmente somando tokens) e valida cota diária.
 * Lança AiQuotaError quando a cota do dia estourar.
 */
export async function checkAiQuota(
  supabase: SupabaseClient<any, any, any>,
  tokens = 0,
): Promise<{ allowed: true; used: number; limit: number; remaining: number }> {
  const { data, error } = await supabase.rpc("check_ai_quota", { _tokens: tokens });
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[ai-quota] rpc error", { message: error.message });
    return { allowed: true, used: 0, limit: 0, remaining: 0 };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { allowed: true, used: 0, limit: 0, remaining: 0 };
  if (!row.allowed) {
    throw new AiQuotaError(
      "Cota diária de IA atingida. Tente novamente amanhã ou peça ao administrador para revisar o limite.",
      { used: row.used, limit: row.limit_value, remaining: row.remaining },
    );
  }
  return {
    allowed: true,
    used: row.used,
    limit: row.limit_value,
    remaining: row.remaining,
  };
}
