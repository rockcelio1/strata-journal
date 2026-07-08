import { describe, it, expect } from "vitest";
import {
  sanitizeExportCell,
  sanitizeExportRow,
  sanitizeExportMatrix,
} from "@/lib/security/sanitize-export";

describe("sanitizeExportCell", () => {
  it("escapa =cmd", () => expect(sanitizeExportCell("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0"));
  it("escapa +SUM", () => expect(sanitizeExportCell("+SUM(A1)")).toBe("'+SUM(A1)"));
  it("escapa -10+20", () => expect(sanitizeExportCell("-10+20")).toBe("'-10+20"));
  it("escapa @A1", () => expect(sanitizeExportCell("@A1")).toBe("'@A1"));
  it("escapa TAB", () => expect(sanitizeExportCell("\tX")).toBe("'\tX"));
  it("escapa CR", () => expect(sanitizeExportCell("\rX")).toBe("'\rX"));
  it("mantém texto normal", () => expect(sanitizeExportCell("Alvenaria")).toBe("Alvenaria"));
  it("mantém número", () => expect(sanitizeExportCell(42)).toBe(42));
  it("mantém boolean", () => expect(sanitizeExportCell(true)).toBe(true));
  it("mantém null/undefined", () => {
    expect(sanitizeExportCell(null)).toBeNull();
    expect(sanitizeExportCell(undefined)).toBeUndefined();
  });
  it("mantém string vazia", () => expect(sanitizeExportCell("")).toBe(""));
  it("mantém data ISO (não começa com trigger)", () =>
    expect(sanitizeExportCell("2026-07-08")).toBe("2026-07-08"));
});

describe("sanitizeExportRow", () => {
  it("aplica em cada valor", () => {
    const out = sanitizeExportRow({ nome: "=HYPERLINK(x)", n: 10, ok: "texto" });
    expect(out).toEqual({ nome: "'=HYPERLINK(x)", n: 10, ok: "texto" });
  });
});

describe("sanitizeExportMatrix", () => {
  it("aplica em matriz", () => {
    const out = sanitizeExportMatrix([["=1", "ok"], [10, "@X"]]);
    expect(out).toEqual([["'=1", "ok"], [10, "'@X"]]);
  });
});
