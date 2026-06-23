import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/core.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Building2, Wrench, HardHat, AlertTriangle, CheckCircle2, FileText, Clock } from "lucide-react";
import { rdoStatusMeta } from "@/components/status";
import { useMemo, useState } from "react";
import { Bars3D, Pie3D, Chart3DLegend, type Chart3DDatum } from "@/components/charts-3d";

type Dim = "obras" | "equipamentos" | "mao_de_obra" | "ocorrencias";

const DIM_META: Record<Dim, { label: string; icon: any; desc: string }> = {
  obras: { label: "Obras", icon: Building2, desc: "RDOs emitidos por obra" },
  equipamentos: { label: "Equipamentos", icon: Wrench, desc: "Usos de equipamentos em RDOs" },
  mao_de_obra: { label: "Mão de obra", icon: HardHat, desc: "Alocações de mão de obra em RDOs" },
  ocorrencias: { label: "Ocorrências", icon: AlertTriangle, desc: "Ocorrências por tipo" },
};

export const Route = createFileRoute("/_authenticated/relatorios/$dim")({
  component: RelatorioPage,
});

function RelatorioPage() {
  const { dim } = Route.useParams();
  const d = dim as Dim;
  const meta = DIM_META[d];
  const navigate = useNavigate();
  const fn = useServerFn(getDashboard);
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => fn() });
  const [focus, setFocus] = useState<string>("todos");

  const rows = useMemo<Chart3DDatum[]>(() => {
    if (!data) return [];
    if (d === "obras") {
      const by = new Map<string, number>();
      (data.rdos_all as any[]).forEach((r) => by.set(r.obra_id, (by.get(r.obra_id) ?? 0) + 1));
      return (data.obras as any[]).map((o) => ({ id: o.id, name: o.nome, value: by.get(o.id) ?? 0, extra: `${Number(o.avanco_pct).toFixed(0)}% concluído` })).filter((x) => x.value > 0);
    }
    if (d === "equipamentos") {
      const by = new Map<string, number>();
      (data.rdo_equipamentos as any[]).forEach((e) => by.set(e.equipamento_id, (by.get(e.equipamento_id) ?? 0) + 1));
      return (data.equipamentos as any[]).map((e) => ({ id: e.id, name: e.nome, value: by.get(e.id) ?? 0, extra: "usos" })).filter((x) => x.value > 0);
    }
    if (d === "mao_de_obra") {
      const by = new Map<string, number>();
      (data.rdo_mao_de_obra as any[]).forEach((m) => by.set(m.mao_de_obra_id, (by.get(m.mao_de_obra_id) ?? 0) + 1));
      return (data.mao_de_obra as any[]).map((m) => ({ id: m.id, name: m.nome, value: by.get(m.id) ?? 0, extra: "alocações" })).filter((x) => x.value > 0);
    }
    const by = new Map<string, number>();
    (data.ocorrencias_all as any[]).forEach((o) => by.set(o.tipo_ocorrencia_id, (by.get(o.tipo_ocorrencia_id) ?? 0) + 1));
    return (data.tipos_ocorrencia as any[]).map((t) => ({ id: t.id, name: t.nome, value: by.get(t.id) ?? 0, extra: "ocorrências" })).filter((x) => x.value > 0);
  }, [data, d]);

  const filtered = focus === "todos" ? rows : rows.filter((r) => r.id === focus);

  const rdoStats = useMemo(() => {
    if (!data) return { total: 0, aprovados: 0, pendentes: 0, rascunho: 0 };
    const rs = data.rdos_all as any[];
    return {
      total: rs.length,
      aprovados: rs.filter((r) => r.status === "aprovado").length,
      pendentes: rs.filter((r) => r.status === "pendente_aprovacao" || r.status === "em_aprovacao").length,
      rascunho: rs.filter((r) => r.status === "rascunho").length,
    };
  }, [data]);

  if (!meta) return <div className="p-8">Dimensão inválida</div>;
  if (!data) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  const Icon = meta.icon;
  const aprovPct = rdoStats.total > 0 ? (rdoStats.aprovados / rdoStats.total) * 100 : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })} className="mb-2 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao dashboard
          </Button>
          <h1 className="font-serif text-2xl sm:text-3xl flex items-center gap-2">
            <Icon className="h-7 w-7 text-brand" /> Relatório · {meta.label}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{meta.desc}</p>
        </div>
        <div className="flex gap-2">
          {(Object.keys(DIM_META) as Dim[]).map((k) => (
            <Button key={k} size="sm" variant={k === d ? "default" : "outline"} onClick={() => navigate({ to: "/relatorios/$dim", params: { dim: k } })}>
              {DIM_META[k].label}
            </Button>
          ))}
        </div>
      </header>

      {/* Resumo RDO */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard icon={FileText} label="RDOs totais" value={rdoStats.total} tone="brand" />
        <SummaryCard icon={CheckCircle2} label="Aprovados" value={rdoStats.aprovados} tone="success" />
        <SummaryCard icon={Clock} label="Pendentes" value={rdoStats.pendentes} tone="warning" />
        <SummaryCard icon={AlertTriangle} label="Rascunhos" value={rdoStats.rascunho} tone="destructive" />
      </div>

      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between mb-2 text-sm">
          <span className="font-medium">Taxa de aprovação dos RDOs</span>
          <span className="font-mono tabular-nums">{aprovPct.toFixed(1)}%</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000" style={{ width: `${aprovPct}%` }} />
        </div>
      </Card>

      <Card className="p-4 sm:p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-serif text-xl">Visualização 3D</h2>
          <Select value={focus} onValueChange={setFocus}>
            <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os itens</SelectItem>
              {rows.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Sem dados.</div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Barras 3D · arraste para rotacionar</div>
              <Bars3D data={filtered} onSelect={() => {}} />
              <Chart3DLegend data={filtered} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pizza 3D · arraste para rotacionar</div>
              <Pie3D data={filtered} onSelect={() => {}} />
              <Chart3DLegend data={filtered} />
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="font-serif text-xl mb-4">Detalhamento</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3 text-right">Valor</th>
                <th className="py-2 pr-3">Observação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border/60 hover:bg-muted/40">
                  <td className="py-2 pr-3 font-medium">{r.name}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">{r.value}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.extra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6">
        <h3 className="font-serif text-lg mb-3">RDOs recentes</h3>
        <ul className="space-y-2">
          {(data.recent_rdos as any[]).map((r) => {
            const m = rdoStatusMeta[r.status as keyof typeof rdoStatusMeta];
            return (
              <li key={r.id}>
                <Link to="/rdo/$rdoId" params={{ rdoId: r.id }} className="flex items-center justify-between hover:bg-muted/50 px-3 py-2 rounded-md border">
                  <span className="text-sm font-medium">RDO #{r.numero} · {r.obras?.nome}</span>
                  <Badge variant="outline" className={m.className}>{m.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: "brand" | "success" | "warning" | "destructive" }) {
  const color = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-brand";
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="font-serif text-3xl tabular-nums">{value}</div>
    </Card>
  );
}
