import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listRdos, createRdo } from "@/lib/rdo.functions";
import { listObras } from "@/lib/obras.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import {
  Plus, FileText, CloudArrowUp, WifiSlash, CheckCircle, WarningCircle,
  ArrowClockwise, X, MagnifyingGlass, DownloadSimple, ListBullets, CalendarBlank,
} from "@phosphor-icons/react";
import { rdoStatusMeta } from "@/components/status";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listQueued, flushQueue, removeQueued, retryQueued, type QueuedRdo } from "@/lib/offline-queue";
import { sanitizeRdoPayload } from "@/lib/rdo-validate";
import { fuzzyFilter, normalizeForSearch, fuzzyScore } from "@/lib/fuzzy-search";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rdo/")({
  validateSearch: (s: Record<string, unknown>) => ({
    status: typeof s.status === "string" ? s.status : undefined,
  }),
  component: RdoListPage,
});

const statusFilters = ["todos", "rascunho", "enviado", "aprovado", "reprovado"] as const;

function toISODate(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function exportCsv(rows: any[]) {
  const head = ["numero", "obra", "data", "status"];
  const body = rows.map((r) => [
    r.numero,
    (r.obras?.nome ?? "").replace(/[";\n]/g, " "),
    r.data,
    r.status,
  ].map((v) => `"${String(v ?? "")}"`).join(";"));
  const csv = "\uFEFF" + [head.join(";"), ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorios-rdo-${toISODate(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function RdoListPage() {
  const fn = useServerFn(listRdos);
  const obrasFn = useServerFn(listObras);
  const createFn = useServerFn(createRdo);
  const qc = useQueryClient();
  const { data: rdos = [] } = useQuery({ queryKey: ["rdos"], queryFn: () => fn() });
  const { data: obras = [] } = useQuery({ queryKey: ["obras-min"], queryFn: () => obrasFn() });

  const [status, setStatus] = useState<string>("todos");
  const [obraId, setObraId] = useState<string>("todas");
  const [contrato, setContrato] = useState<string>("");
  const [autorId, setAutorId] = useState<string>("todos");
  const [signerId, setSignerId] = useState<string>("todos");
  const [aprovadorId, setAprovadorId] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [view, setView] = useState<"lista" | "calendario">("lista");
  const [calMonth, setCalMonth] = useState<Date>(new Date());
  const [calSelected, setCalSelected] = useState<Date | undefined>(undefined);

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
    const totals = { equipamentos: 0, ocorrencias: 0, mao_de_obra: 0, atividades: 0 };
    try {
      const res = await flushQueue(
        async (payload) => {
          const { sane, dropped } = sanitizeRdoPayload(payload);
          totals.equipamentos += dropped.equipamentos;
          totals.ocorrencias += dropped.ocorrencias;
          totals.mao_de_obra += dropped.mao_de_obra;
          totals.atividades += dropped.atividades;
          const r: any = await createFn({ data: sane }); return { id: r.id };
        },
        ({ index, total }) => setProgress({ done: index, total }),
      );
      await refreshQueue();
      qc.invalidateQueries({ queryKey: ["rdos"] });
      const droppedTotal = totals.equipamentos + totals.ocorrencias + totals.mao_de_obra + totals.atividades;
      const droppedDetails = droppedTotal > 0
        ? ` · descartados: ${[
            totals.equipamentos ? `${totals.equipamentos} equipamento(s) sem UUID` : "",
            totals.ocorrencias ? `${totals.ocorrencias} ocorrência(s) sem descrição` : "",
            totals.mao_de_obra ? `${totals.mao_de_obra} mão de obra sem pessoa` : "",
            totals.atividades ? `${totals.atividades} atividade(s) sem descrição` : "",
          ].filter(Boolean).join(", ")}`
        : "";
      if (res.ok && !res.fail) toast.success(`${res.ok} RDO(s) sincronizado(s)${droppedDetails}`, { duration: droppedTotal ? 8000 : 4000 });
      else if (res.ok && res.fail) toast.warning(`${res.ok} enviados · ${res.fail} com erro${droppedDetails}`);
      else if (res.fail) toast.error(`${res.fail} falharam ao sincronizar${droppedDetails}`);
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

  // Conjuntos únicos para alimentar selects (autor/assinou/aprovou)
  const autoresOpts = useMemo(() => {
    const m = new Map<string, string>();
    (rdos as any[]).forEach((r) => { if (r.autor?.id) m.set(r.autor.id, r.autor.nome ?? r.autor.email ?? r.autor.id.slice(0, 8)); });
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rdos]);
  const signersOpts = useMemo(() => {
    const m = new Map<string, string>();
    (rdos as any[]).forEach((r) => (r.rdo_assinaturas ?? []).forEach((a: any) => {
      const s = a.signatario; if (s?.id) m.set(s.id, s.nome ?? s.email ?? s.id.slice(0, 8));
    }));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rdos]);
  const aprovadoresOpts = useMemo(() => {
    const m = new Map<string, string>();
    (rdos as any[]).forEach((r) => { if (r.aprovador?.id) m.set(r.aprovador.id, r.aprovador.nome ?? r.aprovador.email ?? r.aprovador.id.slice(0, 8)); });
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rdos]);

  // Pré-filtro estrutural (status, obra, contrato, datas, pessoas) — depois aplica fuzzy.
  const preFiltered = useMemo(() => {
    const cn = normalizeForSearch(contrato);
    return (rdos as any[]).filter((r) => {
      if (status !== "todos" && r.status !== status) return false;
      if (obraId !== "todas" && r.obras?.id !== obraId) return false;
      if (from && r.data < from) return false;
      if (to && r.data > to) return false;
      if (autorId !== "todos" && r.autor?.id !== autorId) return false;
      if (aprovadorId !== "todos" && r.aprovador?.id !== aprovadorId) return false;
      if (signerId !== "todos") {
        const ok = (r.rdo_assinaturas ?? []).some((a: any) => a.signatario?.id === signerId);
        if (!ok) return false;
      }
      if (cn) {
        const hayCon = normalizeForSearch(`${r.obras?.codigo ?? ""} ${r.obras?.cliente ?? ""}`);
        if (fuzzyScore(hayCon, cn) === 0) return false;
      }
      if (view === "calendario" && calSelected) {
        if (r.data !== toISODate(calSelected)) return false;
      }
      return true;
    });
  }, [rdos, status, obraId, contrato, autorId, signerId, aprovadorId, from, to, view, calSelected]);

  // Busca aproximada ignorando acentos/erros sobre os campos relevantes.
  const filtered = useMemo(() => {
    return fuzzyFilter(preFiltered, busca, (r: any) => [
      r.numero, r.obras?.nome, r.obras?.codigo, r.obras?.cliente,
      r.autor?.nome, r.aprovador?.nome,
      (r.rdo_assinaturas ?? []).map((a: any) => a.signatario?.nome).filter(Boolean).join(" "),
    ].filter(Boolean).join(" "));
  }, [preFiltered, busca]);

  const diasComRdo = useMemo(() => {
    const set = new Set<string>();
    preFiltered.forEach((r: any) => set.add(r.data));
    return set;
  }, [preFiltered]);

  function limparFiltros() {
    setStatus("todos"); setObraId("todas"); setContrato(""); setAutorId("todos"); setSignerId("todos");
    setAprovadorId("todos"); setBusca(""); setFrom(""); setTo(""); setCalSelected(undefined);
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <header className="flex items-end justify-between mb-4 flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl">Relatórios — RDO</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            {filtered.length} de {rdos.length} RDOs
            <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${online ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              {online ? <CheckCircle size={12} /> : <WifiSlash size={12} />} {online ? "Online" : "Offline"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCsv(filtered)} disabled={filtered.length === 0}>
            <DownloadSimple size={16} className="mr-1" /> Exportar CSV
          </Button>
          <Link to="/rdo/novo">
            <Button className="bg-brand text-brand-foreground"><Plus size={16} className="mr-1" />Novo RDO</Button>
          </Link>
        </div>
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

      {/* Filtros */}
      <Card className="p-3 md:p-4 mb-4 space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 items-end">
          <div className="md:col-span-5 relative">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Busca aproximada (ignora acento e erros): número, obra, autor, assinatura, aprovador…"
              className="pl-8" />
          </div>
          <div className="md:col-span-3">
            <Select value={obraId} onValueChange={setObraId}>
              <SelectTrigger><SelectValue placeholder="Obra" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as obras</SelectItem>
                {(obras as any[]).map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Input value={contrato} onChange={(e) => setContrato(e.target.value)} placeholder="Contrato/cliente" />
          </div>
          <div className="md:col-span-1">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Data inicial" />
          </div>
          <div className="md:col-span-1">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Data final" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 items-end">
          <div className="md:col-span-4">
            <Select value={autorId} onValueChange={setAutorId}>
              <SelectTrigger><SelectValue placeholder="Registrado por" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Quem registrou: todos</SelectItem>
                {autoresOpts.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-4">
            <Select value={signerId} onValueChange={setSignerId}>
              <SelectTrigger><SelectValue placeholder="Quem assinou" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Quem assinou: todos</SelectItem>
                {signersOpts.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Select value={aprovadorId} onValueChange={setAprovadorId}>
              <SelectTrigger><SelectValue placeholder="Quem aprovou" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Quem aprovou: todos</SelectItem>
                {aprovadoresOpts.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1 flex md:justify-end">
            <Button variant="ghost" size="sm" onClick={limparFiltros}>Limpar</Button>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {statusFilters.map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-2 text-sm border-b-2 transition-colors whitespace-nowrap ${status === s ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {s === "todos" ? "Todos" : rdoStatusMeta[s as keyof typeof rdoStatusMeta].label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <button onClick={() => setView("lista")} className={`px-3 py-1.5 text-sm inline-flex items-center gap-1 ${view === "lista" ? "bg-muted" : "hover:bg-muted/50"}`}>
            <ListBullets size={14} /> Lista
          </button>
          <button onClick={() => setView("calendario")} className={`px-3 py-1.5 text-sm inline-flex items-center gap-1 border-l border-border ${view === "calendario" ? "bg-muted" : "hover:bg-muted/50"}`}>
            <CalendarBlank size={14} /> Calendário
          </button>
        </div>
      </div>

      {view === "calendario" && (
        <Card className="p-3 md:p-4 mb-4">
          <div className="grid md:grid-cols-[auto,1fr] gap-4">
            <Calendar
              mode="single"
              month={calMonth}
              onMonthChange={setCalMonth}
              selected={calSelected}
              onSelect={setCalSelected}
              modifiers={{
                hasRdo: (d) => diasComRdo.has(toISODate(d)),
              }}
              modifiersClassNames={{
                hasRdo: "relative font-semibold text-brand after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-brand",
              }}
              className="p-3 pointer-events-auto"
            />
            <div className="text-sm">
              {calSelected ? (
                <>
                  <div className="text-muted-foreground mb-2">RDOs em {calSelected.toLocaleDateString("pt-BR")}</div>
                  {filtered.length === 0 ? (
                    <div className="text-muted-foreground">Sem RDOs nessa data com os filtros atuais.</div>
                  ) : (
                    <ul className="space-y-1.5">
                      {filtered.map((r: any) => {
                        const m = rdoStatusMeta[r.status as keyof typeof rdoStatusMeta];
                        return (
                          <li key={r.id}>
                            <Link to="/rdo/$rdoId" params={{ rdoId: r.id }} className="flex items-center justify-between hover:bg-muted/50 px-2 py-1.5 rounded">
                              <span><span className="font-medium tabular-nums">#{r.numero}</span> — {r.obras?.nome}</span>
                              <Badge variant="outline" className={m.className}>{m.label}</Badge>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              ) : (
                <div className="text-muted-foreground">Selecione uma data com marcador para ver os RDOs do dia.</div>
              )}
            </div>
          </div>
        </Card>
      )}

      {view === "lista" && (
        filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum RDO neste filtro.</p>
          </Card>
        ) : (
          <>
            <div className="md:hidden flex flex-col gap-2">
              {filtered.map((r: any) => {
                const m = rdoStatusMeta[r.status as keyof typeof rdoStatusMeta];
                return (
                  <Link key={r.id} to="/rdo/$rdoId" params={{ rdoId: r.id }}>
                    <Card className="p-3 active:bg-muted/50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium tabular-nums">#{r.numero}</span>
                        <Badge variant="outline" className={m.className}>{m.label}</Badge>
                      </div>
                      <div className="mt-1 text-sm truncate">{r.obras?.nome}</div>
                      <div className="text-xs text-muted-foreground">{new Date(r.data).toLocaleDateString("pt-BR")}</div>
                    </Card>
                  </Link>
                );
              })}
            </div>
            <Card className="hidden md:block overflow-x-auto">
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
          </>
        )
      )}
    </div>
  );
}
