import { describe, it, expect } from "vitest";
import { countWords } from "../text";

describe("countWords", () => {
  it("retorna 0 para string vazia ou só espaços", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
    expect(countWords("\n\t  ")).toBe(0);
  });

  it("ignora espaços múltiplos entre palavras", () => {
    expect(countWords("uma   duas    tres")).toBe(3);
    expect(countWords("  a\tb\nc  ")).toBe(3);
  });

  it("trata pontuação anexa como parte da palavra", () => {
    expect(countWords("olá, mundo!")).toBe(2);
    expect(countWords("um. dois; três: quatro?")).toBe(4);
  });

  it("valida limiar de 5 palavras (borda verde só a partir daí)", () => {
    expect(countWords("uma duas três quatro") >= 5).toBe(false);
    expect(countWords("uma duas três quatro cinco") >= 5).toBe(true);
    expect(countWords("obra concluída, sem ocorrências relevantes hoje.") >= 5).toBe(true);
  });

  it("hífens e apóstrofos contam como uma palavra", () => {
    expect(countWords("bem-vindo ao canteiro")).toBe(3);
    expect(countWords("d'água limpa")).toBe(2);
  });
});
