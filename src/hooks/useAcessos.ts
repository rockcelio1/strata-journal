import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { meusAcessos, type PermScope } from "@/lib/acessos.functions";

const SCOPE_RANK: Record<PermScope, number> = { proprio: 0, equipe: 1, empresa: 2, global: 3 };

/**
 * Acesso granular por recurso ("modulo.recurso") e ação.
 *
 *   const { pode, escopo } = useAcessos();
 *   pode("diario.rdos", "aprovar")      -> boolean
 *   escopo("diario.rdos", "ver")        -> "proprio" | "equipe" | "empresa" | "global" | null
 */
export function useAcessos() {
  const fn = useServerFn(meusAcessos);
  const query = useQuery({
    queryKey: ["meus-acessos"],
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return useMemo(() => {
    const map = new Map<string, PermScope>();
    for (const a of query.data?.acessos ?? []) map.set(`${a.recurso_key}.${a.acao}`, a.scope);

    const roles = query.data?.roles ?? [];
    const isMaster = roles.includes("master") || roles.includes("admin");

    const escopo = (recurso: string, acao: string): PermScope | null => {
      if (isMaster) return map.get(`${recurso}.${acao}`) ?? "empresa";
      return map.get(`${recurso}.${acao}`) ?? null;
    };

    const pode = (recurso: string, acao: string) => escopo(recurso, acao) !== null;

    const podeAlgum = (pares: Array<[string, string]>) => pares.some(([r, a]) => pode(r, a));

    /** Módulo visível no menu quando existe qualquer ação permitida nele. */
    const podeModulo = (moduloKey: string) => {
      if (isMaster) return true;
      const prefixo = `${moduloKey}.`;
      for (const k of map.keys()) if (k.startsWith(prefixo)) return true;
      return false;
    };

    const veTudoDaEmpresa = (recurso: string, acao: string) => {
      const s = escopo(recurso, acao);
      return s !== null && SCOPE_RANK[s] >= SCOPE_RANK.empresa;
    };

    return {
      isLoading: query.isLoading,
      isError: query.isError,
      roles,
      isMaster,
      escopos: query.data?.escopos ?? [],
      pode,
      podeAlgum,
      podeModulo,
      escopo,
      veTudoDaEmpresa,
      raw: query.data,
    };
  }, [query.data, query.isLoading, query.isError]);
}

export type UseAcessosReturn = ReturnType<typeof useAcessos>;
