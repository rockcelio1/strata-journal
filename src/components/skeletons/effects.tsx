import { cn } from "@/lib/utils";
import type { SkeletonLayoutType } from "./types";

/**
 * Base block used by every effect. `bg-muted` ensures dark-mode compatibility.
 */
function Block({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("rounded-md bg-muted/70", className)} style={style} />;
}

/* ============ Layout scaffolds (rows shape) ============ */

function layoutRows(layout: SkeletonLayoutType): { rows: number; gridCols?: string; itemClass?: string; container?: string } {
  switch (layout) {
    case "gallery":
      return { rows: 8, gridCols: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3", itemClass: "aspect-square w-full" };
    case "card":
      return { rows: 6, gridCols: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", itemClass: "h-40 w-full" };
    case "table":
      return { rows: 8, itemClass: "h-10 w-full" };
    case "form":
      return { rows: 6, itemClass: "h-12 w-full" };
    case "dashboard":
      return { rows: 4, gridCols: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", itemClass: "h-28 w-full" };
    case "list":
      return { rows: 6, itemClass: "h-14 w-full" };
    default:
      return { rows: 5, itemClass: "h-8 w-full" };
  }
}

function Wrapper({ children, layout }: { children: (i: number) => React.ReactNode; layout: SkeletonLayoutType }) {
  const cfg = layoutRows(layout);
  const items = Array.from({ length: cfg.rows }, (_, i) => i);
  return (
    <div className={cn("w-full", cfg.gridCols ?? "flex flex-col gap-3")} aria-hidden="true">
      {items.map((i) => (
        <div key={i} className={cfg.itemClass}>
          {children(i)}
        </div>
      ))}
    </div>
  );
}

/* ============ 1. Shimmer ============ */
export function ShimmerSkeleton({ layout }: { layout: SkeletonLayoutType }) {
  return (
    <Wrapper layout={layout}>
      {() => (
        <div className="relative h-full w-full overflow-hidden rounded-md bg-muted/70">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent" />
        </div>
      )}
    </Wrapper>
  );
}

/* ============ 2. Gradient ============ */
export function GradientSkeleton({ layout }: { layout: SkeletonLayoutType }) {
  return (
    <Wrapper layout={layout}>
      {() => (
        <div className="h-full w-full rounded-md bg-[length:200%_100%] animate-[gradientMove_2.4s_ease_infinite] bg-gradient-to-r from-brand/30 via-fuchsia-500/30 to-cyan-500/30" />
      )}
    </Wrapper>
  );
}

/* ============ 3. Staggered ============ */
export function StaggeredSkeleton({ layout }: { layout: SkeletonLayoutType }) {
  return (
    <Wrapper layout={layout}>
      {(i) => (
        <div
          className="h-full w-full rounded-md bg-muted animate-pulse"
          style={{ animationDelay: `${(i % 6) * 0.12}s` }}
        />
      )}
    </Wrapper>
  );
}

/* ============ 4. Typewriter ============ */
export function TypewriterSkeleton({ layout }: { layout: SkeletonLayoutType }) {
  return (
    <Wrapper layout={layout}>
      {(i) => (
        <div className="relative h-full w-full overflow-hidden rounded-md bg-muted/60">
          <div
            className="absolute inset-y-0 left-0 bg-muted-foreground/20 animate-[typewriter_1.8s_ease-in-out_infinite]"
            style={{ animationDelay: `${(i % 6) * 0.18}s` }}
          />
        </div>
      )}
    </Wrapper>
  );
}

/* ============ 5. Layered ============ */
export function LayeredSkeleton({ layout }: { layout: SkeletonLayoutType }) {
  return (
    <Wrapper layout={layout}>
      {() => (
        <div className="relative h-full w-full rounded-md bg-muted/70 overflow-hidden">
          <div className="absolute inset-0 rounded-md bg-gradient-to-br from-white/20 via-transparent to-black/10 animate-pulse" />
          <div className="absolute inset-2 rounded bg-muted/80 animate-[pulse_2s_ease-in-out_infinite]" />
        </div>
      )}
    </Wrapper>
  );
}

/* ============ 6. Elastic ============ */
export function ElasticSkeleton({ layout }: { layout: SkeletonLayoutType }) {
  return (
    <Wrapper layout={layout}>
      {(i) => (
        <div
          className="h-full w-full rounded-full bg-brand/30 origin-left animate-[elastic_1.6s_ease-in-out_infinite]"
          style={{ animationDelay: `${(i % 5) * 0.15}s` }}
        />
      )}
    </Wrapper>
  );
}

/* ============ 7. Pulse ============ */
export function PulseSkeleton({ layout }: { layout: SkeletonLayoutType }) {
  return (
    <Wrapper layout={layout}>
      {() => <div className="h-full w-full rounded-md bg-muted animate-pulse" />}
    </Wrapper>
  );
}

/* ============ 8. Cascade ============ */
export function CascadeSkeleton({ layout }: { layout: SkeletonLayoutType }) {
  return (
    <Wrapper layout={layout}>
      {(i) => (
        <div
          className="h-full w-full rounded-md bg-gradient-to-r from-muted via-muted/40 to-muted animate-[cascade_1.8s_ease_infinite]"
          style={{ animationDelay: `${i * 0.08}s` }}
        />
      )}
    </Wrapper>
  );
}

/* ============ 9. Outline ============ */
export function OutlineSkeleton({ layout }: { layout: SkeletonLayoutType }) {
  return (
    <Wrapper layout={layout}>
      {() => (
        <div className="h-full w-full rounded-md border-2 border-dashed border-brand/40 bg-transparent animate-[outline_2s_linear_infinite]" />
      )}
    </Wrapper>
  );
}

export const EFFECT_COMPONENTS = {
  shimmer: ShimmerSkeleton,
  gradient: GradientSkeleton,
  staggered: StaggeredSkeleton,
  typewriter: TypewriterSkeleton,
  layered: LayeredSkeleton,
  elastic: ElasticSkeleton,
  pulse: PulseSkeleton,
  cascade: CascadeSkeleton,
  outline: OutlineSkeleton,
} as const;

export function Block_Export() {
  return <Block />;
}
