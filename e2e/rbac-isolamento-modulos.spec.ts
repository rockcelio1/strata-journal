import { test, expect } from "@playwright/test";
import {
  SUPABASE_URL,
  SUPABASE_KEY,
  atualizar,
  bloqueado,
  criarObra,
  criarRdo,
  criarSessao,
  inserir,
  remover,
  rpc,
  selecionar,
  type Sessao,
} from "./helpers/empresa";

/**
 * Isolamento por empresa nos três módulos centrais — RDO, Obras e Cadastros —
 * cobrindo tabelas-filhas (atividades, ocorrências, mão de obra do RDO, fotos
 * da obra) e as funções RPC privilegiadas.
 *
 * Toda chamada usa a Data API com o token real do usuário, logo a RLS é
 * exercitada exatamente como no runtime do app.
 */
test.describe("Isolamento por empresa — RDO, Obras e Cadastros", () => {
  test.skip(!SUPABASE_URL || !SUPABASE_KEY, "Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  let a: Sessao;
  let b: Sessao;
  const ids: Record<string, string> = {};

  test.beforeAll(async ({ browser, baseURL }) => {
    a = await criarSessao(browser, baseURL, "isoA");
    b = await criarSessao(browser, baseURL, "isoB");
    expect(a.empresaId).not.toBe(b.empresaId);

    ids.obra = await criarObra(a, "Obra Módulos");
    ids.rdo = await criarRdo(a, ids.obra);

    const equip = await inserir(a.token, "equipamentos", {
      empresa_id: a.empresaId,
      nome: `Equip ${Date.now()}`,
    });
    ids.equipamento = equip.body[0].id;

    const mo = await inserir(a.token, "mao_de_obra", {
      empresa_id: a.empresaId,
      nome: `MO ${Date.now()}`,
      funcao: "Pedreiro",
    });
    ids.mao_de_obra = mo.body[0].id;

    const tipo = await inserir(a.token, "tipos_ocorrencia", {
      empresa_id: a.empresaId,
      nome: `Tipo ${Date.now()}`,
    });
    ids.tipo = tipo.body[0].id;

    const atividade = await inserir(a.token, "rdo_atividades", {
      rdo_id: ids.rdo,
      descricao: "Concretagem do bloco 1",
    });
    expect(atividade.status, `atividade: ${JSON.stringify(atividade.body)}`).toBeLessThan(300);
    ids.atividade = atividade.body[0].id;
  });

  // ---------------------------------------------------------------- RDO ----
  test("RDO: registro de outra empresa é invisível por ID", async () => {
    const res = await selecionar(b.token, `rdos?select=id,numero&id=eq.${ids.rdo}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("RDO: tabelas-filhas não vazam para outra empresa", async () => {
    const atividades = await selecionar(b.token, `rdo_atividades?select=id&rdo_id=eq.${ids.rdo}`);
    expect(atividades.body).toEqual([]);

    const anexos = await selecionar(b.token, `rdo_anexos?select=id&rdo_id=eq.${ids.rdo}`);
    expect(anexos.body).toEqual([]);

    const logs = await selecionar(b.token, `rdo_audit_logs?select=id&rdo_id=eq.${ids.rdo}`);
    expect(logs.body).toEqual([]);
  });

  test("RDO: inserir atividade em RDO alheio é recusado", async () => {
    const res = await inserir(b.token, "rdo_atividades", {
      rdo_id: ids.rdo,
      descricao: "atividade injetada",
    });
    expect(res.status, JSON.stringify(res.body)).toBeGreaterThanOrEqual(400);
  });

  test("RDO: aprovar/reprovar RDO alheio não tem efeito", async () => {
    const res = await atualizar(b.token, `rdos?id=eq.${ids.rdo}`, { status: "aprovado" });
    expect(bloqueado(res), JSON.stringify(res)).toBe(true);

    const atual = await selecionar(a.token, `rdos?select=status&id=eq.${ids.rdo}`);
    expect(atual.body[0].status).toBe("rascunho");
  });

  test("RDO: RPCs privilegiadas rejeitam RDO de outra empresa", async () => {
    const softDelete = await rpc(b.token, "soft_delete_rdo", { _rdo_id: ids.rdo });
    expect(softDelete.status).toBeGreaterThanOrEqual(400);

    const adminDelete = await rpc(b.token, "admin_soft_delete_rdo", { _rdo_id: ids.rdo });
    expect(adminDelete.status).toBeGreaterThanOrEqual(400);

    const adminEdit = await rpc(b.token, "admin_update_rdo_basico", {
      _rdo_id: ids.rdo,
      _obra_id: null,
      _data: null,
      _observacoes: "invadido",
      _clima_manha: null,
      _clima_tarde: null,
      _clima_noite: null,
    });
    expect(adminEdit.status).toBeGreaterThanOrEqual(400);

    const intacto = await selecionar(a.token, `rdos?select=deleted_at,observacoes&id=eq.${ids.rdo}`);
    expect(intacto.body[0].deleted_at).toBeNull();
    expect(intacto.body[0].observacoes ?? "").not.toBe("invadido");
  });

  // -------------------------------------------------------------- Obras ----
  test("Obras: vinculações e fotos de outra empresa são inacessíveis", async () => {
    const obra = await selecionar(b.token, `obras?select=id&id=eq.${ids.obra}`);
    expect(obra.body).toEqual([]);

    const fotos = await selecionar(b.token, `obra_fotos?select=id&obra_id=eq.${ids.obra}`);
    expect(fotos.body).toEqual([]);

    const permitidos = await inserir(b.token, "obra_equipamentos_permitidos", {
      empresa_id: b.empresaId,
      obra_id: ids.obra,
      equipamento_id: ids.equipamento,
    });
    expect(permitidos.status).toBeGreaterThanOrEqual(400);
  });

  test("Obras: criar RDO apontando para obra de outra empresa falha", async () => {
    const res = await inserir(b.token, "rdos", {
      empresa_id: b.empresaId,
      obra_id: ids.obra,
      numero: 888888,
      data: new Date().toISOString().slice(0, 10),
      autor_id: b.userId,
    });
    expect(res.status, JSON.stringify(res.body)).toBeGreaterThanOrEqual(400);
  });

  // ---------------------------------------------------------- Cadastros ----
  const cadastros = [
    { tabela: "equipamentos", chave: "equipamento" },
    { tabela: "mao_de_obra", chave: "mao_de_obra" },
    { tabela: "tipos_ocorrencia", chave: "tipo" },
  ] as const;

  for (const { tabela, chave } of cadastros) {
    test(`Cadastros/${tabela}: leitura, edição e exclusão cruzadas bloqueadas`, async () => {
      const ler = await selecionar(b.token, `${tabela}?select=id&id=eq.${ids[chave]}`);
      expect(ler.body).toEqual([]);

      const editar = await atualizar(b.token, `${tabela}?id=eq.${ids[chave]}`, { nome: "invadido" });
      expect(bloqueado(editar)).toBe(true);

      const excluir = await remover(b.token, `${tabela}?id=eq.${ids[chave]}`);
      expect(bloqueado(excluir)).toBe(true);

      const intacto = await selecionar(a.token, `${tabela}?select=nome&id=eq.${ids[chave]}`);
      expect(intacto.body[0].nome).not.toBe("invadido");
    });
  }

  test("Cadastros: seeds padrão só afetam a própria empresa", async () => {
    const antesB = await selecionar(b.token, "mao_de_obra?select=empresa_id");
    const seed = await rpc(b.token, "seed_mao_de_obra_padrao", {});
    expect([200, 400, 401, 403]).toContain(seed.status);

    const depoisB = await selecionar(b.token, "mao_de_obra?select=empresa_id");
    for (const row of depoisB.body as any[]) expect(row.empresa_id).toBe(b.empresaId);
    expect(Array.isArray(antesB.body)).toBe(true);
  });

  test("Listagens dos três módulos só retornam a própria empresa", async () => {
    for (const tabela of ["rdos", "obras", "equipamentos", "mao_de_obra", "tipos_ocorrencia"]) {
      const res = await selecionar(b.token, `${tabela}?select=empresa_id`);
      expect(res.status).toBe(200);
      for (const row of res.body as any[]) expect(row.empresa_id).toBe(b.empresaId);
    }
  });
});
