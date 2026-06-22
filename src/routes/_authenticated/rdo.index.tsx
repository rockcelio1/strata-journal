import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listRdos, createRdo } from "@/lib/rdo.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, FileText, CloudArrowUp, WifiSlash, CheckCircle, WarningCircle, ArrowClockwise, X } from "@phosphor-icons/react";
import { rdoStatusMeta } from "@/components/status";
import { useCallback, useEffect, useRef, useState } from "react";
import { listQueued, flushQueue, removeQueued, retryQueued, type QueuedRdo } from "@/lib/offline-queue";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rdo/")({
  component: RdoListPage,
});

const statusFilters = ["todos", "rascunho", "enviado", "aprovado", "reprovado"] as const;

function RdoListPage() {
  const fn = useServerFn(listRdos);
  const createFn = useServerFn(createRdo);
  const qc = useQueryClient();
  const { data: rdos = [] } = useQuery({ queryKey: ["rdos"], queryFn: () => fn() });
  const [status, setStatus] = useState<string>("todos");
  const [queue, setQueue] = useState<QueuedRdo[]>([]);
  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const syncingRef = useRef(false);

  const refreshQueue = useCallback(async () => { setQueue(await listQueued()); }, []);
  useEffect(() => { refreshQueue(); }, [refreshQueue]);

  const sincronizar = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setProgress({ done: 0, total: 0 });
    try {
      const res = await flushQueue(
        async (payload) => { const r: any = await createFn({ data: payload }); return { id: r.id }; },
        ({ index, total }) => setProgress({ done: index, total }),
      );
      await refreshQueue();
      qc.invalidateQueries({ queryKey: ["rdos"] });
      if (res.ok && !res.fail) toast.success(`${res.ok} RDO(s) sincronizado(s)`);
      else if (res.ok && res.fail) toast.warning(`${res.ok} enviados · ${res.fail} com erro`);
      else if (res.fail) toast.error(`${res.fail} falharam ao sincronizar`);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      setProgress(null);
    }
  }, [createFn, qc, refreshQueue]);

  useEffect(() => {
    const on = () => { setOnline(true); sincronizar(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [sincronizar]);

  const pendentes = queue.filter((q) => q.status !== "sincronizado");

  async function descartar(id: string) { await removeQueued(id); await refreshQueue(); }
  async function retry(id: string) { await retryQueued(id); await refreshQueue(); sincronizar(); }

  const filtered = (rdos as any[]).filter((r) => status === "todos" || r.status === status);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <header className="flex items-end justify-between mb-4 flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl">Relatório Diário de Obra</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            {rdos.length} RDOs registrados
            <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${online ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              {online ? <CheckCircle size={12} /> : <WifiSlash size={12} />} {online ? "Online" : "Offline"}
            </span>
          </p>
        </div>
        <Link to="/rdo/novo">
          <Button className="bg-brand text-brand-foreground"><Plus size={16} className="mr-1" />Novo RDO</Button>
        </Link>
      </header>

      {(pendentes.length > 0 || syncing) && (
        <Card className="p-4 mb-4 border-amber-200 bg-amber-50/60">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <CloudArrowUp size={18} className={syncing ? "text-blue-700 animate-pulse" : "text-amber-700"} />
              <span>
                {syncing && progress
                  ? <>Sincronizando <b>{progress.done}</b> de <b>{progress.total}</b>…</>
                  : <><b>{pendentes.length}</b> RDOs aguardando sincronização local.</>}
              </span>
            </div>
            <Button size="sm" onClick={sincronizar} disabled={!online || syncing || pendentes.length === 0} className="bg-brand text-brand-foreground">
              {syncing ? "Sincronizando…" : online ? "Sincronizar agora" : "Aguardando conexão"}
            </Button>
          </div>
          {syncing && progress && progress.total > 0 && (
            <Progress className="h-1.5 mt-3" value={(progress.done / progress.total) * 100} />
          )}
          {pendentes.length > 0 && (
            <ul className="mt-3 divide-y divide-amber-200/70 text-xs">
              {pendentes.map((q) => (
                <li key={q.local_id} className="py-1.5 flex items-center justify-between gap-2">
                  <span className="font-mono truncate flex-1">{q.local_id.slice(0, 8)}…{q.error ? <span className="ml-2 text-rose-700">— {q.error}</span> : null}</span>
                  <Badge variant="outline" className={
                    q.status === "erro" ? "border-rose-300 text-rose-700 bg-rose-50" :
                    q.status === "enviando" ? "border-blue-300 text-blue-700 bg-blue-50" :
                    "border-amber-300 text-amber-700 bg-amber-50"
                  }>
                    {q.status === "erro" ? <WarningCircle size={10} className="mr-1" /> : null}
                    {q.status}
                  </Badge>
                  {q.status === "erro" && (
                    <button onClick={() => retry(q.local_id)} disabled={!online || syncing} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 disabled:opacity-40">
                      <ArrowClockwise size={11} /> tentar
                    </button>
                  )}
                  <button onClick={() => descartar(q.local_id)} disabled={syncing} className="text-muted-foreground hover:text-destructive inline-flex items-center gap-0.5 disabled:opacity-40">
                    <X size={11} /> descartar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto">
        {statusFilters.map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-2 text-sm border-b-2 transition-colors whitespace-nowrap ${status === s ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {s === "todos" ? "Todos" : rdoStatusMeta[s as keyof typeof rdoStatusMeta].label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum RDO neste filtro.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
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
