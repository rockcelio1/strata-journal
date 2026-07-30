import { describe, expect, it } from "vitest";
import { verificarEscopos, ESCOPOS_OBRIGATORIOS } from "@/lib/onedrive-appuser.server";

describe("Verificação dos escopos OAuth do OneDrive", () => {
  it("aprova quando a Microsoft concede tudo (offline_access via refresh token)", () => {
    const v = verificarEscopos("openid profile email User.Read Files.ReadWrite", true);
    expect(v.ok).toBe(true);
    expect(v.faltando).toEqual([]);
    expect(v.obrigatorios).toEqual(ESCOPOS_OBRIGATORIOS);
  });

  it("aceita escopos com o prefixo completo do Graph e Files.ReadWrite.All", () => {
    const v = verificarEscopos(
      "https://graph.microsoft.com/User.Read https://graph.microsoft.com/Files.ReadWrite.All",
      true,
    );
    expect(v.ok).toBe(true);
  });

  it("aponta o que falta quando não há refresh token nem gravação", () => {
    const v = verificarEscopos("openid User.Read", false);
    expect(v.ok).toBe(false);
    expect(v.faltando).toContain("Files.ReadWrite");
    expect(v.faltando).toContain("offline_access");
  });

  it("não quebra quando a Microsoft não devolve escopo algum", () => {
    const v = verificarEscopos(undefined, false);
    expect(v.ok).toBe(false);
    expect(v.concedidos).toEqual([]);
    expect(v.faltando).toEqual(ESCOPOS_OBRIGATORIOS);
  });
});
