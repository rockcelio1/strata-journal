/**
 * E2E do QuotaChart3D — hover→auto-fechamento, pin por toque, Esc/×,
 * roving tabindex (Tab não entra no tooltip), reduced-motion.
 *
 * Setup:
 *   bun add -d @playwright/test
 *   bunx playwright install chromium
 * Rodar:
 *   bunx playwright test e2e/quota-chart.spec.ts
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

  test("teclado: Enter abre, Esc fecha, foco volta à barra", async ({ page }) => {
    await page.goto(URL);
    const bar = page.getByRole("button", { name: /Disponível:/ });
    await bar.focus();
    await expect(bar).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tooltip")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toBeHidden();
    await expect(bar).toBeFocused();
  });

  test("× fecha o tooltip pinado e devolve o foco", async ({ page }) => {
    await page.goto(URL);
    const bar = page.getByRole("button", { name: /Usado:/ });
    await bar.focus();
    await page.keyboard.press("Enter");
    const tip = page.getByRole("tooltip");
    await expect(tip).toBeVisible();
    await page.getByRole("button", { name: "Fechar tooltip" }).click();
    await expect(tip).toBeHidden();
    await expect(bar).toBeFocused();
  });

  test("roving tabindex: setas navegam, Tab pula tooltip", async ({ page }) => {
    await page.goto(URL);
    const used = page.getByRole("button", { name: /Usado:/ });
    const free = page.getByRole("button", { name: /Disponível:/ });
    const deleted = page.getByRole("button", { name: /Lixeira:/ });
    await used.focus();
    await page.keyboard.press("ArrowRight");
    await expect(free).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(deleted).toBeFocused();
    // Abre tooltip e garante que Tab não cai dentro dele
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tooltip")).toBeVisible();
    await page.keyboard.press("Tab");
    const focusedInTip = await page.evaluate(() => {
      const tip = document.getElementById("quota-tooltip");
      return !!(tip && tip.contains(document.activeElement));
    });
    expect(focusedInTip).toBe(false);
  });

  test("toque fixa o tooltip; tocar fora fecha", async ({ browser }) => {
    const ctx = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await ctx.newPage();
    await page.goto(URL);
    const bar = page.getByRole("button", { name: /Lixeira:/ });
    await bar.tap();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await page.locator("body").tap({ position: { x: 5, y: 5 } });
    await expect(page.getByRole("tooltip")).toBeHidden();
    await ctx.close();
  });

  test("reduced-motion: botão Girar desativado", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(URL);
    await expect(page.getByRole("button", { name: /Movimento reduzido/ })).toBeDisabled();
    await ctx.close();
  });
});
