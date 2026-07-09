/**
 * Smoke test dos gráficos 3D (Bars3D / Pie3D) usados na Análise de Dimensão.
 *
 * Objetivo: garantir que a página carrega e os <canvas> WebGL montam SEM page
 * errors, mesmo que o worker do troika (usado por <Text> do drei) esteja
 * indisponível — hoje os rótulos são renderizados via <Html> + fallback
 * (<Label3D>), então não deve haver erro de "worker module init function
 * failed to rehydrate" derrubando a cena.
 *
 * Setup:
 *   bunx playwright install chromium
 * Rodar:
 *   bunx playwright test e2e/charts-3d-smoke.spec.ts
 */
import { test, expect } from "@playwright/test";

const URL = process.env.E2E_URL ?? "http://localhost:8080/analise-dimensao";

test.describe("Gráficos 3D — smoke", () => {
  test("carrega sem page errors e monta ao menos um <canvas>", async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err?.message ?? err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto(URL, { waitUntil: "domcontentloaded" });
    // dá tempo para Suspense/Canvas montarem
    await page.waitForTimeout(2500);

    // Não deve haver erros fatais de página
    expect(pageErrors, `pageerrors: ${pageErrors.join(" | ")}`).toEqual([]);

    // Nenhum erro relacionado ao worker troika deve ter derrubado a cena
    const troikaFatal = consoleErrors.filter((e) =>
      /troika|worker module init function failed to rehydrate/i.test(e)
    );
    expect(troikaFatal, `troika worker errors: ${troikaFatal.join(" | ")}`).toEqual([]);

    // Pelo menos um canvas do react-three-fiber presente
    const canvases = page.locator("canvas");
    await expect(canvases.first()).toBeVisible({ timeout: 10_000 });
  });
});
