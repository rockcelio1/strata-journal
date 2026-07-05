import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listMaoDeObra, upsertMaoDeObra, deleteMaoDeObra, seedMaoDeObraPadrao } from "@/lib/cadastros.functions";
import { CadastroLayout, CrudDialog, CrudTable, FieldText, FieldSwitch } from "@/components/cadastro-helpers";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { NewBadge } from "@/components/NewBadge";

export const Route = createFileRoute("/_authenticated/cadastros/mao-de-obra")({
  component: MaoDeObraPage,
});

const empty = { nome: "", funcao: "", disciplina: "", empresa_terceira: "", contato: "", ativo: true };

function MaoDeObraPage() {
  const listFn = useServerFn(listMaoDeObra);
  const upFn = useServerFn(upsertMaoDeObra);
  const delFn = useServerFn(deleteMaoDeObra);
  const seedFn = useServerFn(seedMaoDeObraPadrao);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["mao_de_obra"], queryFn: () => listFn() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const save = useMutation({
    mutationFn: () => upFn({ data: { ...form, id: form.id ?? undefined, disciplina: form.disciplina || null, empresa_terceira: form.empresa_terceira || null, contato: form.contato || null } }),
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["mao_de_obra"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["mao_de_obra"] }); },
  });
  const seed = useMutation({
    mutationFn: () => seedFn(),
    onSuccess: () => { toast.success("Funções padrão adicionadas"); qc.invalidateQueries({ queryKey: ["mao_de_obra"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <CadastroLayout
      title="Mão de obra"
      subtitle="Equipe e empresas terceirizadas atuando nas obras"
      onNew={() => { setForm(empty); setOpen(true); }}
      extraActions={
        <>
          <NewBadge since="2026-07-05" label="Disciplinas" />
          <Button variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>
            <Sparkles className="h-4 w-4 mr-1" />Popular padrões
          </Button>
        </>
      }
    >
      <CrudTable
        rows={data as any[]}
        columns={[
          { key: "nome", label: "Nome" },
          { key: "funcao", label: "Função" },
          { key: "disciplina", label: "Disciplina", render: (r: any) => r.disciplina ?? "—" },
          { key: "empresa_terceira", label: "Empresa", render: (r: any) => r.empresa_terceira ?? "—" },
          { key: "ativo", label: "Ativo", render: (r: any) => r.ativo ? "Sim" : "Não" },
        ]}
        onEdit={(r: any) => { setForm({ ...r, disciplina: r.disciplina ?? "", empresa_terceira: r.empresa_terceira ?? "", contato: r.contato ?? "" }); setOpen(true); }}
        onDelete={(r: any) => del.mutate(r.id)}
      />
      <CrudDialog open={open} onOpenChange={setOpen} title={form.id ? "Editar" : "Nova mão de obra"} onSave={() => save.mutate()} saving={save.isPending} canSave={!!form.nome && !!form.funcao}>
        <FieldText label="Nome" value={form.nome} onChange={(v: string) => setForm({ ...form, nome: v })} />
        <FieldText label="Função" value={form.funcao} onChange={(v: string) => setForm({ ...form, funcao: v })} />
        <FieldText label="Disciplina" value={form.disciplina} onChange={(v: string) => setForm({ ...form, disciplina: v })} />
        <FieldText label="Empresa terceira" value={form.empresa_terceira} onChange={(v: string) => setForm({ ...form, empresa_terceira: v })} />
        <FieldText label="Contato" value={form.contato} onChange={(v: string) => setForm({ ...form, contato: v })} />
        <FieldSwitch label="Ativo" value={form.ativo} onChange={(v: boolean) => setForm({ ...form, ativo: v })} />
      </CrudDialog>
    </CadastroLayout>
  );
}
