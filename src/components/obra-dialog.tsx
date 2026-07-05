import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createObra, updateObra, listObras } from "@/lib/obras.functions";
import { registerObraFoto } from "@/lib/obra-fotos.functions";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { ImageSquare, X } from "@phosphor-icons/react";

const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = "obra-fotos";

async function makeBlurDataUrl(file: File): Promise<{ blur: string; w: number; h: number } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const ratio = bmp.width / bmp.height;
    const w = 16;
    const h = Math.max(1, Math.round(w / ratio));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, w, h);
    return { blur: canvas.toDataURL("image/jpeg", 0.5), w: bmp.width, h: bmp.height };
  } catch { return null; }
}

export function ObraDialog({ open, onOpenChange, obra }: { open: boolean; onOpenChange: (v: boolean) => void; obra: any | null }) {
  const createFn = useServerFn(createObra);
  const updateFn = useServerFn(updateObra);
  const listFn = useServerFn(listObras);
  const registerFotoFn = useServerFn(registerObraFoto);
  const { data: obrasList = [] } = useQuery({ queryKey: ["obras"], queryFn: () => listFn(), enabled: open && !obra });
  const qc = useQueryClient();
  const [pickedId, setPickedId] = useState<string>("");
  const locked = !obra && !!pickedId;
  const [form, setForm] = useState<any>({
    nome: "", codigo: "", cliente: "", endereco: "", data_inicio: "", data_previsao_fim: "",
    status: "planejamento", avanco_pct: 0, descricao: "",
  });
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [capaPreview, setCapaPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPickedId("");
      setCapaFile(null);
      setCapaPreview(null);
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

  useEffect(() => {
    if (!capaFile) { setCapaPreview(null); return; }
    const url = URL.createObjectURL(capaFile);
    setCapaPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [capaFile]);

  const handlePickFile = (f: File | null) => {
    if (!f) { setCapaFile(null); return; }
    if (!f.type.startsWith("image/")) { toast.error("Selecione uma imagem"); return; }
    if (f.size > MAX_BYTES) { toast.error("A foto deve ter no máximo 5MB"); return; }
    setCapaFile(f);
  };

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

      const created: any = await createFn({ data: payload });

      if (capaFile && created?.id && created?.empresa_id) {
        const ext = capaFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const id = (crypto as any).randomUUID?.() ?? Math.random().toString(36).slice(2);
        const path = `${created.empresa_id}/${created.id}/${id}.${ext}`;
        const up = await supabase.storage.from(BUCKET).upload(path, capaFile, {
          contentType: capaFile.type, upsert: false,
        });
        if (up.error) throw up.error;
        const meta = await makeBlurDataUrl(capaFile);
        await registerFotoFn({
          data: {
            obra_id: created.id,
            storage_path: path,
            nome: capaFile.name,
            mime_type: capaFile.type,
            tamanho_bytes: capaFile.size,
            largura: meta?.w ?? null,
            altura: meta?.h ?? null,
            blur_data_url: meta?.blur ?? null,
            set_capa: true,
          },
        });
      }
      return created;
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
      <DialogContent className="max-w-xl w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{obra ? "Editar obra" : "Nova obra"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!obra && (obrasList as any[]).length > 0 && (
              <div className="sm:col-span-2">
                <Label>Selecionar obra existente (autopreenche)</Label>
                <Select
                  value={pickedId}
                  onValueChange={(id) => {
                    setPickedId(id);
                    const o = (obrasList as any[]).find((x) => x.id === id);
                    if (!o) return;
                    setForm((f: any) => ({
                      ...f,
                      nome: o.nome ?? "",
                      codigo: o.codigo ?? "",
                      cliente: o.cliente ?? "",
                      endereco: o.endereco ?? "",
                      data_inicio: o.data_inicio ?? "",
                      data_previsao_fim: o.data_previsao_fim ?? "",
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Escolha uma obra para preencher os campos" /></SelectTrigger>
                  <SelectContent>
                    {(obrasList as any[]).map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {locked && (
                  <button type="button" className="text-xs text-muted-foreground hover:underline mt-1"
                    onClick={() => { setPickedId(""); }}>
                    Limpar seleção e editar manualmente
                  </button>
                )}
              </div>
            )}

            {!obra && (
              <div className="sm:col-span-2">
                <Label>Foto de capa</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    handlePickFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
                {capaPreview ? (
                  <div className="relative mt-1 rounded-md overflow-hidden border border-border aspect-[4/3] bg-muted">
                    <img src={capaPreview} alt="Prévia" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setCapaFile(null)}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white inline-flex items-center justify-center hover:bg-black/80"
                      aria-label="Remover foto"
                    >
                      <X size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="absolute bottom-2 right-2 text-xs bg-background/90 border border-border px-2 py-1 rounded"
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="mt-1 w-full aspect-[4/3] rounded-md border-2 border-dashed border-border hover:border-brand hover:bg-muted/40 flex flex-col items-center justify-center gap-2 text-muted-foreground transition"
                  >
                    <ImageSquare size={28} />
                    <span className="text-sm">Adicionar foto de capa</span>
                    <span className="text-[11px]">JPG, PNG ou WEBP · até 5MB</span>
                  </button>
                )}
              </div>
            )}

            <div className="sm:col-span-2">
              <Label>Nome do Contrato</Label>
              <Input value={form.nome} readOnly={locked} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div>
              <Label>Contrato</Label>
              <Input value={form.codigo} readOnly={locked} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            </div>
            <div>
              <Label>Cliente</Label>
              <Input value={form.cliente} readOnly={locked} onChange={(e) => setForm({ ...form, cliente: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Endereço</Label>
              <Input value={form.endereco} readOnly={locked} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
            </div>
            <div>
              <Label>Início</Label>
              <Input type="date" value={form.data_inicio} readOnly={locked} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
            </div>
            <div>
              <Label>Previsão fim</Label>
              <Input type="date" value={form.data_previsao_fim} readOnly={locked} onChange={(e) => setForm({ ...form, data_previsao_fim: e.target.value })} />
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
            <div className="sm:col-span-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.nome} className="bg-brand text-brand-foreground">
            {save.isPending ? "Salvando…" : obra ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
