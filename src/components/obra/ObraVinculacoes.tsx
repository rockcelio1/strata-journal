import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Trash2, Upload, FileText, Plus } from "lucide-react";
import { listTemplates } from "@/lib/templates-tarefas.functions";
import {
  listObraTaskLists, createObraListFromTemplate, deleteObraList,
  listRecursos, toggleFuncaoPermitida, toggleEquipamentoPermitido,
  listObraAnexos, uploadObraAnexo, deleteObraAnexo,
} from "@/lib/obra-vinculacoes.functions";

type Tab = "listas" | "funcoes" | "equipamentos" | "anexos";

export function ObraVinculacoes({ obraId }: { obraId: string }) {
  const [tab, setTab] = useState<Tab>("listas");
  const tabs: { id: Tab; label: string }[] = [
    { id: "listas", label: "Listas de tarefas" },
    { id: "funcoes", label: "Funções permitidas" },
    { id: "equipamentos", label: "Equipamentos permitidos" },
    { id: "anexos", label: "Anexos / Projetos" },
  ];

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id ? "border-brand text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-4">
        {tab === "listas" && <ListasPanel obraId={obraId} />}
        {tab === "funcoes" && <FuncoesPanel obraId={obraId} />}
        {tab === "equipamentos" && <EquipamentosPanel obraId={obraId} />}
        {tab === "anexos" && <AnexosPanel obraId={obraId} />}
      </div>
    </Card>
  );
}

function ListasPanel({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listObraTaskLists);
  const tplFn = useServerFn(listTemplates);
  const createFn = useServerFn(createObraListFromTemplate);
  const delFn = useServerFn(deleteObraList);
  const { data } = useQuery({ queryKey: ["obra-listas", obraId], queryFn: () => listFn({ data: { obra_id: obraId } }) });
  const { data: templates = [] } = useQuery({ queryKey: ["templates_tarefas"], queryFn: () => tplFn() });
  const [templateId, setTemplateId] = useState<string>("");

  const add = useMutation({
    mutationFn: () => createFn({ data: { obra_id: obraId, template_id: templateId } }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["obra-listas", obraId] }); toast.success("Lista importada"); setTemplateId(""); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["obra-listas", obraId] }); toast.success("Removida"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const lists = data?.lists ?? [];
  const itens = data?.itens ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label>Importar template</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger><SelectValue placeholder="Selecione um template…" /></SelectTrigger>
            <SelectContent>
              {(templates as any[]).map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => add.mutate()} disabled={!templateId || add.isPending} className="bg-brand text-brand-foreground">
          <Plus className="h-4 w-4 mr-1" />Adicionar
        </Button>
      </div>

      {lists.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma lista vinculada.</div>
      ) : lists.map((l: any) => {
        const meus = itens.filter((it: any) => it.task_list_id === l.id);
        const total = meus.length;
        const feitos = meus.filter((it: any) => it.status === "concluida").length;
        const pct = total ? Math.round((feitos / total) * 100) : 0;
        return (
          <Card key={l.id} className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-medium">{l.nome}</div>
                <div className="text-xs text-muted-foreground">{l.tipo_controle} · {total} itens</div>
              </div>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(l.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Progress value={pct} className="h-2" />
            <div className="text-xs text-muted-foreground mt-1 tabular-nums">{pct}% concluído</div>
          </Card>
        );
      })}
    </div>
  );
}

function FuncoesPanel({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listRecursos);
  const toggleFn = useServerFn(toggleFuncaoPermitida);
  const { data } = useQuery({ queryKey: ["obra-recursos", obraId], queryFn: () => listFn({ data: { obra_id: obraId } }) });
  const set = new Set(data?.funcoesPermitidas ?? []);
  const toggle = useMutation({
    mutationFn: (p: { id: string; enabled: boolean }) => toggleFn({ data: { obra_id: obraId, mao_de_obra_id: p.id, enabled: p.enabled } }),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ["obra-recursos", obraId] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  return (
    <div className="space-y-2">
      {(data?.maoDeObra ?? []).length === 0 && <div className="text-sm text-muted-foreground">Nenhuma função cadastrada.</div>}
      {(data?.maoDeObra ?? []).map((mo: any) => (
        <label key={mo.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/40 cursor-pointer">
          <Checkbox checked={set.has(mo.id)} onCheckedChange={(v) => toggle.mutate({ id: mo.id, enabled: Boolean(v) })} />
          <div className="flex-1">
            <div className="text-sm">{mo.nome} — <span className="text-muted-foreground">{mo.funcao}</span></div>
            {mo.disciplina && <div className="text-xs text-muted-foreground">{mo.disciplina}</div>}
          </div>
        </label>
      ))}
    </div>
  );
}

function EquipamentosPanel({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listRecursos);
  const toggleFn = useServerFn(toggleEquipamentoPermitido);
  const { data } = useQuery({ queryKey: ["obra-recursos", obraId], queryFn: () => listFn({ data: { obra_id: obraId } }) });
  const set = new Set(data?.equipamentosPermitidos ?? []);
  const toggle = useMutation({
    mutationFn: (p: { id: string; enabled: boolean }) => toggleFn({ data: { obra_id: obraId, equipamento_id: p.id, enabled: p.enabled } }),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ["obra-recursos", obraId] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  return (
    <div className="space-y-2">
      {(data?.equipamentos ?? []).length === 0 && <div className="text-sm text-muted-foreground">Nenhum equipamento cadastrado.</div>}
      {(data?.equipamentos ?? []).map((eq: any) => (
        <label key={eq.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/40 cursor-pointer">
          <Checkbox checked={set.has(eq.id)} onCheckedChange={(v) => toggle.mutate({ id: eq.id, enabled: Boolean(v) })} />
          <div className="flex-1">
            <div className="text-sm">{eq.nome}{eq.tipo ? ` — ${eq.tipo}` : ""}</div>
            {eq.disciplina && <div className="text-xs text-muted-foreground">{eq.disciplina}</div>}
          </div>
        </label>
      ))}
    </div>
  );
}

function AnexosPanel({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listObraAnexos);
  const upFn = useServerFn(uploadObraAnexo);
  const delFn = useServerFn(deleteObraAnexo);
  const { data = [] } = useQuery({ queryKey: ["obra-anexos", obraId], queryFn: () => listFn({ data: { obra_id: obraId } }) });
  const [descricao, setDescricao] = useState("");
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      await upFn({ data: { obra_id: obraId, file_name: file.name, file_type: file.type || "application/octet-stream", descricao: descricao || null, base64 } });
      toast.success("Anexo enviado");
      setDescricao("");
      await qc.invalidateQueries({ queryKey: ["obra-anexos", obraId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload");
    } finally { setBusy(false); }
  };

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["obra-anexos", obraId] }); toast.success("Removido"); },
  });

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Textarea placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
        <label className="inline-flex">
          <input type="file" accept="application/pdf,image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background text-sm cursor-pointer hover:bg-muted ${busy ? "opacity-50 pointer-events-none" : ""}`}>
            <Upload className="h-4 w-4" />{busy ? "Enviando…" : "Enviar arquivo"}
          </span>
        </label>
      </div>
      {(data as any[]).length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Nenhum anexo.</div>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {(data as any[]).map((a) => (
            <li key={a.id} className="flex items-center gap-3 p-3">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{a.file_name}</div>
                {a.descricao && <div className="text-xs text-muted-foreground truncate">{a.descricao}</div>}
              </div>
              {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">Abrir</a>}
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(a.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
