/**
 * Onda 4: enforcement de MFA para admin/master.
 *
 * Desativado temporariamente (2026-07-09): o redirecionamento automático
 * para /auth/mfa-setup estava bloqueando o login de administradores que
 * ainda não se inscreveram no TOTP. A página /auth/mfa-setup continua
 * disponível para adesão voluntária; o enforcement será religado por
 * empresa/usuário quando `user_security_settings.mfa_required` for usado
 * como fonte da verdade (em vez de `mfa_enabled`).
 */
export function MfaEnforcer(_: { roles: string[] | undefined }) {
  return null;
}

