// Normaliza para busca aproximada: minúsculas, sem acento, espaços colapsados.
export function normalizeForSearch(input: string | null | undefined): string {
  return (input ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Distância de Levenshtein simples (iterativa, O(n*m)).
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1);
  const v1 = new Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

// Pontua quão bem `haystack` casa com `needle` (já normalizados).
// 0 = não casa; quanto maior, melhor. Tolera 1 erro a cada ~4 letras.
export function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 1;
  if (!haystack) return 0;
  if (haystack.includes(needle)) return 100 + Math.max(0, 50 - haystack.indexOf(needle));
  const tokens = haystack.split(" ");
  let best = 0;
  for (const t of tokens) {
    if (t.startsWith(needle)) { best = Math.max(best, 80); continue; }
    if (t.includes(needle)) { best = Math.max(best, 60); continue; }
    const tol = Math.max(1, Math.floor(needle.length / 4));
    const d = levenshtein(t, needle);
    if (d <= tol) best = Math.max(best, 50 - d * 5);
  }
  return best;
}

// Filtra e ordena por relevância. Cada item produz um haystack via `getHay`.
export function fuzzyFilter<T>(items: T[], query: string, getHay: (item: T) => string): T[] {
  const n = normalizeForSearch(query);
  if (!n) return items;
  const scored = items
    .map((item) => ({ item, score: fuzzyScore(normalizeForSearch(getHay(item)), n) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}
