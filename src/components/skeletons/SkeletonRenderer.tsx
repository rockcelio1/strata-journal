import { useEffect, useState } from "react";
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
let prefetched = false;

async function prefetchAll() {
  if (prefetched) return;
  prefetched = true;
  try {
    const { data, error } = await supabase
      .from("skeleton_loading_settings")
      .select("screen_key, effect_type, is_active");
    if (error || !data) return;
    for (const row of data as { screen_key: string; effect_type: string; is_active: boolean }[]) {
      if (row.is_active && isSkeletonEffect(row.effect_type)) {
        cache.set(row.screen_key, row.effect_type);
      }
    }
  } catch {
    /* silently fall back to defaults */
  }
}

export function SkeletonRenderer({
  screenKey,
  isLoading,
  children,
  fallbackVariant,
  layout,
}: Props) {
  const screen = findScreen(screenKey);
  const resolvedLayout: SkeletonLayoutType = layout ?? screen?.layout ?? "default";
  const defaultEffect: SkeletonEffectType =
    fallbackVariant ?? screen?.defaultEffect ?? "shimmer";

  const [effect, setEffect] = useState<SkeletonEffectType>(
    () => cache.get(screenKey) ?? defaultEffect,
  );

  useEffect(() => {
    if (!isLoading) return;
    let cancelled = false;
    prefetchAll().then(() => {
      if (cancelled) return;
      const found = cache.get(screenKey);
      if (found && found !== effect) setEffect(found);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenKey, isLoading]);

  if (!isLoading) return <>{children}</>;

  const Effect = EFFECT_COMPONENTS[effect] ?? EFFECT_COMPONENTS.shimmer;

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[SkeletonRenderer]", { screenKey, effect, layout: resolvedLayout });
  }

  try {
    return (
      <div role="status" aria-busy="true" aria-live="polite" className="w-full">
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
  prefetched = false;
}
