import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { AutoSkeleton } from "./components/skeletons/AutoSkeleton";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "viewport",
    defaultPreloadDelay: 0,
    defaultPreloadStaleTime: 60_000,
    defaultPendingMs: 50,
    defaultPendingMinMs: 0,
    defaultPendingComponent: AutoSkeleton,
    defaultGcTime: 10 * 60_000,
    defaultStaleTime: 30_000,
  });

  return router;
};



