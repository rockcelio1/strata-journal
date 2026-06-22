import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listRdos } from "@/lib/rdo.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import { rdoStatusMeta } from "@/components/status";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/rdo/")({
  component: RdoListPage,
});

const statusFilters = ["todos", "rascunho", "enviado", "aprovado", "reprovado"] as const;

function RdoListPage() {
  const fn = useServerFn(listRdos);
  const { data: rdos = [] } = useQuery({ queryKey: ["rdos"], queryFn: () => fn() });
  const [status, setStatus] = useState<string>("todos");

  const filtered = (rdos as any[]).filter((r) => status === "todos" || r.status === status);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-3xl">Relatório Diário de Obra</h1>
          <p className="text-sm text-muted-foreground mt-1">{rdos.length} RDOs registrados.</p>
        </div>
        <Link to="/rdo/novo">
          <Button className="bg-brand text-brand-foreground"><Plus className="h-4 w-4 mr-1" />Novo RDO</Button>
        </Link>
      </header>

      <div className="flex gap-1 mb-4 border-b border-border">
        {statusFilters.map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-2 text-sm border-b-2 transition-colors ${status === s ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {s === "todos" ? "Todos" : rdoStatusMeta[s as keyof typeof rdoStatusMeta].label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum RDO neste filtro.</p>
        </Card>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">#</th>
                <th className="p-3 font-medium">Obra</th>
                <th className="p-3 font-medium">Data</th>
                <th className="p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => {
                const m = rdoStatusMeta[r.status as keyof typeof rdoStatusMeta];
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="p-3 tabular-nums"><Link to="/rdo/$rdoId" params={{ rdoId: r.id }} className="font-medium hover:underline">#{r.numero}</Link></td>
                    <td className="p-3">{r.obras?.nome}</td>
                    <td className="p-3">{new Date(r.data).toLocaleDateString("pt-BR")}</td>
                    <td className="p-3"><Badge variant="outline" className={m.className}>{m.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
