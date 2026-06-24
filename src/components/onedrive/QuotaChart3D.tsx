import { useCallback, useEffect, useRef, useState } from "react";

function toNum(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

function fmtBytes(n: number): string {
  const v0 = toNum(n);
  if (v0 === 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  let v = v0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${u[i]}`;
}

type SentryCtx = {
  chartId?: string;
  empresa?: string;
  barIndex?: number;
  barKey?: string;
};

function reportError(scope: string, payload: Record<string, unknown>, ctx: SentryCtx = {}) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = typeof window !== "undefined" ? (window as any) : null;
    if (w?.Sentry?.withScope && w?.Sentry?.captureMessage) {
      w.Sentry.withScope((s: any) => {
        s.setTag("component", "QuotaChart3D");
        s.setTag("scope", scope);
        if (ctx.chartId) s.setTag("chart_id", ctx.chartId);
        if (ctx.empresa) s.setTag("empresa", ctx.empresa);
        if (typeof ctx.barIndex === "number") s.setTag("bar_index", String(ctx.barIndex));
        if (ctx.barKey) s.setTag("bar_key", ctx.barKey);
        s.setContext("quota_chart", { ...payload, ...ctx });
        w.Sentry.captureMessage(`[QuotaChart3D] ${scope}`, "warning");
      });
    } else if (w?.Sentry?.captureMessage) {
      w.Sentry.captureMessage(`[QuotaChart3D] ${scope}`, { level: "warning", extra: { ...payload, ...ctx } });
    }
  } catch { /* noop */ }
  console.warn(`[QuotaChart3D] ${scope}`, { ...payload, ...ctx });
}

type Props = {
  used: number;
  total: number;
  deleted?: number;
  chartId?: string;
  empresa?: string;
};

type BarDef = {
  key: string;
  label: string;
  value: number;
  pct: number;
  color: string;
  highlight: string;
  shadow: string;
};

export function QuotaChart3D({ used, total, deleted = 0, chartId = "onedrive-quota", empresa }: Props) {
  const usedSafe = toNum(used);
  const totalSafe = toNum(total);
  const deletedSafe = toNum(deleted);
  const safeTotal = Math.max(totalSafe, 1);
  const free = Math.max(totalSafe - usedSafe, 0);
  const pctUsed = Math.min(100, (usedSafe / safeTotal) * 100);
  const pctFree = Math.min(100, (free / safeTotal) * 100);
  const pctDel = Math.min(100, (deletedSafe / safeTotal) * 100);
  const dataValid = Number.isFinite(used) && Number.isFinite(total);

  const [rx, setRx] = useState(-18);
  const [ry, setRy] = useState(-28);
  const [active, setActive] = useState<string | null>(null);
  const [tip, setTip] = useState<{ key: string; x: number; y: number; pinned?: boolean } | null>(null);
  const [spin, setSpin] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Respeita preferência do sistema "reduzir movimento".
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => { setReducedMotion(mq.matches); if (mq.matches) setSpin(false); };
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);
  const [, forceTick] = useState(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const barRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Log dados inválidos uma única vez por mudança.
  useEffect(() => {
    if (!dataValid) reportError("dados inválidos", { used, total, deleted }, { chartId, empresa });
  }, [used, total, deleted, dataValid]);

  // Auto-rotate 360° com throttling (~30fps) e respeito a reduce-motion.
  useEffect(() => {
    if (!spin || reducedMotion) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      if (dt >= 1 / 30) {
        last = now;
        setRy((r) => (r + dt * 36) % 360);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [spin, reducedMotion]);

  function armAutoClose() {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => {
      setTip((t) => (t && !t.pinned ? null : t));
    }, 3000);
  }
  useEffect(() => () => { if (tipTimer.current) clearTimeout(tipTimer.current); }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => forceTick((n) => n + 1);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    let ro: ResizeObserver | null = null;
    if ("ResizeObserver" in window && stageRef.current) {
      ro = new ResizeObserver(onResize);
      ro.observe(stageRef.current);
    }
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      ro?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!tip?.pinned) return;
    function onDocDown(e: PointerEvent) {
      const t = e.target as Node | null;
      if (stageRef.current && t && stageRef.current.contains(t)) return;
      if (tipRef.current && t && tipRef.current.contains(t)) return;
      setTip(null);
    }
    document.addEventListener("pointerdown", onDocDown, true);
    return () => document.removeEventListener("pointerdown", onDocDown, true);
  }, [tip?.pinned]);

  // Esc fecha o tooltip e devolve foco à barra (sem armadilha de foco).
  const closeTipAndRefocus = useCallback(() => {
    const k = tip?.key;
    setTip(null);
    setActive(null);
    if (k && barRefs.current[k]) {
      requestAnimationFrame(() => barRefs.current[k]?.focus());
    }
  }, [tip?.key]);

  useEffect(() => {
    if (!tip) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeTipAndRefocus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tip, closeTipAndRefocus]);

  function openTipForKey(key: string, pinned = true) {
    const rect = stageRef.current?.getBoundingClientRect();
    const barEl = barRefs.current[key];
    if (!rect || !barEl) return;
    const br = barEl.getBoundingClientRect();
    const x = br.left - rect.left + br.width / 2;
    const y = br.top - rect.top + br.height / 2;
    setTip({ key, x, y, pinned });
    setActive(key);
    armAutoClose();
  }

  function onHoverMove(e: React.PointerEvent) {
    if (!stageRef.current || !tip || tip.pinned) return;
    const rect = stageRef.current.getBoundingClientRect();
    setTip({ key: tip.key, x: e.clientX - rect.left, y: e.clientY - rect.top });
    armAutoClose();
  }

  function onDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, rx, ry };
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    setRy(drag.current.ry + dx * 0.6);
    setRx(drag.current.rx - dy * 0.6);
  }
  function onUp(e: React.PointerEvent) {
    drag.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  }
  function resetView() { setRx(-18); setRy(-28); }

  const bars: BarDef[] = [
    { key: "used",    label: "Usado",      value: usedSafe,    pct: pctUsed, color: "#2563eb", highlight: "#60a5fa", shadow: "rgba(37,99,235,0.65)" },
    { key: "free",    label: "Disponível", value: free,        pct: pctFree, color: "#10b981", highlight: "#6ee7b7", shadow: "rgba(16,185,129,0.65)" },
    { key: "deleted", label: "Lixeira",    value: deletedSafe, pct: pctDel,  color: "#f59e0b", highlight: "#fcd34d", shadow: "rgba(245,158,11,0.65)" },
    { key: "total",   label: "Total",      value: totalSafe,   pct: 100,     color: "#8b5cf6", highlight: "#c4b5fd", shadow: "rgba(139,92,246,0.65)" },
  ];

  const ryNorm = ((ry % 360) + 360) % 360;
  const rxNorm = ((rx % 360) + 360) % 360;

  const onBarKey = useCallback((e: React.KeyboardEvent, key: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openTipForKey(key, true);
    } else if (e.key === "Escape") {
      setTip(null);
      setActive(null);
    }
  }, []);

  return (
    <div className="space-y-3">
      <div
        ref={stageRef}
        className="relative h-80 w-full rounded-2xl border border-white/10 cursor-grab active:cursor-grabbing select-none overflow-hidden"
        style={{
          perspective: "1100px",
          background:
            "radial-gradient(ellipse at 25% 15%, rgba(99,102,241,0.25), transparent 55%)," +
            "radial-gradient(ellipse at 80% 90%, rgba(16,185,129,0.20), transparent 55%)," +
            "linear-gradient(135deg, #0b1220 0%, #111827 50%, #0b1220 100%)",
          boxShadow:
            "inset 0 0 80px rgba(99,102,241,0.20)," +
            "inset 0 0 0 1px rgba(255,255,255,0.06)," +
            "0 30px 60px -20px rgba(0,0,0,0.6)",
          backdropFilter: "blur(8px)",
        }}
        onPointerDown={onDown}
        onPointerMove={(e) => { onMove(e); onHoverMove(e); }}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => setTip((t) => (t?.pinned ? t : null))}
        title="Clique e arraste para girar 360°"
        role="group"
        aria-label="Gráfico 3D de uso do repositório OneDrive"
      >
        {/* Vidro / reflexo */}
        <div className="pointer-events-none absolute inset-0" style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.08), transparent 35%)",
        }} />

        {!dataValid && (
          <div className="absolute inset-0 grid place-items-center text-xs text-white/80">
            Dados indisponíveis no momento.
          </div>
        )}

        <div
          className="absolute inset-0 flex items-end justify-center gap-10 pb-10"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${rx}deg) rotateY(${ry}deg)`,
          }}
        >
          <div
            className="absolute left-1/2 bottom-8"
            style={{
              width: 420, height: 220,
              borderRadius: 9999,
              background: "radial-gradient(ellipse at center, rgba(255,255,255,0.18), rgba(255,255,255,0.02) 70%)",
              transform: "translateX(-50%) rotateX(90deg) translateZ(-1px)",
              transformStyle: "preserve-3d",
            }}
          />
          {bars.map((b, barIndex) => {
            const h = Math.max(12, (b.pct / 100) * 210);
            const isActive = active === b.key;
            return (
              <div
                key={b.key}
                ref={(el) => { barRefs.current[b.key] = el; }}
                className="flex flex-col items-center cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/80 rounded-md"
                style={{ transformStyle: "preserve-3d", transform: isActive ? "translateY(-6px) scale(1.05)" : undefined, transition: "transform 200ms" }}
                role="button"
                tabIndex={0}
                aria-label={`${b.label}: ${fmtBytes(b.value)}, ${b.pct.toFixed(1)} por cento`}
                aria-describedby={tip?.key === b.key ? "quota-tooltip" : undefined}
                onKeyDown={(e) => onBarKey(e, b.key)}
                onPointerEnter={(e) => {
                  try {
                    setActive(b.key);
                    const rect = stageRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setTip({ key: b.key, x: e.clientX - rect.left, y: e.clientY - rect.top, pinned: e.pointerType === "touch" });
                    armAutoClose();
                  } catch (err) {
                    reportError("hover error", { value: b.value, err: String(err) }, { chartId, empresa, barIndex, barKey: b.key });
                  }
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === "touch") return;
                  setActive((cur) => (cur === b.key ? null : cur));
                  setTip((t) => (t?.key === b.key && !t.pinned ? null : t));
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActive((cur) => (cur === b.key ? null : b.key));
                  setTip((t) => {
                    const rect = stageRef.current?.getBoundingClientRect();
                    if (!rect) return t;
                    if (t?.key === b.key) return null;
                    return { key: b.key, x: e.clientX - rect.left, y: e.clientY - rect.top, pinned: true };
                  });
                }}
              >
                <span
                  className="text-[11px] font-semibold mb-1 px-2 py-0.5 rounded-full"
                  style={{ color: "#fff", background: b.color, boxShadow: `0 0 14px ${b.shadow}, 0 0 2px #fff inset` }}
                >
                  {b.pct.toFixed(1)}%
                </span>
                <Bar3D height={h} color={b.color} highlight={b.highlight} shadow={b.shadow} active={isActive} />
                <span
                  className="text-[11px] mt-2 font-bold tracking-wide px-2 py-0.5 rounded-md"
                  style={{
                    color: "#fff",
                    background: `linear-gradient(135deg, ${b.color}, ${b.highlight})`,
                    boxShadow: `0 4px 14px ${b.shadow}, 0 0 12px ${b.shadow}`,
                  }}
                >
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={resetView}
          className="absolute top-2 left-2 text-[10px] bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-md border border-white/20 backdrop-blur"
        >
          Resetar vista
        </button>
        <button
          type="button"
          onClick={() => setSpin((s) => !s)}
          aria-pressed={spin}
          disabled={reducedMotion}
          title={reducedMotion ? "Desativado pela preferência 'reduzir movimento' do sistema" : undefined}
          className="absolute top-2 left-28 text-[10px] bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-md border border-white/20 backdrop-blur disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {reducedMotion ? "Movimento reduzido" : spin ? "Parar giro" : "Girar 360°"}
        </button>
        <div className="absolute top-2 right-2 text-[10px] text-white/80 bg-white/10 backdrop-blur px-2 py-1 rounded-md border border-white/20">
          arraste para girar · X {rxNorm.toFixed(0)}° · Y {ryNorm.toFixed(0)}°
        </div>

        {/* Tooltip flutuante com posicionamento inteligente (flip horizontal/vertical) */}
        {(() => {
          if (!tip) return null;
          const b = bars.find((x) => x.key === tip.key);
          if (!b) {
            reportError("tooltip sem barra", { key: tip.key }, { chartId, empresa });
            return null;
          }
          if (!Number.isFinite(b.value) || !Number.isFinite(b.pct)) {
            reportError("tooltip valores inválidos", { value: b.value, pct: b.pct }, { chartId, empresa, barKey: b.key, barIndex: bars.indexOf(b) });
            return null;
          }
          const rect = stageRef.current?.getBoundingClientRect();
          const stageW = rect?.width ?? stageRef.current?.clientWidth ?? 0;
          const stageH = rect?.height ?? stageRef.current?.clientHeight ?? 0;
          const tipW = Math.min(260, Math.max(160, stageW - 24));
          const tipH = Math.min(190, Math.max(120, stageH * 0.55));
          const gap = 14;

          // Decisão de lado: prefere o lado com mais espaço
          const spaceRight = stageW - tip.x;
          const spaceLeft = tip.x;
          const spaceBottom = stageH - tip.y;
          const spaceTop = tip.y;

          let x = spaceRight >= tipW + gap || spaceRight >= spaceLeft
            ? tip.x + gap
            : tip.x - tipW - gap;
          let y = spaceBottom >= tipH + gap || spaceBottom >= spaceTop
            ? tip.y + gap
            : tip.y - tipH - gap;

          // Clamp final
          x = Math.max(8, Math.min(x, Math.max(8, stageW - tipW - 8)));
          y = Math.max(8, Math.min(y, Math.max(8, stageH - tipH - 8)));

          return (
            <div
              ref={tipRef}
              id="quota-tooltip"
              role="tooltip"
              aria-live="polite"
              tabIndex={-1}
              className={`absolute z-10 rounded-2xl p-3 text-[11px] ${tip.pinned ? "" : "pointer-events-none"}`}
              style={{
                left: x,
                top: y,
                width: tipW,
                maxWidth: "calc(100% - 16px)",
                background:
                  `linear-gradient(135deg, ${b.color}cc, ${b.highlight}aa)`,
                color: "#fff",
                border: `1px solid ${b.highlight}`,
                boxShadow:
                  `0 12px 32px ${b.shadow},` +
                  `0 0 24px ${b.shadow},` +
                  `0 0 0 1px rgba(255,255,255,0.18) inset`,
                backdropFilter: "blur(14px) saturate(140%)",
                WebkitBackdropFilter: "blur(14px) saturate(140%)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="h-3 w-3 rounded-full" style={{ background: "#fff", boxShadow: `0 0 10px #fff` }} />
                <span className="font-bold text-sm">{b.label}</span>
                <span className="ml-auto font-bold">{b.pct.toFixed(1)}%</span>
                {tip.pinned && (
                  <button
                    type="button"
                    aria-label="Fechar tooltip"
                    onClick={(e) => { e.stopPropagation(); setTip(null); }}
                    className="ml-1 text-white/90 hover:text-white text-sm leading-none px-1"
                  >×</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 opacity-95">
                <span className="opacity-80">Tamanho</span><span className="font-semibold text-right">{fmtBytes(b.value)}</span>
                <span className="opacity-80">Bytes</span><span className="font-semibold text-right">{b.value.toLocaleString("pt-BR")}</span>
                <span className="opacity-80">Total</span><span className="font-semibold text-right">{fmtBytes(totalSafe)}</span>
              </div>
              <div className="mt-1 text-[10px] opacity-90 italic">
                {b.key === "used" && "Espaço já ocupado por arquivos no OneDrive."}
                {b.key === "free" && "Espaço ainda disponível para uploads."}
                {b.key === "deleted" && "Itens na lixeira — contam até serem expurgados."}
                {b.key === "total" && "Capacidade total contratada do repositório."}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Detalhes da barra ativa */}
      {(() => {
        const b = bars.find((x) => x.key === active);
        if (!b) {
          return (
            <p className="text-[11px] text-muted-foreground italic">
              Passe o mouse, clique ou use Enter/Espaço em uma barra (ou na legenda) para ver os detalhes. Esc fecha.
            </p>
          );
        }
        const totalRef = Math.max(totalSafe, 1);
        return (
          <div
            className="rounded-xl p-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs"
            style={{
              background: `linear-gradient(135deg, ${b.color}1a, ${b.highlight}0d)`,
              border: `1px solid ${b.color}`,
              boxShadow: `0 4px 16px ${b.shadow}`,
            }}
          >
            <span className="font-bold" style={{ color: b.color }}>{b.label}</span>
            <span><span className="text-muted-foreground">Tamanho:</span> <b>{fmtBytes(b.value)}</b></span>
            <span><span className="text-muted-foreground">% do total:</span> <b>{b.pct.toFixed(2)}%</b></span>
            <span><span className="text-muted-foreground">Bytes:</span> <b>{b.value.toLocaleString("pt-BR")}</b></span>
            <span><span className="text-muted-foreground">Referência total:</span> <b>{fmtBytes(totalRef)}</b></span>
            <button
              type="button"
              onClick={() => { setActive(null); setTip(null); }}
              className="ml-auto text-[10px] px-2 py-0.5 rounded border border-border hover:bg-muted"
            >
              Fechar
            </button>
          </div>
        );
      })()}

      {/* Legenda colorida — hover destaca a barra correspondente */}
      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs" aria-label="Legenda do gráfico">
        {bars.map((b) => (
          <li
            key={b.key}
            onMouseEnter={() => { setActive(b.key); openTipForKey(b.key, false); }}
            onMouseLeave={() => {
              setActive((cur) => (cur === b.key ? null : cur));
              setTip((t) => (t?.key === b.key && !t.pinned ? null : t));
            }}
            onClick={() => {
              setActive((cur) => (cur === b.key ? null : b.key));
              openTipForKey(b.key, true);
            }}
            className="relative rounded-xl p-3 overflow-hidden cursor-pointer transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white/70 outline-none"
            tabIndex={0}
            onKeyDown={(e) => onBarKey(e, b.key)}
            role="button"
            aria-label={`Destacar ${b.label}`}
            style={{
              background: `linear-gradient(135deg, ${b.color}22, ${b.highlight}11)`,
              border: `${active === b.key ? 2 : 1}px solid ${b.color}`,
              boxShadow: active === b.key
                ? `0 10px 28px ${b.shadow}, 0 0 16px ${b.shadow}`
                : `0 6px 18px ${b.shadow}`,
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="h-4 w-4 rounded-full"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${b.highlight}, ${b.color})`,
                  boxShadow: `0 0 10px ${b.shadow}`,
                }}
              />
              <span className="font-bold" style={{ color: b.color }}>{b.label}</span>
            </div>
            <div className="mt-1 font-semibold text-foreground">{fmtBytes(b.value)}</div>
            <div className="text-[10px] text-muted-foreground">{b.pct.toFixed(1)}% do total</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bar3D({ height, color, highlight, shadow, active }: { height: number; color: string; highlight: string; shadow: string; active?: boolean }) {
  const w = 56;
  const d = 56;
  const radius = 16;
  const front = `linear-gradient(180deg, ${highlight} 0%, ${color} 55%, ${shade(color, -25)} 100%)`;
  const side  = `linear-gradient(180deg, ${shade(color, -10)} 0%, ${shade(color, -35)} 100%)`;
  const back  = `linear-gradient(180deg, ${shade(color, -20)} 0%, ${shade(color, -45)} 100%)`;
  const top   = `radial-gradient(circle at 35% 30%, ${shade(highlight, 25)}, ${color})`;
  const glow  = active
    ? `0 0 48px ${shadow}, 0 0 0 2px ${highlight}, 0 0 24px ${shadow} inset`
    : `0 0 28px ${shadow}, 0 0 16px ${shadow} inset`;
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    borderRadius: radius,
    boxShadow: glow,
  };
  return (
    <div style={{ width: w, height, position: "relative", transformStyle: "preserve-3d" }}>
      <div style={{ ...baseStyle, inset: 0, background: front, transform: `translateZ(${d / 2}px)` }} />
      <div style={{ ...baseStyle, inset: 0, background: back, transform: `translateZ(${-d / 2}px) rotateY(180deg)` }} />
      <div style={{ ...baseStyle, top: 0, right: 0, width: d, height, background: side, transform: `rotateY(90deg) translateZ(${w / 2}px)`, transformOrigin: "right center" }} />
      <div style={{ ...baseStyle, top: 0, left: 0, width: d, height, background: side, transform: `rotateY(-90deg) translateZ(${w / 2}px)`, transformOrigin: "left center" }} />
      <div style={{ ...baseStyle, top: 0, left: 0, width: w, height: d, background: top, transform: `rotateX(90deg) translateZ(${d / 2}px)`, transformOrigin: "top center" }} />
      {/* reflexo de vidro */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: radius, pointerEvents: "none",
        background: "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 40%)",
        transform: `translateZ(${d / 2 + 0.1}px)`,
      }} />
    </div>
  );
}

function shade(hex: string, percent: number): string {
  const m = hex.replace("#", "");
  const num = parseInt(m, 16);
  let r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

export { fmtBytes };
