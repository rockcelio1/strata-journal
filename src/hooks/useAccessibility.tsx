import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

export type TextScale = "normal" | "large" | "xlarge";

export type A11ySettings = {
  reducedMotion: boolean; // forçado pelo usuário (além do sistema)
  highContrast: boolean;
  textScale: TextScale;
};

const STORAGE_KEY = "a11y:settings:v1";

const DEFAULTS: A11ySettings = {
  reducedMotion: false,
  highContrast: false,
  textScale: "normal",
};

function loadFromStorage(): A11ySettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<A11ySettings>) };
  } catch {
    return DEFAULTS;
  }
}

type Ctx = {
  settings: A11ySettings;
  effectiveReducedMotion: boolean;
  set: <K extends keyof A11ySettings>(key: K, value: A11ySettings[K]) => void;
  reset: () => void;
};

const AccessibilityContext = createContext<Ctx | null>(null);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<A11ySettings>(() => loadFromStorage());
  const systemReduced = usePrefersReducedMotion();
  const effectiveReducedMotion = systemReduced || settings.reducedMotion;

  // Aplica classes no <html> para CSS global e persiste
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("a11y-contrast", settings.highContrast);
    root.classList.toggle("a11y-text-lg", settings.textScale === "large");
    root.classList.toggle("a11y-text-xl", settings.textScale === "xlarge");
    root.classList.toggle("a11y-reduce-motion", effectiveReducedMotion);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings, effectiveReducedMotion]);

  const set = useCallback(<K extends keyof A11ySettings>(key: K, value: A11ySettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  }, []);
  const reset = useCallback(() => setSettings(DEFAULTS), []);

  const value = useMemo<Ctx>(() => ({ settings, effectiveReducedMotion, set, reset }), [settings, effectiveReducedMotion, set, reset]);
  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibility(): Ctx {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    // Fallback seguro para árvores fora do provider (ex.: testes isolados)
    return {
      settings: DEFAULTS,
      effectiveReducedMotion: false,
      set: () => {},
      reset: () => {},
    };
  }
  return ctx;
}
