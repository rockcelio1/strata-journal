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

// Captura cada chain individual iniciando em `.from("rdos")` até o próximo
// `.from(` ou final de statement (`;` ou `,\n`).
const FROM_RDOS_CHAIN = /\.from\(["']rdos["']\)(?:(?!\.from\()[\s\S])*?(?=[,;]\s*\n|;)/g;

describe("integration: rascunhos com deleted_at não aparecem em listagens", () => {
  for (const file of FILES) {
    it(`${file}: todo .from("rdos") inclui filtro deleted_at IS NULL (ou é leitura por id única)`, () => {
      const src = read(file);
      const chains = src.match(FROM_RDOS_CHAIN) ?? [];
      expect(chains.length).toBeGreaterThan(0);
      for (const chain of chains) {
        const isWrite = /\.(update|insert|upsert|delete)\(/.test(chain);
        if (isWrite) continue;
        const filtraSoftDelete = /\.is\(\s*["']?(?:rdos\.)?deleted_at["']?\s*,\s*null\s*\)/.test(chain);
        // Leitura por id única com .maybeSingle(): aceita pós-verificação em código (getRdo).
        const isSingleByPk = /\.eq\(\s*["']id["']/.test(chain) && /\.maybeSingle\(\)/.test(chain);
        expect(filtraSoftDelete || isSingleByPk, `chain sem filtro deleted_at:\n${chain}`).toBe(true);
      }
    });
  }

  it("listRdos não aceita parâmetro que desabilite o filtro de soft-delete", () => {
    const src = read("src/lib/rdo.functions.ts");
    // Garante que a função listRdos não exponha includeDeleted/withDeleted via input.
    expect(src).not.toMatch(/includeDeleted|withDeleted|incluir_excluidos/i);
  });
});
