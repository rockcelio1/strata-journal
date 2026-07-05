import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { NewBadge } from "@/components/NewBadge";
import { ArrowLeft, Plus, Trash2, Upload, Download } from "lucide-react";
import { getTemplate, saveItens, commitImport } from "@/lib/templates-tarefas.functions";

export const Route = createFileRoute("/_authenticated/cadastros/templates-tarefas/$id")({
  component: TemplateEditor,
});

type Item = {
  id?: string;
  _key: string;
  item_code: string;
  descricao: string;
  unidade: string | null;
  planned_quantity: number | null;
  sort_order: number;
};

const uid = () => Math.random().toString(36).slice(2);

function TemplateEditor() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getTemplate);
  const saveFn = useServerFn(saveItens);
  const importFn = useServerFn(commitImport);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery({ queryKey: ["template", id], queryFn: () => getFn({ data: { id } }) });

  const [itens, setItens] = useState<Item[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);

  useEffect(() => {
    if (data?.itens) {
      setItens(data.itens.map((it: any) => ({ ...it, _key: it.id })));
      setRemoved([]);
    }
  }, [data]);

  const addRow = () => setItens((p) => [...p, {
    _key: uid(), item_code: "", descricao: "", unidade: "", planned_quantity: null, sort_order: p.length,
  }]);

  const removeRow = (k: string) => {
    setItens((p) => p.filter((r) => r._key !== k));
    const found = itens.find((r) => r._key === k);
    if (found?.id) setRemoved((r) => [...r, found.id!]);
  };

  const update = (k: string, patch: Partial<Item>) =>
    setItens((p) => p.map((r) => r._key === k ? { ...r, ...patch } : r));

  const save = useMutation({
    mutationFn: () => saveFn({ data: {
      template_id: id,
      itens: itens.map((it, idx) => ({
        id: it.id, item_code: it.item_code, descricao: it.descricao,
        unidade: it.unidade || null, planned_quantity: it.planned_quantity, sort_order: idx,
      })),
      removed_ids: removed,
    } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["template", id] });
      toast.success("Itens salvos");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const onFile = async (f: File) => {
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null });
      const parsed = rows.map((r) => ({
        item_code: String(r.item_code ?? r.codigo ?? r.code ?? "").trim(),
        descricao: String(r.descricao ?? r.description ?? r.desc ?? "").trim(),
        unidade: r.unidade ?? r.unit ?? null,
        planned_quantity: r.planned_quantity != null ? Number(r.planned_quantity) : (r.quantidade != null ? Number(r.quantidade) : null),
        sort_order: 0,
      })).filter((r) => r.item_code && r.descricao);
      if (!parsed.length) { toast.error("Nenhum item válido encontrado no arquivo"); return; }
      const res = await importFn({ data: { template_id: id, file_name: f.name, itens: parsed } });
      toast.success(`Importados: ${res.imported}. Erros: ${res.errors.length}`);
      await qc.invalidateQueries({ queryKey: ["template", id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao importar");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const downloadModel = () => {
    const ws = XLSX.utils.json_to_sheet([
      { item_code: "1", descricao: "Etapa exemplo", unidade: "", planned_quantity: "" },
      { item_code: "1.1", descricao: "Subtarefa exemplo", unidade: "m²", planned_quantity: 100 },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tarefas");
    XLSX.writeFile(wb, "modelo-tarefas.xlsx");
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="flex items-end justify-between mb-6 gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => nav({ to: "/cadastros/templates-tarefas" })}>
            <ArrowLeft className="h-4 w-4 mr-1" />Voltar
          </Button>
          <h1 className="font-serif text-3xl mt-2 flex items-center gap-2">
            {data?.template?.nome ?? "Template"} <NewBadge since="2026-07-05" />
          </h1>
          <p className="text-sm text-muted-foreground">Controle: {data?.template?.tipo_controle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadModel}>
            <Download className="h-4 w-4 mr-1" />Modelo .xlsx
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" />Importar
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-brand text-brand-foreground">
            Salvar
          </Button>
        </div>
      </header>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-2 w-32">Código</th>
              <th className="p-2">Descrição</th>
              <th className="p-2 w-24">Unidade</th>
              <th className="p-2 w-32">Qtd. prevista</th>
              <th className="p-2 w-px"></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it) => (
              <tr key={it._key} className="border-b border-border last:border-0">
                <td className="p-1"><Input value={it.item_code} onChange={(e) => update(it._key, { item_code: e.target.value })} /></td>
                <td className="p-1"><Input value={it.descricao} onChange={(e) => update(it._key, { descricao: e.target.value })} /></td>
                <td className="p-1"><Input value={it.unidade ?? ""} onChange={(e) => update(it._key, { unidade: e.target.value })} /></td>
                <td className="p-1"><Input type="number" step="any" value={it.planned_quantity ?? ""} onChange={(e) => update(it._key, { planned_quantity: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                <td className="p-1 text-right">
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeRow(it._key)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {itens.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum item. Clique em "Adicionar" ou importe do Excel.</td></tr>
            )}
          </tbody>
        </table>
        <div className="p-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4 mr-1" />Adicionar item
          </Button>
        </div>
      </Card>
    </div>
  );
}
