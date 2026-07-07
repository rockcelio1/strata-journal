/**
 * Garante que a barra de rolagem milimétrica NÃO causa layout shift
 * ao navegar entre rotas. Ideia:
 *  - Mede clientWidth do <html> em rota curta (sem scroll vertical).
 *  - Navega para rota longa (com scroll vertical), mede de novo.
 *  - Como usamos `scrollbar-gutter: stable`, os dois valores devem ser iguais
 *    dentro de 1px (tolerância de arredondamento em HiDPI).
 *
 * Rodar:
 *   bunx playwright test e2e/scrollbar-layout.spec.ts
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_URL ?? "http://localhost:8080";
// Rotas públicas — não exigem sessão autenticada.
const SHORT_ROUTE = "/auth";
const LONG_ROUTE = "/reset-password";

async function readWidths(page: import("@playwright/test").Page) {
  return page.evaluate(() => ({
    htmlClient: document.documentElement.clientWidth,
    bodyClient: document.body.clientWidth,
    innerWidth: window.innerWidth,
  }));
}

test.describe("Scrollbar não afeta layout", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("largura do layout permanece estável entre rotas curtas e longas", async ({ page }) => {
    await page.goto(`${BASE}${SHORT_ROUTE}`, { waitUntil: "domcontentloaded" });
    const a = await readWidths(page);

    await page.goto(`${BASE}${LONG_ROUTE}`, { waitUntil: "domcontentloaded" });
    const b = await readWidths(page);

    // Tolerância: 1px cobre arredondamento em telas HiDPI.
    expect(Math.abs(a.htmlClient - b.htmlClient)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.bodyClient - b.bodyClient)).toBeLessThanOrEqual(1);
  });

  test("aplica scrollbar-gutter: stable no <html>", async ({ page }) => {
    await page.goto(`${BASE}${SHORT_ROUTE}`, { waitUntil: "domcontentloaded" });
    const gutter = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollbarGutter,
    );
    expect(gutter).toBe("stable");
  });

  test("rolagem vertical continua funcional", async ({ page }) => {
    await page.goto(`${BASE}${LONG_ROUTE}`, { waitUntil: "domcontentloaded" });
    // Força conteúdo alto caso a rota seja curta e mede scroll efetivo.
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.height = "3000px";
      spacer.setAttribute("data-e2e-spacer", "1");
      document.body.appendChild(spacer);
    });
    await page.evaluate(() => window.scrollTo(0, 500));
    const y = await page.evaluate(() => window.scrollY);
    expect(y).toBeGreaterThanOrEqual(400);
  });
});
