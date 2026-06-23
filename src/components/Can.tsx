import type { ReactNode } from "react";
import { usePermissoes } from "@/hooks/usePermissoes";
import type { AppAction, AppResource } from "@/lib/permissoes.functions";

interface CanProps {
  resource: AppResource;
  action: AppAction;
  fallback?: ReactNode;
  children: ReactNode;
}

export function Can({ resource, action, fallback = null, children }: CanProps) {
  const { can, isLoading } = usePermissoes();
  if (isLoading) return null;
  if (!can(resource, action)) return <>{fallback}</>;
  return <>{children}</>;
}
