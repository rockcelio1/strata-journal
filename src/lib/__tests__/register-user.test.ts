import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Teste de integração: garante que o backend NUNCA permite cadastrar
 * o mesmo e-mail duas vezes, independentemente do estado do formulário.
 *
 * Estratégia: mockamos `@/integrations/supabase/client.server` para simular
 * uma base que já contém um usuário e validamos o comportamento do
 * server-fn `registerUser` / `checkEmailRegistered`.
 */

const existingEmail = "duplicado@empresa.com";

vi.mock("@tanstack/react-start", () => ({
  // Stub mínimo do builder do createServerFn para chamar o handler direto
  createServerFn: () => {
    const builder: any = {
      _validator: (d: any) => d,
      middleware: () => builder,
      inputValidator: (fn: any) => { builder._validator = fn; return builder; },
      handler: (fn: any) => async (args: { data?: any } = {}) =>
        fn({ data: builder._validator(args.data), context: {} }),
    };
    return builder;
  },
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: {},
}));

const createUserMock = vi.fn(async ({ email }: { email: string }) => {
  if (email.toLowerCase() === existingEmail) {
    return { data: null, error: { message: "User already registered" } };
  }
  return { data: { user: { id: "new-id", email } }, error: null };
});

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        listUsers: vi.fn(async () => ({
          data: { users: [{ email: existingEmail }] },
          error: null,
        })),
        createUser: createUserMock,
      },
    },
  },
}));

beforeEach(() => { createUserMock.mockClear(); });

describe("registerUser backend guard", () => {
  it("checkEmailRegistered → true para e-mail existente", async () => {
    const { checkEmailRegistered } = await import("../core.functions");
    const res = await (checkEmailRegistered as any)({ data: { email: existingEmail } });
    expect(res.exists).toBe(true);
  });

  it("checkEmailRegistered → false para e-mail novo", async () => {
    const { checkEmailRegistered } = await import("../core.functions");
    const res = await (checkEmailRegistered as any)({ data: { email: "novo@empresa.com" } });
    expect(res.exists).toBe(false);
  });

  it("registerUser lança EMAIL_TAKEN para duplicado e NÃO chama createUser", async () => {
    const { registerUser } = await import("../core.functions");
    await expect(
      (registerUser as any)({
        data: { email: existingEmail, password: "12345678", nome: "X", empresa_nome: "Y" },
      }),
    ).rejects.toThrow("EMAIL_TAKEN");
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("registerUser cria usuário novo com sucesso", async () => {
    const { registerUser } = await import("../core.functions");
    const res = await (registerUser as any)({
      data: { email: "novo@empresa.com", password: "12345678", nome: "X", empresa_nome: "Y" },
    });
    expect(res.ok).toBe(true);
    expect(createUserMock).toHaveBeenCalledOnce();
  });
});
