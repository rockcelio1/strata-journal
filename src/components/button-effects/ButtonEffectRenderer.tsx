import * as React from "react";
import { cn } from "@/lib/utils";
import { getButtonEffectClass } from "./buttonEffectClasses";
import { normalizeButtonEffect, type ButtonEffectType } from "./buttonEffects";
import {
  getButtonEffectSync,
  subscribeButtonEffects,
  ensureButtonEffectsLoaded,
} from "./buttonEffectStore";

export type ButtonEffectRendererProps = {
  buttonKey: string;
  /** Override opcional — ignora a configuração salva. */
  effect?: ButtonEffectType;
  children: React.ReactElement;
};

/**
 * Envolve um botão existente e adiciona apenas classes CSS de efeito visual.
 *
 * NÃO altera onClick, type, disabled, aria-label, permissões ou comportamento.
 * Em caso de qualquer falha de leitura/configuração, renderiza o filho intacto.
 */
export function ButtonEffectRenderer({ buttonKey, effect, children }: ButtonEffectRendererProps) {
  // forçar re-render quando o cache mudar
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    ensureButtonEffectsLoaded().catch(() => {});
    const unsub = subscribeButtonEffects(() => force());
    const onEvt = () => force();
    if (typeof window !== "undefined") window.addEventListener("button-effects-updated", onEvt);
    return () => {
      unsub();
      if (typeof window !== "undefined") window.removeEventListener("button-effects-updated", onEvt);
    };
  }, []);

  try {
    if (!React.isValidElement(children)) return children as any;
    const resolved = normalizeButtonEffect(effect ?? getButtonEffectSync(buttonKey));
    if (resolved === "none") return children;
    const fxClass = getButtonEffectClass(resolved);
    if (!fxClass) return children;
    const childProps = (children.props ?? {}) as { className?: string };
    return React.cloneElement(children, {
      className: cn(childProps.className, fxClass),
      "data-button-key": buttonKey,
      "data-button-effect": resolved,
    } as any);
  } catch {
    return children;
  }
}
