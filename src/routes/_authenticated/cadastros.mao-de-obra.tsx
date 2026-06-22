import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listMaoDeObra, upsertMaoDeObra, deleteMaoDeObra } from "@/lib/cadastros.functions";
import { CadastroLayout, CrudDialog, CrudTable, FieldText, FieldSwitch } from "@/components/cadastro-helpers";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cadastros/mao-de-obra")({
  component: MaoDeObraPage,
});

const empty = { nome: "", funcao: "", empresa_terceira: "", contato: "", ativo: true };

function MaoDeObraPage() {
  const listFn = useServerFn(listMaoDeObra);
  const upFn = useServerFn(upsertMaoDeObra);
  const delFn = useServerFn(deleteMaoDeObra);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["mao_de_obra"], queryFn: () => listFn() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const save = useMutation({
    mutationFn: () => upFn({ data: { ...form, id: form.id ?? undefined, empresa_terceira: form.empresa_terceira || null, contato: form.contato || null } }),
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["mao_de_obra"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["mao_de_obra"] }); },
  });

  return (
    <CadastroLayout title="Mão de obra" subtitle="Equipe e empresas terceirizadas atuando nas obras" onNew={() => { setForm(empty); setOpen(true); }}>
      <CrudTable
        rows={data as any[]}
        columns={[
          { key: "nome", label: "Nome" },
          { key: "funcao", label: "Função" },
          { key: "empresa_terceira", label: "Empresa", render: (r: any) => r.empresa_terceira ?? "—" },
          { key: "contato", label: "Contato", render: (r: any) => r.contato ?? "—" },
          { key: "ativo", label: "Ativo", render: (r: any) => r.ativo ? "Sim" : "Não" },
        ]}
        onEdit={(r: any) => { setForm({ ...r, empresa_terceira: r.empresa_terceira ?? "", contato: r.contato ?? "" }); setOpen(true); }}
        onDelete={(r: any) => del.mutate(r.id)}
      />
      <CrudDialog open={open} onOpenChange={setOpen} title={form.id ? "Editar" : "Nova mão de obra"} onSave={() => save.mutate()} saving={save.isPending} canSave={!!form.nome && !!form.funcao}>
        <FieldText label="Nome" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} />
        <FieldText label="Função" value={form.funcao} onChange={(v) => setForm({ ...form, funcao: v })} />
        <FieldText label="Empresa terceira" value={form.empresa_terceira} onChange={(v) => setForm({ ...form, empresa_terceira: v })} />
        <FieldText label="Contato" value={form.contato} onChange={(v) => setForm({ ...form, contato: v })} />
        <FieldSwitch label="Ativo" value={form.ativo} onChange={(v) => setForm({ ...form, ativo: v })} />
      </CrudDialog>
    </CadastroLayout>
  );
}
