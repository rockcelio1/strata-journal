import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { listGaleria, removerAnexo } from "@/lib/rdo.functions";
import { listObras } from "@/lib/obras.functions";
import { getMe } from "@/lib/core.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Image as ImageIcon, FilmStrip, FilePdf, FileText, DownloadSimple, Copy, Broadcast, CaretLeft, CaretRight, ArrowSquareOut, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { SkeletonRenderer } from "@/components/skeletons";
import { usePermissoes } from "@/hooks/usePermissoes";

export const Route = createFileRoute("/_authenticated/galeria")({
  component: GaleriaPage,
});

type Tipo = "imagem" | "video" | "pdf" | "outro";
const tipoIcon: Record<Tipo, any> = { imagem: ImageIcon, video: FilmStrip, pdf: FilePdf, outro: FileText };
const RECEBIDO_AGORA_MS = 30_000;

function GaleriaPage() {
  const qc = useQueryClient();
  const galeriaFn = useServerFn(listGaleria);
  const obrasFn = useServerFn(listObras);
  const meFn = useServerFn(getMe);
  const removerFn = useServerFn(removerAnexo);
  const { isMaster } = usePermissoes();

  const [obraId, setObraId] = useState<string>("");
  const [tipo, setTipo] = useState<string>("");
  const [data, setData] = useState<string>("");
  const [preview, setPreview] = useState<any | null>(null);
  const [now, setNow] = useState(Date.now());
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0);
  const [deleting, setDeleting] = useState(false);

  const { data: obras = [] } = useQuery({ queryKey: ["obras"], queryFn: () => obrasFn() });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const filtros = useMemo(
    () => ({ obra_id: obraId || undefined, tipo: (tipo || undefined) as Tipo | undefined, data: data || undefined }),
    [obraId, tipo, data],
  );
  const { data: itens = [], isPending: itensLoading } = useQuery({
    queryKey: ["galeria", filtros],
    queryFn: () => galeriaFn({ data: filtros }),
    refetchOnWindowFocus: true,
  });

  // Realtime: invalida ao receber novo anexo da empresa
  useEffect(() => {
    const empresaId = me?.profile?.empresa_id;
    if (!empresaId) return;
    const ch = supabase
      .channel(`galeria-${empresaId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "rdo_anexos", filter: `empresa_id=eq.${empresaId}` }, () => {
        qc.invalidateQueries({ queryKey: ["galeria"] });
        toast.success("Nova mídia recebida do campo", { duration: 2500 });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "rdo_anexos", filter: `empresa_id=eq.${empresaId}` }, () =>
        qc.invalidateQueries({ queryKey: ["galeria"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me?.profile?.empresa_id, qc]);

  const flatItens = useMemo(() => (itens as any[]) ?? [], [itens]);
  const previewIdx = useMemo(
    () => (preview ? flatItens.findIndex((i) => i.id === preview.id) : -1),
    [preview, flatItens],
  );
  const goPrev = () => { if (previewIdx > 0) setPreview(flatItens[previewIdx - 1]); };
  const goNext = () => { if (previewIdx >= 0 && previewIdx < flatItens.length - 1) setPreview(flatItens[previewIdx + 1]); };

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, previewIdx, flatItens]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const totals = useMemo(() => {
    const t = { imagem: 0, video: 0, pdf: 0, outro: 0 };
    for (const i of itens as any[]) t[i.tipo as Tipo]++;
    return t;
  }, [itens]);

  async function copyUrl(url: string) {
    try { await navigator.clipboard.writeText(url); toast.success("URL copiada"); }
    catch { toast.error("Não foi possível copiar"); }
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl">Galeria da Obra</h1>
          <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-2">
            <Broadcast size={14} className="text-emerald-600 animate-pulse" /> Atualização em tempo real
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="Fotos"  value={totals.imagem} icon={ImageIcon} active={tipo === "imagem"} onClick={() => setTipo(tipo === "imagem" ? "" : "imagem")} />
        <Stat label="Vídeos" value={totals.video}  icon={FilmStrip} active={tipo === "video"}  onClick={() => setTipo(tipo === "video"  ? "" : "video")} />
        <Stat label="PDFs"   value={totals.pdf}    icon={FilePdf}   active={tipo === "pdf"}    onClick={() => setTipo(tipo === "pdf"    ? "" : "pdf")} />
        <Stat label="Outros" value={totals.outro}  icon={FileText}  active={tipo === "outro"}  onClick={() => setTipo(tipo === "outro"  ? "" : "outro")} />
      </div>


      <Card className="p-3 mb-4 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground">Obra</label>
          <Select value={obraId || "all"} onValueChange={(v) => setObraId(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as obras</SelectItem>
              {(obras as any[]).map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[140px] sm:w-40 sm:flex-none">
          <label className="text-xs text-muted-foreground">Tipo</label>
          <Select value={tipo || "all"} onValueChange={(v) => setTipo(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="imagem">Imagem</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="outro">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[140px] sm:w-40 sm:flex-none">
          <label className="text-xs text-muted-foreground">Data do RDO</label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        {(obraId || tipo || data) && (
          <Button variant="ghost" size="sm" onClick={() => { setObraId(""); setTipo(""); setData(""); }}>Limpar</Button>
        )}
      </Card>

      {itensLoading ? (
        <SkeletonRenderer screenKey="galeria" isLoading={true} layout="gallery" fallbackVariant="typewriter" />
      ) : (itens as any[]).length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <ImageIcon size={36} className="mx-auto mb-2" />
          Nenhuma mídia encontrada com os filtros atuais.
        </Card>
      ) : (
        (() => {
          const grupos = new Map<string, any[]>();
          for (const it of itens as any[]) {
            const dia = (it.rdos?.data as string | undefined) ?? (it.created_at as string).slice(0, 10);
            if (!grupos.has(dia)) grupos.set(dia, []);
            grupos.get(dia)!.push(it);
          }
          const dias = Array.from(grupos.keys()).sort((a, b) => (a < b ? 1 : -1));
          return (
            <div className="space-y-6">
              {dias.map((dia) => {
                const lista = grupos.get(dia)!;
                const d = new Date(dia + "T00:00:00");
                const label = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
                return (
                  <section key={dia}>
                    <div className="flex items-baseline justify-between mb-2 border-b border-border pb-1">
                      <h2 className="font-serif text-lg capitalize">{label}</h2>
                      <span className="text-xs text-muted-foreground tabular-nums">{lista.length} item(ns)</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {lista.map((it: any) => {
                        const Icon = tipoIcon[it.tipo as Tipo];
                        const recente = now - new Date(it.created_at).getTime() < RECEBIDO_AGORA_MS;
                        return (
                          <Card key={it.id} className="facom-glow overflow-hidden group cursor-pointer">
                            <button onClick={() => setPreview(it)} className="block relative aspect-square w-full bg-muted overflow-hidden">
                              {it.tipo === "imagem" && it.url ? (
                                <img src={it.url} alt={it.nome} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              ) : it.tipo === "video" && it.url ? (
                                <video src={it.url} className="w-full h-full object-cover" muted preload="metadata" />
                              ) : (
                                <div className="w-full h-full grid place-items-center text-muted-foreground"><Icon size={40} /></div>
                              )}
                              {recente && (
                                <Badge className="absolute top-1 left-1 bg-emerald-600 text-white border-0">
                                  <Broadcast size={10} className="mr-1 animate-pulse" /> Recebido agora
                                </Badge>
                              )}
                              <Badge variant="outline" className="absolute top-1 right-1 bg-background/90 text-[10px] uppercase">{it.tipo}</Badge>
                            </button>
                            <div className="p-2 text-xs">
                              <div className="font-medium truncate">{it.legenda || it.nome}</div>
                              <div className="text-muted-foreground truncate">
                                {it.rdos?.obras?.nome} · <Link to="/rdo/$rdoId" params={{ rdoId: it.rdo_id }} className="hover:underline">#{it.rdos?.numero}</Link>
                              </div>
                              <div className="text-muted-foreground truncate">
                                {it.autor?.nome ?? "—"} · {new Date(it.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          );
        })()
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent
          className="max-w-5xl p-0 overflow-hidden"
          aria-label={preview ? `Visualizando ${preview.legenda || preview.nome}` : "Lightbox"}
        >
          {preview && (
            <div className="bg-black relative">
              {flatItens.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={previewIdx <= 0}
                    aria-label="Mídia anterior (seta esquerda)"
                    className="facom-glow absolute left-2 top-1/2 -translate-y-1/2 z-10 h-11 w-11 grid place-items-center rounded-full bg-background/80 text-foreground hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <CaretLeft size={22} weight="bold" />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={previewIdx >= flatItens.length - 1}
                    aria-label="Próxima mídia (seta direita)"
                    className="facom-glow absolute right-2 top-1/2 -translate-y-1/2 z-10 h-11 w-11 grid place-items-center rounded-full bg-background/80 text-foreground hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <CaretRight size={22} weight="bold" />
                  </button>
                  <div className="absolute top-2 left-2 z-10 text-xs px-2 py-1 rounded bg-background/80 text-foreground tabular-nums">
                    {previewIdx + 1} / {flatItens.length}
                  </div>
                </>
              )}
              {preview.tipo === "imagem" && preview.url && (
                <img src={preview.url} alt={preview.legenda || preview.nome} className="w-full max-h-[80vh] object-contain bg-black" />
              )}
              {preview.tipo === "video" && preview.url && (
                <video src={preview.url} controls autoPlay className="w-full max-h-[80vh] bg-black" />
              )}
              {preview.tipo === "pdf" && preview.url && (
                <iframe src={preview.url} title={preview.nome} className="w-full h-[80vh] bg-white" />
              )}
              {preview.tipo === "outro" && (
                <div className="h-40 grid place-items-center text-white">Prévia indisponível para este tipo.</div>
              )}
              <div className="bg-background text-foreground p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm min-w-0">
                  <div className="font-medium truncate">{preview.legenda || preview.nome}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {preview.rdos?.obras?.nome} · RDO #{preview.rdos?.numero} · {preview.autor?.nome ?? "—"} · {new Date(preview.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {preview.url && (
                    <>
                      {preview.tipo === "pdf" && (
                        <a href={preview.url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" aria-label="Abrir PDF em nova aba">
                            <ArrowSquareOut size={14} className="mr-1" /> Abrir
                          </Button>
                        </a>
                      )}
                      <Button size="sm" variant="outline" onClick={() => copyUrl(preview.url)} aria-label="Copiar URL da mídia">
                        <Copy size={14} className="mr-1" /> URL
                      </Button>
                      <a href={preview.url} download={preview.nome}>
                        <Button size="sm" aria-label={`Baixar ${preview.nome}`}>
                          <DownloadSimple size={14} className="mr-1" /> Baixar
                        </Button>
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, icon: Icon, active, onClick }: { label: string; value: number; icon: any; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Filtrar por ${label} (${value} ${value === 1 ? "item" : "itens"})${active ? " — ativo" : ""}`}
      className={`facom-glow w-full text-left rounded-lg border bg-card p-3 flex items-center gap-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${active ? "border-brand ring-2 ring-brand/40" : "border-border hover:bg-accent/40"}`}
    >
      <div className={`h-9 w-9 rounded-md grid place-items-center ${active ? "bg-brand text-brand-foreground" : "bg-brand/10 text-brand"}`}><Icon size={18} /></div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold tabular-nums">{value}</div>
      </div>
    </button>
  );
}

