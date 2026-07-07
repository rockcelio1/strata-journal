import { test, expect } from "@playwright/test";

/**
 * Visual regression da scrollbar milimétrica: renderiza uma página com overflow
 * vertical e horizontal, tira um screenshot do canto inferior direito (onde a
 * scrollbar aparece) e compara com o snapshot por projeto (Chromium/Firefox/WebKit).
 * O snapshot também documenta que nenhuma coluna/linha é cortada no viewport.
 */
test("scrollbar fina — snapshot por browser/viewport", async ({ page }, testInfo) => {
  await page.setContent(`<!doctype html>
    <html><head><style>
      :root { --scrollbar-size: 8px; }
      @media (max-width: 768px) { :root { --scrollbar-size: 6px; } }
      html { scrollbar-gutter: stable; }
      body { margin: 0; font-family: system-ui; background: #fff; color: #111; }
      .grid { display: grid; grid-template-columns: repeat(20, 120px); gap: 8px; padding: 12px; }
      .cell { height: 120px; background: linear-gradient(135deg,#dbeafe,#e0e7ff); border-radius: 8px; display: grid; place-items: center; }
      ::-webkit-scrollbar { width: var(--scrollbar-size); height: var(--scrollbar-size); }
      ::-webkit-scrollbar-thumb { background: rgba(0,0,0,.35); background-clip: padding-box;
        border: calc((var(--scrollbar-size) - 1px) / 2) solid transparent; border-radius: 999px; }
    </style></head>
    <body><div class="grid">${Array.from({ length: 300 }, (_, i) => `<div class="cell">${i + 1}</div>`).join("")}</div></body></html>`);

  // Espera fontes/layout estabilizarem
  await page.waitForLoadState("networkidle");

  // Screenshot do canto inferior-direito (200×200) — cobre ambas as scrollbars.
  const vp = page.viewportSize()!;
  const clip = { x: Math.max(0, vp.width - 200), y: Math.max(0, vp.height - 200), width: 200, height: 200 };
  await expect(page).toHaveScreenshot(`scrollbar-corner-${testInfo.project.name}.png`, { clip, animations: "disabled" });

  // Garantia extra: gutter reservado é fininho (<= 10px em desktop, 0 em overlay/touch).
  const gutter = await page.evaluate(() => window.innerWidth - document.documentElement.clientWidth);
  expect(gutter).toBeLessThanOrEqual(10);
});
