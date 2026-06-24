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

/**
 * 3D bar chart (CSS perspective) — não anima sozinho.
 * Arraste com o mouse (clique e segure) para girar e ver de todos os lados.
 */
export function QuotaChart3D({ used, total, deleted = 0 }: Props) {
  const safeTotal = Math.max(total, 1);
  const free = Math.max(total - used, 0);
  const pctUsed = Math.min(100, (used / safeTotal) * 100);
  const pctFree = Math.min(100, (free / safeTotal) * 100);
  const pctDel = Math.min(100, (deleted / safeTotal) * 100);

  const [rx, setRx] = useState(-18);
  const [ry, setRy] = useState(-28);
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);

  function onDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, rx, ry };
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    setRy(drag.current.ry + dx * 0.5);
    setRx(Math.max(-80, Math.min(20, drag.current.rx - dy * 0.5)));
  }
  function onUp(e: React.PointerEvent) {
    drag.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  }

  const bars = [
    { key: "used", label: "Usado", value: used, pct: pctUsed, color: "#2563eb" },
    { key: "free", label: "Disponível", value: free, pct: pctFree, color: "#10b981" },
    { key: "deleted", label: "Lixeira", value: deleted, pct: pctDel, color: "#f59e0b" },
    { key: "total", label: "Total", value: total, pct: 100, color: "#6b7280" },
  ];

  return (
    <div className="space-y-3">
      <div
        className="relative h-72 w-full rounded-md border border-border bg-gradient-to-b from-muted/40 to-background cursor-grab active:cursor-grabbing select-none overflow-hidden"
        style={{ perspective: "900px" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        title="Clique e arraste para girar"
      >
        <div
          className="absolute inset-0 flex items-end justify-center gap-8 pb-8"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${rx}deg) rotateY(${ry}deg)`,
            transition: drag.current ? "none" : "transform 0s",
          }}
        >
          {/* "Chão" */}
          <div
            className="absolute left-1/2 bottom-6 rounded bg-border/40"
            style={{
              width: 360, height: 200,
              transform: "translateX(-50%) rotateX(90deg) translateZ(-1px)",
              transformStyle: "preserve-3d",
            }}
          />
          {bars.map((b) => {
            const h = Math.max(8, (b.pct / 100) * 200);
            return (
              <div key={b.key} className="flex flex-col items-center" style={{ transformStyle: "preserve-3d" }}>
                <span className="text-[10px] text-muted-foreground mb-1" style={{ transform: `rotateY(${-ry}deg) rotateX(${-rx}deg)` }}>
                  {b.pct.toFixed(1)}%
                </span>
                <Bar3D height={h} color={b.color} />
                <span className="text-[11px] mt-2 font-medium" style={{ transform: `rotateY(${-ry}deg) rotateX(${-rx}deg)` }}>
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="absolute top-2 right-2 text-[10px] text-muted-foreground bg-background/70 px-2 py-1 rounded border border-border">
          arraste para girar
        </div>
      </div>

      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {bars.map((b) => (
          <li key={b.key} className="border border-border rounded p-2 bg-card">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ background: b.color }} />
              <span className="font-medium">{b.label}</span>
            </div>
            <div className="mt-1 text-muted-foreground">{fmtBytes(b.value)}</div>
            <div className="text-[10px] text-muted-foreground">{b.pct.toFixed(1)}% do total</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bar3D({ height, color }: { height: number; color: string }) {
  const w = 48;
  const d = 48;
  return (
    <div style={{ width: w, height, position: "relative", transformStyle: "preserve-3d" }}>
      {/* frente */}
      <div style={{ position: "absolute", inset: 0, background: color, transform: `translateZ(${d / 2}px)` }} />
      {/* trás */}
      <div style={{ position: "absolute", inset: 0, background: shade(color, -30), transform: `translateZ(${-d / 2}px) rotateY(180deg)` }} />
      {/* direita */}
      <div style={{ position: "absolute", top: 0, right: 0, width: d, height, background: shade(color, -15), transform: `rotateY(90deg) translateZ(${w / 2}px)`, transformOrigin: "right center" }} />
      {/* esquerda */}
      <div style={{ position: "absolute", top: 0, left: 0, width: d, height, background: shade(color, -20), transform: `rotateY(-90deg) translateZ(${w / 2}px)`, transformOrigin: "left center" }} />
      {/* topo */}
      <div style={{ position: "absolute", top: 0, left: 0, width: w, height: d, background: shade(color, 20), transform: `rotateX(90deg) translateZ(${d / 2}px)`, transformOrigin: "top center" }} />
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
