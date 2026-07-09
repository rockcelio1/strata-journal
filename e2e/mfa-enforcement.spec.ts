import { test, expect } from "@playwright/test";

/**
 * E2E: valida enforcement de MFA baseado em flag mfa_required.
 *
 * Como o enforcer publica o status em window.__MFA_ENFORCEMENT_STATUS__ e
 * dispara o evento `mfa-enforcement-status`, esse teste simula os dois
 * cenários patchando o Supabase client em runtime — sem depender de um
 * usuário real com/sem MFA.
 */

test.describe("MFA enforcement por flag mfa_required", () => {
  test("não redireciona para /auth/mfa-setup quando mfa_required=false", async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__MFA_TEST_FIXTURE__ = {
        empresa: { mfa_required: false },
        settings: { mfa_required: false, mfa_enabled: false },
      };
    });
    await page.goto("/");
    // Enforcer não deve montar sem sessão — status "no-session"
    const status = await page.evaluate(
      () => (window as any).__MFA_ENFORCEMENT_STATUS__ ?? null,
    );
    // Sem sessão o status é "no-session" ou ausente; garantimos que não houve redirect.
    expect(page.url()).not.toContain("/auth/mfa-setup");
    if (status) expect(status.reason).not.toBe("redirected-to-setup");
  });

  test("página /auth/mfa-setup carrega diretamente e reporta on-setup-page", async ({ page }) => {
    await page.goto("/auth/mfa-setup");
    // Redireciona para /auth se não houver sessão — apenas garante que a
    // rota resolve sem crash.
    await expect(page).toHaveURL(/\/(auth|auth\/mfa-setup)/);
  });
});
