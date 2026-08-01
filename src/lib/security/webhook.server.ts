import { createHmac, timingSafeEqual } from "crypto";

/**
 * Utilitário para comparação segura de segredos em tempo constante.
 * Evita ataques de temporização (timing attacks).
 */
export function safeCompare(provided: string, expected: string): boolean {
  if (!provided || !expected || provided.length !== expected.length) {
    return false;
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return timingSafeEqual(a, b);
}

/**
 * Valida o cabeçalho 'apikey' contra um segredo de ambiente.
 * Lança erro se falhar ou se o segredo não estiver configurado.
 */
export function exigirSegredoWebhook(request: Request, envVarName: string) {
  const expected = process.env[envVarName];
  if (!expected) {
    console.error(`[security] Erro crítico: ${envVarName} não configurado.`);
    throw new Error("Configuração de segurança pendente.");
  }
  
  const provided = request.headers.get("apikey") || "";
  if (!safeCompare(provided, expected)) {
    throw new Error("Acesso não autorizado.");
  }
}
