/**
 * E2E do QuotaChart3D — tooltip, pin por toque, auto-close, fora do gráfico, a11y.
 *
 * Setup (rodar uma vez):
 *   bun add -d @playwright/test
 *   bunx playwright install chromium
 *
 * Rodar:
 *   bunx playwright test e2e/quota-chart.spec.ts
 *
 * Requer login: ajuste BASE_URL e a rota /configuracoes/onedrive conforme seu
 * ambiente (use storageState do Playwright para sessão autenticada).
 */
import { test, expect, devices } from "@playwright/test";

const URL = process.env.E2E_URL ?? "http://localhost:8080/configuracoes/onedrive";

test.describe("QuotaChart3D", () => {
  test("hover abre tooltip e auto-fecha após ~3.5s", async ({ page }) => {
    await page.goto(URL);
    const bar = page.getByRole("button", { name: /Usado:/ });
    await bar.hover();
    const tip = page.getByRole("tooltip");
    await expect(tip).toBeVisible();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(3500);
    await expect(tip).toBeHidden();
  });

  test("teclado: Enter abre, Esc fecha, foco visível", async ({ page }) => {
    await page.goto(URL);
    const bar = page.getByRole("button", { name: /Disponível:/ });
    await bar.focus();
    await expect(bar).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tooltip")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toBeHidden();
    // foco não deve ficar preso fora da barra
    await expect(bar).toBeFocused();
  });

  test("toque fixa o tooltip e tocar fora fecha", async ({ browser }) => {
    const ctx = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await ctx.newPage();
    await page.goto(URL);
    const bar = page.getByRole("button", { name: /Lixeira:/ });
    await bar.tap();
    await expect(page.getByRole("tooltip")).toBeVisible();
    // tocar fora do gráfico
    await page.locator("body").tap({ position: { x: 5, y: 5 } });
    await expect(page.getByRole("tooltip")).toBeHidden();
    await ctx.close();
  });

  test("respeita prefers-reduced-motion: botão Girar desativado", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(URL);
    const btn = page.getByRole("button", { name: /Movimento reduzido/ });
    await expect(btn).toBeDisabled();
    await ctx.close();
  });
});
