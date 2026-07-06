// Sinaliza globalmente que existe um RDO em rascunho aberto,
// para que qualquer tela mostre um botão "voltar à edição".
import { useEffect, useState } from "react";

const KEY = "rdo:draft-active";
const EVENT = "rdo:draft-active-change";

export function markDraftActive() {
  try {
    if (localStorage.getItem(KEY) === "1") return;
    localStorage.setItem(KEY, "1");
    window.dispatchEvent(new Event(EVENT));
  } catch { /* noop */ }
}

export function clearDraftActive() {
  try {
    if (localStorage.getItem(KEY) === null) return;
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch { /* noop */ }
}

export function isDraftActive(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function useDraftActive(): boolean {
  const [v, setV] = useState<boolean>(() => isDraftActive());
  useEffect(() => {
    const handler = () => setV(isDraftActive());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return v;
}
