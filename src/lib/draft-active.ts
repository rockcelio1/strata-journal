// Sinaliza globalmente que existe um RDO em rascunho aberto,
// para que qualquer tela mostre um botão "voltar à edição".
import { useEffect, useState } from "react";

const KEY = "rdo:draft-active";
const DISMISS_KEY = "rdo:draft-alert-dismissed";
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
    // Ao encerrar/limpar o rascunho, também limpamos o "dispensar"
    // para que o aviso volte a aparecer no próximo rascunho.
    sessionStorage.removeItem(DISMISS_KEY);
    if (localStorage.getItem(KEY) === null) return;
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch { /* noop */ }
}

export function isDraftActive(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

// Oculta temporariamente o aviso flutuante APENAS nesta aba/sessão,
// sem apagar o rascunho. Ao recarregar/abrir nova sessão, volta a exibir.
export function dismissDraftAlertForSession() {
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
    window.dispatchEvent(new Event(EVENT));
  } catch { /* noop */ }
}

export function isDraftAlertDismissed(): boolean {
  try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}

export function useDraftActive(): boolean {
  const [v, setV] = useState<boolean>(() => isDraftActive() && !isDraftAlertDismissed());
  useEffect(() => {
    const handler = () => setV(isDraftActive() && !isDraftAlertDismissed());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return v;
}
