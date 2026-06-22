import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listEquipamentos, upsertEquipamento, deleteEquipamento } from "@/lib/cadastros.functions";
import { CadastroLayout, CrudDialog, CrudTable, FieldText, FieldSwitch, FieldSelect, FieldTextarea } from "@/components/cadastro-helpers";
import { Badge } from "@/components/ui/badge";
import { equipStatusMeta } from "@/components/status";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cadastros/equipamentos")({
  component: EquipPage,
});

const empty = { nome: "", tipo: "", identificacao: "", status: "disponivel", observacoes: "", ativo: true };

function EquipPage() {
  const listFn = useServerFn(listEquipamentos);
  const upFn = useServerFn(upsertEquipamento);
  const delFn = useServerFn(deleteEquipamento);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["equipamentos"], queryFn: () => listFn() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const save = useMutation({
    mutationFn: () => upFn({ data: { ...form, id: form.id ?? undefined, tipo: form.tipo || null, identificacao: form.identificacao || null, observacoes: form.observacoes || null } }),
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["equipamentos"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["equipamentos"] }); },
  });

  return (
    <CadastroLayout title="Equipamentos" subtitle="Máquinas e ferramentas disponíveis para alocação" onNew={() => { setForm(empty); setOpen(true); }}>
      <CrudTable
        rows={data as any[]}
        columns={[
          { key: "nome", label: "Nome" },
          { key: "tipo", label: "Tipo", render: (r: any) => r.tipo ?? "—" },
          { key: "identificacao", label: "Identificação", render: (r: any) => r.identificacao ?? "—" },
          { key: "status", label: "Status", render: (r: any) => {
            const m = equipStatusMeta[r.status as keyof typeof equipStatusMeta];
            return <Badge variant="outline" className={m.className}>{m.label}</Badge>;
          } },
        ]}
        onEdit={(r: any) => { setForm({ ...r, tipo: r.tipo ?? "", identificacao: r.identificacao ?? "", observacoes: r.observacoes ?? "" }); setOpen(true); }}
        onDelete={(r: any) => del.mutate(r.id)}
      />
      <CrudDialog open={open} onOpenChange={setOpen} title={form.id ? "Editar equipamento" : "Novo equipamento"} onSave={() => save.mutate()} saving={save.isPending} canSave={!!form.nome}>
        <FieldText label="Nome" value={form.nome} onChange={(v: string) => setForm({ ...form, nome: v })} />
        <FieldText label="Tipo" value={form.tipo} onChange={(v: string) => setForm({ ...form, tipo: v })} />
        <FieldText label="Identificação / nº de série" value={form.identificacao} onChange={(v: string) => setForm({ ...form, identificacao: v })} />
        <FieldSelect label="Status" value={form.status} onChange={(v: string) => setForm({ ...form, status: v })} options={[
          { value: "disponivel", label: "Disponível" },
          { value: "em_uso", label: "Em uso" },
          { value: "manutencao", label: "Manutenção" },
        ]} />
        <FieldTextarea label="Observações" value={form.observacoes} onChange={(v: string) => setForm({ ...form, observacoes: v })} />
        <FieldSwitch label="Ativo" value={form.ativo} onChange={(v: boolean) => setForm({ ...form, ativo: v })} />
      </CrudDialog>
    </CadastroLayout>
  );
}
