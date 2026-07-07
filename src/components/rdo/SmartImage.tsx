import { useEffect, useRef, useState } from "react";
import { ImageOff, RefreshCw } from "lucide-react";

type Props = {
  src: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  onClick?: () => void;
};

/** Imagem com placeholder, lazy loading, retry automático (2x) e fallback acionável.
 *  Evita “imagem quebrada” em tablet/rede lenta e nunca deixa a UI travada. */
export function SmartImage({ src, alt, className, loading = "lazy", onClick }: Props) {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setStatus("loading");
    setAttempt(0);
  }, [src]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const url = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}_r=${attempt}`;

  const handleError = () => {
    if (attempt < 2) {
      const next = attempt + 1;
      timerRef.current = window.setTimeout(() => setAttempt(next), 400 * next);
    } else {
      setStatus("error");
    }
  };

  if (status === "error") {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 bg-muted/60 text-muted-foreground text-[10px] p-2 ${className ?? ""}`}
        role="img"
        aria-label={`Falha ao carregar ${alt}`}
      >
        <ImageOff className="h-6 w-6" />
        <span className="text-center leading-tight">Não foi possível carregar</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setAttempt((n) => n + 1); setStatus("loading"); }}
          className="inline-flex items-center gap-1 text-[10px] text-brand hover:underline"
        >
          <RefreshCw className="h-3 w-3" /> Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ""}`} onClick={onClick}>
      {status === "loading" && (
        <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />
      )}
      <img
        src={url}
        alt={alt}
        loading={loading}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setStatus("ok")}
        onError={handleError}
        className={`w-full h-full ${className ?? ""} ${status === "ok" ? "opacity-100" : "opacity-0"} transition-opacity`}
      />
    </div>
  );
}
