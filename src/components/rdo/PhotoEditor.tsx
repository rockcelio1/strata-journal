import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { applyImageEdits, type EditOps } from "@/lib/image-utils";
import { ArrowClockwise, ArrowCounterClockwise, Sparkle } from "@phosphor-icons/react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  file: File | null;
  onClose: () => void;
  onSave: (f: File) => void;
};

const ASPECTS: NonNullable<EditOps["cropAspect"]>[] = ["1:1", "4:3", "3:4", "16:9"];

export function PhotoEditor({ open, file, onClose, onSave }: Props) {
  const [rotateDeg, setRotateDeg] = useState<0 | 90 | 180 | 270>(0);
  const [cropAspect, setCropAspect] = useState<EditOps["cropAspect"]>(null);
  const [enhance, setEnhance] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !file) return;
    setRotateDeg(0); setCropAspect(null); setEnhance(false);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [open, file]);

  // Re-renderiza preview ao mudar opções
  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    (async () => {
      try {
        const edited = await applyImageEdits(file, { rotateDeg, cropAspect, enhance });
        if (cancelled) return;
        const url = URL.createObjectURL(edited);
        setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
      } catch { /* ignora preview */ }
    })();
    return () => { cancelled = true; };
  }, [rotateDeg, cropAspect, enhance, file, open]);

  async function save() {
    if (!file) return;
    setBusy(true);
    try {
      const out = await applyImageEdits(file, { rotateDeg, cropAspect, enhance });
      onSave(out);
      onClose();
    } catch (e: any) {
      toast.error("Falha ao salvar edição: " + (e?.message ?? ""));
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Ajustar foto</DialogTitle></DialogHeader>
        <div className="bg-black/90 rounded-md aspect-video flex items-center justify-center overflow-hidden">
          {preview && <img src={preview} alt="" className="max-h-[55vh] object-contain" />}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button type="button" variant="outline" size="sm" onClick={() => setRotateDeg(((rotateDeg + 270) % 360) as 0|90|180|270)}>
            <ArrowCounterClockwise size={14} className="mr-1" />Girar -90°
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setRotateDeg(((rotateDeg + 90) % 360) as 0|90|180|270)}>
            <ArrowClockwise size={14} className="mr-1" />Girar +90°
          </Button>
          <Button type="button" variant={enhance ? "default" : "outline"} size="sm" onClick={() => setEnhance((v) => !v)}>
            <Sparkle size={14} className="mr-1" />Realçar
          </Button>
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-muted-foreground">Recorte:</span>
            <Button type="button" size="sm" variant={cropAspect === null ? "default" : "outline"} onClick={() => setCropAspect(null)}>Original</Button>
            {ASPECTS.map((a) => (
              <Button key={a} type="button" size="sm" variant={cropAspect === a ? "default" : "outline"} onClick={() => setCropAspect(a)}>{a}</Button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Salvando…" : "Aplicar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
