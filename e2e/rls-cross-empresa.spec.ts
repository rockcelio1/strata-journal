import { test, expect, type Browser, type Page } from "@playwright/test";

/**
 * Isolamento multiempresa (RLS).
 *
 * Cria duas contas novas — cada uma gera sua própria empresa — e valida, via
 * PostgREST usando o token de cada sessão, que nenhum usuário enxerga dados
 * (perfis, empresas, obras) da outra empresa.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

const senhaForte = "Teste@123456";

function emailAleatorio() {
  return `e2e_rls_${Date.now()}_${Math.floor(Math.random() * 10000)}@exemplo-e2e.com`;
}

type Sessao = {
  email: string;
  token: string;
  userId: string;
  empresaId: string;
};

async function cadastrar(page: Page, email: string, empresa: string) {
  await page.goto("/auth");
  await expect(page.getByRole("tab", { name: "Entrar" })).toBeVisible();
  await page.getByRole("tab", { name: "Criar conta" }).click();
  await page.getByLabel("Seu nome").fill("Usuário RLS");
  await page.getByLabel("Nome da empresa").fill(empresa);
  await page.locator("#email2").fill(email);
  await page.locator("#password2").fill(senhaForte);
  await expect(page.locator("#email2-feedback")).toContainText(/disponível|cadastrado/i, {
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Criar empresa" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

async function lerToken(page: Page): Promise<{ token: string; userId: string }> {
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

/** Consulta a Data API usando o token do usuário — RLS é aplicada como o usuário. */
async function consultar(token: string, path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function criarSessao(browser: Browser, baseURL: string | undefined): Promise<Sessao> {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const email = emailAleatorio();
  await cadastrar(page, email, `Empresa RLS ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const { token, userId } = await lerToken(page);
  expect(token, "sessão deve ter access_token").toBeTruthy();

  const perfil = await consultar(token, `profiles?select=id,empresa_id&id=eq.${userId}`);
  expect(perfil.status).toBe(200);
  expect(Array.isArray(perfil.body) && perfil.body.length).toBe(1);
  const empresaId = perfil.body[0].empresa_id as string;
  expect(empresaId).toBeTruthy();

  await context.close();
  return { email, token, userId, empresaId };
}

test.describe("RLS — isolamento entre empresas", () => {
  test.skip(!SUPABASE_URL || !SUPABASE_KEY, "Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  let a: Sessao;
  let b: Sessao;

  test.beforeAll(async ({ browser, baseURL }) => {
    a = await criarSessao(browser, baseURL);
    b = await criarSessao(browser, baseURL);
    expect(a.empresaId).not.toBe(b.empresaId);
  });

  test("perfis: cada usuário só enxerga a própria empresa", async () => {
    for (const [eu, outro] of [
      [a, b],
      [b, a],
    ] as const) {
      const todos = await consultar(eu.token, "profiles?select=id,empresa_id");
      expect(todos.status).toBe(200);
      const empresas = new Set((todos.body as any[]).map((p) => p.empresa_id));
      expect([...empresas]).toEqual([eu.empresaId]);

      const alvo = await consultar(eu.token, `profiles?select=id&id=eq.${outro.userId}`);
      expect(alvo.status).toBe(200);
      expect(alvo.body).toEqual([]);
    }
  });

  test("empresas: não é possível ler a empresa do outro usuário", async () => {
    const r1 = await consultar(a.token, `empresas?select=id,nome&id=eq.${b.empresaId}`);
    expect(r1.body).toEqual([]);
    const r2 = await consultar(b.token, `empresas?select=id,nome&id=eq.${a.empresaId}`);
    expect(r2.body).toEqual([]);
  });

  test("papéis: user_roles não vaza entre empresas", async () => {
    const r = await consultar(a.token, "user_roles?select=user_id,empresa_id");
    expect(r.status).toBe(200);
    for (const row of r.body as any[]) {
      expect(row.empresa_id).toBe(a.empresaId);
    }
  });

  test("obras: dados criados por uma empresa são invisíveis para a outra", async () => {
    const nome = `Obra RLS ${Date.now()}`;
    const criar = await fetch(`${SUPABASE_URL}/rest/v1/obras`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${a.token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ empresa_id: a.empresaId, nome }),
    });
    expect(criar.status, "usuário deve conseguir criar obra na própria empresa").toBeLessThan(300);
    const [obra] = (await criar.json()) as any[];
    expect(obra?.id).toBeTruthy();

    const minhas = await consultar(a.token, `obras?select=id&id=eq.${obra.id}`);
    expect(minhas.body).toHaveLength(1);

    const doOutro = await consultar(b.token, `obras?select=id,nome&id=eq.${obra.id}`);
    expect(doOutro.status).toBe(200);
    expect(doOutro.body).toEqual([]);

    const listaB = await consultar(b.token, "obras?select=id,empresa_id");
    for (const row of listaB.body as any[]) {
      expect(row.empresa_id).toBe(b.empresaId);
    }
  });

  test("escrita cruzada: inserir obra na empresa alheia é bloqueado", async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/obras`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${b.token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ empresa_id: a.empresaId, nome: `Invasao ${Date.now()}` }),
    });
    expect(res.status, "RLS deve recusar insert em empresa alheia").toBeGreaterThanOrEqual(400);
  });

  test("anônimo: sem token não há leitura de dados de empresa", async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/obras?select=id`, {
      headers: { apikey: SUPABASE_KEY },
    });
    const body = await res.json().catch(() => null);
    if (res.status === 200) {
      expect(body).toEqual([]);
    } else {
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });
});
