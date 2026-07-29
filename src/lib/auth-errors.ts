// Tradução de erros de autenticação para mensagens claras + ação sugerida.
// Fonte única usada pelas telas de login, cadastro e recuperação de senha.

export type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_CONFIRMED"
  | "USER_BANNED"
  | "USER_NOT_FOUND"
  | "EMAIL_TAKEN"
  | "WEAK_PASSWORD"
  | "SESSION_EXPIRED"
  | "TOKEN_INVALID"
  | "RATE_LIMITED"
  | "NETWORK"
  | "SAME_PASSWORD"
  | "UNKNOWN";

export type FriendlyAuthError = {
  code: AuthErrorCode;
  /** Causa real, em linguagem simples. */
  message: string;
  /** O que o usuário deve fazer em seguida. */
  action: string;
};

const MAP: Record<AuthErrorCode, { message: string; action: string }> = {
  INVALID_CREDENTIALS: {
    message: "E-mail ou senha incorretos.",
    action: "Confira os dados e tente novamente ou use “Esqueci minha senha”.",
  },
  EMAIL_NOT_CONFIRMED: {
    message: "Seu e-mail ainda não foi confirmado.",
    action: "Reenvie a verificação e clique no link recebido antes de entrar.",
  },
  USER_BANNED: {
    message: "Esta conta está bloqueada/desativada.",
    action: "Fale com o administrador da sua empresa para reativar o acesso.",
  },
  USER_NOT_FOUND: {
    message: "Não encontramos uma conta com este e-mail.",
    action: "Verifique o endereço ou crie uma conta na aba “Criar conta”.",
  },
  EMAIL_TAKEN: {
    message: "Este e-mail já está cadastrado.",
    action: "Faça login ou recupere a senha em “Esqueci minha senha”.",
  },
  WEAK_PASSWORD: {
    message: "A senha não atende à política de segurança.",
    action: "Use no mínimo 8 caracteres com maiúscula, minúscula, número e símbolo.",
  },
  SESSION_EXPIRED: {
    message: "Sua sessão expirou por inatividade.",
    action: "Faça login novamente para continuar de onde parou.",
  },
  TOKEN_INVALID: {
    message: "O link de recuperação é inválido ou já expirou.",
    action: "Solicite um novo e-mail de recuperação e use o link em até 1 hora.",
  },
  RATE_LIMITED: {
    message: "Muitas tentativas em pouco tempo.",
    action: "Aguarde alguns minutos antes de tentar novamente.",
  },
  NETWORK: {
    message: "Não foi possível falar com o servidor.",
    action: "Verifique sua conexão com a internet e tente de novo.",
  },
  SAME_PASSWORD: {
    message: "A nova senha é igual à anterior.",
    action: "Escolha uma senha diferente da que você já usava.",
  },
  UNKNOWN: {
    message: "Não foi possível concluir a operação.",
    action: "Tente novamente em instantes; se persistir, avise o administrador.",
  },
};

/** Classifica o erro cru (Supabase/servidor) em um código conhecido. */
export function classifyAuthError(err: unknown): AuthErrorCode {
  const raw =
    typeof err === "string"
      ? err
      : ((err as any)?.message ?? (err as any)?.error_description ?? (err as any)?.msg ?? "");
  const status = Number((err as any)?.status ?? (err as any)?.code ?? 0);
  const m = String(raw).toLowerCase();

  if (!m && !status) return "UNKNOWN";
  if (m.includes("email_taken") || m.includes("already registered") || m.includes("already exists")) return "EMAIL_TAKEN";
  if (m.includes("email_not_found") || m.includes("user not found")) return "USER_NOT_FOUND";
  if (m.includes("banned") || m.includes("disabled") || m.includes("bloquead") || m.includes("desativ")) return "USER_BANNED";
  if (m.includes("not confirmed") || m.includes("email_not_confirmed") || m.includes("confirm")) return "EMAIL_NOT_CONFIRMED";
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("invalid_grant")) return "INVALID_CREDENTIALS";
  if (m.includes("same as the old") || m.includes("should be different")) return "SAME_PASSWORD";
  if (m.includes("weak") || m.includes("password should")) return "WEAK_PASSWORD";
  if (m.includes("expired") || m.includes("otp_expired") || m.includes("token has expired")) return "TOKEN_INVALID";
  if (m.includes("invalid token") || m.includes("access_denied") || m.includes("invalid_request")) return "TOKEN_INVALID";
  if (m.includes("session") && (m.includes("missing") || m.includes("expired"))) return "SESSION_EXPIRED";
  if (m.includes("rate limit") || m.includes("too many") || status === 429) return "RATE_LIMITED";
  if (m.includes("failed to fetch") || m.includes("network")) return "NETWORK";
  if (status === 400) return "INVALID_CREDENTIALS";
  if (status === 401 || status === 403) return "SESSION_EXPIRED";
  return "UNKNOWN";
}

/** Mensagem final pronta para exibição. */
export function friendlyAuthError(err: unknown): FriendlyAuthError {
  const code = classifyAuthError(err);
  return { code, ...MAP[code] };
}

/** Texto de uma linha (causa + ação) para toasts. */
export function authErrorText(err: unknown): string {
  const f = friendlyAuthError(err);
  return `${f.message} ${f.action}`;
}
