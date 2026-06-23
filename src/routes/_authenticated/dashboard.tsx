import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/core.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Building2, FileText, AlertTriangle, CheckCircle2, ArrowRight, SlidersHorizontal, Wrench, HardHat, BarChart3, RotateCw } from "lucide-react";
import { rdoStatusMeta } from "@/components/status";
import { useMemo, useState } from "react";
import { Bars3D, Pie3D, Chart3DLegend, type Chart3DDatum } from "@/components/charts-3d";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type Dim = "obras" | "equipamentos" | "mao_de_obra" | "ocorrencias";

const PALETTE = [
  "#1E3A8A", "#2563EB", "#0EA5E9", "#14B8A6", "#10B981",
  "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#84CC16",
  "#F97316", "#06B6D4",
];

function DashboardPage() {
  const fn = useServerFn(getDashboard);
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => fn() });
  const navigate = useNavigate();
  const [fObra, setFObra] = useState("todas");
  const [fEquip, setFEquip] = useState("todos");
  const [fMao, setFMao] = useState("todos");
  const [fOcor, setFOcor] = useState("todos");
  const [dim, setDim] = useState<Dim>("obras");
  const [drill, setDrill] = useState<null | { title: string; rows: { label: string; value: string | number }[] }>(null);

  const filtros = useMemo(() => {
    if (!data) return null;
    let rdoIds = new Set<string>((data.rdos_all as any[]).map((r) => r.id));
    if (fObra !== "todas") rdoIds = new Set((data.rdos_all as any[]).filter((r) => r.obra_id === fObra).map((r) => r.id));
    if (fEquip !== "todos") {
      const ids = new Set((data.rdo_equipamentos as any[]).filter((e) => e.equipamento_id === fEquip).map((e) => e.rdo_id));
      rdoIds = new Set([...rdoIds].filter((id) => ids.has(id)));
    }
    if (fMao !== "todos") {
      const ids = new Set((data.rdo_mao_de_obra as any[]).filter((m) => m.mao_de_obra_id === fMao).map((m) => m.rdo_id));
      rdoIds = new Set([...rdoIds].filter((id) => ids.has(id)));
    }
    if (fOcor !== "todos") {
      const ids = new Set((data.ocorrencias_all as any[]).filter((o) => o.tipo_ocorrencia_id === fOcor).map((o) => o.rdo_id));
      rdoIds = new Set([...rdoIds].filter((id) => ids.has(id)));
    }
    const ocorrencias = (data.ocorrencias_all as any[]).filter((o) => rdoIds.has(o.rdo_id));
    const equipUsos = (data.rdo_equipamentos as any[]).filter((e) => rdoIds.has(e.rdo_id));
    const maoUsos = (data.rdo_mao_de_obra as any[]).filter((e) => rdoIds.has(e.rdo_id));
    return { rdoIds, rdos: rdoIds.size, ocorrencias: ocorrencias.length, equipamentos: equipUsos.length, mao_de_obra: maoUsos.length };
  }, [data, fObra, fEquip, fMao, fOcor]);

  // ---- Charts data por dimensão ----
  const chartData = useMemo(() => {
    if (!data || !filtros) return [];
    const ids = filtros.rdoIds;
    if (dim === "obras") {
      const byObra = new Map<string, number>();
      (data.rdos_all as any[]).filter((r) => ids.has(r.id)).forEach((r) => {
        byObra.set(r.obra_id, (byObra.get(r.obra_id) ?? 0) + 1);
      });
      return (data.obras as any[])
        .map((o) => ({ id: o.id, name: o.nome, value: byObra.get(o.id) ?? 0, extra: `${Number(o.avanco_pct).toFixed(0)}% concluído` }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value);
    }
    if (dim === "equipamentos") {
      const byEq = new Map<string, number>();
      (data.rdo_equipamentos as any[]).filter((e) => ids.has(e.rdo_id)).forEach((e) => {
        byEq.set(e.equipamento_id, (byEq.get(e.equipamento_id) ?? 0) + 1);
      });
      return (data.equipamentos as any[])
        .map((e) => ({ id: e.id, name: e.nome, value: byEq.get(e.id) ?? 0, extra: "usos em RDOs" }))
        .filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
    }
    if (dim === "mao_de_obra") {
      const byM = new Map<string, number>();
      (data.rdo_mao_de_obra as any[]).filter((m) => ids.has(m.rdo_id)).forEach((m) => {
        byM.set(m.mao_de_obra_id, (byM.get(m.mao_de_obra_id) ?? 0) + 1);
      });
      return (data.mao_de_obra as any[])
        .map((m) => ({ id: m.id, name: m.nome, value: byM.get(m.id) ?? 0, extra: "alocações" }))
        .filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
    }
    // ocorrencias
    const byT = new Map<string, number>();
    (data.ocorrencias_all as any[]).filter((o) => ids.has(o.rdo_id)).forEach((o) => {
      byT.set(o.tipo_ocorrencia_id, (byT.get(o.tipo_ocorrencia_id) ?? 0) + 1);
    });
    return (data.tipos_ocorrencia as any[])
      .map((t) => ({ id: t.id, name: t.nome, value: byT.get(t.id) ?? 0, extra: "ocorrências" }))
      .filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  }, [data, dim, filtros]);

  const dimLabel: Record<Dim, string> = {
    obras: "Obras",
    equipamentos: "Equipamentos",
    mao_de_obra: "Mão de obra",
    ocorrencias: "Ocorrências",
  };

  function openDrill(label: string, value: number) {
    if (!data) return;
    const rows: { label: string; value: string | number }[] = [];
    rows.push({ label: dimLabel[dim], value: label });
    rows.push({ label: "Total no filtro", value });
    if (dim === "obras") {
      const obra = (data.obras as any[]).find((o) => o.nome === label);
      if (obra) {
        rows.push({ label: "Status", value: obra.status });
        rows.push({ label: "Avanço", value: `${Number(obra.avanco_pct).toFixed(1)}%` });
      }
    }
    setDrill({ title: `${dimLabel[dim]}: ${label}`, rows });
  }

  if (!data) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  const obrasAtivas = data.obras.filter((o: any) => o.status === "em_andamento");
  const filtroAtivo = fObra !== "todas" || fEquip !== "todos" || fMao !== "todos" || fOcor !== "todos";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <header className="mb-6 sm:mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl">Visão geral</h1>
        <p className="text-sm text-muted-foreground mt-1">Indicadores em tempo real da operação.</p>
      </header>

      <Card className="p-3 sm:p-4 mb-4">
        <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
          <SlidersHorizontal className="h-4 w-4" /> Filtro avançado
          {filtroAtivo && filtros && (
            <Badge variant="outline" className="ml-2">
              {filtros.rdos} RDO · {filtros.ocorrencias} ocor. · {filtros.equipamentos} equip. · {filtros.mao_de_obra} m.o.
            </Badge>
          )}
          {filtroAtivo && (
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => { setFObra("todas"); setFEquip("todos"); setFMao("todos"); setFOcor("todos"); }}>
              Limpar
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Select value={fObra} onValueChange={setFObra}>
            <SelectTrigger><SelectValue placeholder="Obra" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as obras</SelectItem>
              {(data.obras as any[]).map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fEquip} onValueChange={setFEquip}>
            <SelectTrigger><SelectValue placeholder="Equipamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos equipamentos</SelectItem>
              {(data.equipamentos as any[]).map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fMao} onValueChange={setFMao}>
            <SelectTrigger><SelectValue placeholder="Mão de obra" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Toda mão de obra</SelectItem>
              {(data.mao_de_obra as any[]).map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fOcor} onValueChange={setFOcor}>
            <SelectTrigger><SelectValue placeholder="Tipo de ocorrência" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas ocorrências</SelectItem>
              {(data.tipos_ocorrencia as any[]).map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Stat cards clicáveis */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatCard icon={Building2} label="Obras ativas" value={data.obras_ativas} sub={`${data.obras_total} no total`} tone="brand" onClick={() => navigate({ to: "/obras" })} />
        <StatCard icon={FileText} label={filtroAtivo ? "RDOs filtrados" : "RDOs pendentes"} value={filtroAtivo && filtros ? filtros.rdos : data.rdos_pendentes} sub={filtroAtivo ? "no filtro atual" : "aguardando aprovação"} tone="warning" onClick={() => navigate({ to: "/rdo" })} />
        <StatCard icon={CheckCircle2} label="RDOs aprovados" value={data.rdos_aprovados} sub={`${data.rdos_total} emitidos`} tone="success" onClick={() => navigate({ to: "/rdo" })} />
        <StatCard icon={AlertTriangle} label={filtroAtivo ? "Ocorrências filtradas" : "Ocorrências (7d)"} value={filtroAtivo && filtros ? filtros.ocorrencias : data.ocorrencias_semana} sub={filtroAtivo ? "no filtro atual" : `${data.ocorrencias_total} no histórico`} tone="destructive" onClick={() => { setDim("ocorrencias"); document.getElementById("graficos")?.scrollIntoView({ behavior: "smooth" }); }} />
      </div>

      {/* ============== GRÁFICOS MULTI-DIMENSÃO ============== */}
      <Card id="graficos" className="p-4 sm:p-6 mb-4 overflow-hidden relative">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brand" />
            <h2 className="font-serif text-xl">Análise por dimensão</h2>
          </div>
          <Badge variant="outline" className="text-xs">Clique em qualquer barra ou fatia</Badge>
        </div>

        <Tabs value={dim} onValueChange={(v) => setDim(v as Dim)}>
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full mb-4">
            <TabsTrigger value="obras"><Building2 className="h-4 w-4 mr-1.5" />Obras</TabsTrigger>
            <TabsTrigger value="equipamentos"><Wrench className="h-4 w-4 mr-1.5" />Equipamentos</TabsTrigger>
            <TabsTrigger value="mao_de_obra"><HardHat className="h-4 w-4 mr-1.5" />Mão de obra</TabsTrigger>
            <TabsTrigger value="ocorrencias"><AlertTriangle className="h-4 w-4 mr-1.5" />Ocorrências</TabsTrigger>
          </TabsList>

          <TabsContent value={dim} className="mt-0">
            {chartData.length === 0 ? (
              <EmptyState text="Sem dados para os filtros atuais." />
            ) : (
              <div className="grid lg:grid-cols-2 gap-6 animate-fade-in">
                <ChartFrame title={`Barras 3D · ${dimLabel[dim]}`}>
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={chartData} margin={{ top: 24, right: 16, left: 0, bottom: 56 }}>
                      <defs>
                        {chartData.map((_, i) => (
                          <linearGradient key={i} id={`bar3d-${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={1} />
                            <stop offset="60%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.85} />
                            <stop offset="100%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.55} />
                          </linearGradient>
                        ))}
                        <filter id="bar-shadow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="3" dy="6" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.35" />
                        </filter>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} height={70} tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip content={<FancyTooltip dimLabel={dimLabel[dim]} />} cursor={{ fill: "rgba(30,58,138,0.05)" }} />
                      <Bar
                        dataKey="value"
                        radius={[10, 10, 0, 0]}
                        animationDuration={900}
                        filter="url(#bar-shadow)"
                        onClick={(d: any) => openDrill(d.name, d.value)}
                        style={{ cursor: "pointer" }}
                      >
                        {chartData.map((_, i) => <Cell key={i} fill={`url(#bar3d-${i})`} stroke={PALETTE[i % PALETTE.length]} strokeWidth={1} />)}
                        <LabelList dataKey="value" position="top" style={{ fontSize: 11, fontWeight: 600, fill: "#0f172a" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartFrame>

                <ChartFrame title={`Pizza 3D · ${dimLabel[dim]}`}>
                  <ResponsiveContainer width="100%" height={340}>
                    <PieChart>
                      <defs>
                        {chartData.map((_, i) => (
                          <radialGradient key={i} id={`pie3d-${i}`} cx="50%" cy="40%" r="65%">
                            <stop offset="0%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={1} />
                            <stop offset="100%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.55} />
                          </radialGradient>
                        ))}
                        <filter id="pie-shadow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="2" dy="8" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.4" />
                        </filter>
                      </defs>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        innerRadius={45}
                        paddingAngle={2}
                        animationDuration={900}
                        filter="url(#pie-shadow)"
                        onClick={(d: any) => openDrill(d.name, d.value)}
                        label={(e: any) => `${e.value}`}
                        style={{ cursor: "pointer" }}
                      >
                        {chartData.map((_, i) => <Cell key={i} fill={`url(#pie3d-${i})`} stroke="#fff" strokeWidth={2} />)}
                      </Pie>
                      <Tooltip content={<FancyTooltip dimLabel={dimLabel[dim]} />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartFrame>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      <div className="grid md:grid-cols-12 gap-3 sm:gap-4">
        {/* Avanço por obra */}
        <Card className="md:col-span-8 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl">Avanço por obra</h2>
            <Link to="/obras" className="text-xs text-muted-foreground hover:underline flex items-center gap-1">
              Ver obras <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {obrasAtivas.length === 0 ? (
            <EmptyState text="Nenhuma obra em andamento." />
          ) : (
            <div className="space-y-3">
              {obrasAtivas.slice(0, 6).map((o: any) => (
                <div key={o.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <Link to="/obras/$obraId" params={{ obraId: o.id }} className="font-medium hover:underline">{o.nome}</Link>
                    <span className="text-muted-foreground tabular-nums">{Number(o.avanco_pct).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-brand transition-all duration-700" style={{ width: `${o.avanco_pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Últimos RDOs */}
        <Card className="md:col-span-4 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl">Últimos RDOs</h2>
            <Link to="/rdo" className="text-xs text-muted-foreground hover:underline flex items-center gap-1">
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.recent_rdos.length === 0 ? (
            <EmptyState text="Nenhum RDO ainda." />
          ) : (
            <ul className="space-y-3">
              {data.recent_rdos.map((r: any) => {
                const meta = rdoStatusMeta[r.status as keyof typeof rdoStatusMeta];
                return (
                  <li key={r.id}>
                    <Link to="/rdo/$rdoId" params={{ rdoId: r.id }} className="block hover:bg-muted/50 -mx-2 px-2 py-1.5 rounded-md">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">RDO #{r.numero} · {r.obras?.nome}</span>
                        <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{new Date(r.data).toLocaleDateString("pt-BR")}</div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Drill-down dialog */}
      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{drill?.title}</DialogTitle>
            <DialogDescription>Detalhamento conforme os filtros aplicados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {drill?.rows.map((r, i) => (
              <div key={i} className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-medium">{r.value}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDrill(null)}>Fechar</Button>
            <Button onClick={() => { setDrill(null); navigate({ to: dim === "obras" ? "/obras" : "/rdo" }); }}>Abrir relatório</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChartFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-background to-muted/30 p-3 shadow-inner">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">{title}</div>
      {children}
    </div>
  );
}

function FancyTooltip({ active, payload, dimLabel }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const d = p.payload;
  return (
    <div className="rounded-lg border bg-background/95 backdrop-blur px-3 py-2 shadow-xl text-xs">
      <div className="font-semibold text-foreground">{d.name}</div>
      <div className="text-muted-foreground">{dimLabel}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
        <span className="font-mono tabular-nums font-medium">{d.value}</span>
        {d.extra && <span className="text-muted-foreground">· {d.extra}</span>}
      </div>
      <div className="text-[10px] text-muted-foreground mt-1">Clique para ver detalhes</div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, tone, onClick }: { icon: any; label: string; value: number | string; sub?: string; tone?: "success" | "warning" | "destructive" | "brand"; onClick?: () => void }) {
  const toneColor =
    tone === "success" ? "text-success" :
    tone === "warning" ? "text-warning" :
    tone === "destructive" ? "text-destructive" :
    "text-brand";
  const ring =
    tone === "success" ? "hover:ring-success/40" :
    tone === "warning" ? "hover:ring-warning/40" :
    tone === "destructive" ? "hover:ring-destructive/40" :
    "hover:ring-brand/40";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left group rounded-xl border bg-card p-5 flex flex-col justify-between min-h-[120px] transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-2 ${ring} focus:outline-none focus:ring-2 focus:ring-brand`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${toneColor} transition-transform group-hover:scale-110`} />
      </div>
      <div>
        <div className="font-serif text-3xl tabular-nums">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="h-full grid place-items-center text-sm text-muted-foreground py-8">{text}</div>;
}
