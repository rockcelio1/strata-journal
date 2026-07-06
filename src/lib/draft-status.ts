// Pub/sub para o estado do auto-save do rascunho do RDO.
// Usado pelo botão flutuante "RDO em rascunho — Continuar" para mostrar
// um indicador discreto ("Salvando…" / "Rascunho salvo" / "Erro ao salvar").
import { useEffect, useState } from "react";

export type DraftSaveStatus = "idle" | "saving" | "saved" | "error";

const EVENT = "rdo:draft-save-status";
let current: DraftSaveStatus = "idle";
let lastSavedAt: number | null = null;

export function setDraftSaveStatus(next: DraftSaveStatus) {
  current = next;
  if (next === "saved") lastSavedAt = Date.now();
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: { status: next, lastSavedAt } })); } catch { /* noop */ }
}

export function getDraftSaveStatus(): { status: DraftSaveStatus; lastSavedAt: number | null } {
  return { status: current, lastSavedAt };
}

export function useDraftSaveStatus() {
  const [state, setState] = useState(() => getDraftSaveStatus());
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as { status: DraftSaveStatus; lastSavedAt: number | null } | undefined;
      if (d) setState(d);
      else setState(getDraftSaveStatus());
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  return state;
}
