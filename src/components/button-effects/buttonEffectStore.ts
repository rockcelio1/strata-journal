import { supabase } from "@/integrations/supabase/client";
import { normalizeButtonEffect, type ButtonEffectType } from "./buttonEffects";
import { buttonRegistry, findButton } from "./buttonRegistry";

type Cache = Map<string, ButtonEffectType>;

let cache: Cache | null = null;
let inflight: Promise<Cache> | null = null;
const listeners = new Set<() => void>();

function emit() { for (const l of listeners) try { l(); } catch {} }

async function load(): Promise<Cache> {
  const next: Cache = new Map();
  try {
    const { data, error } = await supabase
      .from("button_effect_settings")
      .select("button_key, effect_type, is_active");
    if (error) throw error;
    for (const row of data ?? []) {
      if (!row.is_active) continue;
      next.set(row.button_key, normalizeButtonEffect(row.effect_type));
    }
  } catch {
    // fallback silencioso: cache vazia => usa defaults do registry
  }
  cache = next;
  emit();
  return next;
}

export function ensureButtonEffectsLoaded(): Promise<Cache> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) inflight = load().finally(() => { inflight = null; });
  return inflight;
}

export function getButtonEffectSync(buttonKey: string): ButtonEffectType {
  const reg = findButton(buttonKey);
  const fallback: ButtonEffectType = reg?.defaultEffect ?? "none";
  if (!cache) {
    // dispara load em background, retorna fallback agora
    ensureButtonEffectsLoaded();
    return fallback;
  }
  return cache.get(buttonKey) ?? fallback;
}

export function subscribeButtonEffects(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function clearButtonEffectsCache() {
  cache = null;
  inflight = null;
  emit();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("button-effects-updated"));
  }
}

export function listRegisteredButtons() {
  return buttonRegistry;
}

// Prefetch eager no boot (apenas no cliente)
if (typeof window !== "undefined") {
  ensureButtonEffectsLoaded().catch(() => {});
  window.addEventListener("button-effects-updated", () => { ensureButtonEffectsLoaded(); });
}
