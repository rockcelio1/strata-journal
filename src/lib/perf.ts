// Monitor de performance leve: mede duração de operações e expõe métricas
// agregadas em window.__perf para inspeção rápida no console.
type Sample = { name: string; dur: number; ok: boolean; at: number; meta?: Record<string, unknown> };

const samples: Sample[] = [];
const MAX_SAMPLES = 200;

function record(s: Sample) {
  samples.push(s);
  if (samples.length > MAX_SAMPLES) samples.shift();
  try {
    const tag = s.ok ? "perf" : "perf:erro";
    console.info(`[${tag}] ${s.name} ${s.dur.toFixed(0)}ms`, s.meta ?? {});
  } catch { /* noop */ }
  if (typeof window !== "undefined") {
    (window as any).__perf = {
      samples: () => samples.slice(),
      summary: () => summary(),
      clear: () => { samples.length = 0; },
    };
  }
}

export async function measure<T>(name: string, fn: () => Promise<T>, meta?: Record<string, unknown>): Promise<T> {
  const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
  try {
    const r = await fn();
    record({ name, dur: (performance.now?.() ?? Date.now()) - t0, ok: true, at: Date.now(), meta });
    return r;
  } catch (e) {
    record({ name, dur: (performance.now?.() ?? Date.now()) - t0, ok: false, at: Date.now(), meta: { ...meta, erro: (e as any)?.message } });
    throw e;
  }
}

export function mark(name: string, dur: number, meta?: Record<string, unknown>) {
  record({ name, dur, ok: true, at: Date.now(), meta });
}

export function summary() {
  const byName = new Map<string, { n: number; total: number; max: number; erros: number }>();
  for (const s of samples) {
    const cur = byName.get(s.name) ?? { n: 0, total: 0, max: 0, erros: 0 };
    cur.n++; cur.total += s.dur; cur.max = Math.max(cur.max, s.dur);
    if (!s.ok) cur.erros++;
    byName.set(s.name, cur);
  }
  return Array.from(byName.entries())
    .map(([name, v]) => ({ name, chamadas: v.n, media_ms: Math.round(v.total / v.n), max_ms: Math.round(v.max), erros: v.erros }))
    .sort((a, b) => b.media_ms - a.media_ms);
}

// Deduplica chamadas concorrentes pelo mesmo `key`: a primeira faz o trabalho,
// chamadas concorrentes recebem a mesma Promise. Suporta cancelamento via AbortController.
const inflight = new Map<string, { p: Promise<unknown>; ac: AbortController }>();
export function dedupe<T>(key: string, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ex = inflight.get(key);
  if (ex) return ex.p as Promise<T>;
  const ac = new AbortController();
  const p = (async () => {
    try { return await fn(ac.signal); }
    finally { inflight.delete(key); }
  })();
  inflight.set(key, { p, ac });
  return p;
}
export function cancelDedupe(key: string) {
  const ex = inflight.get(key);
  if (ex) { ex.ac.abort(); inflight.delete(key); }
}
