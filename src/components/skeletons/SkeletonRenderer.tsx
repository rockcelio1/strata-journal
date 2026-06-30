import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EFFECT_COMPONENTS } from "./effects";
import { findScreen } from "./registry";
import { isSkeletonEffect, type SkeletonEffectType, type SkeletonLayoutType } from "./types";

type Props = {
  screenKey: string;
  isLoading: boolean;
  children?: React.ReactNode;
  fallbackVariant?: SkeletonEffectType;
  layout?: SkeletonLayoutType;
};

const cache = new Map<string, SkeletonEffectType>();
let prefetchPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

export type SkeletonDebugEntry = {
  screenKey: string;
  effect: SkeletonEffectType;
  layout: SkeletonLayoutType;
  registered: boolean;
  at: number;
};
const debugLog: SkeletonDebugEntry[] = [];

function emit() {
  for (const l of listeners) l();
}

export function subscribeSkeletonDebug(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export function getSkeletonDebug(): SkeletonDebugEntry[] {
  return debugLog;
}
export function getSkeletonCacheSnapshot(): Record<string, SkeletonEffectType> {
  return Object.fromEntries(cache.entries());
}

async function prefetchAll(): Promise<void> {
  if (prefetchPromise) return prefetchPromise;
  prefetchPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("skeleton_loading_settings")
        .select("screen_key, effect_type, is_active");
      if (error || !data) return;
      cache.clear();
      for (const row of data as { screen_key: string; effect_type: string; is_active: boolean }[]) {
        if (row.is_active && isSkeletonEffect(row.effect_type)) {
          cache.set(row.screen_key, row.effect_type);
        }
      }
      emit();
    } catch {
      /* fall back to defaults */
    }
  })();
  return prefetchPromise;
}

if (typeof window !== "undefined") {
  void prefetchAll();
  try {
    supabase
      .channel("skeleton_loading_settings_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "skeleton_loading_settings" },
        () => {
          prefetchPromise = null;
          void prefetchAll().then(() => {
            window.dispatchEvent(new CustomEvent("skeleton-settings-updated"));
          });
        },
      )
      .subscribe();
  } catch {
    /* ignore */
  }
  window.addEventListener("skeleton-settings-updated", () => {
    prefetchPromise = null;
    void prefetchAll();
  });
}

export function SkeletonRenderer({
  screenKey,
  isLoading,
  children,
  fallbackVariant,
  layout,
}: Props) {
  const screen = findScreen(screenKey);
  const registered = Boolean(screen);
  const resolvedLayout: SkeletonLayoutType = layout ?? screen?.layout ?? "default";
  const defaultEffect: SkeletonEffectType =
    fallbackVariant ?? screen?.defaultEffect ?? "none";

  // Re-render on cache/prefetch updates so saved settings apply on the CURRENT screen.
  useSyncExternalStore(
    subscribeSkeletonDebug,
    () => cache.get(screenKey) ?? "__default__",
    () => "__ssr__",
  );

  const [, force] = useState(0);
  useEffect(() => {
    const handler = () => force((n) => n + 1);
    window.addEventListener("skeleton-settings-updated", handler);
    return () => window.removeEventListener("skeleton-settings-updated", handler);
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    void prefetchAll();
  }, [screenKey, isLoading]);

  if (!isLoading) return <>{children}</>;

  const effect: SkeletonEffectType = cache.get(screenKey) ?? defaultEffect;
  const Effect = EFFECT_COMPONENTS[effect] ?? EFFECT_COMPONENTS.shimmer;

  // Push debug entry (keep last 20)
  debugLog.unshift({ screenKey, effect, layout: resolvedLayout, registered, at: Date.now() });
  if (debugLog.length > 20) debugLog.length = 20;

  try {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-live="polite"
        className="w-full"
        data-skeleton-screen={screenKey}
        data-skeleton-effect={effect}
        data-skeleton-layout={resolvedLayout}
      >
        <span className="sr-only">Carregando…</span>
        <Effect layout={resolvedLayout} />
      </div>
    );
  } catch {
    const Fallback = EFFECT_COMPONENTS.shimmer;
    return <Fallback layout={resolvedLayout} />;
  }
}

export function clearSkeletonCache() {
  cache.clear();
  prefetchPromise = null;
  emit();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("skeleton-settings-updated"));
  }
}
