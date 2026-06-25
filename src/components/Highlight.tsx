import { fuzzyMatchRanges } from "@/lib/fuzzy-search";

export function Highlight({ text, query, className }: { text: string | null | undefined; query: string; className?: string }) {
  const s = text ?? "";
  if (!query.trim() || !s) return <span className={className}>{s}</span>;
  const ranges = fuzzyMatchRanges(s, query);
  if (!ranges.length) return <span className={className}>{s}</span>;
  const parts: Array<{ t: string; hit: boolean }> = [];
  let cursor = 0;
  for (const [a, b] of ranges) {
    if (a > cursor) parts.push({ t: s.slice(cursor, a), hit: false });
    parts.push({ t: s.slice(a, b), hit: true });
    cursor = b;
  }
  if (cursor < s.length) parts.push({ t: s.slice(cursor), hit: false });
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="bg-amber-200/70 text-foreground rounded-sm px-0.5">{p.t}</mark>
        ) : (
          <span key={i}>{p.t}</span>
        ),
      )}
    </span>
  );
}
