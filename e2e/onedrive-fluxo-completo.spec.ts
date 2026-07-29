import { test, expect, type Page } from "@playwright/test";
import { SUPABASE_URL, SUPABASE_KEY, cadastrar, emailAleatorio } from "./helpers/empresa";

/**
 * Fluxo completo do OneDrive no estado "Conectado":
 * listar → enviar (upload) → baixar (download) o mesmo arquivo.
 *
 * Se o workspace ainda não liberou/vinculou a conexão, a suíte é pulada com
 * uma mensagem clara (em vez de falhar por um pré-requisito de ambiente),
 * mas os caminhos de erro continuam cobertos em `onedrive-conexao.spec.ts`.
 */
const ARQUIVO = `e2e-onedrive-${Date.now()}.txt`;
const CONTEUDO = `Teste E2E FACOM ${new Date().toISOString()}`;

async function abrirConfiguracoes(page: Page) {
  await page.goto("/configuracoes/onedrive");
  const painel = page.getByTestId("onedrive-conexao");
  await expect(painel).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => painel.getAttribute("data-estado"), { timeout: 40_000 })
    .not.toBe("verificando");
  return (await painel.getAttribute("data-estado")) ?? "desconectado";
}

test.describe("OneDrive conectado — listar, enviar e baixar", () => {
  test.skip(!SUPABASE_URL || !SUPABASE_KEY, "Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test("fluxo completo com a conexão do workspace vinculada", async ({ page }) => {
    await cadastrar(page, emailAleatorio("onedrive-fluxo"), `Empresa OneDrive ${Date.now()}`);

    // 1) A tela tenta vincular sozinha; se não conseguir, tentamos pela tela de vínculo.
    let estado = await abrirConfiguracoes(page);
    if (estado !== "conectado") {
      await page.goto("/configuracoes/onedrive/vincular");
      const lista = page.getByTestId("onedrive-lista-conexoes");
      if (await lista.isVisible().catch(() => false)) {
        await page.getByRole("button", { name: /Vincular ao projeto/i }).click();
        await page.waitForTimeout(2000);
      }
      estado = await abrirConfiguracoes(page);
    }

    test.skip(
      estado !== "conectado",
      "Conexão OneDrive do workspace não está liberada/vinculada neste ambiente — libere em Conectores → OneDrive.",
    );

    // 2) Listagem
    const explorador = page.getByTestId("onedrive-explorer");
    await expect(explorador).toBeVisible({ timeout: 30_000 });
    await expect(explorador.getByTestId("onedrive-lista")).toBeVisible({ timeout: 30_000 });

    // 3) Upload
    await explorador
      .getByTestId("onedrive-upload-input")
      .setInputFiles({ name: ARQUIVO, mimeType: "text/plain", buffer: Buffer.from(CONTEUDO, "utf-8") });
    await expect(explorador.getByText(ARQUIVO)).toBeVisible({ timeout: 60_000 });

    // 4) Download do mesmo arquivo
    const linha = explorador.locator("li", { hasText: ARQUIVO }).first();
    // O download usa um link temporário do Graph, aberto em nova aba.
    const [popup] = await Promise.all([
      page.context().waitForEvent("page", { timeout: 60_000 }),
      linha.getByRole("button", { name: /Baixar/i }).click(),
    ]);
    expect(popup.url()).toMatch(/^https?:\/\//);
    await popup.close();
  });

  test("tela de vínculo lista conexões e reflete o status sem recarregar", async ({ page }) => {
    await cadastrar(page, emailAleatorio("onedrive-vinculo"), `Empresa Vinculo ${Date.now()}`);
    await page.goto("/configuracoes/onedrive/vincular");
    await expect(page.getByTestId("onedrive-vinculo")).toBeVisible({ timeout: 30_000 });

    const temConexoes = await page
      .getByTestId("onedrive-lista-conexoes")
      .isVisible()
      .catch(() => false);

    if (!temConexoes) {
      await expect(page.getByTestId("onedrive-sem-conexoes")).toBeVisible();
      await expect(page.getByTestId("onedrive-sem-conexoes")).toContainText(/Files\.ReadWrite/);
      return;
    }

    await page.getByRole("button", { name: /Vincular ao projeto/i }).click();
    const ok = page.getByTestId("onedrive-vinculo-ok");
    const diag = page.getByTestId("onedrive-diagnostico-vinculo");
    await expect(ok.or(diag)).toBeVisible({ timeout: 60_000 });

    if (await diag.isVisible()) {
      // Diagnóstico precisa dar todos os dados de suporte.
      await expect(diag).toContainText(/ID da conexão/i);
      await expect(diag).toContainText(/request-id/i);
      await expect(diag).toContainText(/Organização/i);
      await expect(diag).toContainText(/Conectores → OneDrive/i);
    }
  });

  test("pedido de liberação ao admin gera texto pronto com erro e escopos", async ({ page }) => {
    await cadastrar(page, emailAleatorio("onedrive-pedido"), `Empresa Pedido ${Date.now()}`);
    const estado = await abrirConfiguracoes(page);
    test.skip(estado === "conectado", "conexão já ativa — o pedido ao admin não é necessário");

    await page.getByTestId("onedrive-pedido-admin").click();
    const texto = page.getByTestId("onedrive-pedido-texto");
    await expect(texto).toBeVisible();
    const conteudo = await texto.locator("textarea").inputValue();
    expect(conteudo).toContain("Files.ReadWrite");
    expect(conteudo).toContain("Conectores → OneDrive");
    expect(conteudo).toContain("request-id");
  });
});
