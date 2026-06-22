import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createObra, updateObra } from "@/lib/obras.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

export function ObraDialog({ open, onOpenChange, obra }: { open: boolean; onOpenChange: (v: boolean) => void; obra: any | null }) {
  const createFn = useServerFn(createObra);
  const updateFn = useServerFn(updateObra);
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    nome: "", codigo: "", cliente: "", endereco: "", data_inicio: "", data_previsao_fim: "",
    status: "planejamento", avanco_pct: 0, descricao: "",
  });

  useEffect(() => {
    if (open) {
      setForm(obra ? {
        ...obra,
        codigo: obra.codigo ?? "", cliente: obra.cliente ?? "", endereco: obra.endereco ?? "",
        data_inicio: obra.data_inicio ?? "", data_previsao_fim: obra.data_previsao_fim ?? "",
        descricao: obra.descricao ?? "", avanco_pct: Number(obra.avanco_pct),
      } : {
        nome: "", codigo: "", cliente: "", endereco: "", data_inicio: "", data_previsao_fim: "",
        status: "planejamento", avanco_pct: 0, descricao: "",
      });
    }
  }, [open, obra]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome,
        codigo: form.codigo || null,
        cliente: form.cliente || null,
        endereco: form.endereco || null,
        data_inicio: form.data_inicio || null,
        data_previsao_fim: form.data_previsao_fim || null,
        status: form.status,
        avanco_pct: Number(form.avanco_pct),
        descricao: form.descricao || null,
      };
      if (obra) return updateFn({ data: { ...payload, id: obra.id } });
      return createFn({ data: payload });
    },
    onSuccess: () => {
      toast.success(obra ? "Obra atualizada" : "Obra criada");
      qc.invalidateQueries({ queryKey: ["obras"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{obra ? "Editar obra" : "Nova obra"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div>
              <Label>Código</Label>
              <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            </div>
            <div>
              <Label>Cliente</Label>
              <Input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Endereço</Label>
              <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
            </div>
            <div>
              <Label>Início</Label>
              <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
            </div>
            <div>
              <Label>Previsão fim</Label>
              <Input type="date" value={form.data_previsao_fim} onChange={(e) => setForm({ ...form, data_previsao_fim: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planejamento">Planejamento</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="pausada">Pausada</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Avanço ({Number(form.avanco_pct).toFixed(0)}%)</Label>
              <Slider value={[Number(form.avanco_pct)]} min={0} max={100} step={1}
                onValueChange={(v) => setForm({ ...form, avanco_pct: v[0] })} className="mt-3" />
            </div>
            <div className="col-span-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.nome} className="bg-brand text-brand-foreground">
            {obra ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
