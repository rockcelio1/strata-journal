import { useRouterState } from "@tanstack/react-router";
import { SkeletonRenderer } from "./SkeletonRenderer";
import { screenRegistry, type ScreenRegistryEntry } from "./registry";
import type { SkeletonLayoutType } from "./types";

function matchPath(routePath: string | undefined, current: string): boolean {
  if (!routePath) return false;
  const r = routePath.replace(/\$[^/]+/g, "[^/]+").replace(/\//g, "\\/");
  return new RegExp(`^${r}\\/?$`).test(current);
}

function inferLayout(pathname: string): SkeletonLayoutType {
  if (/list|relator|auditori|usuari|permiss|grupos|cadastros/i.test(pathname)) return "table";
  if (/galer|fotos|videos/i.test(pathname)) return "gallery";
  if (/novo|edit|detalhe|\$/i.test(pathname)) return "form";
  if (/dashboard|onedrive|home|configurac/i.test(pathname)) return "dashboard";
  return "card";
}

export function resolveScreen(pathname: string): ScreenRegistryEntry {
  const sorted = [...screenRegistry].sort(
    (a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0),
  );
  const found = sorted.find((s) => matchPath(s.path, pathname));
  if (found) return found;
  // Fallback synthesized entry for screens not in the registry
  return {
    key: `auto:${pathname}`,
    name: pathname,
    path: pathname,
    layout: inferLayout(pathname),
    defaultEffect: "none",
  };
}

export function AutoSkeleton() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const screen = resolveScreen(pathname);
  return (
    <SkeletonRenderer
      screenKey={screen.key}
      isLoading
      layout={screen.layout}
      fallbackVariant={screen.defaultEffect}
    />
  );
}
