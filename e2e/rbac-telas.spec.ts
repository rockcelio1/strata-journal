import { test, expect, type Page } from "@playwright/test";
import {
  SUPABASE_URL,
  SUPABASE_KEY,
  criarObra,
  criarRdo,
  criarSessao,
  criarSessaoComPapel,
  entrar,
  type Sessao,
} from "./helpers/empresa";

/**
 * RBAC nas telas: um usuário "visualizador" não pode ver ações de escrita
 * em RDO, Obras e Cadastros, enquanto o admin da mesma empresa vê todas.
 */
test.describe("RBAC nas telas — RDO, Obras e Cadastros", () => {
  test.skip(!SUPABASE_URL || !SUPABASE_KEY, "Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  let admin: Sessao;
  let leitor: Sessao;

  test.beforeAll(async ({ browser, baseURL }) => {
    admin = await criarSessao(browser, baseURL, "telaAdm");
    leitor = await criarSessaoComPapel(browser, baseURL, admin, "visualizador", "telaLeitor");
    const obraId = await criarObra(admin, "Obra Telas");
    await criarRdo(admin, obraId);
  });

  async function aguardarAcessos(page: Page) {
    // As guardas <Pode> só renderizam depois que meus_acessos() responde.
    await page.waitForLoadState("networkidle");
  }

  const telas = [
    { rota: "/obras", titulo: /Obras/i, acao: "Nova obra" },
    { rota: "/rdo", titulo: /RDO/i, acao: "Novo RDO" },
    { rota: "/cadastros/equipamentos", titulo: /Equipamentos/i, acao: "Novo" },
    { rota: "/cadastros/mao-de-obra", titulo: /Mão de obra/i, acao: "Novo" },
    { rota: "/cadastros/ocorrencias", titulo: /ocorrência/i, acao: "Novo" },
  ];

  for (const { rota, titulo, acao } of telas) {
    test(`visualizador abre ${rota} sem a ação "${acao}"`, async ({ page }) => {
      await entrar(page, leitor.email);
      await page.goto(rota);
      await expect(page.getByRole("heading", { name: titulo }).first()).toBeVisible({ timeout: 20_000 });
      await aguardarAcessos(page);
      await expect(page.getByRole("button", { name: acao, exact: true })).toHaveCount(0);
    });

    test(`admin abre ${rota} com a ação "${acao}" disponível`, async ({ page }) => {
      await entrar(page, admin.email);
      await page.goto(rota);
      await expect(page.getByRole("heading", { name: titulo }).first()).toBeVisible({ timeout: 20_000 });
      await aguardarAcessos(page);
      await expect(page.getByRole("button", { name: acao, exact: true }).first()).toBeVisible({ timeout: 20_000 });
    });
  }

  test("visualizador consegue ler a listagem de RDOs (sem tela em branco)", async ({ page }) => {
    const erros: string[] = [];
    page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
    await entrar(page, leitor.email);
    await page.goto("/rdo");
    await expect(page.getByRole("heading", { name: /RDO/i }).first()).toBeVisible({ timeout: 20_000 });
    await aguardarAcessos(page);
    expect(erros.filter((e) => /Acesso negado|permiss/i.test(e)), erros.join("\n")).toHaveLength(0);
  });

  test("visualizador não acessa a administração de permissões", async ({ page }) => {
    await entrar(page, leitor.email);
    await page.goto("/configuracoes/acessos");
    await aguardarAcessos(page);
    const conteudo = (await page.locator("body").innerText()).toLowerCase();
    const bloqueado =
      /sem permiss|acesso negado|não autorizado|nao autorizado/.test(conteudo) ||
      !/configuracoes\/acessos/.test(page.url());
    expect(bloqueado, `URL: ${page.url()}`).toBe(true);
  });
});
