// Rotina de teste: dá refresh em cada rota autenticada e valida que o pathname
// permanece o mesmo (não redireciona para a home / dashboard).
//
// Uso:
//   node tests/refresh-preservation.mjs
// Requer sessão Supabase injetada via env (LOVABLE_BROWSER_SUPABASE_*).
// Rode em preview autenticado do Lovable ou local com envs equivalentes.

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:8080";
const ROUTES = [
  "/dashboard",
  "/galeria",
  "/rdo",
  "/cadastros",
  "/configuracoes/aplicativo",
  "/configuracoes/auditoria",
  "/configuracoes/auditoria-midia",
  "/ajuda",
];

const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
const sessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const cookiesJson = process.env.LOVABLE_BROWSER_SUPABASE_COOKIES_JSON;

const results = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 1600 } });

if (cookiesJson) {
  const cookies = JSON.parse(cookiesJson).map((c) => ({ ...c, url: BASE }));
  await context.addCookies(cookies);
}

const page = await context.newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
if (storageKey && sessionJson) {
  await page.evaluate(
    ([k, v]) => window.localStorage.setItem(k, v),
    [storageKey, sessionJson],
  );
}

for (const route of ROUTES) {
  const url = BASE + route;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500); // dá tempo do auth redirecionar se fosse
  const finalPath = new URL(page.url()).pathname;
  const ok = finalPath === route;
  results.push({ route, finalPath, ok });
  console.log(`${ok ? "OK  " : "FAIL"}  ${route}  ->  ${finalPath}`);
}

await browser.close();
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n${failed.length} rota(s) redirecionaram após refresh`);
  process.exit(1);
}
console.log(`\nTodas as ${results.length} rotas preservaram o path após refresh.`);
