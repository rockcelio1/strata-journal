import { test, expect } from "@playwright/test";

/**
 * Valida que as seções "Auditoria por usuário" e "Histórico" da tela de RDO
 * ficam ocultas para usuários que não são admin (mostrando o aviso de
 * acesso restrito) e visíveis para administradores.
 *
 * Este teste depende de variáveis de ambiente opcionais:
 *  - E2E_RDO_URL:      URL completa de um RDO existente (ex.: http://localhost:8080/rdo/<uuid>)
 *  - E2E_ADMIN_TOKEN:  sessão Supabase serializada (JSON) para um usuário admin
 *  - E2E_USER_TOKEN:   sessão Supabase serializada (JSON) para um usuário comum
 *  - E2E_SB_STORAGE_KEY: chave usada no localStorage pelo cliente Supabase
 *
 * Sem esses env vars, o teste é pulado (skip) para não quebrar CIs que
 * ainda não têm credenciais configuradas.
 */

const rdoUrl = process.env.E2E_RDO_URL;
const adminToken = process.env.E2E_ADMIN_TOKEN;
const userToken = process.env.E2E_USER_TOKEN;
const storageKey = process.env.E2E_SB_STORAGE_KEY;

test.describe("RDO - acesso a Auditoria/Histórico", () => {
  test.skip(
    !rdoUrl || !adminToken || !userToken || !storageKey,
    "Defina E2E_RDO_URL, E2E_ADMIN_TOKEN, E2E_USER_TOKEN e E2E_SB_STORAGE_KEY para rodar este teste",
  );

  test("usuário comum vê aviso de acesso restrito", async ({ page }) => {
    await page.goto("http://localhost:8080");
    await page.evaluate(
      ([k, v]) => window.localStorage.setItem(k!, v!),
      [storageKey!, userToken!],
    );
    await page.goto(rdoUrl!);

    await expect(page.getByTestId("rdo-auditoria-usuario")).toHaveCount(0);
    await expect(page.getByTestId("rdo-historico")).toHaveCount(0);
    await expect(page.getByTestId("admin-only-denied").first()).toBeVisible();
  });

  test("admin vê Auditoria por usuário e Histórico", async ({ page }) => {
    await page.goto("http://localhost:8080");
    await page.evaluate(
      ([k, v]) => window.localStorage.setItem(k!, v!),
      [storageKey!, adminToken!],
    );
    await page.goto(rdoUrl!);

    await expect(page.getByTestId("rdo-auditoria-usuario")).toBeVisible();
    await expect(page.getByTestId("rdo-historico")).toBeVisible();
    await expect(page.getByTestId("admin-only-denied")).toHaveCount(0);
  });
});
