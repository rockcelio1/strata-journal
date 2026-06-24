// Integration guard: ensure every server-side list/query of "rdos" that powers
// the "Nova RDO" flow (lists, dashboard, obra details, audit views) filters out
// soft-deleted drafts by chaining `.is("deleted_at", null)`. This protects against
// regressions where new search/pagination/filters bypass the soft-delete filter.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

// Files that expose "rdos" read queries reachable from the Nova RDO flow and
// the rascunho listings. Any `.from("rdos").select(...)` chain in these files
// MUST filter `deleted_at IS NULL`.
const FILES = [
  "src/lib/rdo.functions.ts",
  "src/lib/obras.functions.ts",
  "src/lib/core.functions.ts",
];

// Captures the entire chain starting at `.from("rdos")` up to the next `;`.
const FROM_RDOS_CHAIN = /\.from\(["']rdos["']\)[\s\S]*?;/g;

describe("integration: rascunhos com deleted_at não aparecem em listagens", () => {
  for (const file of FILES) {
    it(`${file}: todo .from("rdos") inclui filtro deleted_at IS NULL`, () => {
      const src = read(file);
      const chains = src.match(FROM_RDOS_CHAIN) ?? [];
      expect(chains.length).toBeGreaterThan(0);
      for (const chain of chains) {
        // Permite UPDATE/INSERT/DELETE escrita (não-select) — exige .is("deleted_at", null) só para reads.
        const isWrite = /\.(update|insert|upsert|delete)\(/.test(chain);
        if (isWrite) continue;
        // Para SELECTs (incluindo head:true / count exact / joins), exige o filtro.
        expect(chain).toMatch(/\.is\(\s*["']?(?:rdos\.)?deleted_at["']?\s*,\s*null\s*\)/);
      }
    });
  }

  it("listRdos não aceita parâmetro que desabilite o filtro de soft-delete", () => {
    const src = read("src/lib/rdo.functions.ts");
    // Garante que a função listRdos não exponha includeDeleted/withDeleted via input.
    expect(src).not.toMatch(/includeDeleted|withDeleted|incluir_excluidos/i);
  });
});
