import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getRdo, submitRdo, approveRdo } from "@/lib/rdo.functions";
import { getMe } from "@/lib/core.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, XCircle, Send, Cloud } from "lucide-react";
import { rdoStatusMeta, severidadeMeta, climaLabel } from "@/components/status";
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
  const { data } = useQuery({ queryKey: ["rdo", rdoId], queryFn: () => fn({ data: { id: rdoId } }) });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const [motivo, setMotivo] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["rdo", rdoId] });
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

  if (!data) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  const r = data.rdo as any;
  const m = rdoStatusMeta[r.status as keyof typeof rdoStatusMeta];
  const canApprove = (me?.roles ?? []).some((x: string) => x === "admin" || x === "engenheiro");
  const isAuthor = r.autor?.id === me?.profile?.id;

  return (
    <div className="p-8 max-w-4xl mx-auto">
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
        <div className="flex gap-2">
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

      <div className="grid grid-cols-3 gap-3 mb-4">
        {(["manha", "tarde", "noite"] as const).map((p) => (
          <Card key={p} className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Cloud className="h-3 w-3" /> {p === "manha" ? "Manhã" : p === "tarde" ? "Tarde" : "Noite"}</div>
            <div className="text-sm mt-1">{r[`clima_${p}`] ? climaLabel[r[`clima_${p}`]] : "—"}</div>
          </Card>
        ))}
      </div>

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
