import * as React from "react";
import { cn } from "@/lib/utils";
import { LoadingSpinner, type LoadingVariant } from "./LoadingSpinner";

export interface LoadingOverlayProps {
  /** Controla a exibição do overlay. */
  show: boolean;
  /** Mensagem visível abaixo do spinner. */
  message?: string;
  size?: number;
  variant?: LoadingVariant;
  color?: string;
  /** Ocupa a viewport inteira (position: fixed). */
  fullScreen?: boolean;
  /** Fundo transparente (sem blur/backdrop). */
  transparent?: boolean;
  className?: string;
  /** Conteúdo envolvido; quando presente, overlay cobre apenas a área do wrapper. */
  children?: React.ReactNode;
}

/**
 * Overlay de carregamento. Sem `children`, renderiza apenas o overlay (fixed ou absolute).
 * Com `children`, envolve o conteúdo em um wrapper `relative` e cobre a área durante `show`.
 */
export function LoadingOverlay({
  show,
  message,
  size = 56,
  variant = "facom-blue",
  color,
  fullScreen = false,
  transparent = false,
  className,
  children,
}: LoadingOverlayProps) {
  const overlay = show ? (
    <div
      className={cn(
        "z-50 flex flex-col items-center justify-center gap-3",
        fullScreen ? "fixed inset-0" : "absolute inset-0",
        transparent ? "bg-transparent" : "bg-background/70 backdrop-blur-sm",
        "animate-in fade-in duration-150",
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <LoadingSpinner size={size} variant={variant} color={color} label={message ?? "Carregando"} />
      {message ? (
        <p className="text-sm text-foreground/80 font-medium max-w-xs text-center px-4">
          {message}
        </p>
      ) : null}
    </div>
  ) : null;

  if (!children) return overlay;

  return (
    <div className={cn("relative", className)}>
      {children}
      {overlay}
    </div>
  );
}
