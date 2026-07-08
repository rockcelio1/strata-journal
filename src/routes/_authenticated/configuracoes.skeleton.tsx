import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/lib/toast";
import {
  SKELETON_EFFECTS,
  screenRegistry,
  isSkeletonEffect,
  SkeletonPreview,
  clearSkeletonCache,
  type SkeletonEffectType,
} from "@/components/skeletons";
import { Sparkles, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes/skeleton")({
  component: SkeletonSettingsPage,
});

type Row = {
  screen_key: string;
  effect_type: SkeletonEffectType;
  layout_type: string;
  is_active: boolean;
};

function SkeletonSettingsPage() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["skeleton_loading_settings"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("skeleton_loading_settings")
        .select("screen_key, effect_type, layout_type, is_active");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const savedMap = new Map<string, SkeletonEffectType>();
  for (const r of rows) if (isSkeletonEffect(r.effect_type)) savedMap.set(r.screen_key, r.effect_type);

  const [draft, setDraft] = useState<Record<string, SkeletonEffectType>>({});
  useEffect(() => {
    const next: Record<string, SkeletonEffectType> = {};
    for (const s of screenRegistry) next[s.key] = savedMap.get(s.key) ?? s.defaultEffect;
    setDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  const upsert = useMutation({
    mutationFn: async (input: { screen_key: string; screen_name: string; effect_type: SkeletonEffectType; layout_type: string }) => {
      const { error } = await supabase
        .from("skeleton_loading_settings")
        .upsert(
          { ...input, is_active: true, updated_at: new Date().toISOString() },
          { onConflict: "screen_key" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      clearSkeletonCache();
      qc.invalidateQueries({ queryKey: ["skeleton_loading_settings"] });
      notify.success("Efeito salvo.");
    },
    onError: (e: any) => notify.error(e?.message ?? "Falha ao salvar."),
  });

  const reset = useMutation({
    mutationFn: async (screen_key: string) => {
      const { error } = await supabase
        .from("skeleton_loading_settings")
        .delete()
        .eq("screen_key", screen_key);
      if (error) throw error;
    },
    onSuccess: () => {
      clearSkeletonCache();
      qc.invalidateQueries({ queryKey: ["skeleton_loading_settings"] });
      notify.success("Restaurado para o padrão.");
    },
    onError: (e: any) => notify.error(e?.message ?? "Falha ao restaurar."),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-brand/10 text-brand grid place-items-center">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-serif text-2xl leading-none">Efeitos de Carregamento</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Escolha o skeleton exibido enquanto cada tela carrega.
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {screenRegistry.map((s) => {
          const current = draft[s.key] ?? s.defaultEffect;
          const saved = savedMap.get(s.key);
          const dirty = saved !== current && !(saved === undefined && current === s.defaultEffect);

          return (
            <Card key={s.key} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {s.path ?? "—"} · layout: {s.layout}
                  </div>
                </div>
                {saved ? (
                  <Badge variant="outline" className="text-brand border-brand/40">salvo</Badge>
                ) : (
                  <Badge variant="outline">padrão</Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={current}
                  onValueChange={(v) => setDraft((d) => ({ ...d, [s.key]: v as SkeletonEffectType }))}
                >
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SKELETON_EFFECTS.map((e) => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  disabled={!dirty || upsert.isPending}
                  onClick={() =>
                    upsert.mutate({
                      screen_key: s.key,
                      screen_name: s.name,
                      effect_type: current,
                      layout_type: s.layout,
                    })
                  }
                  className="bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  Salvar
                </Button>

                {saved && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => reset.mutate(s.key)}
                    disabled={reset.isPending}
                    title="Restaurar padrão"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div>
                <div className="text-[11px] text-muted-foreground mb-1">Prévia</div>
                <SkeletonPreview effect={current} layout={s.layout} />
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <div className="font-medium mb-3">Galeria de efeitos</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SKELETON_EFFECTS.map((e) => (
            <div key={e.value} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{e.label}</span>
                <span className="text-[11px] text-muted-foreground">{e.desc}</span>
              </div>
              <SkeletonPreview effect={e.value} layout="card" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
