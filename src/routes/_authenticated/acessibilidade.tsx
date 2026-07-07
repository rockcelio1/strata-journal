import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Eye, TextAa, Rewind } from "@phosphor-icons/react";
import { useAccessibility, type TextScale } from "@/hooks/useAccessibility";

export const Route = createFileRoute("/_authenticated/acessibilidade")({
  component: AcessibilidadePage,
});

function AcessibilidadePage() {
  const { settings, effectiveReducedMotion, set, reset } = useAccessibility();

  return (
    <div className="space-y-4 max-w-3xl">
      <header className="flex items-center gap-2">
        <Eye className="h-5 w-5 text-brand" />
        <h2 className="font-serif text-xl">Acessibilidade</h2>
      </header>
      <p className="text-sm text-muted-foreground">
        Preferências salvas neste dispositivo e aplicadas a todo o sistema.
      </p>

      <Card className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="a11y-contrast" className="text-sm font-medium">Alto contraste</Label>
            <p className="text-xs text-muted-foreground">Aumenta o contraste geral para melhor leitura.</p>
          </div>
          <Switch
            id="a11y-contrast"
            checked={settings.highContrast}
            onCheckedChange={(v) => set("highContrast", !!v)}
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="a11y-reduce" className="text-sm font-medium">Reduzir movimento</Label>
            <p className="text-xs text-muted-foreground">
              Pausa rotações automáticas e animações. Sistema: {effectiveReducedMotion ? "ativo" : "inativo"}.
            </p>
          </div>
          <Switch
            id="a11y-reduce"
            checked={settings.reducedMotion}
            onCheckedChange={(v) => set("reducedMotion", !!v)}
          />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <TextAa className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Tamanho do texto</Label>
          </div>
          <RadioGroup
            value={settings.textScale}
            onValueChange={(v) => set("textScale", v as TextScale)}
            className="grid gap-2 sm:grid-cols-3"
          >
            {[
              { v: "normal" as const, label: "Normal (100%)" },
              { v: "large" as const, label: "Grande (115%)" },
              { v: "xlarge" as const, label: "Extra (130%)" },
            ].map((o) => (
              <label key={o.v} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent">
                <RadioGroupItem id={`ts-${o.v}`} value={o.v} />
                <span className="text-sm">{o.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className="pt-2">
          <Button variant="outline" size="sm" onClick={reset}>
            <Rewind className="mr-2 h-4 w-4" /> Restaurar padrões
          </Button>
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <h3 className="text-sm font-semibold">Prévia</h3>
        <p className="text-sm text-foreground">Texto padrão do sistema para conferência.</p>
        <p className="text-xs text-muted-foreground">Texto auxiliar — legendas, dicas e valores tabulados.</p>
      </Card>
    </div>
  );
}
