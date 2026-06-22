import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { listObras } from "@/lib/obras.functions";
import { listMaoDeObra, listEquipamentos, listTiposOcorrencia } from "@/lib/cadastros.functions";
import { createRdo } from "@/lib/rdo.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, X } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({ obra: z.string().optional() });

export const Route = createFileRoute("/_authenticated/rdo/novo")({
  validateSearch: searchSchema,
  component: NovoRdoPage,
});

const climas = [
  { value: "ensolarado", label: "Ensolarado" },
  { value: "nublado", label: "Nublado" },
  { value: "chuvoso", label: "Chuvoso" },
  { value: "chuva_forte", label: "Chuva forte" },
  { value: "impraticavel", label: "Impraticável" },
];

function NovoRdoPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/rdo/novo" });
  const obrasFn = useServerFn(listObras);
  const maoFn = useServerFn(listMaoDeObra);
  const equipFn = useServerFn(listEquipamentos);
  const tiposFn = useServerFn(listTiposOcorrencia);
  const createFn = useServerFn(createRdo);

  const { data: obras = [] } = useQuery({ queryKey: ["obras"], queryFn: () => obrasFn() });
  const { data: maoOpts = [] } = useQuery({ queryKey: ["mao_de_obra"], queryFn: () => maoFn() });
  const { data: equipOpts = [] } = useQuery({ queryKey: ["equipamentos"], queryFn: () => equipFn() });
  const { data: tiposOpts = [] } = useQuery({ queryKey: ["tipos_ocorrencia"], queryFn: () => tiposFn() });

  const [form, setForm] = useState<any>({
    obra_id: search.obra ?? "",
    data: new Date().toISOString().slice(0, 10),
    clima_manha: null, clima_tarde: null, clima_noite: null,
    observacoes: "",
    atividades: [] as any[],
    mao_de_obra: [] as any[],
    equipamentos: [] as any[],
    ocorrencias: [] as any[],
  });

  const save = useMutation({
    mutationFn: (enviar: boolean) => createFn({ data: { ...form, enviar } }),
    onSuccess: (rdo: any) => { toast.success("RDO criado"); navigate({ to: "/rdo/$rdoId", params: { rdoId: rdo.id } }); },
    onError: (e: any) => toast.error(e.message),
  });

  function add(key: string, item: any) { setForm({ ...form, [key]: [...form[key], item] }); }
  function rm(key: string, idx: number) { setForm({ ...form, [key]: form[key].filter((_: any, i: number) => i !== idx) }); }
  function upd(key: string, idx: number, field: string, value: any) {
    setForm({ ...form, [key]: form[key].map((it: any, i: number) => i === idx ? { ...it, [field]: value } : it) });
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link to="/rdo" className="text-sm text-muted-foreground hover:underline flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> RDOs
      </Link>
      <h1 className="font-serif text-3xl mb-6">Novo RDO</h1>

      <div className="space-y-4">
        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Obra</Label>
              <Select value={form.obra_id} onValueChange={(v) => setForm({ ...form, obra_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(obras as any[]).map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            {(["manha", "tarde", "noite"] as const).map((p) => (
              <div key={p}>
                <Label className="capitalize">Clima {p}</Label>
                <Select value={form[`clima_${p}`] ?? ""} onValueChange={(v) => setForm({ ...form, [`clima_${p}`]: v || null })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {climas.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div>
            <Label>Observações gerais</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={3} />
          </div>
        </Card>

        {/* Atividades */}
        <Section title="Atividades" onAdd={() => add("atividades", { descricao: "", pct_executado: 0 })}>
          {form.atividades.map((it: any, i: number) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-8"><Label className="text-xs">Descrição</Label><Input value={it.descricao} onChange={(e) => upd("atividades", i, "descricao", e.target.value)} /></div>
              <div className="col-span-3"><Label className="text-xs">% executado</Label><Input type="number" min={0} max={100} value={it.pct_executado} onChange={(e) => upd("atividades", i, "pct_executado", Number(e.target.value))} /></div>
              <RmBtn onClick={() => rm("atividades", i)} />
            </div>
          ))}
        </Section>

        {/* Mão de obra */}
        <Section title="Mão de obra" onAdd={() => add("mao_de_obra", { mao_de_obra_id: "", horas: 8, atividade: "" })}>
          {form.mao_de_obra.map((it: any, i: number) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5"><Label className="text-xs">Pessoa</Label>
                <Select value={it.mao_de_obra_id} onValueChange={(v) => upd("mao_de_obra", i, "mao_de_obra_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {(maoOpts as any[]).map((m) => <SelectItem key={m.id} value={m.id}>{m.nome} — {m.funcao}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-4"><Label className="text-xs">Atividade</Label><Input value={it.atividade ?? ""} onChange={(e) => upd("mao_de_obra", i, "atividade", e.target.value)} /></div>
              <div className="col-span-2"><Label className="text-xs">Horas</Label><Input type="number" step={0.5} value={it.horas} onChange={(e) => upd("mao_de_obra", i, "horas", Number(e.target.value))} /></div>
              <RmBtn onClick={() => rm("mao_de_obra", i)} />
            </div>
          ))}
        </Section>

        {/* Equipamentos */}
        <Section title="Equipamentos" onAdd={() => add("equipamentos", { equipamento_id: "", horas_uso: 0, status_uso: "" })}>
          {form.equipamentos.map((it: any, i: number) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5"><Label className="text-xs">Equipamento</Label>
                <Select value={it.equipamento_id} onValueChange={(v) => upd("equipamentos", i, "equipamento_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {(equipOpts as any[]).map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-4"><Label className="text-xs">Observação</Label><Input value={it.status_uso ?? ""} onChange={(e) => upd("equipamentos", i, "status_uso", e.target.value)} /></div>
              <div className="col-span-2"><Label className="text-xs">Horas</Label><Input type="number" step={0.5} value={it.horas_uso} onChange={(e) => upd("equipamentos", i, "horas_uso", Number(e.target.value))} /></div>
              <RmBtn onClick={() => rm("equipamentos", i)} />
            </div>
          ))}
        </Section>

        {/* Ocorrências */}
        <Section title="Ocorrências" onAdd={() => add("ocorrencias", { tipo_ocorrencia_id: null, descricao: "" })}>
          {form.ocorrencias.map((it: any, i: number) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4"><Label className="text-xs">Tipo</Label>
                <Select value={it.tipo_ocorrencia_id ?? ""} onValueChange={(v) => upd("ocorrencias", i, "tipo_ocorrencia_id", v || null)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {(tiposOpts as any[]).map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-7"><Label className="text-xs">Descrição</Label><Input value={it.descricao} onChange={(e) => upd("ocorrencias", i, "descricao", e.target.value)} /></div>
              <RmBtn onClick={() => rm("ocorrencias", i)} />
            </div>
          ))}
        </Section>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" disabled={!form.obra_id || save.isPending} onClick={() => save.mutate(false)}>Salvar rascunho</Button>
          <Button className="bg-brand text-brand-foreground" disabled={!form.obra_id || save.isPending} onClick={() => save.mutate(true)}>Enviar para aprovação</Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd: () => void }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-lg">{title}</h3>
        <Button size="sm" variant="outline" onClick={onAdd}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>
      </div>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

function RmBtn({ onClick }: { onClick: () => void }) {
  return <Button size="icon" variant="ghost" className="col-span-1 text-destructive" onClick={onClick}><X className="h-4 w-4" /></Button>;
}
