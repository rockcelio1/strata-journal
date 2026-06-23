import { describe, it, expect, vi, beforeEach } from "vitest";
import { emailExistsIn, registerUserCore } from "../core.functions";

const existing = "duplicado@empresa.com";

function makeAdmin(emails: string[] = [existing]) {
  const createUser = vi.fn(async ({ email }: any) =>
    emails.some((e) => e.toLowerCase() === email.toLowerCase())
      ? { data: null, error: { message: "User already registered" } }
      : { data: { user: { id: "new", email } }, error: null },
  );
  return {
    auth: {
      admin: {
        listUsers: vi.fn(async () => ({ data: { users: emails.map((email) => ({ email })) }, error: null })),
        createUser,
      },
    },
    createUser,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("registro: bloqueio de duplicidade", () => {
  it("detecta e-mail já cadastrado", async () => {
    const admin = makeAdmin();
    expect(await emailExistsIn(admin, existing)).toBe(true);
    expect(await emailExistsIn(admin, "novo@x.com")).toBe(false);
  });

  it("registerUserCore lança EMAIL_TAKEN e NÃO chama createUser quando duplicado", async () => {
    const admin = makeAdmin();
    await expect(
      registerUserCore(admin, { email: existing, password: "12345678", nome: "X", empresa_nome: "Y" }),
    ).rejects.toThrow("EMAIL_TAKEN");
    expect(admin.createUser).not.toHaveBeenCalled();
  });

  it("registerUserCore cria usuário novo com sucesso", async () => {
    const admin = makeAdmin();
    const res = await registerUserCore(admin, {
      email: "novo@empresa.com", password: "12345678", nome: "X", empresa_nome: "Y",
    });
    expect(res.ok).toBe(true);
    expect(admin.createUser).toHaveBeenCalledOnce();
  });

  it("é case-insensitive (não permite variações de caixa do mesmo e-mail)", async () => {
    const admin = makeAdmin();
    await expect(
      registerUserCore(admin, { email: existing.toUpperCase(), password: "12345678", nome: "X", empresa_nome: "Y" }),
    ).rejects.toThrow("EMAIL_TAKEN");
  });
});
