import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listTiposOcorrencia, upsertTipoOcorrencia, deleteTipoOcorrencia, seedTiposOcorrenciaPadrao } from "@/lib/cadastros.functions";
import { CadastroLayout, CrudDialog, CrudTable, FieldText, FieldSwitch, FieldSelect, FieldTextarea } from "@/components/cadastro-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { severidadeMeta } from "@/components/status";
import { toast } from "sonner";
import { NewBadge } from "@/components/NewBadge";

export const Route = createFileRoute("/_authenticated/cadastros/ocorrencias")({
  component: TiposOcorrenciaPage,
});

const empty = { nome: "", severidade: "media", descricao: "", ativo: true };

function TiposOcorrenciaPage() {
  const listFn = useServerFn(listTiposOcorrencia);
  const upFn = useServerFn(upsertTipoOcorrencia);
  const delFn = useServerFn(deleteTipoOcorrencia);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["tipos_ocorrencia"], queryFn: () => listFn() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const save = useMutation({
    mutationFn: () => upFn({ data: { ...form, id: form.id ?? undefined, descricao: form.descricao || null } }),
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["tipos_ocorrencia"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["tipos_ocorrencia"] }); },
  });

  return (
    <CadastroLayout title="Tipos de ocorrência" subtitle="Catálogo usado pelos RDOs para classificar eventos no canteiro" onNew={() => { setForm(empty); setOpen(true); }}>
      <CrudTable
        rows={data as any[]}
        columns={[
          { key: "nome", label: "Nome" },
          { key: "severidade", label: "Severidade", render: (r: any) => {
            const m = severidadeMeta[r.severidade as keyof typeof severidadeMeta];
            return <Badge variant="outline" className={m.className}>{m.label}</Badge>;
          } },
          { key: "descricao", label: "Descrição", render: (r: any) => r.descricao ?? "—" },
          { key: "ativo", label: "Ativo", render: (r: any) => r.ativo ? "Sim" : "Não" },
        ]}
        onEdit={(r: any) => { setForm({ ...r, descricao: r.descricao ?? "" }); setOpen(true); }}
        onDelete={(r: any) => del.mutate(r.id)}
      />
      <CrudDialog open={open} onOpenChange={setOpen} title={form.id ? "Editar tipo" : "Novo tipo"} onSave={() => save.mutate()} saving={save.isPending} canSave={!!form.nome}>
        <FieldText label="Nome" value={form.nome} onChange={(v: string) => setForm({ ...form, nome: v })} />
        <FieldSelect label="Severidade" value={form.severidade} onChange={(v: string) => setForm({ ...form, severidade: v })} options={[
          { value: "baixa", label: "Baixa" },
          { value: "media", label: "Média" },
          { value: "alta", label: "Alta" },
          { value: "critica", label: "Crítica" },
        ]} />
        <FieldTextarea label="Descrição" value={form.descricao} onChange={(v: string) => setForm({ ...form, descricao: v })} />
        <FieldSwitch label="Ativo" value={form.ativo} onChange={(v: boolean) => setForm({ ...form, ativo: v })} />
      </CrudDialog>
    </CadastroLayout>
  );
}
