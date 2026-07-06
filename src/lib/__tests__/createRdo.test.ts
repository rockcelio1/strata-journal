import { describe, it, expect } from "vitest";
import { prepareCreateRdoInput } from "@/lib/rdo.functions";

const OBRA = "11111111-1111-4111-8111-111111111111";
const EQUIP = "22222222-2222-4222-8222-222222222222";
const MAO = "33333333-3333-4333-8333-333333333333";

const base = {
  obra_id: OBRA,
  data: "2026-06-30",
  clima_manha: null,
  clima_tarde: null,
  clima_noite: null,
  observacoes: null,
  atividades: [],
  mao_de_obra: [],
  equipamentos: [],
  ocorrencias: [],
  enviar: false,
};

describe("createRdo · prepareCreateRdoInput", () => {
  it("descarta equipamentos com UUID inválido sem quebrar o envio", () => {
    const { data, sanitize } = prepareCreateRdoInput({
      ...base,
      equipamentos: [
        { equipamento_id: "", horas_uso: 0 },
        { equipamento_id: "lixo", horas_uso: 1 },
        { equipamento_id: EQUIP, horas_uso: 2 },
      ],
    });
    expect(data.equipamentos).toHaveLength(1);
    expect(data.equipamentos[0].equipamento_id).toBe(EQUIP);
    expect(sanitize.dropped.equipamentos).toBe(2);
    expect(sanitize.total_dropped).toBe(2);
  });

  it("descarta ocorrências sem descrição mantendo as válidas", () => {
    const { data, sanitize } = prepareCreateRdoInput({
      ...base,
      ocorrencias: [
        { descricao: "" },
        { descricao: "   " },
        { descricao: "vazamento" },
      ],
    });
    expect(data.ocorrencias).toHaveLength(1);
    expect(data.ocorrencias[0].descricao).toBe("vazamento");
    expect(sanitize.dropped.ocorrencias).toBe(2);
  });

  it("descarta mão de obra com UUID inválido", () => {
    const { data, sanitize } = prepareCreateRdoInput({
      ...base,
      mao_de_obra: [
        { mao_de_obra_id: "nope", horas: 8 },
        { mao_de_obra_id: MAO, horas: 8 },
      ],
    });
    expect(data.mao_de_obra).toHaveLength(1);
    expect(sanitize.dropped.mao_de_obra).toBe(1);
  });

  it("payload limpo passa sem descartes", () => {
    const { data, sanitize } = prepareCreateRdoInput({
      ...base,
      equipamentos: [{ equipamento_id: EQUIP, horas_uso: 1 }],
      ocorrencias: [{ descricao: "ok" }],
    });
    expect(sanitize.total_dropped).toBe(0);
    expect(data.equipamentos).toHaveLength(1);
    expect(data.ocorrencias).toHaveLength(1);
  });

  it("obra_id inválido lança erro estrutural (zod)", () => {
    expect(() => prepareCreateRdoInput({ ...base, obra_id: "nao-uuid" })).toThrow();
  });

  it("payload totalmente vazio com obra/data válidas é aceito", () => {
    const { data, sanitize } = prepareCreateRdoInput(base);
    expect(sanitize.total_dropped).toBe(0);
    expect(data.atividades).toEqual([]);
    expect(data.equipamentos).toEqual([]);
  });
});
