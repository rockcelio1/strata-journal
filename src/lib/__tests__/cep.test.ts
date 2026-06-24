import { describe, it, expect } from "vitest";
import { normalizeCep, validarCep } from "@/lib/weather";

describe("normalizeCep", () => {
  it("retorna null para CEP vazio ou incompleto", () => {
    expect(normalizeCep("")).toBeNull();
    expect(normalizeCep("123")).toBeNull();
    expect(normalizeCep("0131010")).toBeNull(); // 7 dígitos
  });
  it("retorna null quando há mais de 8 dígitos", () => {
    expect(normalizeCep("013101000")).toBeNull();
  });
  it("normaliza removendo não-dígitos e formata 00000-000", () => {
    expect(normalizeCep("01310100")).toBe("01310-100");
    expect(normalizeCep("01310-100")).toBe("01310-100");
    expect(normalizeCep(" 01.310-100 ")).toBe("01310-100");
    expect(normalizeCep("abc01310100xyz")).toBe("01310-100");
  });
});

describe("validarCep", () => {
  it("rejeita vazio com código CEP_VAZIO", () => {
    const r = validarCep("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("CEP_VAZIO");
  });
  it("rejeita caracteres não-numéricos com CEP_INVALIDO", () => {
    const r = validarCep("abcde-fgh");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("CEP_INVALIDO");
  });
  it("rejeita CEP incompleto com CEP_INCOMPLETO e contagem", () => {
    const r = validarCep("013101");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("CEP_INCOMPLETO");
      expect(r.mensagem).toMatch(/6\/8/);
    }
  });
  it("rejeita CEP com dígitos demais", () => {
    const r = validarCep("013101000");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("CEP_LONGO");
  });
  it("aceita CEP de 8 dígitos retornando cep formatado e somente dígitos", () => {
    const r = validarCep("01310-100");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cep).toBe("01310-100");
      expect(r.digitos).toBe("01310100");
    }
  });
  it("aceita CEP só com dígitos", () => {
    const r = validarCep("01310100");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cep).toBe("01310-100");
  });
});
