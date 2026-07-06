import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Camera, RefreshCw, X, AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (files: File[], captions: string[]) => void;
};

const MIN_WORDS = 5;
const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function CameraCapture({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);
  const [shots, setShots] = useState<File[]>([]);
  const [captions, setCaptions] = useState<string[]>([]);
  // Foto aguardando legenda obrigatória antes de permitir nova captura
  const [pendingIdx, setPendingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setReady(false);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          toast.error("Câmera não disponível neste navegador. Use a opção Galeria para enviar fotos.");
          onClose();
          return;
        }
        if (typeof window !== "undefined" && !window.isSecureContext) {
          toast.error("Câmera exige HTTPS. Abra o app no domínio seguro ou use a Galeria.");
          onClose();
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 4096 },
            height: { ideal: 2160 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch (e: any) {
        const name = e?.name ?? "";
        const msg =
          name === "NotAllowedError" || name === "SecurityError"
            ? "Permissão da câmera negada. Habilite o acesso nas configurações do navegador ou use a opção Galeria."
            : name === "NotFoundError" || name === "OverconstrainedError"
            ? "Nenhuma câmera encontrada neste dispositivo. Use a opção Galeria."
            : name === "NotReadableError"
            ? "A câmera está em uso por outro app. Feche-o e tente novamente, ou use a Galeria."
            : "Não foi possível acessar a câmera: " + (e?.message ?? name ?? "erro desconhecido");
        toast.error(msg);
        onClose();
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, facing]);

  async function snap() {
    const video = videoRef.current;
    if (!video || !ready) return;
    if (pendingIdx !== null) {
      toast.error(`Escreva a legenda da foto anterior (mín. ${MIN_WORDS} palavras) antes de tirar outra.`);
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.95));
    if (!blob) return;
    const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
    setShots((p) => {
      const next = [...p, file];
      setPendingIdx(next.length - 1);
      return next;
    });
    setCaptions((p) => [...p, ""]);
    setDraft("");
  }

  function confirmCaption() {
    const words = countWords(draft);
    if (words < MIN_WORDS) return;
    if (pendingIdx === null) return;
    setCaptions((p) => p.map((v, i) => (i === pendingIdx ? draft.trim() : v)));
    setPendingIdx(null);
    setDraft("");
  }

  function discardPending() {
    if (pendingIdx === null) return;
    setShots((p) => p.filter((_, i) => i !== pendingIdx));
    setCaptions((p) => p.filter((_, i) => i !== pendingIdx));
    setPendingIdx(null);
    setDraft("");
  }

  function finish() {
    if (pendingIdx !== null) {
      toast.error(`Finalize a legenda da última foto (mín. ${MIN_WORDS} palavras).`);
      return;
    }
    if (shots.length > 0) onCapture(shots, captions);
    setShots([]);
    setCaptions([]);
    onClose();
  }

  function reset() {
    setShots([]);
    setCaptions([]);
    setPendingIdx(null);
    setDraft("");
  }

  const draftWords = countWords(draft);
  const faltam = Math.max(0, MIN_WORDS - draftWords);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Câmera</DialogTitle>
        </DialogHeader>
        <div className="relative bg-black aspect-video">
          <video ref={videoRef} playsInline muted className="w-full h-full object-contain" />
        </div>

        {pendingIdx !== null && (
          <div className="px-4 py-3 border-t bg-amber-50 dark:bg-amber-950/30 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 text-sm font-medium">
              <AlertCircle size={16} />
              Legenda obrigatória — mínimo {MIN_WORDS} palavras
              <span className="text-red-600 font-bold" aria-hidden="true">*</span>
            </div>
            <div className="flex gap-2">
              <img
                src={URL.createObjectURL(shots[pendingIdx])}
                className="h-16 w-16 object-cover rounded border shrink-0"
                alt="Foto recém-tirada"
              />
              <Textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Descreva a foto (mínimo 5 palavras)…"
                rows={2}
                aria-required="true"
                aria-invalid={faltam > 0}
                className="flex-1"
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span
                className={faltam > 0 ? "text-amber-800 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-400"}
                aria-live="polite"
              >
                {faltam > 0
                  ? `Faltam ${faltam} palavra${faltam > 1 ? "s" : ""} (${draftWords}/${MIN_WORDS})`
                  : `Legenda válida (${draftWords} palavras)`}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={discardPending}>
                  Descartar foto
                </Button>
                <Button size="sm" onClick={confirmCaption} disabled={faltam > 0}>
                  <Check size={14} className="mr-1" /> Confirmar legenda
                </Button>
              </div>
            </div>
          </div>
        )}

        {shots.length > 0 && (
          <div className="px-4 py-2 flex gap-2 overflow-x-auto border-t">
            {shots.map((f, i) => (
              <div key={i} className="relative shrink-0">
                <img src={URL.createObjectURL(f)} className="h-16 w-16 object-cover rounded border" alt="" />
                {i === pendingIdx && (
                  <span className="absolute inset-0 rounded ring-2 ring-amber-500" aria-hidden="true" />
                )}
                <button
                  onClick={() => {
                    setShots((p) => p.filter((_, j) => j !== i));
                    setCaptions((p) => p.filter((_, j) => j !== i));
                    if (pendingIdx === i) { setPendingIdx(null); setDraft(""); }
                    else if (pendingIdx !== null && i < pendingIdx) setPendingIdx(pendingIdx - 1);
                  }}
                  className="absolute -top-1 -right-1 bg-background border rounded-full p-0.5"
                  aria-label="Remover"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 p-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
            disabled={pendingIdx !== null}
          >
            <RefreshCw size={14} className="mr-1" /> Virar
          </Button>
          <Button
            onClick={snap}
            disabled={!ready || pendingIdx !== null}
            className="flex-1"
            title={pendingIdx !== null ? "Escreva a legenda antes de capturar outra foto" : undefined}
          >
            <Camera size={16} className="mr-1" /> Capturar
          </Button>
          <Button variant="default" size="sm" onClick={finish} disabled={shots.length === 0 || pendingIdx !== null}>
            Usar ({shots.length})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
