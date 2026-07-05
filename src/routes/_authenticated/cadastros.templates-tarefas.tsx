import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CadastroLayout, CrudTable } from "@/components/cadastro-helpers";
import { NewBadge } from "@/components/NewBadge";
import { Upload } from "lucide-react";
import { listTemplates, upsertTemplate, deleteTemplate } from "@/lib/templates-tarefas.functions";

export const Route = createFileRoute("/_authenticated/cadastros/templates-tarefas")({
  component: TemplatesTarefasPage,
});

type Row = { id: string; nome: string; tipo_controle: string; ativo: boolean };

function TemplatesTarefasPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listTemplates);
  const upsertFn = useServerFn(upsertTemplate);
  const delFn = useServerFn(deleteTemplate);

  const { data = [] } = useQuery({ queryKey: ["templates_tarefas"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ id?: string; nome: string; tipo_controle: "porcentagem" | "produtividade" | "misto"; ativo: boolean }>({
    nome: "",
    tipo_controle: "porcentagem",
    ativo: true,
  });

  const save = useMutation({
    mutationFn: (d: typeof form) => upsertFn({ data: d }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["templates_tarefas"] });
      toast.success("Template salvo");
      setOpen(false);
      if (!form.id && r?.id) navigate({ to: "/cadastros/templates-tarefas/$id", params: { id: r.id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["templates_tarefas"] });
      toast.success("Removido");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <CadastroLayout
      title="Templates de Tarefas"
      subtitle="Modelos hierárquicos de tarefas, reutilizáveis entre obras."
      onNew={() => { setForm({ nome: "", tipo_controle: "porcentagem", ativo: true }); setOpen(true); }}
      extraActions={<NewBadge since="2026-07-05" />}
    >
      <CrudTable<Row>
        rows={data as Row[]}
        columns={[
          { key: "nome", label: "Nome", render: (r) => (
            <Link to="/cadastros/templates-tarefas/$id" params={{ id: r.id }} className="underline underline-offset-2">{r.nome}</Link>
          )},
          { key: "tipo_controle", label: "Controle" },
          { key: "ativo", label: "Ativo", render: (r) => r.ativo ? "Sim" : "Não" },
        ]}
        onEdit={(r) => { setForm({ id: r.id, nome: r.nome, tipo_controle: r.tipo_controle as any, ativo: r.ativo }); setOpen(true); }}
        onDelete={(r) => del.mutate(r.id)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Editar" : "Novo"} template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Tipo de controle</Label>
              <Select value={form.tipo_controle} onValueChange={(v) => setForm({ ...form, tipo_controle: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="porcentagem">Porcentagem</SelectItem>
                  <SelectItem value="produtividade">Produtividade</SelectItem>
                  <SelectItem value="misto">Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate(form)} disabled={!form.nome || save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CadastroLayout>
  );
}
