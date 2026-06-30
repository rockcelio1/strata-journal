import { EFFECT_COMPONENTS } from "./effects";
import type { SkeletonEffectType, SkeletonLayoutType } from "./types";

export function SkeletonPreview({
  effect,
  layout = "card",
}: {
  effect: SkeletonEffectType;
  layout?: SkeletonLayoutType;
}) {
  const Cmp = EFFECT_COMPONENTS[effect] ?? EFFECT_COMPONENTS.shimmer;
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <Cmp layout={layout} />
    </div>
  );
}
