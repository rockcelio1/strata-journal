import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (files: File[]) => void;
};

export function CameraCapture({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);
  const [shots, setShots] = useState<File[]>([]);

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
    setShots((p) => [...p, file]);
  }

  function finish() {
    if (shots.length > 0) onCapture(shots);
    setShots([]);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setShots([]); onClose(); } }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Câmera</DialogTitle>
        </DialogHeader>
        <div className="relative bg-black aspect-video">
          <video ref={videoRef} playsInline muted className="w-full h-full object-contain" />
        </div>
        {shots.length > 0 && (
          <div className="px-4 py-2 flex gap-2 overflow-x-auto border-t">
            {shots.map((f, i) => (
              <div key={i} className="relative shrink-0">
                <img src={URL.createObjectURL(f)} className="h-16 w-16 object-cover rounded border" alt="" />
                <button
                  onClick={() => setShots((p) => p.filter((_, j) => j !== i))}
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
          <Button variant="outline" size="sm" onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}>
            <RefreshCw size={14} className="mr-1" /> Virar
          </Button>
          <Button onClick={snap} disabled={!ready} className="flex-1">
            <Camera size={16} className="mr-1" /> Capturar
          </Button>
          <Button variant="default" size="sm" onClick={finish} disabled={shots.length === 0}>
            Usar ({shots.length})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
