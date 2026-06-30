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
  return (
    <Button
      type="button"
      onClick={(e) => e.preventDefault()}
      className={cn("min-w-[140px]", cls)}
      aria-label={`Pré-visualização ${effect}`}
    >
      <Rocket aria-hidden className="h-4 w-4" />
      <span>{label}</span>
    </Button>
  );
}
