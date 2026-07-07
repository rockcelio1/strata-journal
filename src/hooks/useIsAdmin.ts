import { usePermissoes } from "@/hooks/usePermissoes";

/**
 * Helper reutilizável para checagem de role admin.
 * Centraliza a lógica em um só lugar, evitando duplicação em componentes.
 */
export function useIsAdmin() {
  const { roles, isLoading, isError } = usePermissoes();
  const isAdmin = (roles ?? []).some((x: string) => x === "admin");
  const isMaster = (roles ?? []).some((x: string) => x === "master");
  return { isAdmin, isMaster, isAdminOrMaster: isAdmin || isMaster, isLoading, isError };
}
