// Detecta redirecionamentos inesperados logo após um refresh/deep-link.
// Se a rota inicial mudar sem clique/submit do usuário nos primeiros 4s,
// registra um aviso no console (e dispara um evento para métricas externas).
export function installRefreshAudit(router: { subscribe: any }) {
  if (typeof window === "undefined") return () => {};

  const initialPath = window.location.pathname + window.location.search;
  let userInteracted = false;
  const markInteraction = () => {
    userInteracted = true;
  };
  window.addEventListener("pointerdown", markInteraction, { once: true, capture: true });
  window.addEventListener("keydown", markInteraction, { once: true, capture: true });
  window.addEventListener("submit", markInteraction, { once: true, capture: true });

  const deadline = Date.now() + 4000;
  const unsub = router.subscribe("onResolved", (e: any) => {
    const to = e?.toLocation?.pathname as string | undefined;
    if (!to) return;
    const now = to + (e?.toLocation?.searchStr ?? "");
    if (now === initialPath) return;
    if (Date.now() > deadline) return;
    if (userInteracted) return;
    const payload = {
      from: initialPath,
      to: now,
      at: new Date().toISOString(),
      ua: navigator.userAgent,
    };
    // eslint-disable-next-line no-console
    console.warn("[refresh-audit] unexpected redirect after refresh", payload);
    try {
      window.dispatchEvent(new CustomEvent("refresh-audit:unexpected-redirect", { detail: payload }));
      const key = "refresh-audit:events";
      const buf = JSON.parse(localStorage.getItem(key) ?? "[]");
      buf.push(payload);
      localStorage.setItem(key, JSON.stringify(buf.slice(-20)));
    } catch {}
  });

  return () => {
    unsub();
    window.removeEventListener("pointerdown", markInteraction, true as any);
    window.removeEventListener("keydown", markInteraction, true as any);
    window.removeEventListener("submit", markInteraction, true as any);
  };
}
