import { test, expect } from "@playwright/test";
import {
  SUPABASE_URL,
  SUPABASE_KEY,
  atualizar,
  criarObra,
  criarRdo,
  criarSessao,
  selecionar,
  bloqueado,
  type Sessao,
} from "./helpers/empresa";

/**
 * Trilha de aprovação do RDO.
 *
 * Valida as transições rascunho → enviado → aprovado/reprovado, o registro em
 * `rdo_audit_logs` e — principalmente — que nenhuma ação de aprovação vaza
 * para RDOs de outra empresa, mesmo com o UUID em mãos.
 */
test.describe("RDO — trilha de aprovação e isolamento", () => {
  test.skip(
    !SUPABASE_URL || !SUPABASE_KEY,
    "Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY",
  );
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  let a: Sessao;
  let b: Sessao;
  let obraA: string;
  let rdoA: string;

  test.beforeAll(async ({ browser, baseURL }) => {
    a = await criarSessao(browser, baseURL, "rdoA");
    b = await criarSessao(browser, baseURL, "rdoB");
    expect(a.empresaId).not.toBe(b.empresaId);
    obraA = await criarObra(a, "Obra Aprovação");
    rdoA = await criarRdo(a, obraA);
  });

  test("autor envia o RDO para aprovação", async () => {
    const res = await atualizar(a.token, `rdos?id=eq.${rdoA}`, {
      status: "enviado",
      enviado_em: new Date().toISOString(),
      submitted_by: a.userId,
    });
    expect(res.status).toBeLessThan(300);
    expect(res.body[0].status).toBe("enviado");
  });

  test("cada transição gera registro na auditoria do RDO", async () => {
    const logs = await selecionar(
      a.token,
      `rdo_audit_logs?select=acao,status_anterior,status_novo&rdo_id=eq.${rdoA}&order=created_at.asc`,
    );
    expect(logs.status).toBe(200);
    const acoes = (logs.body as any[]).map((l) => l.acao);
    expect(acoes).toContain("criado");
    expect(acoes).toContain("enviado_para_aprovacao");
  });

  test("usuário de outra empresa não enxerga o RDO mesmo com o ID válido", async () => {
    const res = await selecionar(b.token, `rdos?select=id,status&id=eq.${rdoA}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("usuário de outra empresa não consegue aprovar o RDO", async () => {
    const res = await atualizar(b.token, `rdos?id=eq.${rdoA}`, {
      status: "aprovado",
      aprovado_por: b.userId,
      aprovado_em: new Date().toISOString(),
    });
    expect(bloqueado(res), `esperado bloqueio, veio ${JSON.stringify(res)}`).toBe(true);

    const conferencia = await selecionar(a.token, `rdos?select=status,aprovado_por&id=eq.${rdoA}`);
    expect(conferencia.body[0].status).toBe("enviado");
    expect(conferencia.body[0].aprovado_por).toBeNull();
  });

  test("usuário de outra empresa não consegue reprovar o RDO", async () => {
    const res = await atualizar(b.token, `rdos?id=eq.${rdoA}`, {
      status: "reprovado",
      motivo_reprovacao: "invasão",
    });
    expect(bloqueado(res)).toBe(true);
    const conferencia = await selecionar(a.token, `rdos?select=status&id=eq.${rdoA}`);
    expect(conferencia.body[0].status).toBe("enviado");
  });

  test("aprovação pelo admin da própria empresa é aceita e auditada", async () => {
    const res = await atualizar(a.token, `rdos?id=eq.${rdoA}`, {
      status: "aprovado",
      aprovado_por: a.userId,
      aprovado_em: new Date().toISOString(),
    });
    expect(res.status).toBeLessThan(300);
    expect(res.body[0].status).toBe("aprovado");

    const logs = await selecionar(
      a.token,
      `rdo_audit_logs?select=acao,status_novo&rdo_id=eq.${rdoA}&acao=eq.aprovado`,
    );
    expect((logs.body as any[]).length).toBeGreaterThan(0);
  });

  test("reprovação de um RDO não altera RDOs de outra empresa", async () => {
    const obraB = await criarObra(b, "Obra B");
    const rdoB = await criarRdo(b, obraB);

    await atualizar(b.token, `rdos?id=eq.${rdoB}`, {
      status: "reprovado",
      motivo_reprovacao: "teste",
    });

    const doA = await selecionar(a.token, `rdos?select=status&id=eq.${rdoA}`);
    expect(doA.body[0].status).toBe("aprovado");

    const listaA = await selecionar(a.token, "rdos?select=id,empresa_id");
    for (const row of listaA.body as any[]) {
      expect(row.empresa_id).toBe(a.empresaId);
    }
  });

  test("anônimo não consegue ler nem alterar RDOs", async () => {
    const leitura = await fetch(`${SUPABASE_URL}/rest/v1/rdos?select=id&id=eq.${rdoA}`, {
      headers: { apikey: SUPABASE_KEY },
    });
    if (leitura.status === 200) {
      expect(await leitura.json()).toEqual([]);
    } else {
      expect(leitura.status).toBeGreaterThanOrEqual(400);
    }

    const escrita = await fetch(`${SUPABASE_URL}/rest/v1/rdos?id=eq.${rdoA}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rascunho" }),
    });
    expect(escrita.status).toBeGreaterThanOrEqual(400);
  });
});
