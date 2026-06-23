import { describe, it, expect } from "vitest";
import {
  validateRdoForm,
  sanitizeRdoPayload,
  isUuid,
  assertRowsValid,
} from "@/lib/rdo-validate";

const GOOD = "11111111-2222-3333-4444-555555555555";
const GOOD2 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("isUuid", () => {
  it("aceita UUID válido e rejeita lixo", () => {
    expect(isUuid(GOOD)).toBe(true);
    expect(isUuid("")).toBe(false);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(null as any)).toBe(false);
    expect(isUuid(undefined as any)).toBe(false);
    expect(isUuid(123 as any)).toBe(false);
  });
});

describe("validateRdoForm (UI: botão Concluir desabilitado)", () => {
  it("forma vazia é válida", () => {
    const r = validateRdoForm({});
    expect(r.valid).toBe(true);
  });

  it("equipamento sem equipamento_id é inválido (Concluir DEVE ficar bloqueado)", () => {
    const r = validateRdoForm({
      equipamentos: [{ equipamento_id: "" }, { equipamento_id: GOOD }],
    });
    expect(r.valid).toBe(false);
    expect(r.equipInvalidIdx).toEqual([0]);
  });

  it("ocorrência com descrição vazia/whitespace é inválida", () => {
    const r = validateRdoForm({
      ocorrencias: [{ descricao: "" }, { descricao: "   " }, { descricao: "ok" }],
    });
    expect(r.valid).toBe(false);
    expect(r.ocInvalidIdx).toEqual([0, 1]);
  });

  it("mão de obra sem UUID é inválida", () => {
    const r = validateRdoForm({
      mao_de_obra: [{ mao_de_obra_id: "x" }, { mao_de_obra_id: GOOD2 }],
    });
    expect(r.maoInvalidIdx).toEqual([0]);
    expect(r.valid).toBe(false);
  });

  it("tudo preenchido corretamente → válido", () => {
    const r = validateRdoForm({
      equipamentos: [{ equipamento_id: GOOD }],
      ocorrencias: [{ descricao: "incidente" }],
      mao_de_obra: [{ mao_de_obra_id: GOOD2 }],
      atividades: [{ descricao: "alvenaria" }],
    });
    expect(r.valid).toBe(true);
  });
});

describe("sanitizeRdoPayload (sync: registra descartes)", () => {
  it("remove linhas quebradas e contabiliza descartes", () => {
    const { sane, dropped, total_dropped } = sanitizeRdoPayload({
      equipamentos: [{ equipamento_id: "" }, { equipamento_id: GOOD }],
      ocorrencias: [{ descricao: " " }, { descricao: "ok" }],
      mao_de_obra: [{ mao_de_obra_id: "nope" }],
      atividades: [{ descricao: "" }, { descricao: "fundação" }],
    });
    expect(sane.equipamentos).toHaveLength(1);
    expect(sane.ocorrencias).toHaveLength(1);
    expect(sane.mao_de_obra).toHaveLength(0);
    expect(sane.atividades).toHaveLength(1);
    expect(dropped).toEqual({
      equipamentos: 1,
      ocorrencias: 1,
      mao_de_obra: 1,
      atividades: 1,
    });
    expect(total_dropped).toBe(4);
  });

  it("payload já limpo não descarta nada", () => {
    const { total_dropped } = sanitizeRdoPayload({
      equipamentos: [{ equipamento_id: GOOD }],
      ocorrencias: [{ descricao: "x" }],
      mao_de_obra: [{ mao_de_obra_id: GOOD2 }],
      atividades: [{ descricao: "y" }],
    });
    expect(total_dropped).toBe(0);
  });
});

describe("assertRowsValid (backend: nunca aceita burla de UI)", () => {
  it("aceita payload válido", () => {
    expect(() =>
      assertRowsValid({
        equipamentos: [{ equipamento_id: GOOD }],
        ocorrencias: [{ descricao: "ok" }],
        mao_de_obra: [{ mao_de_obra_id: GOOD2 }],
        atividades: [{ descricao: "ok" }],
      }),
    ).not.toThrow();
  });

  it("rejeita equipamento com UUID inválido mesmo se cliente burlar", () => {
    expect(() =>
      assertRowsValid({
        equipamentos: [{ equipamento_id: "FAKE" }],
      }),
    ).toThrow(/equipamentos\[0\]/);
  });

  it("rejeita ocorrência com descrição vazia", () => {
    expect(() =>
      assertRowsValid({
        ocorrencias: [{ descricao: "" }],
      }),
    ).toThrow(/ocorrencias\[0\]/);
  });

  it("erros são mapeados por linha (múltiplos)", () => {
    try {
      assertRowsValid({
        equipamentos: [{ equipamento_id: GOOD }, { equipamento_id: "x" }],
        ocorrencias: [{ descricao: "" }, { descricao: "ok" }, { descricao: " " }],
      });
      throw new Error("deveria ter falhado");
    } catch (e: any) {
      expect(e.code).toBe("RDO_INVALID_ROWS");
      expect(e.rows).toEqual(
        expect.arrayContaining([
          "equipamentos[1]: equipamento_id inválido",
          "ocorrencias[0]: descrição obrigatória",
          "ocorrencias[2]: descrição obrigatória",
        ]),
      );
    }
  });
});
