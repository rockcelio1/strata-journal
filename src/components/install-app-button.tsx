import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}
function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

/** 3D-look platform glyphs rendered as inline SVG (no external assets). */
function AppleGlyph({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id="appleGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5f7fa" />
          <stop offset="55%" stopColor="#c8cdd4" />
          <stop offset="100%" stopColor="#6b7280" />
        </linearGradient>
        <radialGradient id="appleShine" cx="35%" cy="25%" r="40%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g>
        <path
          fill="url(#appleGrad)"
          d="M33 26.5c0-4 3.3-5.9 3.4-6-1.9-2.7-4.8-3.1-5.8-3.2-2.5-.3-4.8 1.4-6 1.4-1.3 0-3.2-1.4-5.3-1.3-2.7.1-5.2 1.6-6.6 4-2.8 4.9-.7 12.2 2 16.2 1.3 2 2.9 4.2 5 4.1 2-.1 2.8-1.3 5.2-1.3s3.1 1.3 5.3 1.3c2.2 0 3.6-2 4.9-3.9 1.5-2.2 2.2-4.4 2.2-4.5-.1 0-4.3-1.6-4.3-6.8zM29.4 12.6c1.1-1.3 1.8-3.1 1.6-4.9-1.6.1-3.5 1.1-4.6 2.4-1 1.2-1.9 3-1.7 4.8 1.8.1 3.6-.9 4.7-2.3z"
        />
        <path fill="url(#appleShine)" d="M14 19c3-3 7-4 10-3-2 1-5 2-7 4s-4 5-4 8c-1-3 1-7 1-9z" />
      </g>
    </svg>
  );
}

function AndroidGlyph({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id="andGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9beb7a" />
          <stop offset="100%" stopColor="#2f9e44" />
        </linearGradient>
        <radialGradient id="andShine" cx="35%" cy="25%" r="45%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g>
        <path
          fill="url(#andGrad)"
          d="M14.6 19.7l-3-5.2a.7.7 0 011.2-.7l3 5.2a14 14 0 0116.4 0l3-5.2a.7.7 0 011.2.7l-3 5.2A13 13 0 0140 31H8a13 13 0 016.6-11.3zM15 28.2a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm18 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
        />
        <ellipse cx="20" cy="22" rx="10" ry="3" fill="url(#andShine)" />
      </g>
    </svg>
  );
}

export function InstallAppButton() {
  const [bip, setBip] = useState<BIP | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    setIos(isIOS());
    setInstalled(isStandalone());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setBip(e as BIP);
    };
    const onInstalled = () => {
      setInstalled(true);
      setBip(null);
      toast.success("App instalado com sucesso!");
    };
    window.addEventListener("beforeinstallprompt", onPrompt as any);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt as any);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-green-600">
        <CheckCircle2 className="h-4 w-4" /> App já instalado neste aparelho
      </div>
    );
  }

  const handleClick = async () => {
    if (bip) {
      try {
        await bip.prompt();
        const choice = await bip.userChoice;
        if (choice.outcome === "accepted") toast.success("Instalando o app…");
        setBip(null);
      } catch {
        toast.error("Não foi possível abrir o instalador.");
      }
      return;
    }
    if (ios) {
      setShowIosHelp(true);
      return;
    }
    // Fallback: redireciona para a página completa de instruções
    window.location.href = "/instalar";
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="group relative mt-4 flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-br from-card via-card to-brand/5 px-4 py-3 text-left shadow-md transition hover:shadow-lg hover:border-brand/60 active:scale-[0.99]"
      >
        {/* shimmer flash */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-70 animate-[shimmer_2.4s_ease-in-out_infinite]"
        />
        <span className="relative flex items-center gap-3">
          <Download className="h-5 w-5 text-brand" />
          <span>
            <span className="block text-sm font-semibold leading-tight">Instalar o app no celular</span>
            <span className="block text-xs text-muted-foreground">Toque para instalar — Android e iPhone</span>
          </span>
        </span>
        <span className="relative flex items-center gap-2">
          <AppleGlyph className="h-7 w-7 drop-shadow-sm" />
          <AndroidGlyph className="h-7 w-7 drop-shadow-sm" />
        </span>
      </button>

      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AppleGlyph className="h-6 w-6" /> Instalar no iPhone / iPad
            </DialogTitle>
            <DialogDescription>
              O Safari da Apple não permite instalação automática. Siga os 3 passos abaixo — leva 10 segundos.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-foreground">1</span>
              <span>Toque no ícone <b className="inline-flex items-center gap-1"><Share className="h-4 w-4" /> Compartilhar</b> na barra inferior do Safari.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-foreground">2</span>
              <span>Role e toque em <b className="inline-flex items-center gap-1"><Plus className="h-4 w-4" /> Adicionar à Tela de Início</b>.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-foreground">3</span>
              <span>Confirme em <b>Adicionar</b>. O ícone do app aparece na sua tela inicial.</span>
            </li>
          </ol>
          <Button className="w-full" onClick={() => setShowIosHelp(false)}>Entendi</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
