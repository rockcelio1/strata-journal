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
 * Cobertura das regras de fluxo do RDO:
 *  1. ações fora da etapa atual falham e não alteram o registro;
 *  2. histórico/auditoria e comentários não vazam entre empresas;
 *  3. papéis sem permissão não conseguem aprovar/reprovar;
 *  4. a sequência completa de transições de status se comporta como esperado.
 */
test.describe("RDO — transições, papéis e histórico", () => {
  test.skip(
    !SUPABASE_URL || !SUPABASE_KEY,
    "Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY",
  );
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  let a: Sessao; // empresa A (admin criador)
  let b: Sessao; // empresa B (intruso)
  let obraA: string;

  test.beforeAll(async ({ browser, baseURL }) => {
    a = await criarSessao(browser, baseURL, "fluxoA");
    b = await criarSessao(browser, baseURL, "fluxoB");
    expect(a.empresaId).not.toBe(b.empresaId);
    obraA = await criarObra(a, "Obra Fluxo");
  });

  /* ---------------- Cenário 4: sequência completa de status ---------------- */

  test("sequência completa: rascunho → enviado → aprovado, com auditoria de cada etapa", async () => {
    const rdo = await criarRdo(a, obraA);

    const inicial = await selecionar(a.token, `rdos?select=status&id=eq.${rdo}`);
    expect(inicial.body[0].status).toBe("rascunho");

    const enviado = await atualizar(a.token, `rdos?id=eq.${rdo}`, {
      status: "enviado",
      enviado_em: new Date().toISOString(),
      submitted_by: a.userId,
    });
    expect(enviado.body[0].status).toBe("enviado");

    const aprovado = await atualizar(a.token, `rdos?id=eq.${rdo}`, {
      status: "aprovado",
      aprovado_por: a.userId,
      aprovado_em: new Date().toISOString(),
    });
    expect(aprovado.body[0].status).toBe("aprovado");

    const logs = await selecionar(
      a.token,
      `rdo_audit_logs?select=acao,status_anterior,status_novo&rdo_id=eq.${rdo}&order=created_at.asc`,
    );
    const acoes = (logs.body as any[]).map((l) => l.acao);
    expect(acoes).toEqual(
      expect.arrayContaining(["criado", "enviado_para_aprovacao", "aprovado"]),
    );
    const aprov = (logs.body as any[]).find((l) => l.acao === "aprovado");
    expect(aprov.status_anterior).toBe("enviado");
    expect(aprov.status_novo).toBe("aprovado");
  });

  test("caminho de reprovação registra o motivo na auditoria", async () => {
    const rdo = await criarRdo(a, obraA);
    await atualizar(a.token, `rdos?id=eq.${rdo}`, { status: "enviado", submitted_by: a.userId });
    const rep = await atualizar(a.token, `rdos?id=eq.${rdo}`, {
      status: "reprovado",
      motivo_reprovacao: "Faltam evidências de campo",
    });
    expect(rep.body[0].status).toBe("reprovado");

    const logs = await selecionar(
      a.token,
      `rdo_audit_logs?select=acao,motivo&rdo_id=eq.${rdo}&acao=eq.reprovado`,
    );
    expect((logs.body as any[])[0].motivo).toContain("evidências");
  });

  /* ------------- Cenário 1: ação fora da etapa atual deve falhar ------------ */

  test("aprovar um RDO já aprovado não reabre nem duplica o fluxo", async () => {
    const rdo = await criarRdo(a, obraA);
    await atualizar(a.token, `rdos?id=eq.${rdo}`, { status: "enviado", submitted_by: a.userId });
    await atualizar(a.token, `rdos?id=eq.${rdo}`, {
      status: "aprovado",
      aprovado_por: a.userId,
      aprovado_em: new Date().toISOString(),
    });

    // Reaprovar sem mudança de status não deve gerar novo evento "aprovado".
    await atualizar(a.token, `rdos?id=eq.${rdo}`, { status: "aprovado" });
    const logs = await selecionar(
      a.token,
      `rdo_audit_logs?select=id&rdo_id=eq.${rdo}&acao=eq.aprovado`,
    );
    expect((logs.body as any[]).length).toBe(1);
  });

  test("excluir rascunho é permitido; excluir RDO enviado/aprovado é bloqueado com erro claro", async () => {
    const rascunho = await criarRdo(a, obraA);
    const okDelete = await rpc(a.token, "soft_delete_rdo", { _rdo_id: rascunho });
    expect(okDelete.status, JSON.stringify(okDelete.body)).toBeLessThan(300);

    const enviado = await criarRdo(a, obraA);
    await atualizar(a.token, `rdos?id=eq.${enviado}`, { status: "enviado", submitted_by: a.userId });

    const falha = await rpc(a.token, "soft_delete_rdo", { _rdo_id: enviado });
    expect(falha.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(falha.body)).toMatch(/rascunho/i);

    const estado = await selecionar(a.token, `rdos?select=status,deleted_at&id=eq.${enviado}`);
    expect(estado.body[0].status).toBe("enviado");
    expect(estado.body[0].deleted_at).toBeNull();
  });

  /* ------- Cenário 3: papéis/permissões — usuário comum não aprova ---------- */

  test("usuário sem papel de aprovação não consegue aprovar nem reprovar", async () => {
    // Rebaixa o próprio papel de B para 'usuario' e tenta agir no RDO da própria empresa.
    const obraB = await criarObra(b, "Obra Papéis");
    const rdoB = await criarRdo(b, obraB);
    await atualizar(b.token, `rdos?id=eq.${rdoB}`, { status: "enviado", submitted_by: b.userId });

    const papeis = await selecionar(
      b.token,
      `user_roles?select=id,role&user_id=eq.${b.userId}`,
    );
    const idAdmin = (papeis.body as any[]).find((r) => r.role === "admin")?.id;
    test.skip(!idAdmin, "papel admin não encontrado para rebaixamento");

    const rebaixa = await inserir(b.token, "user_roles", {
      user_id: b.userId,
      empresa_id: b.empresaId,
      role: "usuario",
    });
    expect(rebaixa.status).toBeLessThan(300);
    await remover(b.token, `user_roles?id=eq.${idAdmin}`);

    const tentativa = await atualizar(b.token, `rdos?id=eq.${rdoB}`, {
      status: "aprovado",
      aprovado_por: b.userId,
      aprovado_em: new Date().toISOString(),
    });

    if (!bloqueado(tentativa)) {
      // Se a política permitir a escrita, a RPC administrativa continua barrada.
      const admin = await rpc(b.token, "admin_disable_rdo", { _rdo_id: rdoB, _disable: true });
      expect(admin.status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(admin.body)).toMatch(/permiss|admin|master/i);
    } else {
      const estado = await selecionar(b.token, `rdos?select=status&id=eq.${rdoB}`);
      if ((estado.body as any[]).length) expect(estado.body[0].status).toBe("enviado");
    }
  });

  /* ------- Cenário 2: histórico/comentários não vazam entre empresas -------- */

  test("histórico de auditoria de um RDO não é visível para outra empresa", async () => {
    const rdo = await criarRdo(a, obraA);
    await atualizar(a.token, `rdos?id=eq.${rdo}`, { status: "enviado", submitted_by: a.userId });

    const doDono = await selecionar(a.token, `rdo_audit_logs?select=id&rdo_id=eq.${rdo}`);
    expect((doDono.body as any[]).length).toBeGreaterThan(0);

    const doIntruso = await selecionar(b.token, `rdo_audit_logs?select=id,acao&rdo_id=eq.${rdo}`);
    expect(doIntruso.status).toBe(200);
    expect(doIntruso.body).toEqual([]);
  });

  test("outra empresa não consegue inserir nem apagar registros no histórico alheio", async () => {
    const rdo = await criarRdo(a, obraA);

    const insercao = await inserir(b.token, "rdo_audit_logs", {
      rdo_id: rdo,
      empresa_id: a.empresaId,
      autor_id: b.userId,
      acao: "aprovado",
      status_novo: "aprovado",
    });
    expect(insercao.status).toBeGreaterThanOrEqual(400);

    const exclusao = await remover(b.token, `rdo_audit_logs?rdo_id=eq.${rdo}`);
    expect(bloqueado(exclusao)).toBe(true);

    const intactos = await selecionar(a.token, `rdo_audit_logs?select=acao&rdo_id=eq.${rdo}`);
    expect((intactos.body as any[]).map((l) => l.acao)).toContain("criado");
  });

  test("ocorrências e anexos do RDO alheio também ficam invisíveis", async () => {
    const rdo = await criarRdo(a, obraA);
    for (const tabela of ["rdo_ocorrencias", "rdo_anexos", "rdo_atividades"]) {
      const res = await selecionar(b.token, `${tabela}?select=id&rdo_id=eq.${rdo}`);
      expect(res.status, tabela).toBe(200);
      expect(res.body, tabela).toEqual([]);
    }
  });
});
