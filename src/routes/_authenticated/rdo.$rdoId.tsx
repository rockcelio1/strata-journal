import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  getRdo, submitRdo, approveRdo,
  listRdoLogs, listRdoAnexos, registrarAnexo, removerAnexo,
  logRdoView, getRdoAuditSummary, logRdoClimaUpdate,
} from "@/lib/rdo.functions";
import { getMe } from "@/lib/core.functions";
import { supabase } from "@/integrations/supabase/client";
import { exportRdoPdf } from "@/lib/rdo-pdf";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, CheckCircle2, XCircle, Send, Cloud,
  Download, Paperclip, Upload, Trash2, History,
} from "lucide-react";
import { rdoStatusMeta, severidadeMeta, climaLabel } from "@/components/status";
import { fetchHistoricoEPrevisaoUteis, type DiaRegistro } from "@/lib/weather";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/rdo/$rdoId")({
  component: RdoDetailPage,
});

function RdoDetailPage() {
  const { rdoId } = Route.useParams();
  const qc = useQueryClient();
  const fn = useServerFn(getRdo);
  const meFn = useServerFn(getMe);
  const submitFn = useServerFn(submitRdo);
  const approveFn = useServerFn(approveRdo);
  const logsFn = useServerFn(listRdoLogs);
  const anexosFn = useServerFn(listRdoAnexos);
  const registrarFn = useServerFn(registrarAnexo);
  const removerFn = useServerFn(removerAnexo);
  const viewFn = useServerFn(logRdoView);
  const auditFn = useServerFn(getRdoAuditSummary);

  const { data } = useQuery({ queryKey: ["rdo", rdoId], queryFn: () => fn({ data: { id: rdoId } }) });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const [logFilters, setLogFilters] = useState<{ autor_id: string; acao: string; from: string; to: string; limit: number }>({ autor_id: "", acao: "", from: "", to: "", limit: 25 });
  const { data: logsData } = useQuery({
    queryKey: ["rdo-logs", rdoId, logFilters],
    queryFn: () => logsFn({ data: {
      rdo_id: rdoId,
      limit: logFilters.limit,
      offset: 0,
      autor_id: logFilters.autor_id || null,
      acao: logFilters.acao || null,
      from: logFilters.from ? new Date(logFilters.from).toISOString() : null,
      to: logFilters.to ? new Date(logFilters.to + "T23:59:59").toISOString() : null,
    } }),
  });
  const logs = logsData?.rows ?? [];
  const logsTotal = logsData?.total ?? 0;
  const { data: anexos = [] } = useQuery({ queryKey: ["rdo-anexos", rdoId], queryFn: () => anexosFn({ data: { rdo_id: rdoId } }) });
  const { data: audit } = useQuery({ queryKey: ["rdo-audit", rdoId], queryFn: () => auditFn({ data: { rdo_id: rdoId } }) });
  useEffect(() => {
    viewFn({ data: { rdo_id: rdoId } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rdoId]);

  const [motivo, setMotivo] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [climaState, setClimaState] = useState<{ local?: string; dias?: DiaRegistro[] }>({});

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["rdo", rdoId] });
    qc.invalidateQueries({ queryKey: ["rdo-logs", rdoId] });
    qc.invalidateQueries({ queryKey: ["rdos"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const submit = useMutation({
    mutationFn: () => submitFn({ data: { id: rdoId } }),
    onSuccess: () => { toast.success("RDO enviado para aprovação"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const decide = useMutation({
    mutationFn: (aprovar: boolean) => approveFn({ data: { id: rdoId, aprovar, motivo } }),
    onSuccess: () => { toast.success("Decisão registrada"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const removerAnx = useMutation({
    mutationFn: (id: string) => removerFn({ data: { id } }),
    onSuccess: () => { toast.success("Anexo removido"); qc.invalidateQueries({ queryKey: ["rdo-anexos", rdoId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !me?.profile?.empresa_id) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${me.profile.empresa_id}/${rdoId}/${Date.now()}-${safe}`;
        const up = await supabase.storage.from("rdo-anexos").upload(path, file, { upsert: false });
        if (up.error) throw up.error;
        await registrarFn({ data: {
          rdo_id: rdoId, nome: file.name, storage_path: path,
          mime_type: file.type || undefined, tamanho_bytes: file.size,
        }});
      }
      toast.success("Anexos enviados");
      qc.invalidateQueries({ queryKey: ["rdo-anexos", rdoId] });
    } catch (err: any) {
      toast.error(err.message ?? "Falha no upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const baixarPdf = () => {
    if (!data) return;
    exportRdoPdf({
      rdo: data.rdo,
      atividades: data.atividades,
      mao_de_obra: data.mao_de_obra,
      equipamentos: data.equipamentos,
      ocorrencias: data.ocorrencias,
      logs: logs as any[],
      anexos: anexos as any[],
      empresa: (me as any)?.empresa,
      clima_dias: climaState.dias ?? null,
      clima_local: climaState.local ?? null,
    });
  };

  if (!data) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  const r = data.rdo as any;
  const m = rdoStatusMeta[r.status as keyof typeof rdoStatusMeta];
  const canApprove = (me?.roles ?? []).some((x: string) => x === "admin" || x === "engenheiro");
  const isAuthor = r.autor?.id === me?.profile?.id;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <Link to="/rdo" className="text-sm text-muted-foreground hover:underline flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> RDOs
      </Link>

      <header className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <Badge variant="outline" className={m.className}>{m.label}</Badge>
          <h1 className="font-serif text-3xl mt-2">RDO #{r.numero}</h1>
          <p className="text-muted-foreground mt-1">
            {r.obras?.nome} · {new Date(r.data).toLocaleDateString("pt-BR")} · por {r.autor?.nome}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={baixarPdf}><Download className="h-4 w-4 mr-1" />PDF</Button>
          {r.status === "rascunho" && isAuthor && (
            <Button onClick={() => submit.mutate()} className="bg-brand text-brand-foreground"><Send className="h-4 w-4 mr-1" />Enviar</Button>
          )}
          {r.status === "enviado" && canApprove && (
            <>
              <Button onClick={() => decide.mutate(true)} className="bg-success text-success-foreground hover:bg-success/90"><CheckCircle2 className="h-4 w-4 mr-1" />Aprovar</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive border-destructive"><XCircle className="h-4 w-4 mr-1" />Reprovar</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Reprovar RDO</AlertDialogTitle></AlertDialogHeader>
                  <Textarea placeholder="Motivo da reprovação..." value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => decide.mutate(false)} className="bg-destructive text-destructive-foreground">Reprovar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </header>

      {r.status === "reprovado" && r.motivo_reprovacao && (
        <Card className="p-4 border-destructive/50 bg-destructive/5 mb-4">
          <div className="text-xs uppercase tracking-wider text-destructive">Motivo da reprovação</div>
          <p className="text-sm mt-1">{r.motivo_reprovacao}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {(["manha", "tarde", "noite"] as const).map((p) => (
          <Card key={p} className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Cloud className="h-3 w-3" /> {p === "manha" ? "Manhã" : p === "tarde" ? "Tarde" : "Noite"}</div>
            <div className="text-sm mt-1">{r[`clima_${p}`] ? climaLabel[r[`clima_${p}`]] : "—"}</div>
          </Card>
        ))}
      </div>

      <ClimaRelatorio endereco={r.obras?.endereco} data={r.data} />


      {r.observacoes && (
        <Card className="p-4 mb-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Observações</div>
          <p className="text-sm whitespace-pre-wrap mt-1">{r.observacoes}</p>
        </Card>
      )}

      <SectionList title="Atividades" empty="Nenhuma atividade.">
        {data.atividades.map((a: any) => (
          <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <span className="text-sm">{a.descricao}</span>
            <span className="text-sm text-muted-foreground tabular-nums">{Number(a.pct_executado).toFixed(0)}%</span>
          </div>
        ))}
      </SectionList>

      <SectionList title="Mão de obra" empty="Nenhuma pessoa registrada.">
        {data.mao_de_obra.map((m: any) => (
          <div key={m.id} className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
            <span>{m.mao_de_obra?.nome} — <span className="text-muted-foreground">{m.mao_de_obra?.funcao}</span></span>
            <span className="text-muted-foreground">{m.atividade ?? "—"} · {m.horas}h</span>
          </div>
        ))}
      </SectionList>

      <SectionList title="Equipamentos" empty="Nenhum equipamento registrado.">
        {data.equipamentos.map((e: any) => (
          <div key={e.id} className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
            <span>{e.equipamentos?.nome}</span>
            <span className="text-muted-foreground">{e.status_uso ?? "—"} · {e.horas_uso}h</span>
          </div>
        ))}
      </SectionList>

      <SectionList title="Ocorrências" empty="Nenhuma ocorrência.">
        {data.ocorrencias.map((o: any) => {
          const sev = o.tipos_ocorrencia?.severidade ? severidadeMeta[o.tipos_ocorrencia.severidade as keyof typeof severidadeMeta] : null;
          return (
            <div key={o.id} className="py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-2">
                {sev && <Badge variant="outline" className={sev.className}>{sev.label}</Badge>}
                <span className="text-sm font-medium">{o.tipos_ocorrencia?.nome ?? "Geral"}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{o.descricao}</p>
            </div>
          );
        })}
      </SectionList>

      {/* Anexos */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-serif text-lg flex items-center gap-2"><Paperclip className="h-4 w-4" /> Anexos</h3>
          <div>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={onUpload} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4 mr-1" />{uploading ? "Enviando…" : "Enviar arquivos"}
            </Button>
          </div>
        </div>
        {(anexos as any[]).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum anexo.</p>
        ) : (
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(anexos as any[]).map((a) => {
              const isImg = a.mime_type?.startsWith("image/");
              return (
                <li key={a.id} className="border border-border rounded-md overflow-hidden group">
                  {isImg && a.url ? (
                    <a href={a.url} target="_blank" rel="noreferrer" className="block aspect-square bg-muted overflow-hidden">
                      <img src={a.url} alt={a.nome} className="w-full h-full object-cover" />
                    </a>
                  ) : (
                    <a href={a.url ?? "#"} target="_blank" rel="noreferrer" className="aspect-square bg-muted flex items-center justify-center">
                      <Paperclip className="h-8 w-8 text-muted-foreground" />
                    </a>
                  )}
                  <div className="p-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{a.nome}</div>
                      <div className="text-[10px] text-muted-foreground">{a.autor?.nome ?? "—"}</div>
                    </div>
                    <button onClick={() => removerAnx.mutate(a.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Auditoria por usuário */}
      <Card className="p-4 mb-4">
        <h3 className="font-serif text-lg flex items-center gap-2 mb-3"><History className="h-4 w-4" /> Auditoria por usuário</h3>
        {!audit || audit.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem registros ainda.</p>
        ) : (
          <>
            <div className="text-xs text-muted-foreground mb-2">
              Totais: <b>{audit.totais.criou}</b> criação · <b>{audit.totais.visualizou}</b> visualizações · <b>{audit.totais.editou}</b> edições · <b>{audit.totais.alterou}</b> alterações de status
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="p-2 font-medium">Usuário</th>
                    <th className="p-2 font-medium text-right">Criou</th>
                    <th className="p-2 font-medium text-right">Visualizou</th>
                    <th className="p-2 font-medium text-right">Editou</th>
                    <th className="p-2 font-medium text-right">Alterou</th>
                    <th className="p-2 font-medium">Último evento</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.rows.map((r: any) => (
                    <tr key={r.user_id} className="border-b border-border last:border-0">
                      <td className="p-2">{r.nome ?? r.email ?? <span className="text-muted-foreground italic">desconhecido</span>}</td>
                      <td className="p-2 text-right tabular-nums">{r.criou}</td>
                      <td className="p-2 text-right tabular-nums">{r.visualizou}</td>
                      <td className="p-2 text-right tabular-nums">{r.editou}</td>
                      <td className="p-2 text-right tabular-nums">{r.alterou}</td>
                      <td className="p-2 text-xs text-muted-foreground">{r.ultima ? new Date(r.ultima).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Trilha de auditoria */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-serif text-lg flex items-center gap-2"><History className="h-4 w-4" /> Histórico ({logsTotal})</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => exportAuditCsv(logs)}>CSV</Button>
            <Button size="sm" variant="outline" onClick={() => exportAuditPdf(logs, data?.rdo?.numero ?? rdoId)}>PDF</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <select className="text-sm border border-border rounded-md px-2 py-1 bg-background"
            value={logFilters.acao} onChange={(e) => setLogFilters({ ...logFilters, acao: e.target.value })}>
            <option value="">Todas ações</option>
            <option value="criado">Criou</option>
            <option value="visualizado">Visualizou</option>
            <option value="editado">Editou</option>
            <option value="status_alterado">Alterou status</option>
            <option value="enviado_para_aprovacao">Enviou</option>
            <option value="aprovado">Aprovou</option>
            <option value="reprovado">Reprovou</option>
          </select>
          <select className="text-sm border border-border rounded-md px-2 py-1 bg-background"
            value={logFilters.autor_id} onChange={(e) => setLogFilters({ ...logFilters, autor_id: e.target.value })}>
            <option value="">Todos usuários</option>
            {(audit?.rows ?? []).map((r: any) => (
              <option key={r.user_id} value={r.user_id}>{r.nome ?? r.email ?? r.user_id.slice(0, 8)}</option>
            ))}
          </select>
          <input type="date" className="text-sm border border-border rounded-md px-2 py-1 bg-background"
            value={logFilters.from} onChange={(e) => setLogFilters({ ...logFilters, from: e.target.value })} />
          <input type="date" className="text-sm border border-border rounded-md px-2 py-1 bg-background"
            value={logFilters.to} onChange={(e) => setLogFilters({ ...logFilters, to: e.target.value })} />
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento.</p>
        ) : (
          <>
            <ol className="relative border-l border-border ml-2">
              {logs.map((l: any) => (
                <li key={l.id} className="ml-4 pb-3">
                  <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-brand" />
                  <div className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
                  <div className="text-sm">
                    <span className="font-medium capitalize">{l.acao.replaceAll("_", " ")}</span>
                    {l.status_anterior && l.status_novo && (
                      <span className="text-muted-foreground"> · {l.status_anterior} → {l.status_novo}</span>
                    )}
                    {l.autor?.nome && <span className="text-muted-foreground"> · {l.autor.nome}</span>}
                  </div>
                  {l.motivo && <div className="text-xs text-muted-foreground mt-1 italic">"{l.motivo}"</div>}
                </li>
              ))}
            </ol>
            {logs.length < logsTotal && (
              <div className="mt-3 flex justify-center">
                <Button size="sm" variant="outline" onClick={() => setLogFilters({ ...logFilters, limit: logFilters.limit + 25 })}>
                  Carregar mais ({logsTotal - logs.length} restantes)
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

    </div>
  );
}

function SectionList({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const isEmpty = !children || (Array.isArray(children) && children.length === 0);
  return (
    <Card className="p-4 mb-4">
      <h3 className="font-serif text-lg mb-2">{title}</h3>
      {isEmpty ? <p className="text-sm text-muted-foreground">{empty}</p> : <div>{children}</div>}
    </Card>
  );
}

const TZ_BR = "America/Sao_Paulo";
function fmtBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: TZ_BR, hour12: false });
}

function exportAuditCsv(logs: any[]) {
  const sorted = [...logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const head = ["data_hora_brasilia", "acao", "usuario", "email", "status_anterior", "status_novo", "motivo"];
  const body = sorted.map((l) => [
    fmtBR(l.created_at),
    l.acao,
    l.autor?.nome ?? "",
    l.autor?.email ?? "",
    l.status_anterior ?? "",
    l.status_novo ?? "",
    (l.motivo ?? "").replace(/"/g, '""'),
  ].map((v) => `"${v}"`).join(";"));
  const csv = "\uFEFF" + [head.join(";"), ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `auditoria-rdo-${Date.now()}.csv`;
  a.click();
}

async function exportAuditPdf(logs: any[], numero: string | number) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const sorted = [...logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(`Auditoria RDO ${numero}`, 14, 16);
  doc.setFontSize(9);
  doc.text(`Gerado em ${fmtBR(new Date().toISOString())} (Brasília) — ${sorted.length} eventos`, 14, 22);
  autoTable(doc, {
    startY: 26,
    head: [["Data/Hora (BR)", "Ação", "Usuário", "Status", "Motivo"]],
    body: sorted.map((l) => [
      fmtBR(l.created_at),
      l.acao,
      l.autor?.nome ?? l.autor?.email ?? "—",
      [l.status_anterior, l.status_novo].filter(Boolean).join(" → "),
      l.motivo ?? "",
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
  });
  doc.save(`auditoria-rdo-${numero}.pdf`);
}


function ClimaRelatorio({ endereco, data }: { endereco?: string | null; data: string }) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "success" | "error"; erro?: string; local?: string; dias?: DiaRegistro[] }>({ status: "idle" });

  async function carregar() {
    if (!endereco) { setState({ status: "error", erro: "Obra sem endereço cadastrado." }); return; }
    setState({ status: "loading" });
    try {
      const r = await fetchHistoricoEPrevisaoUteis(endereco, data, 2, 2);
      setState({ status: "success", local: r.local, dias: r.dias });
    } catch (e: any) {
      setState({ status: "error", erro: e?.message ?? "Falha ao consultar previsão" });
    }
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [endereco, data]);

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-serif text-base">Evidências meteorológicas</h3>
          <span
            role="status"
            aria-live="polite"
            className={
              "text-[11px] px-2 py-0.5 rounded-full border " +
              (state.status === "loading" ? "bg-muted text-muted-foreground border-border animate-pulse" :
               state.status === "success" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" :
               state.status === "error"   ? "bg-destructive/10 text-destructive border-destructive/30" :
                                            "bg-muted/40 text-muted-foreground border-border")
            }
          >
            {state.status === "loading" && "Consultando Open-Meteo…"}
            {state.status === "success" && (state.local ?? "Atualizado")}
            {state.status === "error" && "Falha"}
            {state.status === "idle" && "Sem dados"}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={carregar} disabled={state.status === "loading"}>
          {state.status === "loading" ? "Atualizando…" : "Atualizar"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        Previsão/observação para o dia do RDO e 2 dias úteis antes/depois — endereço da obra como referência, horário de Brasília.
      </p>
      {state.status === "error" && (
        <p className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-md p-2">{state.erro}</p>
      )}
      {state.dias && state.dias.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {state.dias.map((d) => {
            const destaque = d.data === data;
            const tag = d.origem === "historico" ? "Histórico" : d.origem === "atual" ? "Hoje" : "Previsão";
            return (
              <div key={d.data} className={"border rounded-md p-2 text-xs " + (destaque ? "border-brand bg-brand/5" : "border-border bg-muted/20")}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{d.dia_semana}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{tag}</span>
                </div>
                <div className="text-muted-foreground">{new Date(`${d.data}T12:00:00-03:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</div>
                <div>{d.descricao}</div>
                <div className="text-muted-foreground">{Math.round(d.t_min_c)}° / {Math.round(d.t_max_c)}°C</div>
                <div className="text-muted-foreground">💧 {d.prob_chuva_pct}% · {d.precipitacao_mm} mm</div>
              </div>
            );
          })}
        </div>
      )}
      {state.status === "success" && (!state.dias || state.dias.length === 0) && (
        <p className="text-xs text-muted-foreground">Sem dados meteorológicos disponíveis para o período.</p>
      )}
    </Card>
  );
}
