import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listEmpresaRdoLogs } from "@/lib/rdo.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes/auditoria")({
  component: AuditoriaPage,
});

const ACOES = [
  "criado", "enviado_para_aprovacao", "aprovado", "reprovado",
  "rascunho_excluido", "excluido_admin", "desabilitado_admin",
  "reabilitado_admin", "editado_admin", "payload_sanitizado",
];

function AuditoriaPage() {
  const fn = useServerFn(listEmpresaRdoLogs);
  const [autorId, setAutorId] = useState("");
  const [acao, setAcao] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["empresa-audit-logs", autorId, acao, from, to],
    queryFn: () => fn({
      data: {
        autor_id: autorId || null,
        acao: acao || null,
        from: from ? new Date(from).toISOString() : null,
        to: to ? new Date(to).toISOString() : null,
        limit: 100, offset: 0,
      },
    }),
  });

  const rows: any[] = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-brand" />
        <h2 className="font-serif text-xl">Auditoria de RDO</h2>
      </header>

      <Card className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label className="text-xs">Autor (UUID)</Label>
          <Input value={autorId} onChange={(e) => setAutorId(e.target.value.trim())} placeholder="opcional" />
        </div>
        <div>
          <Label className="text-xs">Ação</Label>
          <Select value={acao || "_all"} onValueChange={(v) => setAcao(v === "_all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas</SelectItem>
              {ACOES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => refetch()}>Atualizar</Button>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-3">Quando</th>
              <th className="p-3">RDO</th>
              <th className="p-3">Autor</th>
              <th className="p-3">Ação</th>
              <th className="p-3">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum evento.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 align-top">
                <td className="p-3 whitespace-nowrap tabular-nums text-xs">
                  {new Date(r.created_at).toLocaleString("pt-BR")}
                </td>
                <td className="p-3 text-xs">{r.rdo?.numero ?? r.rdo_id?.slice(0, 8)}</td>
                <td className="p-3 text-xs">{r.autor?.nome ?? r.autor?.email ?? "—"}</td>
                <td className="p-3">
                  <Badge
                    variant="outline"
                    className={r.acao === "payload_sanitizado" ? "border-yellow-500 text-yellow-700" : ""}
                  >
                    {r.acao}
                  </Badge>
                </td>
                <td className="p-3 text-xs text-muted-foreground max-w-md">
                  {r.acao === "payload_sanitizado"
                    ? <span className="font-medium text-foreground">{r.motivo}</span>
                    : (r.motivo ?? `${r.status_anterior ?? ""} → ${r.status_novo ?? ""}`)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Mostrando até 100 eventos recentes. Use os filtros para refinar.
      </p>
    </div>
  );
}
