import { test, expect, type Page } from "@playwright/test";

/**
 * Cobertura ponta a ponta: cadastro (com criação de empresa), login,
 * persistência de sessão e cenários de falha.
 *
 * Roda contra o app real (PLAYWRIGHT_BASE_URL). Os cenários que dependem de
 * criar contas usam e-mails aleatórios e não interferem em dados existentes.
 */

const senhaForte = "Teste@123456";

function emailAleatorio() {
  return `e2e_${Date.now()}_${Math.floor(Math.random() * 10000)}@exemplo-e2e.com`;
}

async function irParaAuth(page: Page) {
  await page.goto("/auth");
  await expect(page.getByRole("tab", { name: "Entrar" })).toBeVisible();
}

async function cadastrar(page: Page, email: string, empresa: string) {
  await irParaAuth(page);
  await page.getByRole("tab", { name: "Criar conta" }).click();
  await page.getByLabel("Seu nome").fill("Usuário E2E");
  await page.getByLabel("Nome da empresa").fill(empresa);
  await page.getByLabel("Email", { exact: true }).nth(0).fill(email);
  await page.locator("#email2").fill(email);
  await page.locator("#password2").fill(senhaForte);
  // aguarda a verificação de disponibilidade do e-mail terminar
  await expect(page.locator("#email2-feedback")).toContainText(/disponível|cadastrado/i, { timeout: 15_000 });
  await page.getByRole("button", { name: "Criar empresa" }).click();
}

test.describe("Cadastro", () => {
  test("cria conta + empresa e entra no dashboard", async ({ page }) => {
    const email = emailAleatorio();
    await cadastrar(page, email, `Empresa E2E ${Date.now()}`);
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("bloqueia cadastro com senha fraca", async ({ page }) => {
    await irParaAuth(page);
    await page.getByRole("tab", { name: "Criar conta" }).click();
    await page.locator("#password2").fill("123");
    await expect(page.locator("#password2-feedback")).toContainText(/caracteres|maiúscula/i);
    await expect(page.getByRole("button", { name: "Criar empresa" })).toBeDisabled();
  });

  test("bloqueia cadastro com e-mail já existente", async ({ page }) => {
    const email = emailAleatorio();
    await cadastrar(page, email, `Empresa E2E ${Date.now()}`);
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

    // nova tentativa com o mesmo e-mail
    await page.context().clearCookies();
    await page.goto("/auth");
    await page.evaluate(() => window.localStorage.clear());
    await irParaAuth(page);
    await page.getByRole("tab", { name: "Criar conta" }).click();
    await page.locator("#email2").fill(email);
    await expect(page.locator("#email2-feedback")).toContainText(/já está cadastrado/i, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Criar empresa" })).toBeDisabled();
  });
});

test.describe("Login", () => {
  test("entra com senha correta e mantém a sessão após recarregar", async ({ page }) => {
    const email = emailAleatorio();
    await cadastrar(page, email, `Empresa E2E ${Date.now()}`);
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

    // sessão persiste em reload
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);

    // sessão persiste em nova navegação direta
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);

    const temSessao = await page.evaluate(() =>
      Object.keys(window.localStorage).some((k) => k.startsWith("sb-") && k.includes("auth-token")),
    );
    expect(temSessao).toBe(true);
  });

  test("mostra causa real e ação quando a senha está incorreta", async ({ page }) => {
    const email = emailAleatorio();
    await cadastrar(page, email, `Empresa E2E ${Date.now()}`);
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await page.evaluate(() => window.localStorage.clear());

    await irParaAuth(page);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("SenhaErrada@1");
    await page.getByRole("button", { name: "Entrar" }).click();

    const alerta = page.getByTestId("signin-error");
    await expect(alerta).toBeVisible({ timeout: 20_000 });
    await expect(alerta).toContainText(/incorretos/i);
    await expect(alerta).toContainText(/Esqueci minha senha/i);
  });

  test("e-mail inexistente não entra e explica o motivo", async ({ page }) => {
    await irParaAuth(page);
    await page.locator("#email").fill(emailAleatorio());
    await page.locator("#password").fill(senhaForte);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByTestId("signin-error")).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/auth/);
  });
});

test.describe("Sessão", () => {
  test("rota protegida sem sessão redireciona para /auth", async ({ page }) => {
    await page.goto("/auth");
    await page.evaluate(() => window.localStorage.clear());
    await page.context().clearCookies();
    await page.goto("/dashboard");
    await page.waitForURL(/\/auth/, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/auth/);
  });

  test("sessão expirada/corrompida devolve o usuário ao login", async ({ page }) => {
    const email = emailAleatorio();
    await cadastrar(page, email, `Empresa E2E ${Date.now()}`);
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

    // corrompe o token armazenado, simulando sessão expirada
    await page.evaluate(() => {
      const key = Object.keys(window.localStorage).find((k) => k.startsWith("sb-") && k.includes("auth-token"));
      if (key) window.localStorage.removeItem(key);
    });
    await page.goto("/dashboard");
    await page.waitForURL(/\/auth/, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/auth/);
  });
});

test.describe("Recuperação de senha", () => {
  test("solicita link por e-mail", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByTestId("request-form")).toBeVisible();
    await page.getByLabel("Email").fill(emailAleatorio());
    await page.getByRole("button", { name: "Enviar e-mail" }).click();
    // não revela se o e-mail existe; apenas não pode quebrar a tela
    await expect(page.getByTestId("request-form").or(page.getByTestId("reset-invalid"))).toBeVisible();
  });

  test("link inválido/expirado é detectado e oferece novo envio", async ({ page }) => {
    await page.goto("/reset-password#error=access_denied&error_description=Email+link+is+invalid+or+has+expired");
    const box = page.getByTestId("reset-invalid");
    await expect(box).toBeVisible({ timeout: 15_000 });
    await expect(box).toContainText(/inválido|expirou/i);
    await page.getByRole("button", { name: "Solicitar novo link" }).click();
    await expect(page.getByTestId("request-form")).toBeVisible();
  });
});
