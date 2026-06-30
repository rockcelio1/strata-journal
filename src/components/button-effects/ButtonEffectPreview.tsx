import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";
import { getButtonEffectClass } from "./buttonEffectClasses";
import type { ButtonEffectType } from "./buttonEffects";
import { cn } from "@/lib/utils";

export function ButtonEffectPreview({
  effect,
  label = "Exemplo",
}: {
  effect: ButtonEffectType;
  label?: string;
}) {
  const cls = getButtonEffectClass(effect);
  const [playing, setPlaying] = useState(false);

  // Auto-play the effect each time the user picks a different one so the
  // preview reflects the choice immediately (most effects are :hover-driven).
  useEffect(() => {
    if (!cls) return;
    setPlaying(true);
    const t = setTimeout(() => setPlaying(false), 1400);
    return () => clearTimeout(t);
  }, [effect, cls]);

  return (
    <Button
      key={effect}
      type="button"
      onClick={(e) => {
        e.preventDefault();
        setPlaying(false);
        requestAnimationFrame(() => setPlaying(true));
        setTimeout(() => setPlaying(false), 1400);
      }}
      className={cn("min-w-[140px]", cls, playing && "btnfx-demo")}
      aria-label={`Pré-visualização ${effect}`}
    >
      <Rocket aria-hidden className="h-4 w-4" />
      <span>{label}</span>
    </Button>
  );
}
