import { test, expect } from "@playwright/test";
import { SUPABASE_URL, SUPABASE_KEY, cadastrar, emailAleatorio } from "./helpers/empresa";

/**
 * E2E da tela Configurações → OneDrive.
 *
 * O ambiente de teste não tem a conexão OAuth do workspace vinculada, então a
 * tela deve assumir o estado "desconectado/sem acesso" — e é justamente esse
 * caminho de falha que precisa estar claro para quem opera o sistema.
 * As operações felizes (listar/upload/download/paginação) são cobertas pelos
 * testes de integração em `src/lib/__tests__/onedrive-graph.test.ts`.
 */
test.describe("OneDrive — conexão e diagnóstico na tela de configurações", () => {
  test.skip(!SUPABASE_URL || !SUPABASE_KEY, "Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    await cadastrar(page, emailAleatorio("onedrive"), `Empresa OneDrive ${Date.now()}`);
    await page.goto("/configuracoes/onedrive");
  });

  test("painel de conexão guiado aparece com estado e próximos passos", async ({ page }) => {
    const painel = page.getByTestId("onedrive-conexao");
    await expect(painel).toBeVisible({ timeout: 30_000 });

    await expect
      .poll(async () => painel.getAttribute("data-estado"), { timeout: 30_000 })
      .not.toBe("verificando");

    const estado = await painel.getAttribute("data-estado");
    if (estado === "conectado") {
      await expect(painel.getByRole("button", { name: /Revalidar conexão/i })).toBeVisible();
    } else {
      // Fluxo guiado: autorização, escopos e vínculo com o projeto.
      await expect(painel).toContainText(/OAuth 2\.0/i);
      await expect(painel).toContainText(/Files\.ReadWrite/i);
      await expect(painel).toContainText(/vincular a conexão/i);
      await expect(painel.getByRole("button", { name: /Autorizar \/ verificar agora/i })).toBeVisible();
    }
  });

  test("oferece troca de conta e logout da conexão", async ({ page }) => {
    const painel = page.getByTestId("onedrive-conexao");
    await expect(painel.getByRole("button", { name: /Trocar de conta/i })).toBeVisible({ timeout: 30_000 });
    await painel.getByRole("button", { name: /Trocar de conta/i }).click();
    await expect(page.getByText(/Trocar conta do OneDrive/i)).toBeVisible();
    await page.keyboard.press("Escape").catch(() => {});
  });

  test("sem acesso à conexão a tela explica a ação no workspace", async ({ page }) => {
    const painel = page.getByTestId("onedrive-conexao");
    await expect
      .poll(async () => painel.getAttribute("data-estado"), { timeout: 30_000 })
      .not.toBe("verificando");
    const estado = await painel.getAttribute("data-estado");
    test.skip(estado === "conectado", "ambiente já possui conexão OneDrive ativa");

    await expect(painel).toContainText(/Conectores|workspace|autoriza/i);
    // O diagnóstico com status HTTP/request-id precisa estar acessível na mesma página.
    await expect(page.getByText(/request-id|Diagnóstico/i).first()).toBeVisible();
  });

  test("explorador de arquivos só aparece com a conexão ativa", async ({ page }) => {
    const painel = page.getByTestId("onedrive-conexao");
    await expect
      .poll(async () => painel.getAttribute("data-estado"), { timeout: 30_000 })
      .not.toBe("verificando");
    const estado = await painel.getAttribute("data-estado");
    const explorador = page.getByText("Arquivos no OneDrive");
    if (estado === "conectado") {
      await expect(explorador).toBeVisible();
      await expect(page.getByRole("button", { name: /Enviar arquivo/i })).toBeVisible();
    } else {
      await expect(explorador).toHaveCount(0);
    }
  });
});
