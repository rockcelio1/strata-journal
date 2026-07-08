import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getMediaMetrics } from "@/lib/media-audit.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Image as ImageIcon, Gauge, AlertTriangle } from "lucide-react";

export function MediaMetricsPanel() {
  const fn = useServerFn(getMediaMetrics);
  const [hours, setHours] = useState<number>(24);
  const { data, isLoading } = useQuery({
    queryKey: ["media-metrics", hours],
    queryFn: () => fn({ data: { hours } }),
    refetchInterval: 60_000,
  });

  const hit = ((data?.hit_rate ?? 0) * 100).toFixed(1);
  const miss = ((data?.miss_rate ?? 0) * 100).toFixed(1);

  return (
    <Card className="dash-card p-4 sm:p-6 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-brand" />
          <h2 className="font-serif text-xl">Desempenho da Galeria (thumbnails)</h2>
        </div>
        <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Última 1h</SelectItem>
            <SelectItem value="6">Últimas 6h</SelectItem>
            <SelectItem value="24">Últimas 24h</SelectItem>
            <SelectItem value="168">Últimos 7 dias</SelectItem>
            <SelectItem value="720">Últimos 30 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && !data ? (
        <div className="text-sm text-muted-foreground py-4">Carregando métricas…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric icon={Gauge} label="Tempo médio" value={`${data?.avg_ms ?? 0} ms`} sub={`${data?.total_events ?? 0} eventos`} />
            <Metric icon={Gauge} label="Cache HIT" value={`${hit}%`} sub="atendidos pelo cache" tone="success" />
            <Metric icon={Gauge} label="Cache MISS" value={`${miss}%`} sub="buscados no OneDrive" tone="warning" />
            <Metric icon={AlertTriangle} label="Falhas" value={data?.total_failures ?? 0} sub="thumbs que não carregaram" tone="destructive" />
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <h3 className="text-xs uppercase text-muted-foreground mb-2">Por tamanho de thumbnail</h3>
              <div className="space-y-1">
                {(data?.by_size ?? []).length === 0 && <p className="text-xs text-muted-foreground">Sem dados no período.</p>}
                {(data?.by_size ?? []).map((b) => (
                  <div key={b.size} className="flex items-center justify-between border border-border rounded px-2 py-1 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="uppercase">{b.size}</Badge>
                      <span className="tabular-nums text-muted-foreground">{b.total} req · {b.avg_ms} ms</span>
                    </div>
                    <div className="tabular-nums">
                      <span className="text-emerald-600">{((b.hit_rate) * 100).toFixed(0)}% HIT</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs uppercase text-muted-foreground mb-2">Falhas por tamanho</h3>
              <div className="space-y-1">
                {(data?.failures_by_size ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nenhuma falha no período.</p>}
                {(data?.failures_by_size ?? []).map((b) => (
                  <div key={b.size} className="flex items-center justify-between border border-border rounded px-2 py-1 text-xs">
                    <Badge variant="outline" className="uppercase">{b.size}</Badge>
                    <span className="tabular-nums text-destructive">{b.count} falha(s)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function Metric({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string | number; sub?: string; tone?: "success" | "warning" | "destructive" }) {
  const toneCls =
    tone === "success" ? "text-success" :
    tone === "warning" ? "text-warning" :
    tone === "destructive" ? "text-destructive" : "text-brand";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${toneCls}`} />
      </div>
      <div className="font-serif text-2xl tabular-nums mt-1">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
