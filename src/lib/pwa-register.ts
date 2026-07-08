// Guarded PWA registration. Runs only in production, outside Lovable preview/iframe.
// Trata usuários com uma versão antiga do SW: quando um novo SW entra em
// "waiting", pedimos skipWaiting e recarregamos a rota atual (sem voltar
// para a home) assim que o novo controller assumir.
export function registerPwa() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  const host = window.location.hostname;
  const inIframe = window.self !== window.top;
  const killed = new URLSearchParams(window.location.search).get("sw") === "off";
  const isPreview =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");

  if (inIframe || isPreview || killed) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        if (r.active?.scriptURL.endsWith("/sw.js")) r.unregister();
      });
    });
    return;
  }

  import("workbox-window")
    .then(({ Workbox }) => {
      const wb = new Workbox("/sw.js");

      let reloading = false;
      // Quando o novo SW assume, recarrega mantendo a rota atual.
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        // Preserva pathname + search + hash (não volta para "/").
        const href = window.location.pathname + window.location.search + window.location.hash;
        window.location.replace(href);
      });

      const promptUpdate = () => {
        // Ativa o novo SW imediatamente; o controllerchange acima faz o reload.
        wb.messageSkipWaiting();
      };
      wb.addEventListener("waiting", promptUpdate);
      wb.addEventListener("externalwaiting", promptUpdate);

      wb.register().catch(() => {});
    })
    .catch(() => {});
}
