import { describe, it, expect } from "vitest";
import { classifyAuthError, friendlyAuthError, authErrorText } from "../auth-errors";

describe("classificação de erros de autenticação", () => {
  it("senha/e-mail inválidos", () => {
    expect(classifyAuthError({ message: "Invalid login credentials", status: 400 })).toBe("INVALID_CREDENTIALS");
  });

  it("e-mail não confirmado", () => {
    expect(classifyAuthError({ message: "Email not confirmed" })).toBe("EMAIL_NOT_CONFIRMED");
  });

  it("conta bloqueada", () => {
    expect(classifyAuthError({ message: "User is banned" })).toBe("USER_BANNED");
  });

  it("sessão expirada", () => {
    expect(classifyAuthError({ message: "Auth session missing!", status: 401 })).toBe("SESSION_EXPIRED");
  });

  it("token de recuperação expirado", () => {
    expect(classifyAuthError("otp_expired")).toBe("TOKEN_INVALID");
  });

  it("e-mail já cadastrado", () => {
    expect(classifyAuthError(new Error("EMAIL_TAKEN"))).toBe("EMAIL_TAKEN");
  });

  it("excesso de tentativas", () => {
    expect(classifyAuthError({ message: "Request rate limit reached", status: 429 })).toBe("RATE_LIMITED");
  });

  it("falha de rede", () => {
    expect(classifyAuthError(new Error("Failed to fetch"))).toBe("NETWORK");
  });

  it("desconhecido quando não há informação", () => {
    expect(classifyAuthError({})).toBe("UNKNOWN");
  });
});

describe("mensagens amigáveis", () => {
  it("sempre traz causa e ação", () => {
    const f = friendlyAuthError({ message: "Invalid login credentials" });
    expect(f.message).toMatch(/incorretos/i);
    expect(f.action.length).toBeGreaterThan(10);
    expect(authErrorText({ message: "Invalid login credentials" })).toContain(f.action);
  });
});
