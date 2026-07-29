import { expect, type Browser, type Page } from "@playwright/test";

/**
 * Helpers compartilhados pelos testes de RLS / isolamento multiempresa.
 *
 * Cada sessão é criada por um cadastro real na UI (`/auth`), o que provoca a
 * criação de uma nova empresa e do vínculo admin via trigger `handle_new_user`.
 * As consultas subsequentes usam a Data API com o token do usuário — ou seja,
 * a RLS é aplicada exatamente como no runtime do app.
 */

export const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
export const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  "";

export const SENHA_FORTE = "Teste@123456";

export type Sessao = {
  email: string;
  token: string;
  userId: string;
  empresaId: string;
};

export function emailAleatorio(prefixo = "e2e") {
  return `${prefixo}_${Date.now()}_${Math.floor(Math.random() * 10000)}@exemplo-e2e.com`;
}

export async function cadastrar(page: Page, email: string, empresa: string) {
  await page.goto("/auth");
  await expect(page.getByRole("tab", { name: "Entrar" })).toBeVisible();
  await page.getByRole("tab", { name: "Criar conta" }).click();
  await page.getByLabel("Seu nome").fill("Usuário E2E");
  await page.getByLabel("Nome da empresa").fill(empresa);
  await page.locator("#email2").fill(email);
  await page.locator("#password2").fill(SENHA_FORTE);
  await expect(page.locator("#email2-feedback")).toContainText(
    /disponível|cadastrado/i,
    { timeout: 15_000 },
  );
  await page.getByRole("button", { name: "Criar empresa" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

export async function lerToken(page: Page): Promise<{ token: string; userId: string }> {
  return await page.evaluate(() => {
    const key = Object.keys(window.localStorage).find(
      (k) => k.startsWith("sb-") && k.includes("auth-token"),
    );
    const raw = key ? window.localStorage.getItem(key) : null;
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      token: parsed?.access_token ?? "",
      userId: parsed?.user?.id ?? "",
    };
  });
}

type RestResposta = { status: number; body: any };

async function rest(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<RestResposta> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

/** SELECT como o usuário dono do token. */
export const selecionar = (token: string, path: string) => rest(token, path);

/** INSERT como o usuário dono do token. */
export const inserir = (token: string, tabela: string, payload: unknown) =>
  rest(token, tabela, { method: "POST", body: JSON.stringify(payload) });

/** PATCH como o usuário dono do token. */
export const atualizar = (token: string, path: string, payload: unknown) =>
  rest(token, path, { method: "PATCH", body: JSON.stringify(payload) });

/** DELETE como o usuário dono do token. */
export const remover = (token: string, path: string) =>
  rest(token, path, { method: "DELETE" });

/** Chamada de RPC (funções SECURITY DEFINER) como o usuário dono do token. */
export async function rpc(token: string, fn: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

/**
 * Considera "bloqueado" tanto erro HTTP (401/403/42501) quanto resposta 200
 * com zero linhas afetadas — que é como a RLS silencia UPDATE/DELETE fora do
 * escopo do usuário.
 */
export function bloqueado(res: RestResposta): boolean {
  if (res.status >= 400) return true;
  if (Array.isArray(res.body)) return res.body.length === 0;
  return false;
}

export async function criarSessao(
  browser: Browser,
  baseURL: string | undefined,
  prefixo = "e2e",
): Promise<Sessao> {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const email = emailAleatorio(prefixo);
  await cadastrar(
    page,
    email,
    `Empresa ${prefixo} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  );
  const { token, userId } = await lerToken(page);
  expect(token, "sessão deve ter access_token").toBeTruthy();

  const perfil = await selecionar(token, `profiles?select=id,empresa_id&id=eq.${userId}`);
  expect(perfil.status).toBe(200);
  expect(Array.isArray(perfil.body) && perfil.body.length).toBe(1);
  const empresaId = perfil.body[0].empresa_id as string;
  expect(empresaId).toBeTruthy();

  await context.close();
  return { email, token, userId, empresaId };
}

/** Cria uma obra na empresa do usuário e devolve o id. */
export async function criarObra(s: Sessao, nome = `Obra ${Date.now()}`) {
  const res = await inserir(s.token, "obras", { empresa_id: s.empresaId, nome });
  expect(res.status, `criar obra: ${JSON.stringify(res.body)}`).toBeLessThan(300);
  return res.body[0].id as string;
}

/** Cria um RDO em rascunho na obra informada e devolve o id. */
export async function criarRdo(s: Sessao, obraId: string, numero = Date.now() % 100000) {
  const res = await inserir(s.token, "rdos", {
    empresa_id: s.empresaId,
    obra_id: obraId,
    numero,
    data: new Date().toISOString().slice(0, 10),
    autor_id: s.userId,
    status: "rascunho",
  });
  expect(res.status, `criar rdo: ${JSON.stringify(res.body)}`).toBeLessThan(300);
  return res.body[0].id as string;
}
