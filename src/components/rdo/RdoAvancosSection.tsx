import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { NewBadge } from "@/components/NewBadge";
import { listRdoAvancos, saveRdoAvancos } from "@/lib/rdo-avancos.functions";

type Avanco = {
  id?: string;
  _key: string;
  task_item_id: string | null;
  task_list_id: string | null;
  item_code: string | null;
  descricao: string;
  unidade: string | null;
  planned_quantity: number | null;
  realized_today: number | null;
  accumulated_percent: number | null;
  status: "nao_iniciada" | "em_andamento" | "concluida" | "paralisada" | "cancelada";
  total_hours: number | null;
  comment: string | null;
};

const uid = () => Math.random().toString(36).slice(2);

export function RdoAvancosSection({ rdoId, obraId, readOnly }: { rdoId: string; obraId: string; readOnly?: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listRdoAvancos);
  const saveFn = useServerFn(saveRdoAvancos);
  const { data } = useQuery({
    queryKey: ["rdo-avancos", rdoId, obraId],
    queryFn: () => listFn({ data: { rdo_id: rdoId, obra_id: obraId } }),
  });

  const [rows, setRows] = useState<Avanco[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);

  useEffect(() => {
    if (data?.avancos) {
      setRows(data.avancos.map((a: any) => ({
        ...a, _key: a.id,
        realized_today: a.realized_today != null ? Number(a.realized_today) : null,
        accumulated_percent: a.accumulated_percent != null ? Number(a.accumulated_percent) : null,
        planned_quantity: a.planned_quantity != null ? Number(a.planned_quantity) : null,
        total_hours: null,
      })));
      setRemoved([]);
    }
  }, [data]);

  const itens = data?.itens ?? [];

  const addFromList = (itemId: string) => {
    const it = itens.find((x: any) => x.id === itemId);
    if (!it) return;
    setRows((p) => [...p, {
      _key: uid(), task_item_id: it.id, task_list_id: it.task_list_id,
      item_code: it.item_code, descricao: it.descricao, unidade: it.unidade,
      planned_quantity: it.planned_quantity != null ? Number(it.planned_quantity) : null,
      realized_today: null, accumulated_percent: it.percent_complete != null ? Number(it.percent_complete) : 0,
      status: "em_andamento", total_hours: null, comment: null,
    }]);
  };

  const addAvulsa = () => setRows((p) => [...p, {
    _key: uid(), task_item_id: null, task_list_id: null, item_code: null,
    descricao: "", unidade: null, planned_quantity: null, realized_today: null,
    accumulated_percent: 0, status: "em_andamento", total_hours: null, comment: null,
  }]);

  const update = (k: string, patch: Partial<Avanco>) =>
    setRows((p) => p.map((r) => r._key === k ? { ...r, ...patch } : r));

  const removeRow = (k: string) => {
    const found = rows.find((r) => r._key === k);
    setRows((p) => p.filter((r) => r._key !== k));
    if (found?.id) setRemoved((r) => [...r, found.id!]);
  };

  const save = useMutation({
    mutationFn: () => saveFn({ data: {
      rdo_id: rdoId, obra_id: obraId,
      avancos: rows.map((r) => ({
        id: r.id, task_item_id: r.task_item_id, task_list_id: r.task_list_id,
        item_code: r.item_code, descricao: r.descricao, unidade: r.unidade,
        planned_quantity: r.planned_quantity, realized_today: r.realized_today,
        accumulated_percent: r.accumulated_percent, status: r.status,
        total_hours: r.total_hours, comment: r.comment,
      })),
      removed_ids: removed,
    } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["rdo-avancos", rdoId, obraId] });
      toast.success("Avanços salvos");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg flex items-center gap-2">Avanços de tarefas <NewBadge since="2026-07-05" /></h2>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Select onValueChange={addFromList}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Adicionar da lista…" /></SelectTrigger>
              <SelectContent>
                {itens.length === 0 && <div className="p-2 text-xs text-muted-foreground">Nenhuma tarefa na obra</div>}
                {itens.map((it: any) => (
                  <SelectItem key={it.id} value={it.id}>{it.item_code} — {it.descricao}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={addAvulsa}><Plus className="h-4 w-4 mr-1" />Avulsa</Button>
            <Button size="sm" className="bg-brand text-brand-foreground" disabled={save.isPending} onClick={() => save.mutate()}>Salvar</Button>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Nenhum avanço registrado.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r._key} className="grid grid-cols-12 gap-2 items-start border-b border-border pb-2 last:border-0">
              <div className="col-span-4">
                <Input value={r.descricao} disabled={readOnly || !!r.task_item_id}
                  onChange={(e) => update(r._key, { descricao: e.target.value })}
                  placeholder="Descrição" />
                {r.item_code && <div className="text-xs text-muted-foreground mt-1">Cód. {r.item_code}</div>}
              </div>
              <div className="col-span-2">
                <Input type="number" step="any" placeholder="Realizado hoje" value={r.realized_today ?? ""} disabled={readOnly}
                  onChange={(e) => update(r._key, { realized_today: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div className="col-span-2">
                <Input type="number" step="any" placeholder="% acumulado" value={r.accumulated_percent ?? ""} disabled={readOnly}
                  onChange={(e) => update(r._key, { accumulated_percent: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div className="col-span-2">
                <Select value={r.status} disabled={readOnly} onValueChange={(v) => update(r._key, { status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_iniciada">Não iniciada</SelectItem>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                    <SelectItem value="paralisada">Paralisada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1">
                <Input type="number" step="any" placeholder="h" value={r.total_hours ?? ""} disabled={readOnly}
                  onChange={(e) => update(r._key, { total_hours: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div className="col-span-1 text-right">
                {!readOnly && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeRow(r._key)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="col-span-12">
                <Textarea placeholder="Comentário" rows={1} value={r.comment ?? ""} disabled={readOnly}
                  onChange={(e) => update(r._key, { comment: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
