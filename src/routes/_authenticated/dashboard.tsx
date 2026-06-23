import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/core.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Building2, FileText, AlertTriangle, CheckCircle2, ArrowRight, SlidersHorizontal } from "lucide-react";
import { rdoStatusMeta } from "@/components/status";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const fn = useServerFn(getDashboard);
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => fn() });
  const [fObra, setFObra] = useState("todas");
  const [fEquip, setFEquip] = useState("todos");
  const [fMao, setFMao] = useState("todos");
  const [fOcor, setFOcor] = useState("todos");

  const filtros = useMemo(() => {
    if (!data) return null;
    let rdoIds = new Set<string>((data.rdos_all as any[]).map((r) => r.id));
    if (fObra !== "todas") {
      rdoIds = new Set((data.rdos_all as any[]).filter((r) => r.obra_id === fObra).map((r) => r.id));
    }
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
    return { rdos: rdoIds.size, ocorrencias: ocorrencias.length, equipamentos: equipUsos.length, mao_de_obra: maoUsos.length };
  }, [data, fObra, fEquip, fMao, fOcor]);

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

      <div className="grid grid-cols-2 md:grid-cols-12 gap-3 sm:gap-4 md:auto-rows-[120px]">
        <StatCard className="col-span-1 md:col-span-3" icon={Building2} label="Obras ativas" value={data.obras_ativas} sub={`${data.obras_total} no total`} />
        <StatCard className="col-span-1 md:col-span-3" icon={FileText} label={filtroAtivo ? "RDOs filtrados" : "RDOs pendentes"} value={filtroAtivo && filtros ? filtros.rdos : data.rdos_pendentes} sub={filtroAtivo ? "no filtro atual" : "aguardando aprovação"} tone="warning" />
        <StatCard className="col-span-1 md:col-span-3" icon={CheckCircle2} label="RDOs aprovados" value={data.rdos_aprovados} sub={`${data.rdos_total} emitidos`} tone="success" />
        <StatCard className="col-span-1 md:col-span-3" icon={AlertTriangle} label={filtroAtivo ? "Ocorrências filtradas" : "Ocorrências (7d)"} value={filtroAtivo && filtros ? filtros.ocorrencias : data.ocorrencias_semana} sub={filtroAtivo ? "no filtro atual" : `${data.ocorrencias_total} no histórico`} tone="destructive" />

        {/* Avanço por obra */}
        <Card className="col-span-2 md:col-span-8 md:row-span-3 p-4 sm:p-6">
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
                    <div className="h-full bg-brand" style={{ width: `${o.avanco_pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Últimos RDOs */}
        <Card className="col-span-2 md:col-span-4 md:row-span-3 p-4 sm:p-6">
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
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, className, tone }: { icon: any; label: string; value: number | string; sub?: string; className?: string; tone?: "success" | "warning" | "destructive" }) {
  const toneColor =
    tone === "success" ? "text-success" :
    tone === "warning" ? "text-warning" :
    tone === "destructive" ? "text-destructive" :
    "text-brand";
  return (
    <Card className={`${className} p-5 flex flex-col justify-between`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${toneColor}`} />
      </div>
      <div>
        <div className="font-serif text-3xl tabular-nums">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="h-full grid place-items-center text-sm text-muted-foreground">{text}</div>;
}
