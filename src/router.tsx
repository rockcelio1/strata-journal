import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { AutoSkeleton } from "./components/skeletons/AutoSkeleton";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Cache agressivo: dados considerados frescos por 5min, mantidos em memória por 30min
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: 1,
        // Reaproveita a última resposta enquanto a nova carrega (sem "piscar" tela)
        placeholderData: (prev: unknown) => prev,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Pré-carrega no hover/touch + também quando o link entra na viewport
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    // Rotas pré-carregadas ficam frescas por 5min (evita refetch ao navegar)
    defaultPreloadStaleTime: 5 * 60_000,
    // Skeleton só aparece se demorar >150ms (evita flash em navegações instantâneas)
    defaultPendingMs: 150,
    defaultPendingMinMs: 0,
    defaultPendingComponent: AutoSkeleton,
    defaultGcTime: 30 * 60_000,
    defaultStaleTime: 5 * 60_000,
  });

  return router;
};




