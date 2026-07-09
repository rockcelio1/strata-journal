import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { LoadingSpinner, type LoadingVariant } from "./LoadingSpinner";
import { cn } from "@/lib/utils";

export interface ButtonLoadingProps extends ButtonProps {
  /** Estado de processamento. Desabilita o botão e troca o texto. */
  loading?: boolean;
  /** Texto exibido enquanto `loading` é true (default "Processando..."). */
  loadingText?: string;
  /** Variante de cor do spinner (default herda cor do texto). */
  spinnerVariant?: LoadingVariant;
  /** Tamanho do spinner em px (default 14). */
  spinnerSize?: number;
}

/**
 * Botão com estado de carregamento integrado.
 * - Desabilita durante `loading` (impede duplo clique).
 * - Mostra spinner + `loadingText` no lugar do children.
 * - Mantém API do <Button> shadcn.
 */
export const ButtonLoading = React.forwardRef<HTMLButtonElement, ButtonLoadingProps>(
  function ButtonLoading(
    {
      loading = false,
      loadingText = "Processando...",
      spinnerVariant = "current",
      spinnerSize = 14,
      disabled,
      children,
      className,
      onClick,
      ...rest
    },
    ref,
  ) {
    const handleClick = React.useCallback<React.MouseEventHandler<HTMLButtonElement>>(
      (e) => {
        if (loading) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick?.(e);
      },
      [loading, onClick],
    );

    return (
      <Button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(className)}
        onClick={handleClick}
        {...rest}
      >
        {loading ? (
          <>
            <LoadingSpinner size={spinnerSize} variant={spinnerVariant} aria-hidden="true" />
            <span>{loadingText}</span>
          </>
        ) : (
          children
        )}
      </Button>
    );
  },
);
