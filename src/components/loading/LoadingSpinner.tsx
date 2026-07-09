import * as React from "react";
import { cn } from "@/lib/utils";

export type LoadingVariant = "black" | "white" | "facom-blue" | "facom-orange" | "current";

const VARIANT_COLOR: Record<LoadingVariant, string> = {
  black: "#111827",
  white: "#FFFFFF",
  "facom-blue": "#3F51B5",
  "facom-orange": "#FF9800",
  current: "currentColor",
};

export interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Tamanho em px (default 40). */
  size?: number;
  /** Cor CSS explícita ou variante FACOM. Default: currentColor. */
  color?: string;
  variant?: LoadingVariant;
  /** Duração da animação (default "1.5s"). */
  speed?: string;
  /** Texto acessível para leitores de tela. */
  label?: string;
}

/**
 * Spinner de pontos giratórios (estilo boot Windows).
 * Puramente visual, respeita prefers-reduced-motion.
 */
export const LoadingSpinner = React.forwardRef<HTMLSpanElement, LoadingSpinnerProps>(
  function LoadingSpinner(
    { size = 40, color, variant = "current", speed = "1.5s", label, className, style, ...rest },
    ref,
  ) {
    const resolvedColor = color ?? VARIANT_COLOR[variant];
    const cssVars = {
      "--uib-size": `${size}px`,
      "--uib-color": resolvedColor,
      "--uib-speed": speed,
    } as React.CSSProperties;

    return (
      <span
        ref={ref}
        className={cn("lspn", className)}
        style={{ ...cssVars, ...style }}
        role="status"
        aria-live="polite"
        aria-label={label ?? "Carregando"}
        {...rest}
      >
        <span className="lspn-dot" />
        <span className="lspn-dot" />
        <span className="lspn-dot" />
        <span className="lspn-dot" />
        <span className="lspn-dot" />
        <span className="lspn-dot" />
        {label ? <span className="sr-only">{label}</span> : null}
      </span>
    );
  },
);
