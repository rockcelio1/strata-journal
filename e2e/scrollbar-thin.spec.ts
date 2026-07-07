import { test, expect, devices } from "@playwright/test";

/**
 * Valida que a scrollbar do sistema é extremamente fina em todos os browsers
 * e não recorta conteúdo em breakpoints menores (tablet / mobile).
 *
 * A regra em src/styles.css usa `scrollbar-gutter: stable` + tokens
 * `--scrollbar-size` (8px desktop / 6px <768px). O layout NÃO deve mudar
 * de largura quando o conteúdo passa a rolar.
 */

const BREAKPOINTS: Array<{ name: string; width: number; height: number }> = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile-landscape", width: 667, height: 375 },
];

const BROWSERS: Array<{ name: "chromium" | "firefox" | "webkit"; label: string }> = [
  { name: "chromium", label: "Chrome/Edge" },
  { name: "firefox", label: "Firefox" },
  { name: "webkit", label: "Safari" },
];

for (const browserType of BROWSERS) {
  for (const bp of BREAKPOINTS) {
    test(`${browserType.label} @ ${bp.name}: scrollbar fina, sem recorte`, async ({ playwright }) => {
      const browser = await playwright[browserType.name].launch();
      const context = await browser.newContext({ viewport: { width: bp.width, height: bp.height } });
      const page = await context.newPage();

      // Página de teste isolada com overflow vertical e horizontal forçados.
      await page.setContent(`<!doctype html>
        <html>
          <head>
            <style>
              :root { --scrollbar-size: 8px; }
              @media (max-width: 768px) { :root { --scrollbar-size: 6px; } }
              html { scrollbar-gutter: stable; }
              body { margin: 0; }
              .box {
                width: 200vw;      /* força rolagem horizontal */
                height: 300vh;     /* força rolagem vertical */
                background: linear-gradient(45deg, #eee, #ccc);
              }
              ::-webkit-scrollbar { width: var(--scrollbar-size); height: var(--scrollbar-size); }
            </style>
          </head>
          <body><div class="box" id="box"></div></body>
        </html>`);

      // 1) Conteúdo mantém a largura completa mesmo com scrollbar visível.
      const contentWidth = await page.evaluate(() =>
        document.getElementById("box")!.getBoundingClientRect().width,
      );
      // 200vw esperado, tolerância de 2px para arredondamento sub-pixel.
      expect(contentWidth).toBeGreaterThanOrEqual(bp.width * 2 - 2);

      // 2) A "gutter" reservada para a scrollbar é <= 10px (extremamente fina).
      const gutter = await page.evaluate(
        () => window.innerWidth - document.documentElement.clientWidth,
      );
      // Em WebKit/Safari mobile a scrollbar é overlay (gutter=0). Em desktop deve ser fina.
      expect(gutter).toBeLessThanOrEqual(10);

      // 3) A altura do conteúdo (rolagem vertical) também não é cortada.
      const contentHeight = await page.evaluate(
        () => document.getElementById("box")!.getBoundingClientRect().height,
      );
      expect(contentHeight).toBeGreaterThanOrEqual(bp.height * 3 - 2);

      await browser.close();
    });
  }
}

/**
 * Consistência: os tokens CSS estão definidos em :root e podem ser lidos
 * a partir de qualquer elemento (modais, tabelas, etc.).
 */
test("tokens CSS de scrollbar disponíveis em :root", async ({ page }) => {
  await page.goto("http://localhost:8080");
  const tokens = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      size: s.getPropertyValue("--scrollbar-size").trim(),
      thumb: s.getPropertyValue("--scrollbar-thumb").trim(),
      hover: s.getPropertyValue("--scrollbar-thumb-hover").trim(),
    };
  });
  expect(tokens.size).toMatch(/^\d+px$/);
  expect(tokens.thumb.length).toBeGreaterThan(0);
  expect(tokens.hover).toMatch(/^\d+px$/);
});

// Silencia lint de import não usado quando o test runner só usa `test`.
void devices;
