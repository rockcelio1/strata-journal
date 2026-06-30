import type { ButtonEffectType } from "./buttonEffects";

/**
 * Mapeamento estático de efeito -> classe utilitária CSS.
 * As classes estão definidas em src/components/button-effects/button-effects.css
 * e são carregadas via styles.css.
 *
 * IMPORTANTE: estas classes são puramente visuais. Elas não alteram onClick,
 * disabled, type, aria-label nem comportamento de submit do botão.
 */
export const BUTTON_EFFECT_CLASS: Record<ButtonEffectType, string> = {
  none: "",
  typewriter: "btnfx btnfx-typewriter",
  rocket: "btnfx btnfx-rocket",
  iconSwap: "btnfx btnfx-icon-swap",
  spark: "btnfx btnfx-spark",
  circleExpand: "btnfx btnfx-circle-expand",
  shine: "btnfx btnfx-shine",
  flip: "btnfx btnfx-flip",
  expand: "btnfx btnfx-expand",
  badgeArrow: "btnfx btnfx-badge-arrow",
  warp: "btnfx btnfx-warp",
};

export function getButtonEffectClass(effect: ButtonEffectType | undefined | null): string {
  if (!effect) return "";
  return BUTTON_EFFECT_CLASS[effect] ?? "";
}
