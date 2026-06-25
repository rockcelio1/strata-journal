import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 20, // hover/focus quase instantâneo dispara preload
    defaultPreloadStaleTime: 0, // TanStack Query controla a frescura
    defaultPendingMs: 200,
    defaultPendingMinMs: 150,
  });

  return router;
};


