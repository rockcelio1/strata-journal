import { describe, it, expect } from "vitest";
import { normalizeForSearch, fuzzyScore, fuzzyFilter, levenshtein } from "@/lib/fuzzy-search";

describe("normalizeForSearch", () => {
  it("remove acentos e baixa caixa", () => {
    expect(normalizeForSearch("Construção Civíl — Açaí")).toBe("construcao civil acai");
  });
  it("trata null/undefined", () => {
    expect(normalizeForSearch(undefined)).toBe("");
    expect(normalizeForSearch(null)).toBe("");
  });
});

describe("levenshtein / fuzzyScore", () => {
  it("aceita 1 erro a cada ~4 letras", () => {
    expect(levenshtein("obra", "obraa")).toBe(1);
    expect(fuzzyScore("obra alvorada", "alvorda")).toBeGreaterThan(0);
  });
  it("pontua substring melhor que aproximada", () => {
    const exato = fuzzyScore("obra alvorada", "alvorada");
    const aprox = fuzzyScore("obra alvorada", "alvorda");
    expect(exato).toBeGreaterThan(aprox);
  });
});

describe("fuzzyFilter", () => {
  const itens = [
    { numero: 101, obra: "Obra Alvorada", autor: "João Silva" },
    { numero: 102, obra: "Edifício Aurora", autor: "Maria Souza" },
    { numero: 103, obra: "Reforma Centro", autor: "José Pereira" },
  ];
  it("ignora acento e ordena por relevância", () => {
    const r = fuzzyFilter(itens, "jose", (i) => `${i.numero} ${i.obra} ${i.autor}`);
    expect(r[0].autor).toBe("José Pereira");
  });
  it("encontra com erro de digitação", () => {
    const r = fuzzyFilter(itens, "alvorda", (i) => `${i.obra}`);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].obra).toBe("Obra Alvorada");
  });
  it("retorna lista original quando query vazia", () => {
    expect(fuzzyFilter(itens, "", (i) => i.obra)).toHaveLength(3);
  });
});
