import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { listCacheSettings, upsertCacheSetting } from "@/lib/media-audit.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/lib/toast";
import { Gauge, Save } from "lucide-react";

const SIZES = ["small", "medium", "large", "full"] as const;
type Size = (typeof SIZES)[number];
type Row = { thumb_size: Size; max_age_seconds: number; swr_seconds: number; ttl_seconds: number };

export function CacheSettingsSection() {
  const listFn = useServerFn(listCacheSettings);
  const saveFn = useServerFn(upsertCacheSetting);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["onedrive", "cache-settings"], queryFn: () => listFn() });

  const [rows, setRows] = useState<Record<Size, Row>>({} as any);

  useEffect(() => {
    if (!q.data) return;
    const map: Record<Size, Row> = {} as any;
    for (const s of SIZES) {
      const found = (q.data as any[]).find((r) => r.thumb_size === s);
      map[s] = found ?? { thumb_size: s, max_age_seconds: 86400, swr_seconds: 604800, ttl_seconds: 604800 };
    }
    setRows(map);
  }, [q.data]);

  async function save(size: Size) {
    const r = rows[size];
    if (!r) return;
    try {
      await saveFn({ data: {
        thumb_size: size,
        max_age_seconds: Number(r.max_age_seconds) || 0,
        swr_seconds: Number(r.swr_seconds) || 0,
        ttl_seconds: Number(r.ttl_seconds) || 0,
      }});
      notify.success(`Configuração de ${size} salva`);
      qc.invalidateQueries({ queryKey: ["onedrive", "cache-settings"] });
    } catch (e: any) {
      notify.error("Falha ao salvar", { description: e?.message });
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-brand" />
        <h3 className="font-medium text-sm">Cache das thumbnails (TTL e max-age por tamanho)</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Ajuste o cache do proxy do OneDrive por tamanho. <strong>max-age</strong> controla o cache do navegador, <strong>SWR</strong> a revalidação em segundo plano e <strong>TTL</strong> o tempo no cache de borda. Valores em segundos.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-2 py-1">Tamanho</th>
              <th className="text-left px-2 py-1">max-age (s)</th>
              <th className="text-left px-2 py-1">SWR (s)</th>
              <th className="text-left px-2 py-1">TTL edge (s)</th>
              <th className="text-left px-2 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {SIZES.map((s) => {
              const r = rows[s];
              if (!r) return null;
              return (
                <tr key={s} className="border-t border-border">
                  <td className="px-2 py-2"><Badge variant="outline" className="uppercase">{s}</Badge></td>
                  <td className="px-2 py-2 w-32">
                    <Input type="number" min={0} value={r.max_age_seconds}
                      onChange={(e) => setRows((prev) => ({ ...prev, [s]: { ...prev[s], max_age_seconds: Number(e.target.value) } }))} />
                  </td>
                  <td className="px-2 py-2 w-32">
                    <Input type="number" min={0} value={r.swr_seconds}
                      onChange={(e) => setRows((prev) => ({ ...prev, [s]: { ...prev[s], swr_seconds: Number(e.target.value) } }))} />
                  </td>
                  <td className="px-2 py-2 w-32">
                    <Input type="number" min={0} value={r.ttl_seconds}
                      onChange={(e) => setRows((prev) => ({ ...prev, [s]: { ...prev[s], ttl_seconds: Number(e.target.value) } }))} />
                  </td>
                  <td className="px-2 py-2">
                    <Button size="sm" variant="outline" onClick={() => save(s)}>
                      <Save className="h-3 w-3 mr-1" /> Salvar
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
