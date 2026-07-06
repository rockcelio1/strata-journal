import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, X, Plus, GripVertical, ListChecks, History } from "lucide-react";
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  listListaTarefas, listObrasBasic, listListaTarefaHistorico,
  upsertListaTarefaItem, deleteListaTarefaItem, reorderListaTarefas,
} from "@/lib/lista-tarefas.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cadastros/lista-tarefas")({
  component: ListaTarefasPage,
});

type Item = {
  id: string;
  obra_id: string | null;
  parent_id: string | null;
  codigo: string;
  nome: string;
  is_etapa: boolean;
  percentual: number;
  ordem: number;
  ativo: boolean;
};

type FormState = {
  id?: string;
  obra_id: string | null;
  codigo: string;
  nome: string;
  is_etapa: boolean;
  percentual: number;
  ativo: boolean;
};

type FormErrors = Partial<Record<"obra_id" | "codigo" | "nome" | "percentual", string>>;

const CODIGO_RE = /^\d+(\.\d+)*$/;

const EMPTY_FORM: FormState = {
  obra_id: null, codigo: "", nome: "", is_etapa: false, percentual: 0, ativo: true,
};

function validate(f: FormState): FormErrors {
  const e: FormErrors = {};
  if (!f.obra_id) e.obra_id = "Selecione uma obra";
  if (!f.codigo.trim()) e.codigo = "Informe o código";
  else if (!CODIGO_RE.test(f.codigo.trim())) e.codigo = "Use formato 1, 1.0, 1.1.2…";
  if (f.nome.trim().length < 2) e.nome = "Nome muito curto";
  if (f.percentual < 0 || f.percentual > 100) e.percentual = "0 a 100";
  return e;
}

function ListaTarefasPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listListaTarefas);
  const obrasFn = useServerFn(listObrasBasic);
  const upsertFn = useServerFn(upsertListaTarefaItem);
  const delFn = useServerFn(deleteListaTarefaItem);
  const reorderFn = useServerFn(reorderListaTarefas);

  const [obraFiltro, setObraFiltro] = useState<string>("");

  const { data: obras = [] } = useQuery({
    queryKey: ["obras_basic"],
    queryFn: () => obrasFn(),
  });
  const obrasList = obras as Array<{ id: string; nome: string }>;

  const { data = [] } = useQuery({
    queryKey: ["lista_tarefas", obraFiltro || "all"],
    queryFn: () => listFn({ data: obraFiltro ? { obra_id: obraFiltro } : {} }),
    enabled: true,
  });
  const items = data as Item[];

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todas" | "etapas" | "tarefas">("todas");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [historyOpen, setHistoryOpen] = useState<Item | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (filter === "etapas" && !it.is_etapa) return false;
      if (filter === "tarefas" && it.is_etapa) return false;
      if (hideCompleted && Number(it.percentual) >= 100) return false;
      if (!q) return true;
      return it.codigo.toLowerCase().includes(q) || it.nome.toLowerCase().includes(q);
    });
  }, [items, search, filter, hideCompleted]);

  const totals = useMemo(() => {
    const total = items.length;
    const naoIniciada = items.filter((i) => Number(i.percentual) === 0).length;
    const emAndamento = items.filter((i) => Number(i.percentual) > 0 && Number(i.percentual) < 100).length;
    const concluida = items.filter((i) => Number(i.percentual) >= 100).length;
    const realizado = total > 0
      ? Math.round((items.reduce((s, i) => s + Number(i.percentual || 0), 0) / (total * 100)) * 10000) / 100
      : 0;
    return { total, naoIniciada, emAndamento, concluida, realizado };
  }, [items]);

  const save = useMutation({
    mutationFn: (d: FormState) => upsertFn({ data: d }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["lista_tarefas"] });
      toast.success("Tarefa salva");
      setOpen(false);
      setForm(EMPTY_FORM);
      setErrors({});
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["lista_tarefas"] });
      toast.success("Removido");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const reorder = useMutation({
    mutationFn: (order: string[]) => reorderFn({ data: { order } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lista_tarefas"] });
      toast.success("Ordem atualizada", { duration: 1200 });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao reordenar"),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = filtered.map((i) => i.id);
    const from = ids.indexOf(String(e.active.id));
    const to = ids.indexOf(String(e.over.id));
    if (from < 0 || to < 0) return;
    const newIds = arrayMove(ids, from, to);
    const outside = items.filter((i) => !ids.includes(i.id)).map((i) => i.id);
    reorder.mutate([...outside, ...newIds]);
  }

  function openNew() {
    setForm({ ...EMPTY_FORM, obra_id: obraFiltro || null });
    setErrors({});
    setOpen(true);
  }
  function openEdit(it: Item) {
    setForm({
      id: it.id,
      obra_id: it.obra_id,
      codigo: it.codigo,
      nome: it.nome,
      is_etapa: it.is_etapa,
      percentual: Number(it.percentual),
      ativo: it.ativo,
    });
    setErrors({});
    setOpen(true);
  }

  function trySubmit() {
    const eobj = validate(form);
    setErrors(eobj);
    if (Object.keys(eobj).length) {
      toast.error("Corrija os campos destacados");
      return;
    }
    save.mutate({ ...form, codigo: form.codigo.trim(), nome: form.nome.trim() });
  }

  const obraNome = (id: string | null) =>
    id ? obrasList.find((o) => o.id === id)?.nome ?? "—" : "—";

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl">Lista de tarefas</h1>
          <p className="text-sm text-muted-foreground">Catálogo de etapas e tarefas por obra</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={reordering ? "default" : "outline"}
            onClick={() => setReordering((v) => !v)}
            className={cn(reordering && "bg-brand text-brand-foreground")}
          >
            <GripVertical className="h-4 w-4 mr-1" /> Reordenar
          </Button>
          <Button onClick={openNew} className="bg-brand text-brand-foreground">
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>
      </header>

      <Card className="p-3 md:p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_220px_auto] gap-3 items-center">
          <Input placeholder="Pesquisa" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={obraFiltro || "__all"} onValueChange={(v) => setObraFiltro(v === "__all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Obra" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas as obras</SelectItem>
              {obrasList.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as tarefas</SelectItem>
              <SelectItem value="etapas">Somente etapas</SelectItem>
              <SelectItem value="tarefas">Somente tarefas</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <Checkbox checked={hideCompleted} onCheckedChange={(v) => setHideCompleted(!!v)} />
            Ocultar concluídas
          </label>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total" value={totals.total} />
        <StatCard label="Não iniciada" value={totals.naoIniciada} />
        <StatCard label="Em andamento" value={totals.emAndamento} />
        <StatCard label="Concluída" value={totals.concluida} />
        <StatCard label="Realizado" value={`${totals.realizado.toFixed(2)}%`} />
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <ListChecks className="h-8 w-8 opacity-40" />
            Nenhuma tarefa cadastrada{obraFiltro ? " para esta obra" : ""}.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={filtered.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-border">
                {filtered.map((it) => (
                  <Row
                    key={it.id}
                    item={it}
                    obraNome={obraNome(it.obra_id)}
                    reordering={reordering}
                    onEdit={() => openEdit(it)}
                    onDelete={() => del.mutate(it.id)}
                    onHistory={() => setHistoryOpen(it)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label>Obra *</Label>
              <Select
                value={form.obra_id ?? ""}
                onValueChange={(v) => setForm({ ...form, obra_id: v || null })}
              >
                <SelectTrigger className={cn(errors.obra_id && "border-destructive")}>
                  <SelectValue placeholder="Selecione a obra" />
                </SelectTrigger>
                <SelectContent>
                  {obrasList.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.obra_id && <p className="text-xs text-destructive mt-1">{errors.obra_id}</p>}
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <div>
                <Label>Código *</Label>
                <Input
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  placeholder="1.0"
                  className={cn(errors.codigo && "border-destructive")}
                />
                {errors.codigo && <p className="text-xs text-destructive mt-1">{errors.codigo}</p>}
              </div>
              <div>
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className={cn(errors.nome && "border-destructive")}
                />
                {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Progresso (%)</Label>
                <Input
                  type="number" min={0} max={100} step={1} inputMode="numeric"
                  value={form.percentual}
                  onChange={(e) => setForm({ ...form, percentual: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                  className={cn(errors.percentual && "border-destructive")}
                />
                {errors.percentual && <p className="text-xs text-destructive mt-1">{errors.percentual}</p>}
              </div>
              <div className="flex flex-col justify-end gap-2 pb-1">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.is_etapa} onCheckedChange={(v) => setForm({ ...form, is_etapa: !!v })} />
                  É uma etapa (linha destacada)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: !!v })} />
                  Ativo
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={trySubmit} disabled={save.isPending} className="bg-brand text-brand-foreground">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HistoryDialog item={historyOpen} onClose={() => setHistoryOpen(null)} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-3 text-center">
      <div className="text-2xl font-semibold text-brand">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}

function Row({
  item, obraNome, reordering, onEdit, onDelete, onHistory,
}: {
  item: Item; obraNome: string; reordering: boolean;
  onEdit: () => void; onDelete: () => void; onHistory: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const pct = Math.min(100, Math.max(0, Number(item.percentual) || 0));

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "grid grid-cols-[auto_60px_1fr_140px_120px_auto] items-center gap-3 px-3 md:px-4 py-2.5 text-sm",
        item.is_etapa && "bg-muted/50 font-semibold",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Arrastar"
        className={cn(
          "h-6 w-6 grid place-items-center rounded text-muted-foreground",
          reordering ? "cursor-grab active:cursor-grabbing hover:bg-muted" : "opacity-30 cursor-not-allowed",
        )}
        disabled={!reordering}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="tabular-nums text-muted-foreground">{item.codigo}</span>
      <span className="truncate">{item.nome}</span>
      <span className="truncate text-xs text-muted-foreground">{obraNome}</span>
      <div className="flex items-center gap-2">
        <Progress value={pct} className="h-2" />
        <span className="tabular-nums text-xs text-muted-foreground w-10 text-right">{pct}%</span>
      </div>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" onClick={onHistory} aria-label="Histórico">
          <History className="h-4 w-4 text-muted-foreground" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Editar">
          <Pencil className="h-4 w-4 text-brand" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Excluir">
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover tarefa?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}

function HistoryDialog({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const histFn = useServerFn(listListaTarefaHistorico);
  const { data = [], isLoading } = useQuery({
    queryKey: ["lista_tarefas_hist", item?.id],
    queryFn: () => histFn({ data: { item_id: item!.id } }),
    enabled: !!item,
  });
  const rows = data as Array<{
    id: string; percentual_anterior: number | null; percentual_novo: number;
    created_at: string; autor: { nome: string | null; email: string | null } | null;
  }>;

  return (
    <Dialog open={!!item} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Histórico de progresso {item ? `— ${item.codigo} ${item.nome}` : ""}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
        ) : (
          <ul className="divide-y divide-border max-h-[60vh] overflow-y-auto">
            {rows.map((r) => (
              <li key={r.id} className="py-2 text-sm flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {r.percentual_anterior ?? 0}% → {r.percentual_novo}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.autor?.nome ?? r.autor?.email ?? "—"}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {new Date(r.created_at).toLocaleString("pt-BR")}
                </div>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
