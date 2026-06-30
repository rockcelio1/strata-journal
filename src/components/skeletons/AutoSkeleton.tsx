import { useRouterState } from "@tanstack/react-router";
import { SkeletonRenderer } from "./SkeletonRenderer";
import { screenRegistry } from "./registry";

function matchPath(routePath: string | undefined, current: string): boolean {
  if (!routePath) return false;
  const r = routePath.replace(/\$[^/]+/g, "[^/]+").replace(/\//g, "\\/");
  return new RegExp(`^${r}\\/?$`).test(current);
}

function resolveScreenKey(pathname: string): string {
  // prefer most specific (longest path) match
  const sorted = [...screenRegistry].sort(
    (a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0),
  );
  const found = sorted.find((s) => matchPath(s.path, pathname));
  return found?.key ?? "dashboard";
}

export function AutoSkeleton() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const key = resolveScreenKey(pathname);
  return <SkeletonRenderer screenKey={key} isLoading />;
}
