import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { HardDrive, Database, Trash2, CheckCircle2, AlertTriangle, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtBytes } from "@/components/onedrive/QuotaChart3D";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Props = {
  used: number;
  total: number;
  deleted?: number;
};

type DetailKey = "total" | "used" | "deleted" | "free";

export function QuotaDashboard({ used, total, deleted = 0 }: Props) {
  const safeTotal = Math.max(total, 1);
  const safeUsed = Math.max(Math.min(used, safeTotal), 0);
  const safeDeleted = Math.max(Math.min(deleted, safeTotal - safeUsed), 0);
  const livre = Math.max(safeTotal - safeUsed - safeDeleted, 0);
  const pct = (safeUsed / safeTotal) * 100;
  const pctDel = (safeDeleted / safeTotal) * 100;
  const pctFree = (livre / safeTotal) * 100;
  const [open, setOpen] = useState<DetailKey | null>(null);

  const status = useMemo(() => {
    if (pct >= 90) return { label: "Crítico", cls: "text-destructive bg-destructive/10 border-destructive/30", Icon: CircleAlert, ring: "hsl(var(--destructive))" };
    if (pct >= 75) return { label: "Atenção", cls: "text-amber-700 bg-amber-500/10 border-amber-500/30", Icon: AlertTriangle, ring: "rgb(245 158 11)" };
    return { label: "Saudável", cls: "text-emerald-700 bg-emerald-500/10 border-emerald-500/30", Icon: CheckCircle2, ring: "rgb(16 185 129)" };
  }, [pct]);

  const data = [
    { name: "Em uso", value: safeUsed, color: status.ring },
    { name: "Lixeira", value: safeDeleted, color: "rgb(148 163 184)" },
    { name: "Livre", value: livre, color: "rgb(226 232 240)" },
  ].filter((d) => d.value > 0);

  const details: Record<DetailKey, {
    title: string; desc: string; value: string; pct?: string;
    rows: Array<{ k: string; v: string }>;
    tone: "muted" | "brand" | "ok" | "warn" | "danger";
  }> = {
    total: {
      title: "Capacidade total", tone: "muted",
      desc: "Espaço total contratado no OneDrive associado a esta conta.",
      value: fmtBytes(safeTotal),
      rows: [
        { k: "Total bruto", v: `${safeTotal.toLocaleString("pt-BR")} bytes` },
        { k: "Em uso", v: `${fmtBytes(safeUsed)} (${pct.toFixed(2)}%)` },
        { k: "Lixeira", v: `${fmtBytes(safeDeleted)} (${pctDel.toFixed(2)}%)` },
        { k: "Disponível", v: `${fmtBytes(livre)} (${pctFree.toFixed(2)}%)` },
      ],
    },
    used: {
      title: "Em uso", tone: "brand",
      desc: "Arquivos atualmente armazenados (fotos, vídeos, PDFs e demais anexos enviados).",
      value: fmtBytes(safeUsed), pct: `${pct.toFixed(2)}%`,
      rows: [
        { k: "Ocupação", v: `${pct.toFixed(2)}% do total` },
        { k: "Restam até 75%", v: fmtBytes(Math.max(safeTotal * 0.75 - safeUsed, 0)) },
        { k: "Restam até 90%", v: fmtBytes(Math.max(safeTotal * 0.90 - safeUsed, 0)) },
        { k: "Status", v: status.label },
      ],
    },
    deleted: {
      title: "Lixeira", tone: "muted",
      desc: "Itens removidos que ainda ocupam espaço até serem esvaziados (retenção padrão 30 dias).",
      value: fmtBytes(safeDeleted), pct: `${pctDel.toFixed(2)}%`,
      rows: [
        { k: "Ocupação", v: `${pctDel.toFixed(2)}% do total` },
        { k: "Recuperável esvaziando", v: fmtBytes(safeDeleted) },
        { k: "Dica", v: "Esvazie a lixeira do OneDrive para liberar espaço imediatamente." },
      ],
    },
    free: {
      title: "Disponível", tone: pct >= 90 ? "danger" : pct >= 75 ? "warn" : "ok",
      desc: "Espaço livre para novos uploads antes de atingir o limite.",
      value: fmtBytes(livre), pct: `${pctFree.toFixed(2)}%`,
      rows: [
        { k: "Livre agora", v: `${fmtBytes(livre)} (${pctFree.toFixed(2)}%)` },
        { k: "Com lixeira esvaziada", v: fmtBytes(livre + safeDeleted) },
        { k: "Status", v: status.label },
      ],
    },
  };

  const d = open ? details[open] : null;

  return (
    <div className="space-y-4">
      {/* KPIs clicáveis */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi onClick={() => setOpen("total")} icon={HardDrive} label="Capacidade total" value={fmtBytes(safeTotal)} tone="muted" />
        <Kpi onClick={() => setOpen("used")} icon={Database} label="Em uso" value={fmtBytes(safeUsed)} sub={`${pct.toFixed(1)}%`} tone="brand" />
        <Kpi onClick={() => setOpen("deleted")} icon={Trash2} label="Lixeira" value={fmtBytes(safeDeleted)} tone="muted" />
        <Kpi onClick={() => setOpen("free")} icon={status.Icon} label="Disponível" value={fmtBytes(livre)} sub={status.label} tone={pct >= 90 ? "danger" : pct >= 75 ? "warn" : "ok"} />
      </div>

      {/* Donut + barra */}
      <div className="grid md:grid-cols-[260px_minmax(0,1fr)] gap-4 items-center">
        <div className="relative h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius={68}
                outerRadius={92}
                paddingAngle={2}
                stroke="hsl(var(--background))"
                strokeWidth={2}
                isAnimationActive
                onClick={(_, idx) => {
                  const name = data[idx]?.name;
                  if (name === "Em uso") setOpen("used");
                  else if (name === "Lixeira") setOpen("deleted");
                  else if (name === "Livre") setOpen("free");
                }}
                style={{ cursor: "pointer" }}
              >
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, n: string) => [fmtBytes(v), n]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="text-center">
              <div className="text-3xl font-semibold tabular-nums leading-none">{pct.toFixed(0)}%</div>
              <div className="text-[11px] text-muted-foreground mt-1">ocupado</div>
            </div>
          </div>
        </div>

        <div className="space-y-3 min-w-0">
          <div className={cn("inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border", status.cls)}>
            <status.Icon className="h-3.5 w-3.5" /> {status.label}
          </div>

          <ProgressBar pct={pct} deletedPct={(safeDeleted / safeTotal) * 100} />

          <Legend items={[
            { color: status.ring, label: "Em uso", value: fmtBytes(safeUsed) },
            { color: "rgb(148 163 184)", label: "Lixeira", value: fmtBytes(safeDeleted) },
            { color: "rgb(226 232 240)", label: "Livre", value: fmtBytes(livre) },
          ]} />
          <p className="text-[11px] text-muted-foreground">Toque em um card ou na fatia do gráfico para ver detalhes.</p>
        </div>
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-md">
          {d && (
            <>
              <DialogHeader>
                <DialogTitle>{d.title}</DialogTitle>
                <DialogDescription>{d.desc}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className={cn("rounded-lg border p-3", toneClass(d.tone))}>
                  <div className="text-2xl font-semibold tabular-nums leading-none">{d.value}</div>
                  {d.pct && <div className="text-xs opacity-80 mt-1">{d.pct} da capacidade total</div>}
                </div>
                <dl className="text-sm divide-y divide-border rounded-md border border-border overflow-hidden">
                  {d.rows.map((r) => (
                    <div key={r.k} className="flex justify-between gap-3 px-3 py-2">
                      <dt className="text-muted-foreground">{r.k}</dt>
                      <dd className="font-medium tabular-nums text-right">{r.v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toneClass(tone: "muted" | "brand" | "ok" | "warn" | "danger") {
  return ({
    muted: "bg-muted/40 text-foreground border-border",
    brand: "bg-brand/10 text-brand border-brand/30",
    ok: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    warn: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    danger: "bg-destructive/10 text-destructive border-destructive/30",
  })[tone];
}

function Kpi({
  icon: Icon, label, value, sub, tone = "muted", onClick,
}: { icon: any; label: string; value: string; sub?: string; tone?: "muted" | "brand" | "ok" | "warn" | "danger"; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ver detalhes de ${label}`}
      className={cn(
        "text-left rounded-lg border p-3 transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring",
        toneClass(tone),
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide opacity-80">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-[11px] opacity-70 mt-0.5">{sub}</div>}
    </button>
  );
}

function ProgressBar({ pct, deletedPct }: { pct: number; deletedPct: number }) {
  const usedColor = pct >= 90 ? "bg-destructive" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("absolute inset-y-0 left-0 transition-all", usedColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
        <div className="absolute inset-y-0 bg-slate-400/70" style={{ left: `${Math.min(pct, 100)}%`, width: `${Math.min(deletedPct, 100 - pct)}%` }} />
        <div className="absolute inset-y-0 w-px bg-foreground/30" style={{ left: "75%" }} aria-hidden />
        <div className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: "90%" }} aria-hidden />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1 tabular-nums">
        <span>0%</span>
        <span>75% atenção</span>
        <span>90% crítico</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function Legend({ items }: { items: { color: string; label: string; value: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
          <span className="text-muted-foreground">{it.label}:</span>
          <span className="font-medium tabular-nums">{it.value}</span>
        </li>
      ))}
    </ul>
  );
}
