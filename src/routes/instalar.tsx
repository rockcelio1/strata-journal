import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Apple, Smartphone, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/instalar")({
  head: () => ({
    meta: [
      { title: "Instalar o app — Diário de Obra" },
      { name: "description", content: "Instale o Diário de Obra no seu celular Android ou iPhone em segundos." },
      { property: "og:title", content: "Instalar o app — Diário de Obra" },
      { property: "og:description", content: "Instale o Diário de Obra no seu celular Android ou iPhone em segundos." },
    ],
  }),
  component: InstalarPage,
});

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}
function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches
    || (navigator as any).standalone === true;
}

function InstalarPage() {
  const [bip, setBip] = useState<BIP | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setIos(isIOS());
    setInstalled(isStandalone());
    const onPrompt = (e: Event) => { e.preventDefault(); setBip(e as BIP); };
    const onInstalled = () => { setInstalled(true); setBip(null); };
    window.addEventListener("beforeinstallprompt", onPrompt as any);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt as any);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const instalar = async () => {
    if (!bip) return;
    await bip.prompt();
    await bip.userChoice.catch(() => {});
    setBip(null);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <img src="/icon-512.png" alt="Diário de Obra" className="h-14 w-14 rounded-xl shadow-sm" />
        <div>
          <h1 className="font-serif text-2xl">Instalar o Diário de Obra</h1>
          <p className="text-sm text-muted-foreground">Funciona offline (cache do navegador) e abre como app, com ícone na tela do celular.</p>
        </div>
      </div>

      {installed && (
        <Card className="p-4 mb-4 border-green-500/40 bg-green-500/5">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            App já instalado neste aparelho.
          </div>
        </Card>
      )}

      {/* Android / Chrome / Edge */}
      <Card className="p-4 mb-4">
        <h2 className="font-medium flex items-center gap-2 mb-2"><Smartphone className="h-4 w-4" /> Android (Chrome, Edge, Samsung Internet)</h2>
        {bip ? (
          <Button onClick={instalar} className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" /> Instalar agora
          </Button>
        ) : (
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal pl-5">
            <li>Toque no menu do navegador (três pontos no canto superior direito).</li>
            <li>Selecione <b>“Instalar app”</b> ou <b>“Adicionar à tela inicial”</b>.</li>
            <li>Confirme. O ícone aparece na tela inicial e abre como aplicativo.</li>
          </ol>
        )}
        {!bip && !installed && (
          <p className="text-xs text-muted-foreground mt-2">
            Se o botão automático não apareceu, é porque o navegador ainda não detectou a página como instalável — use o caminho manual acima.
          </p>
        )}
      </Card>

      {/* iOS */}
      <Card className="p-4 mb-4">
        <h2 className="font-medium flex items-center gap-2 mb-2"><Apple className="h-4 w-4" /> iPhone / iPad (Safari)</h2>
        <ol className="text-sm text-muted-foreground space-y-1 list-decimal pl-5">
          <li>Abra esta página no <b>Safari</b> (não funciona dentro do Chrome no iOS).</li>
          <li>Toque no ícone <b>Compartilhar</b> (quadrado com seta para cima) na barra inferior.</li>
          <li>Role e toque em <b>“Adicionar à Tela de Início”</b>.</li>
          <li>Confirme em <b>“Adicionar”</b>. O ícone do app aparece na tela.</li>
        </ol>
        {ios && (
          <p className="text-xs text-muted-foreground mt-2">
            Você está no iOS — siga os passos acima diretamente no Safari.
          </p>
        )}
      </Card>

      <Card className="p-4 text-xs text-muted-foreground">
        <b>Por que não há link na App Store / Play Store?</b> O Diário de Obra é um <b>PWA</b> — instala direto pelo navegador, sem precisar de loja, atualiza sozinho e ocupa pouco espaço. Funciona como app nativo: ícone, tela cheia e abertura rápida.
      </Card>
    </div>
  );
}
