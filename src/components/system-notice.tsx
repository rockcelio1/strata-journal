import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

// Sistema de notificações centralizado (centro da tela), rápido e acessível.
// Usado por telas de Configurações — evita depender do toast genérico do canto.

type Kind = "success" | "error" | "info";
type Notice = { id: number; kind: Kind; message: string; description?: string };

type Listener = (n: Notice) => void;
const listeners = new Set<Listener>();
let seq = 0;

function emit(kind: Kind, message: string, description?: string) {
  const n: Notice = { id: ++seq, kind, message, description };
  listeners.forEach((l) => l(n));
}

type NotifyExtra = string | { description?: string; [key: string]: unknown } | undefined | null;
const toDesc = (x: NotifyExtra): string | undefined => {
  if (!x) return undefined;
  if (typeof x === "string") return x;
  if (typeof x === "object" && "description" in x) return x.description;
  return undefined;
};

export const notify = {
  success: (message: string, extra?: NotifyExtra) => emit("success", message, toDesc(extra)),
  error: (message: string, extra?: NotifyExtra) => emit("error", message, toDesc(extra)),
  info: (message: string, extra?: NotifyExtra) => emit("info", message, toDesc(extra)),
};

const DURATION_MS = 900;

export function SystemNoticeHost() {
  const [items, setItems] = useState<Notice[]>([]);

  useEffect(() => {
    const listener: Listener = (n) => {
      setItems((prev) => [...prev, n]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== n.id));
      }, DURATION_MS);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (typeof document === "undefined") return null;
  if (items.length === 0) return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="true"
      role="status"
      className="pointer-events-none fixed inset-0 z-[100] grid place-items-center"
    >
      <div className="flex flex-col gap-2">
        {items.map((n) => (
          <NoticeCard
            key={n.id}
            item={n}
            onClose={() => setItems((prev) => prev.filter((x) => x.id !== n.id))}
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}

function NoticeCard({ item, onClose }: { item: Notice; onClose: () => void }) {
  const Icon = item.kind === "success" ? CheckCircle2 : item.kind === "error" ? AlertCircle : Info;
  const tone =
    item.kind === "success"
      ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
      : item.kind === "error"
        ? "border-destructive/50 text-destructive"
        : "border-border text-foreground";

  return (
    <div
      className={`pointer-events-auto min-w-[220px] max-w-[420px] rounded-lg border-2 bg-background/95 backdrop-blur px-4 py-3 shadow-lg animate-scale-in flex items-start gap-3 ${tone}`}
    >
      <Icon className="h-5 w-5 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight">{item.message}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar notificação"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
