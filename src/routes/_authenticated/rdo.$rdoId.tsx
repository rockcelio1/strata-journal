import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getRdo, submitRdo, approveRdo, deleteRdo, adminDeleteRdo, adminDisableRdo,
  listRdoLogs, listRdoAnexos, registrarAnexo, removerAnexo,
  logRdoView, getRdoAuditSummary, logRdoClimaUpdate, logRdoAuditView,
  updateRdoClimaRascunho,
} from "@/lib/rdo.functions";
import { requestRevisionRdo, reopenRdo, listRdoAvancos } from "@/lib/rdo-avancos.functions";
import { RdoAvancosSection } from "@/components/rdo/RdoAvancosSection";
import { setAnexoTaskItem } from "@/lib/rdo.functions";

import { uploadOneDriveAnexo } from "@/lib/onedrive.functions";
import { getMe } from "@/lib/core.functions";
import { supabase } from "@/integrations/supabase/client";
import { exportRdoPdf } from "@/lib/rdo-pdf";
import { exportRdoExcel } from "@/lib/rdo-excel";
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

import { RdoAcessoCard } from "@/components/rdo/RdoAcessoCard";
import { SignaturesCard } from "@/components/rdo/SignaturesCard";
import { AdminConfirmTwiceButton } from "@/components/rdo/AdminConfirmTwiceButton";

export const Route = createFileRoute("/_authenticated/rdo/$rdoId")({
  component: RdoDetailPage,
});

