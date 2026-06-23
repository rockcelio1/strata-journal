import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Smartphone, Tablet, Monitor, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes/aplicativo")({
  component: AplicativoPage,
});

const PRESETS = [
  { label: "Mobile", width: 360, height: 720, icon: Smartphone },
  { label: "Tablet", width: 768, height: 1024, icon: Tablet },
  { label: "Desktop", width: 1024, height: 720, icon: Monitor },
] as const;

function AplicativoPage() {
  const [width, setWidth] = useState(360);
  const [height, setHeight] = useState(720);
  const [path, setPath] = useState("/dashboard");
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-serif text-xl">Aplicativo</h2>
        <p className="text-sm text-muted-foreground">
          Preferências do app de campo e pré-visualização responsiva.
        </p>
      </div>

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
              style={{ width: "100%", height: `${height}px`, border: 0, display: "block" }}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6 text-sm text-muted-foreground bg-muted/30 border-dashed">
        Em breve: modo offline, qualidade de fotos, destino de upload (OneDrive/Supabase), sincronização.
      </Card>
    </section>
  );
}
