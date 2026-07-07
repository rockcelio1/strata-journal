import { useEffect, useState } from "react";
import { Bug } from "lucide-react";
import {
  subscribeSkeletonDebug,
  getSkeletonDebug,
  getSkeletonCacheSnapshot,
  type SkeletonDebugEntry,
} from "./SkeletonRenderer";
import { resolveScreen } from "./AutoSkeleton";

export function SkeletonDebugPanel() {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [pathname, setPathname] = useState("/");

  useEffect(() => {
    setMounted(true);
    setPathname(window.location.pathname);
    const u = subscribeSkeletonDebug(() => force((n) => n + 1));
    const onNav = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onNav);
    const id = window.setInterval(onNav, 500);
    const onUpd = () => force((n) => n + 1);
    window.addEventListener("skeleton-settings-updated", onUpd);
    return () => {
      u();
      window.removeEventListener("popstate", onNav);
      window.removeEventListener("skeleton-settings-updated", onUpd);
      window.clearInterval(id);
    };
  }, []);

  if (!mounted) return null;
  if (!import.meta.env.DEV && !window.location.search.includes("skeletonDebug=1")) {
    return null;
  }


  const cache = getSkeletonCacheSnapshot();
  const current = resolveScreen(pathname);
  const currentEffect = cache[current.key] ?? current.defaultEffect;
  const log: SkeletonDebugEntry[] = getSkeletonDebug();

  return (
    <div className="fixed bottom-3 right-3 z-[9999]">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-brand text-white shadow-lg p-2 hover:scale-105 transition"
          aria-label="Abrir debug de skeleton"
          title="Skeleton debug"
        >
          <Bug className="h-4 w-4" />
        </button>
      ) : (
        <div className="w-80 max-h-[60vh] overflow-auto rounded-lg border bg-background shadow-xl text-xs">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
            <strong>Skeleton Debug</strong>
            <button onClick={() => setOpen(false)} className="text-muted-foreground">✕</button>
          </div>
          <div className="p-3 space-y-2">
            <div>
              <div className="text-muted-foreground">Rota atual</div>
              <div className="font-mono">{pathname}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-muted-foreground">screenKey</div>
                <div className="font-mono break-all">{current.key}</div>
              </div>
              <div>
                <div className="text-muted-foreground">layout</div>
                <div className="font-mono">{current.layout}</div>
              </div>
              <div>
                <div className="text-muted-foreground">effect</div>
                <div className="font-mono">{currentEffect}</div>
              </div>
              <div>
                <div className="text-muted-foreground">registrado</div>
                <div className="font-mono">{current.key.startsWith("auto:") ? "fallback" : "sim"}</div>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">Cache ({Object.keys(cache).length})</div>
              <pre className="bg-muted/40 p-2 rounded max-h-32 overflow-auto">
                {JSON.stringify(cache, null, 2)}
              </pre>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">Últimos renders</div>
              <ul className="space-y-1">
                {log.slice(0, 8).map((e, i) => (
                  <li key={i} className="font-mono">
                    {new Date(e.at).toLocaleTimeString()} · {e.screenKey} · {e.effect} · {e.layout}
                    {!e.registered && " (fallback)"}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
