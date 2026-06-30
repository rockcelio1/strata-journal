import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Sparkles, RotateCcw, Save } from "lucide-react";
import {
  BUTTON_EFFECTS,
  ButtonEffectPreview,
  buttonRegistry,
  clearButtonEffectsCache,
  ensureButtonEffectsLoaded,
  getButtonEffectSync,
  normalizeButtonEffect,
  type ButtonEffectType,
} from "@/components/button-effects";

export const Route = createFileRoute("/_authenticated/configuracoes/botoes-efeitos")({
  component: ButtonEffectsSettingsPage,
});

function ButtonEffectsSettingsPage() {
  const [search, setSearch] = useState("");
  const [screenFilter, setScreenFilter] = useState<string>("all");
  const [pending, setPending] = useState<Record<string, ButtonEffectType>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    ensureButtonEffectsLoaded().then(() => force((n) => n + 1));
    const onEvt = () => force((n) => n + 1);
    window.addEventListener("button-effects-updated", onEvt);
    return () => window.removeEventListener("button-effects-updated", onEvt);
  }, []);

  const screens = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of buttonRegistry) m.set(b.screenKey, b.screenName);
    return Array.from(m.entries()).map(([key, name]) => ({ key, name }));
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return buttonRegistry.filter((b) => {
      if (screenFilter !== "all" && b.screenKey !== screenFilter) return false;
      if (!q) return true;
      return (
        b.label.toLowerCase().includes(q) ||
        b.key.toLowerCase().includes(q) ||
        b.screenName.toLowerCase().includes(q)
      );
    });
  }, [search, screenFilter]);

  function getCurrent(key: string): ButtonEffectType {
    return pending[key] ?? getButtonEffectSync(key);
  }

  async function save(key: string) {
    const entry = buttonRegistry.find((b) => b.key === key);
    if (!entry) return;
    const effect = normalizeButtonEffect(pending[key] ?? getButtonEffectSync(key));
    setSaving(key);
    try {
      const { error } = await supabase
        .from("button_effect_settings")
        .upsert(
          {
            button_key: entry.key,
            button_label: entry.label,
            screen_key: entry.screenKey,
            screen_name: entry.screenName,
            effect_type: effect,
            is_active: true,
          },
          { onConflict: "button_key" },
        );
      if (error) throw error;
      clearButtonEffectsCache();
      setPending((p) => { const { [key]: _, ...rest } = p; return rest; });
      toast.success(`Efeito salvo para “${entry.label}”`);
    } catch (e: any) {
      toast.error("Falha ao salvar", { description: e?.message });
    } finally {
      setSaving(null);
    }
  }

  async function restoreDefault(key: string) {
    const entry = buttonRegistry.find((b) => b.key === key);
    if (!entry) return;
    setPending((p) => ({ ...p, [key]: entry.defaultEffect }));
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-brand" />
        <div>
          <h2 className="font-serif text-xl leading-none">Efeitos dos Botões</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Escolha um efeito visual para cada botão do sistema. O comportamento (clique, validação, permissão) não é alterado.
          </p>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input placeholder="Buscar botão..." value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
        <Select value={screenFilter} onValueChange={setScreenFilter}>
          <SelectTrigger className="sm:w-[220px]"><SelectValue placeholder="Todas as telas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as telas</SelectItem>
            {screens.map((s) => (<SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-2">Tela</th>
              <th className="p-2">Botão</th>
              <th className="p-2">Ação</th>
              <th className="p-2">Efeito</th>
              <th className="p-2">Prévia</th>
              <th className="p-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const current = getCurrent(b.key);
              const dirty = pending[b.key] !== undefined && pending[b.key] !== getButtonEffectSync(b.key);
              return (
                <tr key={b.key} className="border-t border-border align-middle">
                  <td className="p-2 whitespace-nowrap">{b.screenName}</td>
                  <td className="p-2">
                    <div className="font-medium">{b.label}</div>
                    <div className="text-xs text-muted-foreground">{b.key}</div>
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">{b.selectorHint}</td>
                  <td className="p-2">
                    <Select
                      value={current}
                      onValueChange={(v) => setPending((p) => ({ ...p, [b.key]: v as ButtonEffectType }))}
                    >
                      <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BUTTON_EFFECTS.map((e) => (
                          <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2"><ButtonEffectPreview effect={current} label={b.label.slice(0, 14)} /></td>
                  <td className="p-2">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => restoreDefault(b.key)} title="Restaurar padrão">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={() => save(b.key)} disabled={saving === b.key || !dirty}>
                        <Save className="h-4 w-4" />
                        {saving === b.key ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">Nenhum botão encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <section className="space-y-2">
        <h3 className="font-medium">Galeria de efeitos</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {BUTTON_EFFECTS.filter((e) => e.value !== "none").map((e) => (
            <div key={e.value} className="border border-border rounded-lg p-3 bg-card flex flex-col items-center gap-2">
              <ButtonEffectPreview effect={e.value} label={e.label} />
              <div className="text-xs text-muted-foreground text-center">{e.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
