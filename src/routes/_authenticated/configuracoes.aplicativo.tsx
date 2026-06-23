import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, Tablet, Monitor, RefreshCw, Apple, Download } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe, updateEmpresaAppLinks } from "@/lib/core.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/configuracoes/aplicativo")({
  component: AplicativoPage,
});

const PRESETS = [
  { label: "Mobile", width: 360, height: 720, icon: Smartphone },
  { label: "Tablet", width: 768, height: 1024, icon: Tablet },
  { label: "Desktop", width: 1024, height: 720, icon: Monitor },
] as const;

function AplicativoPage() {
  const qc = useQueryClient();
  const [width, setWidth] = useState(360);
  const [height, setHeight] = useState(720);
  const [path, setPath] = useState("/dashboard");
  const [reloadKey, setReloadKey] = useState(0);

  const meFn = useServerFn(getMe);
  const updateLinksFn = useServerFn(updateEmpresaAppLinks);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const empresa: any = me.data?.empresa ?? null;
  const isAdmin = (me.data?.roles ?? []).some((r) => r === "admin" || r === "master");

  const [iosUrl, setIosUrl] = useState("");
  const [androidUrl, setAndroidUrl] = useState("");
  useEffect(() => {
    if (empresa) {
      setIosUrl(empresa.app_ios_url ?? "");
      setAndroidUrl(empresa.app_android_url ?? "");
    }
  }, [empresa?.id, empresa?.app_ios_url, empresa?.app_android_url]);

  const mSave = useMutation({
    mutationFn: (v: { app_ios_url: string | null; app_android_url: string | null }) => updateLinksFn({ data: v }),
    onSuccess: () => { toast.success("Links salvos"); qc.invalidateQueries({ queryKey: ["me"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-serif text-xl">Aplicativo</h2>
        <p className="text-sm text-muted-foreground">
          Downloads do app de campo, pré-visualização responsiva e preferências.
        </p>
      </div>

      {/* Downloads iOS / Android */}
      <Card className="p-4 space-y-4">
        <div>
          <h3 className="font-serif text-lg">Baixar o aplicativo</h3>
          <p className="text-xs text-muted-foreground">Links para download nas lojas oficiais.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={iosUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!iosUrl}
            onClick={(e) => { if (!iosUrl) e.preventDefault(); }}
            className={`flex items-center gap-3 rounded-lg border border-border p-4 min-h-[64px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${iosUrl ? "active:bg-muted/60" : "opacity-50 cursor-not-allowed"}`}
          >
            <Apple className="h-8 w-8" />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">Baixar para</div>
              <div className="font-medium">iPhone / iPad (iOS)</div>
            </div>
            <Download className="h-5 w-5 text-muted-foreground" />
          </a>
          <a
            href={androidUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!androidUrl}
            onClick={(e) => { if (!androidUrl) e.preventDefault(); }}
            className={`flex items-center gap-3 rounded-lg border border-border p-4 min-h-[64px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${androidUrl ? "active:bg-muted/60" : "opacity-50 cursor-not-allowed"}`}
          >
            <Smartphone className="h-8 w-8" />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">Baixar para</div>
              <div className="font-medium">Android (Play Store / APK)</div>
            </div>
            <Download className="h-5 w-5 text-muted-foreground" />
          </a>
        </div>

        {isAdmin && (
          <div className="border-t pt-4 space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Configurar links (admin)</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ios-url">URL iOS (App Store / TestFlight)</Label>
                <Input id="ios-url" value={iosUrl} onChange={(e) => setIosUrl(e.target.value)} placeholder="https://apps.apple.com/..." />
              </div>
              <div className="space-y-1">
                <Label htmlFor="android-url">URL Android (Play Store / APK)</Label>
                <Input id="android-url" value={androidUrl} onChange={(e) => setAndroidUrl(e.target.value)} placeholder="https://play.google.com/..." />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                className="min-h-[44px]"
                onClick={() => mSave.mutate({ app_ios_url: iosUrl.trim() || null, app_android_url: androidUrl.trim() || null })}
                disabled={mSave.isPending}
              >
                Salvar links
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Para iOS sem App Store use TestFlight. Para Android você pode hospedar o APK e usar a URL pública.
            </p>
          </div>
        )}
      </Card>


      {isAdmin && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-serif text-lg">Pré-visualização responsiva</h3>
              <p className="text-xs text-muted-foreground">
                Simule larguras antes de publicar — útil para validar layout web e mobile.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReloadKey((k) => k + 1)}
              className="min-h-[44px]"
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Recarregar
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-2 flex-wrap">
              {PRESETS.map((p) => {
                const active = width === p.width;
                return (
                  <Button
                    key={p.label}
                    variant={active ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setWidth(p.width); setHeight(p.height); }}
                    className="min-h-[44px]"
                  >
                    <p.icon className="h-4 w-4 mr-1" />
                    {p.label} <span className="ml-1 text-xs opacity-70">{p.width}px</span>
                  </Button>
                );
              })}
            </div>
            <div className="flex items-end gap-2">
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Largura
                <Input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value) || 360)}
                  className="w-24 h-10"
                  min={280}
                  max={1920}
                />
              </label>
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Altura
                <Input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value) || 720)}
                  className="w-24 h-10"
                  min={400}
                  max={1600}
                />
              </label>
              <label className="text-xs text-muted-foreground flex flex-col gap-1 flex-1 min-w-[180px]">
                Rota
                <Input
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/dashboard"
                  className="h-10"
                />
              </label>
            </div>
          </div>

          <div className="bg-muted/30 rounded-lg p-3 sm:p-6 overflow-auto">
            <div
              className="mx-auto bg-background rounded-2xl shadow-lg border border-border overflow-hidden"
              style={{ width: `${width}px`, maxWidth: "100%" }}
            >
              <div className="h-6 bg-muted flex items-center justify-center text-[10px] text-muted-foreground tabular-nums">
                {width} × {height}
              </div>
              <iframe
                key={reloadKey}
                src={path}
                title="Pré-visualização"
                loading="eager"
                referrerPolicy="same-origin"
                style={{ width: "100%", height: `${height}px`, border: 0, display: "block" }}
              />
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6 text-sm text-muted-foreground bg-muted/30 border-dashed">
        Em breve: modo offline, qualidade de fotos, destino de upload (OneDrive/Supabase), sincronização.
      </Card>
    </section>
  );
}