function RdoDetailPage() {
  const { rdoId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fn = useServerFn(getRdo);
  const meFn = useServerFn(getMe);
  const submitFn = useServerFn(submitRdo);
  const approveFn = useServerFn(approveRdo);
  const deleteFn = useServerFn(deleteRdo);
  const adminDeleteFn = useServerFn(adminDeleteRdo);
  const adminDisableFn = useServerFn(adminDisableRdo);
  
  const logsFn = useServerFn(listRdoLogs);
  const anexosFn = useServerFn(listRdoAnexos);
  const registrarFn = useServerFn(registrarAnexo);
  const removerFn = useServerFn(removerAnexo);
  const viewFn = useServerFn(logRdoView);
  const auditViewFn = useServerFn(logRdoAuditView);
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
  const [uploadDest, setUploadDest] = useState<"onedrive" | "supabase">(
    (typeof window !== "undefined" && (localStorage.getItem("rdo.upload_dest") as any)) || "onedrive",
  );
  const [filterProv, setFilterProv] = useState<"all" | "onedrive" | "supabase">("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "name" | "size_desc">("date_desc");
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadOdFn = useServerFn(uploadOneDriveAnexo);
  const [climaState, setClimaState] = useState<{ local?: string; dias?: DiaRegistro[] }>({});

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("rdo.upload_dest", uploadDest);
  }, [uploadDest]);

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
  const revisionFn = useServerFn(requestRevisionRdo);
  const reopenSFn = useServerFn(reopenRdo);
  const requestRev = useMutation({
    mutationFn: (m: string) => revisionFn({ data: { id: rdoId, motivo: m } }),
    onSuccess: () => { toast.success("Revisão solicitada"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const reopen = useMutation({
    mutationFn: () => reopenSFn({ data: { id: rdoId } }),
    onSuccess: () => { toast.success("RDO reaberto"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const removerAnx = useMutation({
    mutationFn: (id: string) => removerFn({ data: { id } }),
    onSuccess: () => { toast.success("Anexo removido"); qc.invalidateQueries({ queryKey: ["rdo-anexos", rdoId] }); },
    onError: (e: any) => toast.error(`Falha ao remover anexo: ${e.message}. Verifique permissões no OneDrive/Storage.`),
  });
  const excluir = useMutation({
    mutationFn: () => deleteFn({ data: { id: rdoId } }),
    onSuccess: () => {
      toast.success("Rascunho excluído com sucesso");
      qc.invalidateQueries({ queryKey: ["rdos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      navigate({ to: "/rdo" });
    },
    onError: (e: any) => {
      const msg = e?.message ?? "Erro desconhecido ao excluir o rascunho.";
      toast.error(msg, { duration: 6000 });
    },
  });
  const adminExcluir = useMutation({
    mutationFn: () => adminDeleteFn({ data: { id: rdoId } }),
    onSuccess: () => {
      toast.success("RDO excluído (admin)");
      qc.invalidateQueries({ queryKey: ["rdos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      navigate({ to: "/rdo" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao excluir RDO", { duration: 6000 }),
  });
  const adminToggleDisabled = useMutation({
    mutationFn: (disable: boolean) => adminDisableFn({ data: { id: rdoId, disable } }),
    onSuccess: () => { toast.success("Status atualizado"); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao alterar disponibilidade", { duration: 6000 }),
  });

  const fileToBase64 = (f: File) => new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      resolve(s.includes(",") ? s.split(",")[1] : s);
    };
    r.onerror = () => reject(new Error("Falha ao ler arquivo"));
    r.readAsDataURL(f);
  });

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !me?.profile?.empresa_id) return;
    setUploading(true);
    const rootFolder = (typeof window !== "undefined" && localStorage.getItem("onedrive.root_folder")) || "DiarioDeObra";
    try {
      for (const file of Array.from(files)) {
        if (uploadDest === "onedrive") {
          try {
            const base64 = await fileToBase64(file);
            await uploadOdFn({ data: {
              rdo_id: rdoId, nome: file.name,
              mime_type: file.type || "application/octet-stream",
              tamanho_bytes: file.size, base64, root_folder: rootFolder,
            }});
          } catch (err: any) {
            const msg = String(err?.message ?? err);
            let step = "envio ao OneDrive";
            if (/raiz/i.test(msg)) step = "validar pasta raiz";
            else if (/listar/i.test(msg)) step = "listar pastas";
            else if (/upload|PUT|escrever/i.test(msg)) step = "escrever arquivo";
            throw new Error(`OneDrive — etapa "${step}": ${msg}. Verifique conexão e pasta raiz em Configurações → OneDrive.`);
          }
        } else {
          const safe = file.name.replace(/[^\w.\-]+/g, "_");
          const path = `${me.profile.empresa_id}/${rdoId}/${Date.now()}-${safe}`;
          const up = await supabase.storage.from("rdo-anexos").upload(path, file, { upsert: false });
          if (up.error) throw new Error(`Supabase Storage — etapa "escrever arquivo": ${up.error.message}`);
          await registrarFn({ data: {
            rdo_id: rdoId, nome: file.name, storage_path: path,
            mime_type: file.type || undefined, tamanho_bytes: file.size,
          }});
        }
      }
      toast.success(`Anexos enviados via ${uploadDest === "onedrive" ? "OneDrive" : "Supabase Storage"}`);
      qc.invalidateQueries({ queryKey: ["rdo-anexos", rdoId] });
    } catch (err: any) {
      toast.error(err.message ?? "Falha no upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };


  const avancosExpFn = useServerFn(listRdoAvancos);
  const { data: avancosData } = useQuery({
    queryKey: ["rdo-avancos-export", rdoId, (data as any)?.rdo?.obra_id],
    queryFn: () => avancosExpFn({ data: { rdo_id: rdoId, obra_id: (data as any).rdo.obra_id } }),
    enabled: !!(data as any)?.rdo?.obra_id,
  });
  const avancosItens = (avancosData?.itens ?? []) as any[];
  const avancosRows = (avancosData?.avancos ?? []) as any[];
  const setTaskItemFn = useServerFn(setAnexoTaskItem);
  const setTaskItem = useMutation({
    mutationFn: (p: { id: string; task_item_id: string | null }) => setTaskItemFn({ data: p }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rdo-anexos", rdoId] }),
  });

  const baixarPdf = async () => {
    if (!data) return;
    await exportRdoPdf({
      rdo: data.rdo,
      atividades: data.atividades,
      avancos: avancosRows,
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

  const baixarExcel = async () => {
    if (!data) return;
    exportRdoExcel({
      rdo: data.rdo,
      atividades: data.atividades,
      avancos: avancosRows,
      mao_de_obra: data.mao_de_obra,
      equipamentos: data.equipamentos,
      ocorrencias: data.ocorrencias,
      anexos: anexos as any[],
      logs: logs as any[],
      clima_dias: climaState.dias ?? null,
      clima_local: climaState.local ?? null,
      empresa: (me as any)?.empresa,
    });
  };

  if (!data) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  const r = data.rdo as any;
  const m = rdoStatusMeta[r.status as keyof typeof rdoStatusMeta];
  const canApprove = (me?.roles ?? []).some((x: string) => x === "admin" || x === "engenheiro");
  const canManageAccess = (me?.roles ?? []).some((x: string) => x === "admin" || x === "master" || x === "gestor_acessos");
  const isAuthor = r.autor?.id === me?.profile?.id;
  const isAdminOrMaster = (me?.roles ?? []).some((x: string) => x === "admin" || x === "master");
  const canDeleteRascunho = r.status === "rascunho" && (isAuthor || isAdminOrMaster);

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
          <Button variant="outline" onClick={baixarExcel}><Download className="h-4 w-4 mr-1" />Excel</Button>
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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline"><History className="h-4 w-4 mr-1" />Solicitar revisão</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Solicitar revisão</AlertDialogTitle></AlertDialogHeader>
                  <Textarea placeholder="Descreva o que precisa ser revisado..." value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => motivo.trim() && requestRev.mutate(motivo)}>Solicitar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {(r.status === "aprovado" || r.status === "revisao_solicitada") && canApprove && (
            <Button variant="outline" onClick={() => reopen.mutate()}><History className="h-4 w-4 mr-1" />Reabrir</Button>
          )}
          {canDeleteRascunho && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive border-destructive" disabled={excluir.isPending}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  {excluir.isPending ? "Excluindo…" : "Excluir rascunho"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir rascunho permanentemente?</AlertDialogTitle>
                </AlertDialogHeader>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>
                    O rascunho <strong>RDO #{r.numero}</strong> será removido do sistema
                    e <strong>não poderá ser recuperado</strong> pela interface.
                  </p>
                  <p>
                    A exclusão fica registrada no log de auditoria (autor, data e ação)
                    para fins de rastreabilidade e conformidade.
                  </p>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={excluir.isPending}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); excluir.mutate(); }}
                    disabled={excluir.isPending}
                    className="bg-destructive text-destructive-foreground"
                  >
                    {excluir.isPending ? "Excluindo…" : "Excluir permanentemente"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {isAdminOrMaster && (
            <>
              <AdminConfirmTwiceButton
                label={r.disabled_at ? "Reabilitar (admin)" : "Desabilitar (admin)"}
                title={r.disabled_at ? "Reabilitar este RDO?" : "Desabilitar este RDO?"}
                description={r.disabled_at
                  ? `O RDO #${r.numero} voltará a ficar disponível para edição/uso.`
                  : `O RDO #${r.numero} ficará marcado como desabilitado e indisponível para novas edições.`}
                doubleConfirmText={r.disabled_at ? "REABILITAR" : "DESABILITAR"}
                isPending={adminToggleDisabled.isPending}
                variant="outline"
                onConfirm={() => adminToggleDisabled.mutate(!r.disabled_at)}
              />
              {!canDeleteRascunho && (
                <AdminConfirmTwiceButton
                  label={`Excluir RDO #${r.numero} (admin)`}
                  title={`Excluir RDO #${r.numero} em status "${r.status}"?`}
                  description={`Como administrador você pode excluir RDOs em qualquer status. Esta ação é irreversível pela interface e fica registrada na auditoria.`}
                  doubleConfirmText={`EXCLUIR-${r.numero}`}
                  isPending={adminExcluir.isPending}
                  variant="destructive"
                  onConfirm={() => adminExcluir.mutate()}
                />
              )}
            </>
          )}
        </div>
      </header>

      {r.disabled_at && (
        <Card className="p-3 border-amber-300 bg-amber-50 text-amber-900 mb-4 text-sm">
          ⚠️ Este RDO está <strong>desabilitado</strong> por um administrador desde {new Date(r.disabled_at).toLocaleString("pt-BR")}.
        </Card>
      )}


      {r.status === "reprovado" && r.motivo_reprovacao && (
        <Card className="p-4 border-destructive/50 bg-destructive/5 mb-4">
          <div className="text-xs uppercase tracking-wider text-destructive">Motivo da reprovação</div>
          <p className="text-sm mt-1">{r.motivo_reprovacao}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
        {(["manha", "tarde", "noite"] as const).map((p) => (
          <Card key={p} className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Cloud className="h-3 w-3" /> {p === "manha" ? "Manhã" : p === "tarde" ? "Tarde" : "Noite"}</div>
            <div className="text-sm mt-1">{r[`clima_${p}`] ? climaLabel[r[`clima_${p}`]] : "—"}</div>
          </Card>
        ))}
      </div>
      {r.status === "rascunho" && isAuthor && (
        <div className="mb-4">
          <EditarClimaRascunho
            rdoId={rdoId}
            atual={{ clima_manha: r.clima_manha, clima_tarde: r.clima_tarde, clima_noite: r.clima_noite }}
            onSaved={refresh}
          />
        </div>
      )}

      <ClimaRelatorio
        rdoId={rdoId}
        endereco={r.obras?.endereco}
        data={r.data}
        onData={(local, dias) => setClimaState({ local, dias })}
      />



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

      {(r.obras?.id ?? r.obra_id) && (
        <RdoAvancosSection
          rdoId={rdoId}
          obraId={r.obras?.id ?? r.obra_id}
          readOnly={!(r.status === "rascunho" || r.status === "revisao_solicitada" || r.status === "reaberto") || !isAuthor}
        />
      )}


      <SectionList title="Mão de obra" empty="Nenhuma pessoa registrada.">
        {data.mao_de_obra.map((m: any) => (
          <div key={m.id} className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
            <span>{m.mao_de_obra?.nome} — <span className="text-muted-foreground">{m.mao_de_obra?.funcao}</span></span>
            <span className="text-muted-foreground">{m.horas} UN</span>
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

      {/* Assinaturas requeridas */}
      <SignaturesCard
        rdoId={rdoId}
        myUserId={me?.profile?.id}
        canManage={!!me?.profile?.id && (me.profile.id === data.rdo.autor_id)}
      />

      {/* Anexos unificados (OneDrive + Supabase) */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-serif text-lg flex items-center gap-2"><Paperclip className="h-4 w-4" /> Anexos</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="text-xs border border-border rounded-md px-2 py-1 bg-background"
              value={uploadDest}
              onChange={(e) => setUploadDest(e.target.value as any)}
              aria-label="Destino do upload"
              disabled={uploading}
            >
              <option value="onedrive">Enviar para: OneDrive</option>
              <option value="supabase">Enviar para: Supabase</option>
            </select>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={onUpload} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4 mr-1" />{uploading ? "Enviando…" : "Enviar arquivos"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input
            type="search"
            placeholder="Pesquisar por nome…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs border border-border rounded-md px-2 py-1 bg-background flex-1 min-w-[160px]"
            aria-label="Pesquisar anexos"
          />
          <select
            className="text-xs border border-border rounded-md px-2 py-1 bg-background"
            value={filterProv}
            onChange={(e) => setFilterProv(e.target.value as any)}
            aria-label="Filtrar por provedor"
          >
            <option value="all">Todos os provedores</option>
            <option value="onedrive">Apenas OneDrive</option>
            <option value="supabase">Apenas Supabase</option>
          </select>
          <select
            className="text-xs border border-border rounded-md px-2 py-1 bg-background"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            aria-label="Ordenar"
          >
            <option value="date_desc">Mais recentes</option>
            <option value="date_asc">Mais antigos</option>
            <option value="name">Nome (A→Z)</option>
            <option value="size_desc">Maior tamanho</option>
          </select>
        </div>

        {(() => {
          const list = (anexos as any[])
            .filter((a) => {
              const prov = a.storage_provider ?? "supabase";
              if (filterProv !== "all" && prov !== filterProv) return false;
              if (search && !String(a.nome ?? "").toLowerCase().includes(search.toLowerCase())) return false;
              return true;
            })
            .sort((a, b) => {
              if (sortBy === "name") return String(a.nome).localeCompare(String(b.nome));
              if (sortBy === "size_desc") return (b.tamanho_bytes ?? 0) - (a.tamanho_bytes ?? 0);
              const ta = new Date(a.created_at).getTime();
              const tb = new Date(b.created_at).getTime();
              return sortBy === "date_asc" ? ta - tb : tb - ta;
            });

          if (list.length === 0) {
            return <p className="text-sm text-muted-foreground">Nenhum anexo corresponde aos filtros.</p>;
          }
          const fmtSize = (n?: number) => {
            if (!n) return "—";
            if (n < 1024) return `${n} B`;
            if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
            return `${(n / (1024 * 1024)).toFixed(1)} MB`;
          };
          return (
            <ul className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {list.map((a) => {
                const isImg = a.mime_type?.startsWith("image/");
                const prov = a.storage_provider ?? "supabase";
                const provLabel = prov === "onedrive" ? "OneDrive" : "Supabase";
                const provColor = prov === "onedrive" ? "bg-blue-500/10 text-blue-600 border-blue-500/30" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
                return (
                  <li key={a.id} className="border border-border rounded-md overflow-hidden group flex flex-col">
                    {isImg && a.url ? (
                      <a href={a.url} target="_blank" rel="noreferrer" className="block aspect-square bg-muted overflow-hidden">
                        <img src={a.url} alt={a.nome} className="w-full h-full object-cover" />
                      </a>
                    ) : (
                      <a href={a.url ?? "#"} target="_blank" rel="noreferrer" className="aspect-square bg-muted flex items-center justify-center">
                        <Paperclip className="h-8 w-8 text-muted-foreground" />
                      </a>
                    )}
                    <div className="p-2 flex flex-col gap-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 ${provColor}`}>{provLabel}</Badge>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{fmtSize(a.tamanho_bytes)}</span>
                      </div>
                      <div className="text-xs font-medium truncate" title={a.nome}>{a.nome}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString("pt-BR")} · {a.autor?.nome ?? "—"}
                      </div>
                      {avancosItens.length > 0 && (
                        <select
                          value={a.task_item_id ?? ""}
                          onChange={(e) => setTaskItem.mutate({ id: a.id, task_item_id: e.target.value || null })}
                          className="text-[10px] border border-border rounded px-1 py-0.5 bg-background"
                          aria-label="Vincular a atividade"
                        >
                          <option value="">— sem atividade —</option>
                          {avancosItens.map((it: any) => (
                            <option key={it.id} value={it.id}>
                              {(it.item_code ? it.item_code + " · " : "") + (it.descricao ?? "")}
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <a
                          href={a.url ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          download={a.nome}
                          className="text-[11px] text-brand hover:underline inline-flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" /> Baixar
                        </a>
                        <button
                          onClick={() => {
                            if (confirm(`Remover "${a.nome}" do ${provLabel}?`)) removerAnx.mutate(a.id);
                          }}
                          className="text-muted-foreground hover:text-destructive inline-flex items-center gap-1 text-[11px]"
                          aria-label="Remover anexo"
                        >
                          <Trash2 className="h-3 w-3" /> Remover
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          );
        })()}
      </Card>



      {canManageAccess && <RdoAcessoCard rdoId={rdoId} obraId={r.obras?.id ?? r.obra_id ?? null} />}

      {/* Auditoria por usuário */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-serif text-lg flex items-center gap-2"><History className="h-4 w-4" /> Auditoria por usuário</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="text-sm border border-border rounded-md px-2 py-1 bg-background"
              value={logFilters.autor_id}
              onChange={(e) => setLogFilters({ ...logFilters, autor_id: e.target.value })}
              aria-label="Filtrar por usuário"
            >
              <option value="">Todos os usuários</option>
              {(audit?.rows ?? []).map((r: any) => (
                <option key={r.user_id} value={r.user_id}>{r.nome ?? r.email ?? r.user_id.slice(0, 8)}</option>
              ))}
            </select>
            <input type="date" className="text-sm border border-border rounded-md px-2 py-1 bg-background"
              value={logFilters.from} onChange={(e) => setLogFilters({ ...logFilters, from: e.target.value })} aria-label="De" />
            <input type="date" className="text-sm border border-border rounded-md px-2 py-1 bg-background"
              value={logFilters.to} onChange={(e) => setLogFilters({ ...logFilters, to: e.target.value })} aria-label="Até" />
            <Button size="sm" variant="outline" onClick={() => {
              auditViewFn({ data: { rdo_id: rdoId } }).catch(() => {});
              exportSummaryCsv(audit?.rows ?? [], logFilters);
            }}>CSV</Button>
            <Button size="sm" variant="outline" onClick={() => {
              auditViewFn({ data: { rdo_id: rdoId } }).catch(() => {});
              exportSummaryPdf(audit?.rows ?? [], data?.rdo?.numero ?? rdoId, logFilters);
            }}>PDF</Button>
          </div>
        </div>
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
                  {audit.rows
                    .filter((r: any) => !logFilters.autor_id || r.user_id === logFilters.autor_id)
                    .map((r: any) => (
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


      {/* Auditoria de Exclusões */}
      <ExclusoesPanel logs={logs} />

      {/* Linha do tempo: eventos administrativos do RDO */}
      <EventosRdoPanel logs={logs} />

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

function ExclusoesPanel({ logs }: { logs: any[] }) {
  const exclusoes = useMemo(
    () => logs.filter((l: any) => l.acao === "rascunho_excluido" || /excluid/i.test(l.acao ?? "")),
    [logs],
  );
  const usuarios = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of exclusoes) {
      const id = l.autor_id ?? l.autor?.id;
      if (id) m.set(id, l.autor?.nome ?? l.autor?.email ?? id.slice(0, 8));
    }
    return Array.from(m.entries());
  }, [exclusoes]);
  const [filtroUser, setFiltroUser] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const filtradas = useMemo(() => {
    return exclusoes.filter((l: any) => {
      const id = l.autor_id ?? l.autor?.id ?? "";
      if (filtroUser && id !== filtroUser) return false;
      const t = new Date(l.created_at).getTime();
      if (from && t < new Date(`${from}T00:00:00-03:00`).getTime()) return false;
      if (to && t > new Date(`${to}T23:59:59-03:00`).getTime()) return false;
      return true;
    });
  }, [exclusoes, filtroUser, from, to]);
  useEffect(() => { setPage(1); }, [filtroUser, from, to]);
  if (exclusoes.length === 0) return null;
  const totalPages = Math.max(1, Math.ceil(filtradas.length / pageSize));
  const slice = filtradas.slice((page - 1) * pageSize, page * pageSize);
  return (
    <Card className="p-4 mb-4 border-destructive/40">
      <h3 className="font-serif text-lg flex items-center gap-2 mb-3 text-destructive">
        <History className="h-4 w-4" /> Auditoria de exclusões ({filtradas.length}/{exclusoes.length})
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        <select className="text-sm border border-border rounded-md px-2 py-1 bg-background"
          value={filtroUser} onChange={(e) => setFiltroUser(e.target.value)}>
          <option value="">Todos usuários</option>
          {usuarios.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
        </select>
        <input type="date" className="text-sm border border-border rounded-md px-2 py-1 bg-background"
          value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="text-sm border border-border rounded-md px-2 py-1 bg-background"
          value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {slice.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma exclusão para o filtro.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {slice.map((l: any) => (
            <li key={l.id} className="border border-destructive/20 rounded-md p-2 bg-destructive/5">
              <div className="text-xs text-muted-foreground">{fmtBR(l.created_at)}</div>
              <div>
                <span className="font-medium">{l.autor?.nome ?? l.autor?.email ?? "Usuário"}</span>
                <span className="text-muted-foreground"> · ID: <code className="text-[11px]">{l.autor_id ?? "—"}</code></span>
              </div>
              {l.motivo && <div className="text-xs italic text-muted-foreground mt-1">"{l.motivo}"</div>}
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <span className="text-muted-foreground">Página {page} de {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
        </div>
      )}
    </Card>
  );
}

function EventosRdoPanel({ logs }: { logs: any[] }) {
  // Mapeia ações relevantes em rótulos amigáveis e classes visuais.
  const TIPOS: Record<string, { label: string; tone: string; match: RegExp }> = {
    excluido:    { label: "Excluído",    tone: "bg-destructive/10 text-destructive border-destructive/30", match: /(excluid|rascunho_excluido|soft_delete|admin_excluiu)/i },
    desabilitado:{ label: "Desabilitado",tone: "bg-amber-500/10 text-amber-700 border-amber-500/30",       match: /(desabilit|disable)/i },
    reabilitado: { label: "Reabilitado", tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30", match: /(reabilit|enable|restaurad)/i },
    editado:     { label: "Editado",     tone: "bg-sky-500/10 text-sky-700 border-sky-500/30",             match: /(editad|atualizad|alterad|admin_update)/i },
  };
  const eventos = useMemo(() => {
    return logs
      .map((l: any) => {
        const acao = String(l.acao ?? "");
        const tipo = Object.entries(TIPOS).find(([, v]) => v.match.test(acao))?.[0] ?? null;
        return tipo ? { ...l, _tipo: tipo } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [logs]);
  if (eventos.length === 0) return null;
  return (
    <Card className="p-4 mb-4">
      <h3 className="font-serif text-lg flex items-center gap-2 mb-3">
        <History className="h-4 w-4" /> Eventos do RDO ({eventos.length})
      </h3>
      <ol className="relative border-l border-border ml-2">
        {eventos.map((l: any) => {
          const t = TIPOS[l._tipo];
          return (
            <li key={l.id} className="ml-4 pb-3">
              <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-brand" />
              <div className="text-xs text-muted-foreground">{fmtBR(l.created_at)}</div>
              <div className="text-sm flex flex-wrap items-center gap-2">
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${t.tone}`}>{t.label}</span>
                <span className="text-muted-foreground">por</span>
                <span className="font-medium">{l.autor?.nome ?? l.autor?.email ?? l.autor_id?.slice(0, 8) ?? "—"}</span>
              </div>
              {l.motivo && <div className="text-xs italic text-muted-foreground mt-1">"{l.motivo}"</div>}
            </li>
          );
        })}
      </ol>
    </Card>
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


function filterSummaryRows(rows: any[], f: { autor_id?: string; from?: string; to?: string }) {
  return rows
    .filter((r) => !f.autor_id || r.user_id === f.autor_id)
    .filter((r) => {
      if (!r.ultima) return !f.from && !f.to;
      const t = new Date(r.ultima).getTime();
      if (f.from && t < new Date(f.from).getTime()) return false;
      if (f.to && t > new Date(f.to + "T23:59:59").getTime()) return false;
      return true;
    });
}

function exportSummaryCsv(rows: any[], f: { autor_id?: string; from?: string; to?: string }) {
  const data = filterSummaryRows(rows, f);
  const head = ["usuario", "email", "criou", "visualizou", "editou", "alterou", "ultimo_evento_brasilia"];
  const body = data.map((r) => [
    r.nome ?? "",
    r.email ?? "",
    r.criou ?? 0,
    r.visualizou ?? 0,
    r.editou ?? 0,
    r.alterou ?? 0,
    r.ultima ? fmtBR(r.ultima) : "",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));
  const csv = "\uFEFF" + [head.join(";"), ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `auditoria-usuarios-rdo-${Date.now()}.csv`;
  a.click();
}

async function exportSummaryPdf(rows: any[], numero: string | number, f: { autor_id?: string; from?: string; to?: string }) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const data = filterSummaryRows(rows, f);
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(`Auditoria por usuário — RDO ${numero}`, 14, 16);
  doc.setFontSize(9);
  const periodo = f.from || f.to ? `Período: ${f.from || "início"} até ${f.to || "hoje"} · ` : "";
  doc.text(`${periodo}Gerado em ${fmtBR(new Date().toISOString())} (Brasília)`, 14, 22);
  autoTable(doc, {
    startY: 26,
    head: [["Usuário", "E-mail", "Criou", "Visualizou", "Editou", "Alterou", "Último evento"]],
    body: data.map((r) => [
      r.nome ?? "—",
      r.email ?? "—",
      r.criou ?? 0,
      r.visualizou ?? 0,
      r.editou ?? 0,
      r.alterou ?? 0,
      r.ultima ? fmtBR(r.ultima) : "—",
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
  });
  doc.save(`auditoria-usuarios-rdo-${numero}.pdf`);
}


function ClimaRelatorio({
  rdoId, endereco, data, onData,
}: {
  rdoId: string;
  endereco?: string | null;
  data: string;
  onData?: (local: string | undefined, dias: DiaRegistro[] | undefined) => void;
}) {
  const logClima = useServerFn(logRdoClimaUpdate);
  const [state, setState] = useState<{
    status: "idle" | "loading" | "success" | "error";
    erro?: string;
    local?: string;
    dias?: DiaRegistro[];
    tentativa?: number;
    proximaEm?: number;
  }>({ status: "idle" });
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTimers() {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }

  async function executar(tentativa = 1, manual = false) {
    clearTimers();
    if (!endereco) { setState({ status: "error", erro: "Obra sem endereço cadastrado." }); return; }
    setState({ status: "loading", tentativa });
    try {
      const r = await fetchHistoricoEPrevisaoUteis(endereco, data, 2, 2);
      setState({ status: "success", local: r.local, dias: r.dias });
      onData?.(r.local, r.dias);
      if (manual) {
        logClima({ data: { rdo_id: rdoId, endereco, local: r.local, ok: true } }).catch(() => {});
      }
    } catch (e: any) {
      const msg = e?.message ?? "Falha ao consultar previsão";
      const MAX = 3;
      if (tentativa < MAX) {
        const delay = Math.min(8000, 1000 * Math.pow(2, tentativa - 1)); // 1s, 2s, 4s
        setState({ status: "error", erro: `${msg} — tentando novamente…`, tentativa, proximaEm: Math.ceil(delay / 1000) });
        countdownRef.current = setInterval(() => {
          setState((s) => s.proximaEm && s.proximaEm > 1 ? { ...s, proximaEm: s.proximaEm - 1 } : s);
        }, 1000);
        retryTimerRef.current = setTimeout(() => executar(tentativa + 1, manual), delay);
      } else {
        setState({ status: "error", erro: msg, tentativa });
        if (manual) {
          logClima({ data: { rdo_id: rdoId, endereco, ok: false, erro: msg } }).catch(() => {});
        }
      }
    }
  }

  useEffect(() => {
    executar(1, false);
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endereco, data]);

  function exportarCsv() {
    const dias = [...(state.dias ?? [])].sort((a, b) => a.data.localeCompare(b.data));
    if (dias.length === 0) { toast.error("Sem dados meteorológicos para exportar"); return; }
    const head = ["data_brasilia", "dia_semana", "origem", "t_min_c", "t_max_c", "precipitacao_mm", "prob_chuva_pct", "codigo", "descricao"];
    const body = dias.map((d) => [
      new Date(`${d.data}T12:00:00-03:00`).toLocaleDateString("pt-BR", { timeZone: TZ_BR }),
      d.dia_semana, d.origem, d.t_min_c, d.t_max_c, d.precipitacao_mm, d.prob_chuva_pct, d.codigo,
      String(d.descricao ?? "").replace(/"/g, '""'),
    ].map((v) => `"${v}"`).join(";"));
    const csv = "\uFEFF" + [head.join(";"), ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `evidencias-clima-rdo-${rdoId}.csv`;
    a.click();
  }

  const badgeText =
    state.status === "loading"
      ? state.tentativa && state.tentativa > 1
        ? `Tentativa ${state.tentativa}/3…`
        : "Consultando Open-Meteo…"
      : state.status === "success"
        ? (state.local ?? "Atualizado")
        : state.status === "error"
          ? state.proximaEm ? `Falha — novo tentativa em ${state.proximaEm}s` : "Falha"
          : "Sem dados";

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
            {badgeText}
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportarCsv} disabled={!state.dias?.length}>CSV</Button>
          <Button size="sm" variant="outline" onClick={() => executar(1, true)} disabled={state.status === "loading"}>
            {state.status === "loading" ? "Atualizando…" : "Atualizar"}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        Previsão/observação para o dia do RDO e 2 dias úteis antes/depois — endereço da obra como referência, horário de Brasília.
      </p>
      {state.status === "error" && (
        <div className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-md p-2">
          <div>{state.erro}</div>
          {state.tentativa && state.tentativa >= 3 && (
            <button onClick={() => executar(1, true)} className="underline mt-1">Tentar manualmente</button>
          )}
        </div>
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

type ClimaVal = "ensolarado" | "nublado" | "chuvoso" | "chuva_forte" | "impraticavel" | null;

function EditarClimaRascunho({
  rdoId,
  atual,
  onSaved,
}: {
  rdoId: string;
  atual: { clima_manha: ClimaVal; clima_tarde: ClimaVal; clima_noite: ClimaVal };
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [manha, setManha] = useState<ClimaVal>(atual.clima_manha ?? null);
  const [tarde, setTarde] = useState<ClimaVal>(atual.clima_tarde ?? null);
  const [noite, setNoite] = useState<ClimaVal>(atual.clima_noite ?? null);
  const [justificativa, setJustificativa] = useState("");
  const fn = useServerFn(updateRdoClimaRascunho);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () => fn({ data: {
      rdo_id: rdoId,
      clima_manha: manha,
      clima_tarde: tarde,
      clima_noite: noite,
      justificativa: justificativa.trim(),
    } }),
    onSuccess: () => {
      toast.success("Previsão atualizada e registrada na auditoria");
      setOpen(false);
      setJustificativa("");
      qc.invalidateQueries({ queryKey: ["rdo", rdoId] });
      qc.invalidateQueries({ queryKey: ["rdo-logs", rdoId] });
      qc.invalidateQueries({ queryKey: ["rdo-audit", rdoId] });
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar previsão"),
  });

  const opcoes: { value: Exclude<ClimaVal, null>; label: string }[] = [
    { value: "ensolarado", label: "Ensolarado" },
    { value: "nublado", label: "Nublado" },
    { value: "chuvoso", label: "Chuvoso" },
    { value: "chuva_forte", label: "Chuva forte" },
    { value: "impraticavel", label: "Impraticável" },
  ];

  const Selector = ({ label, value, onChange }: { label: string; value: ClimaVal; onChange: (v: ClimaVal) => void }) => (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground uppercase tracking-wider">{label}</span>
      <select
        className="border rounded-md px-2 py-1.5 text-sm bg-background"
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value || null) as ClimaVal)}
      >
        <option value="">—</option>
        {opcoes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Cloud className="h-4 w-4 mr-1" /> Editar previsão do tempo
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Editar previsão do tempo (rascunho)</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground text-xs">
            A alteração ficará registrada na auditoria e aparecerá no relatório (PDF) com o valor anterior, o novo valor e a justificativa.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Selector label="Manhã" value={manha} onChange={setManha} />
            <Selector label="Tarde" value={tarde} onChange={setTarde} />
            <Selector label="Noite" value={noite} onChange={setNoite} />
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Justificativa (obrigatória)</span>
            <Textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex.: corrigindo previsão após observação no canteiro às 14h."
              rows={3}
            />
          </label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mut.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); mut.mutate(); }}
            disabled={mut.isPending || justificativa.trim().length < 5}
          >
            {mut.isPending ? "Salvando…" : "Salvar e registrar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
