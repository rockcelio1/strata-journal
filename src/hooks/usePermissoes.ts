import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { minhasPermissoes, type AppAction, type AppResource } from "@/lib/permissoes.functions";

export function usePermissoes() {
  const fn = useServerFn(minhasPermissoes);
  const query = useQuery({
    queryKey: ["minhas-permissoes"],
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return useMemo(() => {
    const set = new Set(query.data?.permissions ?? []);
    const roles = new Set(query.data?.roles ?? []);
    const isMaster = roles.has("master") || roles.has("admin");

    const can = (resource: AppResource, action: AppAction) =>
      isMaster || set.has(`${resource}.${action}`);

    const canAny = (pairs: Array<[AppResource, AppAction]>) => pairs.some(([r, a]) => can(r, a));

    return {
      isLoading: query.isLoading,
      isError: query.isError,
      roles: query.data?.roles ?? [],
      isMaster,
      can,
      canAny,
      raw: query.data,
    };
  }, [query.data, query.isLoading, query.isError]);
}

export type UsePermissoesReturn = ReturnType<typeof usePermissoes>;
