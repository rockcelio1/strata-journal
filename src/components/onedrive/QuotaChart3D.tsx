import { useRef, useState } from "react";

function fmtBytes(n: number): string {
  if (!n || n < 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${u[i]}`;
}

type Props = {
  used: number;
  total: number;
  deleted?: number;
};

type BarDef = {
  key: string;
  label: string;
  value: number;
  pct: number;
  color: string;       // cor base, vívida
  highlight: string;   // brilho/topo
  shadow: string;      // sombra colorida (glow)
};

/**
 * Gráfico 3D em barras (CSS perspective). Arraste para girar 360° em qualquer eixo,
 * inclusive a legenda dentro do palco (fica solidária ao giro).
 */
export function QuotaChart3D({ used, total, deleted = 0 }: Props) {
  const safeTotal = Math.max(total, 1);
  const free = Math.max(total - used, 0);
  const pctUsed = Math.min(100, (used / safeTotal) * 100);
  const pctFree = Math.min(100, (free / safeTotal) * 100);
  const pctDel = Math.min(100, (deleted / safeTotal) * 100);

  const [rx, setRx] = useState(-18);
  const [ry, setRy] = useState(-28);
  const [active, setActive] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);

  function onDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, rx, ry };
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    // 360° livre nos dois eixos
    setRy(drag.current.ry + dx * 0.6);
    setRx(drag.current.rx - dy * 0.6);
  }
  function onUp(e: React.PointerEvent) {
    drag.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  }
  function resetView() { setRx(-18); setRy(-28); }

  const bars: BarDef[] = [
    { key: "used",    label: "Usado",      value: used,    pct: pctUsed, color: "#2563eb", highlight: "#60a5fa", shadow: "rgba(37,99,235,0.55)" },
    { key: "free",    label: "Disponível", value: free,    pct: pctFree, color: "#10b981", highlight: "#6ee7b7", shadow: "rgba(16,185,129,0.55)" },
    { key: "deleted", label: "Lixeira",    value: deleted, pct: pctDel,  color: "#f59e0b", highlight: "#fcd34d", shadow: "rgba(245,158,11,0.55)" },
    { key: "total",   label: "Total",      value: total,   pct: 100,     color: "#8b5cf6", highlight: "#c4b5fd", shadow: "rgba(139,92,246,0.55)" },
  ];

  const ryNorm = ((ry % 360) + 360) % 360;
  const rxNorm = ((rx % 360) + 360) % 360;

  return (
    <div className="space-y-3">
      <div
        className="relative h-80 w-full rounded-2xl border border-border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 cursor-grab active:cursor-grabbing select-none overflow-hidden shadow-inner"
        style={{ perspective: "1100px" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        title="Clique e arraste para girar 360°"
      >
        {/* brilho ambiente */}
        <div className="pointer-events-none absolute inset-0 opacity-40"
          style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.25), transparent 60%)" }} />

        <div
          className="absolute inset-0 flex items-end justify-center gap-10 pb-10"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${rx}deg) rotateY(${ry}deg)`,
          }}
        >
          {/* "Chão" arredondado */}
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
          {bars.map((b) => {
            const h = Math.max(12, (b.pct / 100) * 210);
            const isActive = active === b.key;
            return (
              <div
                key={b.key}
                className="flex flex-col items-center cursor-pointer"
                style={{ transformStyle: "preserve-3d", transform: isActive ? "translateY(-6px) scale(1.05)" : undefined, transition: "transform 200ms" }}
                onMouseEnter={() => setActive(b.key)}
                onMouseLeave={() => setActive((cur) => (cur === b.key ? null : cur))}
                onClick={(e) => { e.stopPropagation(); setActive((cur) => (cur === b.key ? null : b.key)); }}
              >
                <span
                  className="text-[11px] font-semibold mb-1 px-2 py-0.5 rounded-full"
                  style={{ color: "#fff", background: b.color, boxShadow: `0 0 12px ${b.shadow}` }}
                >
                  {b.pct.toFixed(1)}%
                </span>
                <Bar3D height={h} color={b.color} highlight={b.highlight} shadow={b.shadow} active={isActive} />
                <span
                  className="text-[11px] mt-2 font-bold tracking-wide px-2 py-0.5 rounded-md"
                  style={{
                    color: "#fff",
                    background: `linear-gradient(135deg, ${b.color}, ${b.highlight})`,
                    boxShadow: `0 4px 14px ${b.shadow}`,
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
          className="absolute top-2 left-2 text-[10px] bg-background/80 hover:bg-background text-foreground px-2 py-1 rounded-md border border-border"
        >
          Resetar vista
        </button>
        <div className="absolute top-2 right-2 text-[10px] text-white/80 bg-white/10 backdrop-blur px-2 py-1 rounded-md border border-white/20">
          arraste para girar · X {rxNorm.toFixed(0)}° · Y {ryNorm.toFixed(0)}°
        </div>
      </div>

      {/* Detalhes da barra ativa */}
      {(() => {
        const b = bars.find((x) => x.key === active);
        if (!b) {
          return (
            <p className="text-[11px] text-muted-foreground italic">
              Passe o mouse ou clique em uma barra (ou na legenda) para ver os detalhes.
            </p>
          );
        }
        const totalRef = Math.max(total, 1);
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
              onClick={() => setActive(null)}
              className="ml-auto text-[10px] px-2 py-0.5 rounded border border-border hover:bg-muted"
            >
              Fechar
            </button>
          </div>
        );
      })()}

      {/* Legenda colorida e destacada */}
      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">

        {bars.map((b) => (
          <li
            key={b.key}
            onMouseEnter={() => setActive(b.key)}
            onMouseLeave={() => setActive((cur) => (cur === b.key ? null : cur))}
            onClick={() => setActive((cur) => (cur === b.key ? null : b.key))}
            className="relative rounded-xl p-3 overflow-hidden cursor-pointer transition-transform hover:-translate-y-0.5"
            style={{
              background: `linear-gradient(135deg, ${b.color}22, ${b.highlight}11)`,
              border: `${active === b.key ? 2 : 1}px solid ${b.color}`,
              boxShadow: active === b.key ? `0 10px 28px ${b.shadow}` : `0 6px 18px ${b.shadow}`,
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="h-4 w-4 rounded-full"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${b.highlight}, ${b.color})`,
                  boxShadow: `0 0 8px ${b.shadow}`,
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
  const radius = 14;
  const front = `linear-gradient(180deg, ${highlight} 0%, ${color} 55%, ${shade(color, -25)} 100%)`;
  const side  = `linear-gradient(180deg, ${shade(color, -10)} 0%, ${shade(color, -35)} 100%)`;
  const back  = `linear-gradient(180deg, ${shade(color, -20)} 0%, ${shade(color, -45)} 100%)`;
  const top   = `radial-gradient(circle at 35% 30%, ${shade(highlight, 25)}, ${color})`;
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    borderRadius: radius,
    boxShadow: active ? `0 0 36px ${shadow}, 0 0 0 2px ${highlight}` : `0 0 22px ${shadow}`,
  };
  return (
    <div style={{ width: w, height, position: "relative", transformStyle: "preserve-3d" }}>
      {/* frente */}
      <div style={{ ...baseStyle, inset: 0, background: front, transform: `translateZ(${d / 2}px)` }} />
      {/* trás */}
      <div style={{ ...baseStyle, inset: 0, background: back, transform: `translateZ(${-d / 2}px) rotateY(180deg)` }} />
      {/* direita */}
      <div style={{ ...baseStyle, top: 0, right: 0, width: d, height, background: side, transform: `rotateY(90deg) translateZ(${w / 2}px)`, transformOrigin: "right center" }} />
      {/* esquerda */}
      <div style={{ ...baseStyle, top: 0, left: 0, width: d, height, background: side, transform: `rotateY(-90deg) translateZ(${w / 2}px)`, transformOrigin: "left center" }} />
      {/* topo */}
      <div style={{ ...baseStyle, top: 0, left: 0, width: w, height: d, background: top, transform: `rotateX(90deg) translateZ(${d / 2}px)`, transformOrigin: "top center" }} />
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
