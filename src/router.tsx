import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function PendingScreen() {
  return (
    <div className="min-h-[60vh] p-6 max-w-5xl mx-auto animate-pulse">
      <div className="h-8 w-48 rounded-md bg-muted mb-6" />
      <div className="grid gap-3">
        <div className="h-24 rounded-xl bg-muted/70" />
        <div className="h-24 rounded-xl bg-muted/70" />
        <div className="h-24 rounded-xl bg-muted/70" />
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    defaultPendingComponent: PendingScreen,
    defaultPendingMs: 150,
    defaultPendingMinMs: 0,
  });

  return router;
};

