/**
 * Sanitização de erros do backend antes de ir ao frontend.
 *
 * Nunca enviar ao cliente:
 *   - nome de tabela / coluna
 *   - trecho de SQL / constraint
 *   - stack trace
 *   - caminho interno
 *   - token / secret
 *   - dados pessoais
 *
 * Uso no handler:
 *   } catch (e) {
 *     logServerError("createRdo", e, { userId, empresaId });
 *     throw new Error(mapServerError(e));
 *   }
 */

const GENERIC = "Não foi possível concluir a operação. Tente novamente.";

const SAFE_HINTS: Array<[RegExp, string]> = [
  [/permission denied|not authorized|forbidden|42501/i, "Sem permissão para esta ação."],
  [/unique|duplicate key|23505/i, "Registro duplicado."],
  [/foreign key|23503/i, "Existe vínculo com outros registros que impede a ação."],
  [/not[- ]?found|nao encontrado|p0002/i, "Registro não encontrado."],
  [/rate.?limit|too many requests|429/i, "Muitas solicitações. Aguarde alguns minutos e tente novamente."],
  [/timeout|timed out/i, "A operação demorou demais. Tente novamente."],
  [/network|failed to fetch/i, "Falha de rede. Verifique sua conexão."],
];

export function mapServerError(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!raw) return GENERIC;
  for (const [rx, msg] of SAFE_HINTS) if (rx.test(raw)) return msg;
  return GENERIC;
}

export function logServerError(
  operation: string,
  err: unknown,
  ctx: Record<string, unknown> = {},
): void {
  // Log técnico apenas no backend — nunca ecoar ao cliente.
  const request_id = ctx.request_id ?? cryptoRandomId();
  const payload = {
    request_id,
    operation,
    error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
    ...ctx,
  };
  console.error(`[server-error]`, payload);
}

function cryptoRandomId(): string {
  try {
    return "req_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  } catch {
    return "req_" + Math.random().toString(36).slice(2, 14);
  }
}
