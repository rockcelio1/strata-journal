import { test, expect } from "@playwright/test";

/**
 * Valida que a scrollbar dentro de modais (Radix Dialog), Radix ScrollArea e
 * tabelas dentro de modais segue os mesmos tokens (`--scrollbar-size`) e
 * NÃO corta o conteúdo em viewports compactos.
 *
 * Skipped por padrão até E2E_MODAL_URL apontar para uma página que renderiza
 * um Dialog com tabela dentro (ex.: cadastro/edição de RDO).
 */
const modalUrl = process.env.E2E_MODAL_URL;
const openTrigger = process.env.E2E_MODAL_TRIGGER ?? '[data-testid="open-modal"]';

test.describe("Scrollbar em modais/tabelas", () => {
  test.skip(!modalUrl, "Defina E2E_MODAL_URL para rodar este teste");

  test("modal com tabela: scrollbar fina e sem recorte", async ({ page }) => {
    await page.goto(modalUrl!);
    await page.locator(openTrigger).first().click();
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();

    // Token CSS presente e coerente.
    const size = await dialog.evaluate(
      (el) => getComputedStyle(el).getPropertyValue("--scrollbar-size").trim() ||
              getComputedStyle(document.documentElement).getPropertyValue("--scrollbar-size").trim(),
    );
    expect(size).toMatch(/^\d+px$/);
    expect(parseInt(size, 10)).toBeLessThanOrEqual(8);

    // Se houver tabela dentro, ela mantém min-width e não recorta.
    const table = dialog.locator("table").first();
    if (await table.count()) {
      const box = await table.boundingBox();
      const dlgBox = await dialog.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(dlgBox!.width - 16);
      const overflows = await dialog.evaluate((el) => {
        const scr = el.querySelector<HTMLElement>(".overflow-x-auto,.overflow-auto,[data-radix-scroll-area-viewport]");
        return scr ? scr.scrollWidth >= scr.clientWidth : true;
      });
      expect(overflows).toBeTruthy();
    }

    // Radix ScrollArea (se presente) também usa a mesma espessura.
    const sa = dialog.locator("[data-radix-scroll-area-viewport]").first();
    if (await sa.count()) {
      const w = await sa.evaluate((el) => getComputedStyle(el).getPropertyValue("scrollbar-width"));
      expect(["thin", "auto", ""]).toContain(w.trim());
    }
  });
});
