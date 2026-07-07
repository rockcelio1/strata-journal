import { defineConfig, devices } from "@playwright/test";

/**
 * Configuração Playwright com matriz de dispositivos (desktop, tablet, mobile)
 * rodando em Chromium, Firefox e WebKit (Safari) — para validar continuamente
 * o comportamento da scrollbar fina e a ausência de recortes.
 *
 * Uso no CI:
 *   bunx playwright install --with-deps chromium firefox webkit
 *   bunx playwright test
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: process.env.CI
    ? {
        command: "bun run dev",
        url: "http://localhost:8080",
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
  projects: [
    // Desktop
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "firefox-desktop",  use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 800 } } },
    { name: "webkit-desktop",   use: { ...devices["Desktop Safari"],  viewport: { width: 1280, height: 800 } } },
    // Tablet
    { name: "webkit-tablet",    use: { ...devices["iPad Pro 11"] } },
    { name: "chromium-tablet",  use: { ...devices["Galaxy Tab S4"] } },
    // Mobile
    { name: "webkit-mobile",    use: { ...devices["iPhone 13"] } },
    { name: "chromium-mobile",  use: { ...devices["Pixel 7"] } },
  ],
  // Snapshots por projeto (Safari/Chrome/Firefox produzem pixels diferentes).
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFilePath}/{arg}-{projectName}{ext}",
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
});
