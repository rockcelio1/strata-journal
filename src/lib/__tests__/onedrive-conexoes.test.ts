import { describe, expect, it } from "vitest";
import {
  ESCOPOS_ONEDRIVE,
  conexaoPermitida,
  detectarConexoes,
  mascararChave,
  montarDiagnosticoVinculo,
  montarPedidoLiberacao,
} from "@/lib/onedrive-conexoes";

describe("Conexões OneDrive disponíveis no projeto", () => {
  it("sem vínculo no workspace, não lista nenhuma conexão", () => {
    expect(detectarConexoes({ OUTRA_COISA: "x" })).toEqual([]);
    expect(detectarConexoes({ MICROSOFT_ONEDRIVE_API_KEY: "   " })).toEqual([]);
  });

  it("lista a conexão padrão e as adicionais, sem expor a chave", () => {
    const lista = detectarConexoes({
      MICROSOFT_ONEDRIVE_API_KEY: "lovack_primeira_chave_1234",
      MICROSOFT_ONEDRIVE_API_KEY_2: "lovack_segunda_chave_9876",
      LOVABLE_API_KEY: "nao_entra",
    });
    expect(lista.map((c) => c.envName)).toEqual([
      "MICROSOFT_ONEDRIVE_API_KEY",
      "MICROSOFT_ONEDRIVE_API_KEY_2",
    ]);
    expect(lista[0].padrao).toBe(true);
    expect(lista[1].rotulo).toContain("#2");
    for (const c of lista) expect(c.id).not.toContain("chave");
  });

  it("mascara a chave preservando apenas as pontas", () => {
    expect(mascararChave("lovack_abcdef_1234")).toBe("lova••••1234");
    expect(mascararChave("curta")).toBe("••••");
  });

  it("só permite vincular conexões realmente presentes", () => {
    const env = { MICROSOFT_ONEDRIVE_API_KEY: "lovack_chave_valida" };
    expect(conexaoPermitida(env, "MICROSOFT_ONEDRIVE_API_KEY")).toBe(true);
    expect(conexaoPermitida(env, "SUPABASE_SERVICE_ROLE_KEY")).toBe(false);
    expect(conexaoPermitida(env, "MICROSOFT_ONEDRIVE_API_KEY_9")).toBe(false);
  });
});

describe("Pedido de liberação ao admin do workspace", () => {
  it("inclui erro, escopos e instruções acionáveis", () => {
    const texto = montarPedidoLiberacao({
      conexaoId: "lova••••1234",
      organizacao: "FACOM Engenharia",
      requestId: "req-abc-123",
      status: 403,
      erro: "Esta conta não tem acesso à conexão OneDrive do workspace.",
      projeto: "Diário de Obra FACOM",
      usuario: "cpd@facom.com.br",
    });
    for (const escopo of ESCOPOS_ONEDRIVE) expect(texto).toContain(escopo);
    expect(texto).toContain("Conectores → OneDrive");
    expect(texto).toContain("req-abc-123");
    expect(texto).toContain("403");
    expect(texto).toContain("FACOM Engenharia");
    expect(texto).toContain("cpd@facom.com.br");
  });

  it("é legível mesmo sem nenhum dado de conexão", () => {
    const texto = montarPedidoLiberacao({});
    expect(texto).toContain("sem conexão vinculada ao projeto");
    expect(texto).toContain("sem resposta");
    expect(texto).not.toContain("undefined");
  });
});

describe("Diagnóstico de falha na vinculação", () => {
  it("traz conexão, conta, request-id, status e checklist", () => {
    const d = montarDiagnosticoVinculo({
      conexaoId: "lova••••1234",
      conta: "sistemas@facom.com.br",
      requestId: "req-9",
      status: 401,
      erro: "token expirado",
    });
    expect(d.conexaoId).toBe("lova••••1234");
    expect(d.organizacao).toBe("sistemas@facom.com.br");
    expect(d.requestId).toBe("req-9");
    expect(d.status).toBe("401");
    expect(d.checklist.length).toBeGreaterThanOrEqual(4);
    expect(d.checklist.join(" ")).toContain("vinculada a ESTE projeto");
  });

  it("usa textos explícitos quando falta informação", () => {
    const d = montarDiagnosticoVinculo({});
    expect(d.conexaoId).toContain("nenhuma conexão");
    expect(d.requestId).toContain("não retornado");
    expect(d.status).toBe("sem resposta");
  });
});
