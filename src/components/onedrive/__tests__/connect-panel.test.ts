import { describe, expect, it } from "vitest";
import { classificarEstadoConexao } from "@/components/onedrive/ConnectPanel";

describe("Estado da conexão OneDrive na tela de configurações", () => {
  it("mostra 'verificando' enquanto a checagem roda", () => {
    expect(classificarEstadoConexao({ carregando: true, ok: false })).toBe("verificando");
  });

  it("mostra 'conectado' quando a verificação passa", () => {
    expect(classificarEstadoConexao({ carregando: false, ok: true })).toBe("conectado");
  });

  it("distingue falta de acesso à conexão de simples desconexão", () => {
    expect(
      classificarEstadoConexao({
        carregando: false,
        ok: false,
        erro: "Esta conta não tem acesso à conexão OneDrive do workspace.",
      }),
    ).toBe("sem_acesso");

    expect(
      classificarEstadoConexao({
        carregando: false,
        ok: false,
        erro: "O OneDrive ainda não está conectado a este projeto.",
      }),
    ).toBe("desconectado");
  });
});
