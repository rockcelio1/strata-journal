import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getObra } from "@/lib/obras.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Calendar, FileText, Plus } from "lucide-react";
import { obraStatusMeta, rdoStatusMeta } from "@/components/status";

export const Route = createFileRoute("/_authenticated/obras/$obraId")({
  component: ObraDetail,
});

function ObraDetail() {
  const { obraId } = Route.useParams();
  const fn = useServerFn(getObra);
  const { data } = useQuery({ queryKey: ["obra", obraId], queryFn: () => fn({ data: { id: obraId } }) });

  if (!data) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  const o = data.obra as any;
  const m = obraStatusMeta[o.status as keyof typeof obraStatusMeta];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <Link to="/obras" className="text-sm text-muted-foreground hover:underline flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> Obras
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={m.className}>{m.label}</Badge>
          {o.codigo && <span className="text-xs text-muted-foreground">#{o.codigo}</span>}
        </div>
        <h1 className="font-serif text-4xl mt-2">{o.nome}</h1>
        {o.cliente && <p className="text-muted-foreground mt-1">{o.cliente}</p>}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Avanço</div>
          <div className="font-serif text-3xl mt-1 tabular-nums">{Number(o.avanco_pct).toFixed(0)}%</div>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-brand" style={{ width: `${o.avanco_pct}%` }} />
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Calendar className="h-3 w-3" /> Prazo</div>
          <div className="text-sm mt-2">{o.data_inicio ? new Date(o.data_inicio).toLocaleDateString("pt-BR") : "—"} → {o.data_previsao_fim ? new Date(o.data_previsao_fim).toLocaleDateString("pt-BR") : "—"}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><MapPin className="h-3 w-3" /> Endereço</div>
          <div className="text-sm mt-2">{o.endereco ?? "—"}</div>
        </Card>
      </div>

      <Tabs defaultValue="visao">
        <TabsList>
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="rdos">RDOs</TabsTrigger>
        </TabsList>
        <TabsContent value="visao" className="mt-4">
          <Card className="p-6">
            <h3 className="font-serif text-lg mb-2">Descrição</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{o.descricao ?? "Sem descrição."}</p>
          </Card>
        </TabsContent>
        <TabsContent value="rdos" className="mt-4">
          <div className="flex justify-end mb-3">
            <Link to="/rdo/novo" search={{ obra: obraId } as any}>
              <Button size="sm" className="bg-brand text-brand-foreground"><Plus className="h-4 w-4 mr-1" />Novo RDO</Button>
            </Link>
          </div>
          {data.rdos.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3" />
              Nenhum RDO ainda.
            </Card>
          ) : (
            <Card>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">#</th>
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rdos.map((r: any) => {
                    const meta = rdoStatusMeta[r.status as keyof typeof rdoStatusMeta];
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                        <td className="p-3"><Link to="/rdo/$rdoId" params={{ rdoId: r.id }} className="font-medium hover:underline">#{r.numero}</Link></td>
                        <td className="p-3">{new Date(r.data).toLocaleDateString("pt-BR")}</td>
                        <td className="p-3"><Badge variant="outline" className={meta.className}>{meta.label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
