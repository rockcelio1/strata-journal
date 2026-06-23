// Guarded PWA registration. Runs only in production, outside Lovable preview/iframe.
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
      wb.register().catch(() => {});
    })
    .catch(() => {});
}
