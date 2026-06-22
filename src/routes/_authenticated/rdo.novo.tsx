import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { listObras } from "@/lib/obras.functions";
import { listMaoDeObra, listEquipamentos, listTiposOcorrencia } from "@/lib/cadastros.functions";
import { createRdo, registrarAnexo } from "@/lib/rdo.functions";
import { getMe } from "@/lib/core.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Plus, X, Camera, Eraser, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

const steps = [
  { key: "obra", label: "Obra" },
  { key: "clima", label: "Clima" },
  { key: "atividades", label: "Atividades" },
  { key: "mao", label: "Mão de obra" },
  { key: "equip", label: "Equipamentos" },
  { key: "oc", label: "Ocorrências" },
  { key: "fotos", label: "Fotos & Assinatura" },
] as const;

function NovoRdoPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/rdo/novo" });
  const obrasFn = useServerFn(listObras);
  const maoFn = useServerFn(listMaoDeObra);
  const equipFn = useServerFn(listEquipamentos);
  const tiposFn = useServerFn(listTiposOcorrencia);
  const createFn = useServerFn(createRdo);
  const meFn = useServerFn(getMe);
  const registrarFn = useServerFn(registrarAnexo);

  const { data: obras = [] } = useQuery({ queryKey: ["obras"], queryFn: () => obrasFn() });
  const { data: maoOpts = [] } = useQuery({ queryKey: ["mao_de_obra"], queryFn: () => maoFn() });
  const { data: equipOpts = [] } = useQuery({ queryKey: ["equipamentos"], queryFn: () => equipFn() });
  const { data: tiposOpts = [] } = useQuery({ queryKey: ["tipos_ocorrencia"], queryFn: () => tiposFn() });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });

  const [stepIdx, setStepIdx] = useState(0);
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
  const [fotos, setFotos] = useState<File[]>([]);
  const [assinaturaBlob, setAssinaturaBlob] = useState<Blob | null>(null);

  async function uploadAttachments(rdoId: string, empresaId: string) {
    const all: { file: Blob; name: string; mime: string }[] = [
      ...fotos.map((f) => ({ file: f, name: f.name, mime: f.type || "image/jpeg" })),
    ];
    if (assinaturaBlob) all.push({ file: assinaturaBlob, name: "assinatura.png", mime: "image/png" });
    for (const a of all) {
      const safe = a.name.replace(/[^\w.\-]+/g, "_");
      const path = `${empresaId}/${rdoId}/${Date.now()}-${safe}`;
      const up = await supabase.storage.from("rdo-anexos").upload(path, a.file, { contentType: a.mime, upsert: false });
      if (up.error) throw up.error;
      await registrarFn({ data: { rdo_id: rdoId, nome: a.name, storage_path: path, mime_type: a.mime, tamanho_bytes: (a.file as any).size ?? 0 } });
    }
  }

  const save = useMutation({
    mutationFn: async (enviar: boolean) => {
      const rdo: any = await createFn({ data: { ...form, enviar } });
      if ((fotos.length || assinaturaBlob) && me?.profile?.empresa_id) {
        try { await uploadAttachments(rdo.id, me.profile.empresa_id); }
        catch (e: any) { toast.error("Anexos: " + (e.message ?? "falha")); }
      }
      return rdo;
    },
    onSuccess: (rdo: any) => { toast.success("RDO criado"); navigate({ to: "/rdo/$rdoId", params: { rdoId: rdo.id } }); },
    onError: (e: any) => toast.error(e.message),
  });

  function add(key: string, item: any) { setForm({ ...form, [key]: [...form[key], item] }); }
  function rm(key: string, idx: number) { setForm({ ...form, [key]: form[key].filter((_: any, i: number) => i !== idx) }); }
  function upd(key: string, idx: number, field: string, value: any) {
    setForm({ ...form, [key]: form[key].map((it: any, i: number) => i === idx ? { ...it, [field]: value } : it) });
  }

  const canNext = stepIdx === 0 ? !!form.obra_id : true;
  const isLast = stepIdx === steps.length - 1;

  return (
    <div className="px-4 py-5 md:p-8 max-w-3xl mx-auto">
      <Link to="/rdo" className="text-sm text-muted-foreground hover:underline flex items-center gap-1 mb-3">
        <ArrowLeft className="h-3 w-3" /> RDOs
      </Link>
      <h1 className="font-serif text-2xl md:text-3xl mb-1">Novo RDO</h1>
      <p className="text-xs text-muted-foreground mb-4">Etapa {stepIdx + 1} de {steps.length} · {steps[stepIdx].label}</p>

      {/* Stepper */}
      <div className="flex gap-1.5 mb-5">
        {steps.map((s, i) => (
          <div key={s.key} className={cn("h-1.5 flex-1 rounded-full", i <= stepIdx ? "bg-brand" : "bg-muted")} />
        ))}
      </div>

      <div className="space-y-4">
        {stepIdx === 0 && (
          <Card className="p-5 space-y-4">
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
            <div>
              <Label>Observações gerais</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={3} />
            </div>
          </Card>
        )}

        {stepIdx === 1 && (
          <Card className="p-5 grid grid-cols-1 gap-3">
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
          </Card>
        )}

        {stepIdx === 2 && (
          <Section title="Atividades" onAdd={() => add("atividades", { descricao: "", pct_executado: 0 })}>
            {form.atividades.map((it: any, i: number) => (
              <Card key={i} className="p-3 space-y-2">
                <div><Label className="text-xs">Descrição</Label><Input value={it.descricao} onChange={(e) => upd("atividades", i, "descricao", e.target.value)} /></div>
                <div className="flex items-end gap-2">
                  <div className="flex-1"><Label className="text-xs">% executado</Label><Input type="number" min={0} max={100} value={it.pct_executado} onChange={(e) => upd("atividades", i, "pct_executado", Number(e.target.value))} /></div>
                  <RmBtn onClick={() => rm("atividades", i)} />
                </div>
              </Card>
            ))}
          </Section>
        )}

        {stepIdx === 3 && (
          <Section title="Mão de obra" onAdd={() => add("mao_de_obra", { mao_de_obra_id: "", horas: 8, atividade: "" })}>
            {form.mao_de_obra.map((it: any, i: number) => (
              <Card key={i} className="p-3 space-y-2">
                <div><Label className="text-xs">Pessoa</Label>
                  <Select value={it.mao_de_obra_id} onValueChange={(v) => upd("mao_de_obra", i, "mao_de_obra_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {(maoOpts as any[]).map((m) => <SelectItem key={m.id} value={m.id}>{m.nome} — {m.funcao}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Atividade</Label><Input value={it.atividade ?? ""} onChange={(e) => upd("mao_de_obra", i, "atividade", e.target.value)} /></div>
                  <div><Label className="text-xs">Horas</Label><Input type="number" step={0.5} value={it.horas} onChange={(e) => upd("mao_de_obra", i, "horas", Number(e.target.value))} /></div>
                </div>
                <div className="flex justify-end"><RmBtn onClick={() => rm("mao_de_obra", i)} /></div>
              </Card>
            ))}
          </Section>
        )}

        {stepIdx === 4 && (
          <Section title="Equipamentos" onAdd={() => add("equipamentos", { equipamento_id: "", horas_uso: 0, status_uso: "" })}>
            {form.equipamentos.map((it: any, i: number) => (
              <Card key={i} className="p-3 space-y-2">
                <div><Label className="text-xs">Equipamento</Label>
                  <Select value={it.equipamento_id} onValueChange={(v) => upd("equipamentos", i, "equipamento_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {(equipOpts as any[]).map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Observação</Label><Input value={it.status_uso ?? ""} onChange={(e) => upd("equipamentos", i, "status_uso", e.target.value)} /></div>
                  <div><Label className="text-xs">Horas</Label><Input type="number" step={0.5} value={it.horas_uso} onChange={(e) => upd("equipamentos", i, "horas_uso", Number(e.target.value))} /></div>
                </div>
                <div className="flex justify-end"><RmBtn onClick={() => rm("equipamentos", i)} /></div>
              </Card>
            ))}
          </Section>
        )}

        {stepIdx === 5 && (
          <Section title="Ocorrências" onAdd={() => add("ocorrencias", { tipo_ocorrencia_id: null, descricao: "" })}>
            {form.ocorrencias.map((it: any, i: number) => (
              <Card key={i} className="p-3 space-y-2">
                <div><Label className="text-xs">Tipo</Label>
                  <Select value={it.tipo_ocorrencia_id ?? ""} onValueChange={(v) => upd("ocorrencias", i, "tipo_ocorrencia_id", v || null)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {(tiposOpts as any[]).map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Descrição</Label><Input value={it.descricao} onChange={(e) => upd("ocorrencias", i, "descricao", e.target.value)} /></div>
                <div className="flex justify-end"><RmBtn onClick={() => rm("ocorrencias", i)} /></div>
              </Card>
            ))}
          </Section>
        )}

        {stepIdx === 6 && (
          <>
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg">Fotos do canteiro</h3>
                <label className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-border cursor-pointer hover:bg-accent">
                  <Camera className="h-4 w-4" /> Tirar foto
                  <input
                    type="file" accept="image/*" capture="environment" multiple className="sr-only"
                    onChange={(e) => { if (e.target.files) setFotos((p) => [...p, ...Array.from(e.target.files!)]); e.target.value = ""; }}
                  />
                </label>
              </div>
              {fotos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma foto adicionada.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {fotos.map((f, i) => (
                    <div key={i} className="relative group aspect-square overflow-hidden rounded-md border border-border">
                      <img src={URL.createObjectURL(f)} className="object-cover w-full h-full" alt={f.name} />
                      <button onClick={() => setFotos((p) => p.filter((_, j) => j !== i))} className="absolute top-1 right-1 bg-background/80 rounded-full p-1">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <SignaturePad onChange={setAssinaturaBlob} hasSignature={!!assinaturaBlob} />
          </>
        )}
      </div>

      {/* Footer ações */}
      <div className="sticky bottom-16 md:bottom-0 mt-6 -mx-4 md:mx-0 bg-background/95 backdrop-blur border-t border-border md:border-0 px-4 py-3 flex justify-between gap-2">
        <Button variant="ghost" disabled={stepIdx === 0} onClick={() => setStepIdx((s) => Math.max(0, s - 1))}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        {!isLast ? (
          <Button disabled={!canNext} onClick={() => setStepIdx((s) => Math.min(steps.length - 1, s + 1))} className="bg-brand text-brand-foreground">
            Próximo <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" disabled={!form.obra_id || save.isPending} onClick={() => save.mutate(false)}>Rascunho</Button>
            <Button className="bg-brand text-brand-foreground" disabled={!form.obra_id || save.isPending} onClick={() => save.mutate(true)}>
              <Check className="h-4 w-4 mr-1" /> Enviar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd: () => void }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-lg">{title}</h3>
        <Button size="sm" variant="outline" onClick={onAdd}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>
      </div>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

function RmBtn({ onClick }: { onClick: () => void }) {
  return <Button size="sm" variant="ghost" className="text-destructive" onClick={onClick}><X className="h-4 w-4 mr-1" /> Remover</Button>;
}

function SignaturePad({ onChange, hasSignature }: { onChange: (b: Blob | null) => void; hasSignature: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const c = canvasRef.current!;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1f2937";
  }, []);

  function pos(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function down(e: React.PointerEvent) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
    dirty.current = true;
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty.current) canvasRef.current!.toBlob((b) => onChange(b), "image/png");
  }
  function clear() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    dirty.current = false;
    onChange(null);
  }

  return (
    <Card className="p-5 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg">Assinatura do responsável</h3>
        <Button size="sm" variant="ghost" onClick={clear}><Eraser className="h-4 w-4 mr-1" /> Limpar</Button>
      </div>
      <div className="rounded-md border border-dashed border-border bg-muted/30">
        <canvas
          ref={canvasRef}
          className="w-full h-40 touch-none block"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
        />
      </div>
      <p className="text-xs text-muted-foreground">{hasSignature ? "Assinatura capturada." : "Assine no campo acima."}</p>
    </Card>
  );
}
