import { test, expect } from "@playwright/test";
import {
  SUPABASE_URL,
  SUPABASE_KEY,
  atualizar,
  bloqueado,
  criarObra,
  criarRdo,
  criarSessao,
  criarSessaoComPapel,
  inserir,
  podeNoBanco,
  remover,
  rpc,
  selecionar,
  type Sessao,
} from "./helpers/empresa";

/**
 * RBAC por papel dentro da MESMA empresa.
 *
 * O usuário "visualizador" é criado pelo fluxo real de convite, portanto os
 * grants vêm de `perm_role_grants` — a mesma fonte usada por `pode()` no banco,
 * pelas server functions (`exigirPermissao`) e pela UI (`useAcessos`).
 */
test.describe("RBAC por papel — RDO, Obras e Cadastros", () => {
  test.skip(!SUPABASE_URL || !SUPABASE_KEY, "Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  let admin: Sessao;
  let leitor: Sessao;
  const ids: Record<string, string> = {};

  test.beforeAll(async ({ browser, baseURL }) => {
    admin = await criarSessao(browser, baseURL, "rbacAdm");
    leitor = await criarSessaoComPapel(browser, baseURL, admin, "visualizador", "rbacLeitor");

    ids.obra = await criarObra(admin, "Obra RBAC");
    ids.rdo = await criarRdo(admin, ids.obra);

    const equip = await inserir(admin.token, "equipamentos", {
      empresa_id: admin.empresaId,
      nome: `Equip RBAC ${Date.now()}`,
    });
    ids.equipamento = equip.body[0].id;
  });

  test("admin e visualizador compartilham a mesma empresa", () => {
    expect(leitor.empresaId).toBe(admin.empresaId);
    expect(leitor.userId).not.toBe(admin.userId);
  });

  test("matriz de permissões do visualizador: lê, mas não escreve", async () => {
    const recursos = ["diario.rdos", "obras.obras", "cadastros.equipamentos", "cadastros.mao_de_obra"];
    for (const recurso of recursos) {
      expect(await podeNoBanco(leitor, recurso, "ver"), `${recurso}:ver`).toBe(true);
      for (const acao of ["criar", "editar", "excluir"]) {
        expect(await podeNoBanco(leitor, recurso, acao), `${recurso}:${acao}`).toBe(false);
      }
    }
    expect(await podeNoBanco(leitor, "diario.rdos", "aprovar")).toBe(false);
    expect(await podeNoBanco(leitor, "admin.usuarios", "editar")).toBe(false);
    expect(await podeNoBanco(leitor, "admin.permissoes", "editar")).toBe(false);
  });

  test("admin mantém permissões de escrita e aprovação", async () => {
    expect(await podeNoBanco(admin, "diario.rdos", "criar")).toBe(true);
    expect(await podeNoBanco(admin, "diario.rdos", "aprovar")).toBe(true);
    expect(await podeNoBanco(admin, "obras.obras", "excluir")).toBe(true);
    expect(await podeNoBanco(admin, "cadastros.equipamentos", "editar")).toBe(true);
  });

  test("meus_acessos() do visualizador não expõe ações de escrita", async () => {
    const res = await rpc(leitor.token, "meus_acessos", {});
    expect(res.status).toBe(200);
    const linhas = (res.body ?? []) as Array<{ recurso_key: string; acao: string }>;
    const escritas = linhas.filter(
      (l) =>
        ["diario.rdos", "obras.obras", "cadastros.equipamentos"].includes(l.recurso_key) &&
        ["criar", "editar", "excluir", "aprovar"].includes(l.acao),
    );
    expect(escritas, JSON.stringify(escritas)).toHaveLength(0);
  });

  test("visualizador enxerga os dados da empresa (leitura permitida)", async () => {
    const obras = await selecionar(leitor.token, `obras?select=id&id=eq.${ids.obra}`);
    expect(obras.status).toBe(200);
    expect(obras.body).toHaveLength(1);

    const rdos = await selecionar(leitor.token, `rdos?select=id&id=eq.${ids.rdo}`);
    expect(rdos.body).toHaveLength(1);
  });

  test("visualizador não cria RDO, obra nem cadastro", async () => {
    const rdo = await inserir(leitor.token, "rdos", {
      empresa_id: leitor.empresaId,
      obra_id: ids.obra,
      numero: 777777,
      data: new Date().toISOString().slice(0, 10),
      autor_id: leitor.userId,
    });
    const obra = await inserir(leitor.token, "obras", {
      empresa_id: leitor.empresaId,
      nome: "Obra do leitor",
    });
    const equip = await inserir(leitor.token, "equipamentos", {
      empresa_id: leitor.empresaId,
      nome: "Equip do leitor",
    });

    for (const [nome, res] of Object.entries({ rdo, obra, equip })) {
      expect(res.status, `${nome} deveria ser recusado: ${JSON.stringify(res.body)}`).toBeGreaterThanOrEqual(400);
    }
  });

  test("visualizador não edita nem exclui registros existentes", async () => {
    const editarObra = await atualizar(leitor.token, `obras?id=eq.${ids.obra}`, { nome: "renomeada" });
    expect(bloqueado(editarObra)).toBe(true);

    const aprovarRdo = await atualizar(leitor.token, `rdos?id=eq.${ids.rdo}`, { status: "aprovado" });
    expect(bloqueado(aprovarRdo)).toBe(true);

    const excluirEquip = await remover(leitor.token, `equipamentos?id=eq.${ids.equipamento}`);
    expect(bloqueado(excluirEquip)).toBe(true);

    const obraIntacta = await selecionar(admin.token, `obras?select=nome&id=eq.${ids.obra}`);
    expect(obraIntacta.body[0].nome).toBe("Obra RBAC");
    const rdoIntacto = await selecionar(admin.token, `rdos?select=status&id=eq.${ids.rdo}`);
    expect(rdoIntacto.body[0].status).toBe("rascunho");
  });

  test("visualizador não escala privilégios nem altera grants", async () => {
    const papel = await inserir(leitor.token, "user_roles", {
      user_id: leitor.userId,
      empresa_id: leitor.empresaId,
      role: "admin",
    });
    expect(papel.status).toBeGreaterThanOrEqual(400);

    const grant = await inserir(leitor.token, "perm_user_grants", {
      empresa_id: leitor.empresaId,
      user_id: leitor.userId,
      recurso_key: "diario.rdos",
      acao: "excluir",
      allowed: true,
      scope: "empresa",
    });
    expect(grant.status).toBeGreaterThanOrEqual(400);

    expect(await podeNoBanco(leitor, "diario.rdos", "excluir")).toBe(false);
  });

  test("visualizador não executa RPCs administrativas", async () => {
    const seed = await rpc(leitor.token, "seed_equipamentos_padrao", {});
    expect(seed.status).toBeGreaterThanOrEqual(400);

    const backup = await rpc(leitor.token, "backup_estimate", {
      _empresa: leitor.empresaId,
      _tables: ["obras"],
    });
    expect(backup.status).toBeGreaterThanOrEqual(400);

    const excluirRdo = await rpc(leitor.token, "admin_soft_delete_rdo", { _rdo_id: ids.rdo });
    expect(excluirRdo.status).toBeGreaterThanOrEqual(400);
  });
});
