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
  selecionar,
  type Sessao,
} from "./helpers/empresa";

/**
 * Isolamento CRUD entre empresas: criar, ler, editar e excluir registros
 * alheios deve falhar — inclusive quando o atacante conhece o UUID exato.
 */
test.describe("RLS — CRUD cruzado entre empresas", () => {
  test.skip(
    !SUPABASE_URL || !SUPABASE_KEY,
    "Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY",
  );
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  let a: Sessao;
  let b: Sessao;
  const ids: Record<string, string> = {};

  test.beforeAll(async ({ browser, baseURL }) => {
    a = await criarSessao(browser, baseURL, "crudA");
    b = await criarSessao(browser, baseURL, "crudB");
    expect(a.empresaId).not.toBe(b.empresaId);

    ids.obra = await criarObra(a, "Obra Isolamento");
    ids.rdo = await criarRdo(a, ids.obra);

    const equip = await inserir(a.token, "equipamentos", {
      empresa_id: a.empresaId,
      nome: `Escavadeira ${Date.now()}`,
    });
    expect(equip.status).toBeLessThan(300);
    ids.equipamento = equip.body[0].id;

    const mao = await inserir(a.token, "mao_de_obra", {
      empresa_id: a.empresaId,
      nome: `Pedreiro ${Date.now()}`,
      funcao: "Pedreiro",
    });
    expect(mao.status).toBeLessThan(300);
    ids.mao_de_obra = mao.body[0].id;

    const tipo = await inserir(a.token, "tipos_ocorrencia", {
      empresa_id: a.empresaId,
      nome: `Chuva ${Date.now()}`,
    });
    expect(tipo.status).toBeLessThan(300);
    ids.tipo_ocorrencia = tipo.body[0].id;
  });

  const tabelas = ["obras", "rdos", "equipamentos", "mao_de_obra", "tipos_ocorrencia"] as const;
  const chave: Record<(typeof tabelas)[number], string> = {
    obras: "obra",
    rdos: "rdo",
    equipamentos: "equipamento",
    mao_de_obra: "mao_de_obra",
    tipos_ocorrencia: "tipo_ocorrencia",
  };

  for (const tabela of tabelas) {
    test(`${tabela}: leitura por ID conhecido de outra empresa retorna vazio`, async () => {
      const res = await selecionar(b.token, `${tabela}?select=id&id=eq.${ids[chave[tabela]]}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test(`${tabela}: edição de registro de outra empresa é bloqueada`, async () => {
      const res = await atualizar(b.token, `${tabela}?id=eq.${ids[chave[tabela]]}`, {
        ...(tabela === "rdos" ? { observacoes: "invadido" } : { nome: "invadido" }),
      });
      expect(bloqueado(res), `esperado bloqueio: ${JSON.stringify(res)}`).toBe(true);
    });

    test(`${tabela}: exclusão de registro de outra empresa é bloqueada`, async () => {
      const res = await remover(b.token, `${tabela}?id=eq.${ids[chave[tabela]]}`);
      expect(bloqueado(res), `esperado bloqueio: ${JSON.stringify(res)}`).toBe(true);

      const ainda = await selecionar(a.token, `${tabela}?select=id&id=eq.${ids[chave[tabela]]}`);
      expect(ainda.body).toHaveLength(1);
    });
  }

  test("criação de registros com empresa_id alheio é recusada", async () => {
    const tentativas = [
      inserir(b.token, "obras", { empresa_id: a.empresaId, nome: "Obra invadida" }),
      inserir(b.token, "equipamentos", { empresa_id: a.empresaId, nome: "Equip invadido" }),
      inserir(b.token, "mao_de_obra", {
        empresa_id: a.empresaId,
        nome: "MO invadida",
        funcao: "Servente",
      }),
      inserir(b.token, "tipos_ocorrencia", { empresa_id: a.empresaId, nome: "Tipo invadido" }),
      inserir(b.token, "rdos", {
        empresa_id: a.empresaId,
        obra_id: ids.obra,
        numero: 999999,
        data: new Date().toISOString().slice(0, 10),
        autor_id: b.userId,
      }),
    ];
    for (const res of await Promise.all(tentativas)) {
      expect(res.status, `esperado erro RLS: ${JSON.stringify(res.body)}`).toBeGreaterThanOrEqual(
        400,
      );
    }
  });

  test("papéis e perfis de outra empresa não são legíveis por ID", async () => {
    const papel = await selecionar(
      b.token,
      `user_roles?select=user_id,role&user_id=eq.${a.userId}`,
    );
    expect(papel.body).toEqual([]);

    const perfil = await selecionar(b.token, `profiles?select=id,email&id=eq.${a.userId}`);
    expect(perfil.body).toEqual([]);

    const empresa = await selecionar(b.token, `empresas?select=id,nome&id=eq.${a.empresaId}`);
    expect(empresa.body).toEqual([]);
  });

  test("escalada de privilégio: inserir papel admin em empresa alheia falha", async () => {
    const res = await inserir(b.token, "user_roles", {
      user_id: b.userId,
      empresa_id: a.empresaId,
      role: "admin",
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("listagens só devolvem linhas da própria empresa", async () => {
    for (const tabela of tabelas) {
      const res = await selecionar(b.token, `${tabela}?select=empresa_id`);
      expect(res.status).toBe(200);
      for (const row of res.body as any[]) {
        expect(row.empresa_id).toBe(b.empresaId);
      }
    }
  });

  test("anônimo não cria nem lê registros", async () => {
    const criar = await fetch(`${SUPABASE_URL}/rest/v1/obras`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ empresa_id: a.empresaId, nome: "anon" }),
    });
    expect(criar.status).toBeGreaterThanOrEqual(400);

    const ler = await fetch(`${SUPABASE_URL}/rest/v1/equipamentos?select=id`, {
      headers: { apikey: SUPABASE_KEY },
    });
    if (ler.status === 200) expect(await ler.json()).toEqual([]);
    else expect(ler.status).toBeGreaterThanOrEqual(400);
  });
});
