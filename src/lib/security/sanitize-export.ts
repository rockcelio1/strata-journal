/**
 * CSV Injection defense.
 *
 * Excel / Google Sheets / LibreOffice interpretam células cujo primeiro
 * caractere é `=`, `+`, `-`, `@`, TAB ou CR como fórmula. Um usuário
 * malicioso pode inserir `=HYPERLINK(...)` num campo de texto e assumir
 * controle da planilha quando alguém abre o export.
 *
 * `sanitizeExportCell` prefixa apóstrofo simples em qualquer valor
 * string suspeito. Números, booleanos, datas e `null` permanecem intocados.
 *
 * Aplicar em TODO ponto de exportação (CSV e XLSX).
 */

const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

export function sanitizeExportCell<T>(value: T): T | string {
  if (value == null) return value;
  if (typeof value !== "string") return value;
  if (value.length === 0) return value;
  const first = value.charAt(0);
  if (FORMULA_TRIGGERS.has(first)) return `'${value}`;
  return value;
}

/** Sanitiza cada valor de um objeto (linha para json_to_sheet). */
export function sanitizeExportRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(row)) out[k] = sanitizeExportCell(row[k]);
  return out as T;
}

/** Sanitiza uma matriz de linhas (aoa_to_sheet). */
export function sanitizeExportMatrix(rows: unknown[][]): unknown[][] {
  return rows.map((r) => r.map((c) => sanitizeExportCell(c)));
}
