import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getObra } from "@/lib/obras.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, ClipboardText, ListChecks, Warning, ChatCircle, Camera,
  PencilSimple, Funnel, House, FileText, Plus, Image as ImageIcon,
} from "@phosphor-icons/react";
import { obraStatusMeta, rdoStatusMeta } from "@/components/status";
import { cn } from "@/lib/utils";
import { ObraFotos } from "@/components/obra/ObraFotos";
import { ObraVinculacoes } from "@/components/obra/ObraVinculacoes";
import { NewBadge } from "@/components/NewBadge";

export const Route = createFileRoute("/_authenticated/obras/$obraId")({
  component: ObraDetail,
});

type View = "visao" | "tarefas" | "recursos" | "relatorios" | "filtro" | "editar";

function ObraDetail() {
  const { obraId } = Route.useParams();
  const fn = useServerFn(getObra);
  const { data } = useQuery({ queryKey: ["obra", obraId], queryFn: () => fn({ data: { id: obraId } }) });
  const [view, setView] = useState<View>("visao");

  if (!data) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  const o = data.obra as any;
  const m = obraStatusMeta[o.status as keyof typeof obraStatusMeta];
  const stats = data.stats;
  const fotos = data.fotos_recentes ?? [];

  const nav: { id: View; label: string; icon: any; badge?: number; isNew?: boolean }[] = [
    { id: "visao", label: "Visão geral", icon: House },
    { id: "tarefas", label: "Lista de tarefas", icon: ListChecks, badge: 0 },
    { id: "recursos", label: "Recursos e anexos", icon: ClipboardText, isNew: true },
    { id: "relatorios", label: "Relatórios", icon: ClipboardText, badge: stats.relatorios },
    { id: "filtro", label: "Filtro de busca", icon: Funnel },
    { id: "editar", label: "Editar obra", icon: PencilSimple },
  ];

  // datas/prazo
  const inicio = o.data_inicio ? new Date(o.data_inicio) : null;
  const fim = o.data_previsao_fim ? new Date(o.data_previsao_fim) : null;
  const hoje = new Date();
  const totalDias = inicio && fim ? Math.max(1, Math.round((+fim - +inicio) / 86400000)) : 0;
  const decorridos = inicio ? Math.max(0, Math.round((+hoje - +inicio) / 86400000)) : 0;
  const aVencer = fim ? Math.max(0, Math.round((+fim - +hoje) / 86400000)) : 0;
  const pctPrazo = totalDias ? Math.min(100, Math.round((decorridos / totalDias) * 100)) : 0;

  return (
    <div className="bg-muted/30 min-h-[calc(100dvh-4rem)]">
      {/* Top bar */}
      <div className="bg-background border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-[1600px] mx-auto">
          <Link to="/obras" aria-label="Voltar para obras" className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-border hover:bg-muted">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="font-serif text-xl md:text-2xl truncate">
            {o.codigo ? `${o.codigo} — ` : ""}{o.nome}
          </h1>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 p-4">
        {/* Sidebar */}
        <aside className="space-y-3">
          <Card className="overflow-hidden p-2">
            <ObraFotos obraId={obraId} empresaId={o.empresa_id} />
          </Card>
          <nav className="bg-background rounded-md border border-border overflow-hidden">
            {nav.map((n) => {
              const Icon = n.icon;
              const active = view === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setView(n.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 text-sm border-l-2 transition-colors",
                    active
                      ? "border-brand bg-brand/5 text-foreground font-medium"
                      : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon size={16} weight={active ? "fill" : "regular"} />
                  <span className="flex-1 text-left">{n.label}</span>
                  {n.isNew && <NewBadge since="2026-07-05" />}
                  {typeof n.badge === "number" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 h-5 tabular-nums">{n.badge}</Badge>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main */}
        <main className="space-y-4 min-w-0">
          {view === "visao" && (
            <>
              {/* KPIs (clicáveis) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                <KpiButton label="Relatórios" value={stats.relatorios} icon={<ClipboardText size={18} />}
                  onClick={() => setView("relatorios")} title="Ver relatórios desta obra" />
                <KpiButton label="Atividades" value={stats.atividades} icon={<ListChecks size={18} />}
                  onClick={() => setView("tarefas")} title="Ver lista de tarefas/atividades" />
                <KpiLink label="Ocorrências" value={stats.ocorrencias} icon={<Warning size={18} />}
                  to="/cadastros/ocorrencias" title="Abrir tipos de ocorrência" />
                <KpiButton label="Comentários" value={stats.comentarios} icon={<ChatCircle size={18} />}
                  onClick={() => setView("relatorios")} title="Ver comentários nos RDOs desta obra" />
                <KpiLink label="Fotos" value={stats.fotos} icon={<Camera size={18} />}
                  to="/galeria" title="Abrir galeria de fotos" />
              </div>


              {/* Recentes */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card className="p-0 overflow-hidden transition-colors hover:bg-muted/30 hover:ring-1 hover:ring-brand/30 focus-within:ring-2 focus-within:ring-ring">
                  <button
                    type="button"
                    onClick={() => setView("relatorios")}
                    aria-label="Abrir relatórios desta obra"
                    className="w-full flex items-center justify-between px-4 py-3 border-b border-border text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/50"
                  >
                    <h3 className="text-brand font-medium">Relatórios recentes</h3>
                    <span className="text-xs text-brand hover:underline">Ver tudo</span>
                  </button>

                  {data.rdos.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      <FileText size={28} className="mx-auto mb-2 opacity-60" />
                      Nenhum relatório ainda.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground border-b border-border">
                          <th className="px-4 py-2 font-medium">Data</th>
                          <th className="px-2 py-2 font-medium">N°</th>
                          <th className="px-2 py-2 font-medium">Status</th>
                          <th className="px-2 py-2 font-medium">Modelo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.rdos.slice(0, 8).map((r: any) => {
                          const meta = rdoStatusMeta[r.status as keyof typeof rdoStatusMeta];
                          return (
                            <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                              <td className="px-4 py-2">
                                <Link to="/rdo/$rdoId" params={{ rdoId: r.id }} className="text-brand hover:underline tabular-nums">
                                  {new Date(r.data).toLocaleDateString("pt-BR")}
                                </Link>
                              </td>
                              <td className="px-2 py-2 text-brand tabular-nums">{r.numero}</td>
                              <td className="px-2 py-2"><Badge variant="outline" className={meta.className}>{meta.label}</Badge></td>
                              <td className="px-2 py-2 text-muted-foreground inline-flex items-center gap-1">
                                <FileText size={12} /> RDO
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </Card>

                <Card className="p-0 overflow-hidden transition-colors hover:bg-muted/30 hover:ring-1 hover:ring-brand/30 focus-within:ring-2 focus-within:ring-ring">
                  <Link
                    to="/galeria"
                    aria-label="Abrir galeria de fotos"
                    className="flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/50"
                  >
                    <h3 className="text-brand font-medium">Fotos recentes</h3>
                    <span className="text-xs text-brand hover:underline">Ver tudo</span>
                  </Link>

                  {fotos.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      <ImageIcon size={28} className="mx-auto mb-2 opacity-60" />
                      Nenhuma foto ainda.
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-1 p-1">
                      {fotos.slice(0, 12).map((f: any) => (
                        <div key={f.id} className="aspect-square overflow-hidden bg-muted">
                          {f.url
                            ? <img src={f.url} alt={f.nome} className="w-full h-full object-cover" loading="lazy" />
                            : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ImageIcon size={16} /></div>}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Informações da obra */}
              <Card className="p-0 overflow-hidden transition-colors hover:bg-muted/30 hover:ring-1 hover:ring-brand/30 focus-within:ring-2 focus-within:ring-ring">
                <button
                  type="button"
                  onClick={() => setView("editar")}
                  aria-label="Editar informações da obra"
                  className="w-full flex items-center justify-between px-4 py-3 border-b border-border text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/50"
                >
                  <h3 className="text-brand font-medium">Informações da obra</h3>
                  <span className="text-xs text-brand hover:underline">Editar</span>
                </button>

                <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                  <Field label="Status"><Badge variant="outline" className={m.className}>{m.label}</Badge></Field>
                  <Field label="N° do contrato">{o.codigo ?? "—"}</Field>
                  <Field label="Prazo decorrido">
                    <Progress value={pctPrazo} className="h-2" />
                    <span className="text-xs text-muted-foreground tabular-nums mt-1 block">{pctPrazo}%</span>
                  </Field>
                  <Field label="Endereço" className="col-span-2 md:col-span-3">{o.endereco ?? "—"}</Field>
                  <Field label="Responsável">{o.responsavel?.nome ?? "—"}</Field>
                  <Field label="Contratante">{o.cliente ?? "—"}</Field>
                  <Field label="Avanço">
                    <Progress value={Number(o.avanco_pct)} className="h-2" />
                    <span className="text-xs text-muted-foreground tabular-nums mt-1 block">{Number(o.avanco_pct).toFixed(0)}%</span>
                  </Field>
                  <Field label="Prazo contratual">{totalDias ? `${totalDias} dias` : "—"}</Field>
                  <Field label="Prazo decorrido (dias)">{inicio ? `${decorridos} dias` : "—"}</Field>
                  <Field label="Prazo a vencer">{fim ? `${aVencer} dias` : "—"}</Field>
                  <Field label="Data início">{inicio ? inicio.toLocaleDateString("pt-BR") : "—"}</Field>
                  <Field label="Previsão de término">{fim ? fim.toLocaleDateString("pt-BR") : "—"}</Field>
                </div>
              </Card>

              {o.descricao && (
                <Card className="p-4">
                  <h3 className="text-brand font-medium mb-2">Descrição</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{o.descricao}</p>
                </Card>
              )}
            </>
          )}

          {view === "tarefas" && <ObraVinculacoes obraId={obraId} />}

          {view === "recursos" && <ObraVinculacoes obraId={obraId} />}

          {view === "relatorios" && (
            <Card className="p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-brand font-medium">Relatórios da obra</h3>
                <Link to="/rdo/novo" search={{ obra: obraId } as any}>
                  <Button size="sm" className="bg-brand text-brand-foreground"><Plus size={14} className="mr-1" />Novo RDO</Button>
                </Link>
              </div>
              {data.rdos.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <FileText size={36} className="mx-auto mb-3 opacity-60" />
                  Nenhum RDO ainda.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Data</th>
                      <th className="px-2 py-2 font-medium">N°</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rdos.map((r: any) => {
                      const meta = rdoStatusMeta[r.status as keyof typeof rdoStatusMeta];
                      return (
                        <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                          <td className="px-4 py-2"><Link to="/rdo/$rdoId" params={{ rdoId: r.id }} className="text-brand hover:underline">{new Date(r.data).toLocaleDateString("pt-BR")}</Link></td>
                          <td className="px-2 py-2 tabular-nums">{r.numero}</td>
                          <td className="px-2 py-2"><Badge variant="outline" className={meta.className}>{meta.label}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          {view === "filtro" && (
            <Card className="p-12 text-center text-muted-foreground">
              <Funnel size={36} className="mx-auto mb-3 opacity-60" />
              <p className="text-sm">Filtros avançados em breve.</p>
            </Card>
          )}

          {view === "editar" && (
            <Card className="p-6">
              <h3 className="text-brand font-medium mb-4">Editar obra</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Use a tela de edição completa para alterar dados desta obra.
              </p>
              <Link to="/obras">
                <Button variant="outline"><PencilSimple size={14} className="mr-1" /> Abrir editor</Button>
              </Link>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="p-0 overflow-hidden border-t-2 border-t-brand">
      <div className="px-4 py-3">
        <div className="text-2xl font-serif text-brand tabular-nums">{value.toLocaleString("pt-BR")}</div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-muted-foreground/70">{icon}</span>
        </div>
      </div>
    </Card>
  );
}

function KpiButton({ label, value, icon, onClick, title }: { label: string; value: number; icon: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title ?? label}
      className="text-left rounded-md border-t-2 border-t-brand bg-card overflow-hidden hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors">
      <div className="px-4 py-3">
        <div className="text-2xl font-serif text-brand tabular-nums">{value.toLocaleString("pt-BR")}</div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-muted-foreground/70">{icon}</span>
        </div>
      </div>
    </button>
  );
}

function KpiLink({ label, value, icon, to, title }: { label: string; value: number; icon: React.ReactNode; to: string; title?: string }) {
  return (
    <Link to={to as any} title={title} aria-label={title ?? label}
      className="text-left rounded-md border-t-2 border-t-brand bg-card overflow-hidden hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors block">
      <div className="px-4 py-3">
        <div className="text-2xl font-serif text-brand tabular-nums">{value.toLocaleString("pt-BR")}</div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-muted-foreground/70">{icon}</span>
        </div>
      </div>
    </Link>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
