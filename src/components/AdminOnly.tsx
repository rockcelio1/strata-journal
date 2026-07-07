import type { ReactNode } from "react";
import { ShieldWarning } from "@phosphor-icons/react";
import { Card } from "@/components/ui/card";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface AdminOnlyProps {
  children: ReactNode;
  /** Quando true, exibe uma tela de "Acesso negado" no lugar do conteúdo. */
  showDenied?: boolean;
  /** Título opcional exibido no aviso de acesso negado. */
  deniedTitle?: string;
  /** Fallback customizado (sobrescreve showDenied). */
  fallback?: ReactNode;
}

export function AdminOnly({
  children,
  showDenied = false,
  deniedTitle = "Acesso restrito",
  fallback,
}: AdminOnlyProps) {
  const { isAdmin, isLoading } = useIsAdmin();
  if (isLoading) return null;
  if (isAdmin) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  if (!showDenied) return null;
  return (
    <Card
      data-testid="admin-only-denied"
      className="p-4 sm:p-6 mb-4 border-dashed flex items-start gap-3"
    >
      <ShieldWarning className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 text-muted-foreground mt-0.5" />
      <div className="min-w-0">
        <h3 className="font-serif text-base sm:text-lg">{deniedTitle}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Esta funcionalidade está disponível apenas para administradores.
        </p>
      </div>
    </Card>
  );
}
