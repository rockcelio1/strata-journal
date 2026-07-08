import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listMediaFailures } from "@/lib/media-audit.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes/auditoria-midia")({
  component: AuditoriaMidiaPage,
});

const REASON_LABEL: Record<string, string> = {
  thumb_404: "Thumb 404",
  timeout: "Timeout",
  network: "Erro de rede",
  decode: "Erro de decodificação",
  unknown: "Desconhecido",
};

function AuditoriaMidiaPage() {
  const fn = useServerFn(listMediaFailures);
  const [itemId, setItemId] = useState("");
  const [reason, setReason] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const limit = 50;

  const filtros = {
    onedrive_item_id: itemId.trim() || null,
    reason: (reason || null) as any,
    from: from ? new Date(from).toISOString() : null,
    to: to ? new Date(to + "T23:59:59").toISOString() : null,
    limit,
    offset: page * limit,
  };

  const q = useQuery({
    queryKey: ["media-failures", filtros],
    queryFn: () => fn({ data: filtros }),
  });

  const rows = q.data?.rows ?? [];
  const total = q.data?.count ?? 0;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-brand/10 text-brand grid place-items-center">
          <ImageIcon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-serif text-xl leading-none">Auditoria de Mídia</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Falhas de carregamento de miniaturas (thumb 404, timeout, erro de rede/decodificação) por empresa.
          </p>
        </div>
      </header>

      <Card className="p-3 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
        <div>
          <label className="text-xs text-muted-foreground">OneDrive item ID</label>
          <Input value={itemId} onChange={(e) => { setItemId(e.target.value); setPage(0); }} placeholder="ex.: 01ABC..." />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Motivo</label>
          <Select value={reason || "all"} onValueChange={(v) => { setReason(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(REASON_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">De</label>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Até</label>
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => q.refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
          </Button>
          {(itemId || reason || from || to) && (
            <Button variant="ghost" size="sm" onClick={() => { setItemId(""); setReason(""); setFrom(""); setTo(""); setPage(0); }}>
              Limpar
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-3 flex items-center justify-between text-xs text-muted-foreground border-b border-border">
          <span>{q.isLoading ? "Carregando…" : `${total} falha(s) encontrada(s)`}</span>
          <span>Página {page + 1} de {Math.max(1, Math.ceil(total / limit))}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Quando</th>
                <th className="text-left px-3 py-2">Motivo</th>
                <th className="text-left px-3 py-2">Thumb</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">OneDrive item</th>
                <th className="text-left px-3 py-2">Usuário</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !q.isLoading && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Nenhuma falha registrada com esses filtros.</td></tr>
              )}
              {rows.map((r: any) => {
                const d = r.detalhes ?? {};
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums text-xs">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[10px]">{REASON_LABEL[d.reason as string] ?? d.reason ?? "—"}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">{d.thumb_size ?? "—"}</td>
                    <td className="px-3 py-2 text-xs tabular-nums">{d.status ?? "—"}</td>
                    <td className="px-3 py-2 text-xs font-mono break-all max-w-[220px]">{d.onedrive_item_id ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.autor?.nome ?? r.autor?.email ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-3 flex items-center justify-between border-t border-border">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</Button>
          <Button variant="outline" size="sm" disabled={(page + 1) * limit >= total} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
        </div>
      </Card>
    </div>
  );
}
