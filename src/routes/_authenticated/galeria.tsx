import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { listGaleria, logMediaLoadFailure, removerAnexo } from "@/lib/rdo.functions";
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
import { Progress } from "@/components/ui/progress";
import { Image as ImageIcon, FilmStrip, FilePdf, PenNib, DownloadSimple, Copy, Broadcast, CaretLeft, CaretRight, ArrowSquareOut, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { SkeletonRenderer } from "@/components/skeletons";
import { usePermissoes } from "@/hooks/usePermissoes";

export const Route = createFileRoute("/_authenticated/galeria")({
  component: GaleriaPage,
});

type Tipo = "imagem" | "video" | "pdf" | "assinatura";
const tipoIcon: Record<Tipo, any> = { imagem: ImageIcon, video: FilmStrip, pdf: FilePdf, assinatura: PenNib };
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
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [lastError, setLastError] = useState<string | null>(null);
  const [failedIds, setFailedIds] = useState<string[]>([]);

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
    const t = { imagem: 0, video: 0, pdf: 0, assinatura: 0 };
    for (const i of itens as any[]) {
      if (i.tipo in t) t[i.tipo as Tipo]++;
    }
    return t;
  }, [itens]);

  async function copyUrl(url: string) {
    try { await navigator.clipboard.writeText(url); toast.success("URL copiada"); }
    catch { toast.error("Não foi possível copiar"); }
  }

  function toggleSelected(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function doDelete() {
    setDeleting(true);
    setLastError(null);
    const ids = Array.from(selected);
    setProgress({ done: 0, total: ids.length });
    const failed: string[] = [];
    let ok = 0;
    let lastMsg = "";
    for (const id of ids) {
      try {
        await removerFn({ data: { id } });
        ok++;
      } catch (e: any) {
        failed.push(id);
        lastMsg = e?.message ?? String(e);
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setDeleting(false);
    qc.invalidateQueries({ queryKey: ["galeria"] });
    if (failed.length === 0) {
      toast.success(`${ok} mídia(s) excluída(s) com sucesso`);
      setConfirmStep(0);
      setSelected(new Set());
      setSelectMode(false);
      setFailedIds([]);
    } else {
      // Preserve selection of failed items so the user can retry
      setSelected(new Set(failed));
      setFailedIds(failed);
      setLastError(lastMsg || "Falha desconhecida ao excluir");
      toast.error(`${ok} excluída(s), ${failed.length} falha(s). Tente novamente.`);
      setConfirmStep(0);
    }
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
        {isMaster && (
          <div className="flex items-center gap-2">
            {selectMode && (
              <>
                <span className="text-xs text-muted-foreground tabular-nums">{selected.size} selecionada(s)</span>
                <Button size="sm" variant="destructive" disabled={selected.size === 0 || deleting} onClick={() => setConfirmStep(1)}>
                  <Trash size={14} className="mr-1" /> {failedIds.length > 0 ? "Tentar novamente" : "Excluir"}
                </Button>
                <Button size="sm" variant="ghost" disabled={deleting} onClick={() => { setSelectMode(false); setSelected(new Set()); setFailedIds([]); setLastError(null); }}>
                  Cancelar
                </Button>
              </>
            )}
            {!selectMode && (
              <Button size="sm" variant="outline" onClick={() => setSelectMode(true)}>
                <Trash size={14} className="mr-1" /> Selecionar para excluir
              </Button>
            )}
          </div>
        )}
      </header>

      {deleting && progress.total > 0 && (
        <div className="mb-4 rounded-md border bg-card p-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium">Excluindo mídias…</span>
            <span className="tabular-nums text-muted-foreground">{progress.done}/{progress.total}</span>
          </div>
          <Progress value={(progress.done / Math.max(1, progress.total)) * 100} />
        </div>
      )}

      {!deleting && lastError && failedIds.length > 0 && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <div className="font-medium text-destructive">Falha ao excluir {failedIds.length} item(ns)</div>
          <div className="text-xs text-muted-foreground mt-1 break-all">{lastError}</div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="destructive" onClick={() => setConfirmStep(1)}>Tentar novamente</Button>
            <Button size="sm" variant="ghost" onClick={() => { setLastError(null); setFailedIds([]); setSelected(new Set()); setSelectMode(false); }}>Descartar</Button>
          </div>
        </div>
      )}




      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="Fotos"  value={totals.imagem} icon={ImageIcon} active={tipo === "imagem"} onClick={() => setTipo(tipo === "imagem" ? "" : "imagem")} />
        <Stat label="Vídeos" value={totals.video}  icon={FilmStrip} active={tipo === "video"}  onClick={() => setTipo(tipo === "video"  ? "" : "video")} />
        <Stat label="PDFs"   value={totals.pdf}    icon={FilePdf}   active={tipo === "pdf"}    onClick={() => setTipo(tipo === "pdf"    ? "" : "pdf")} />
        <Stat label="Assinaturas" value={totals.assinatura} icon={PenNib} active={tipo === "assinatura"} onClick={() => setTipo(tipo === "assinatura" ? "" : "assinatura")} />
        
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
              <SelectItem value="assinatura">Assinaturas</SelectItem>
              
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
                      {lista.map((it: any, idx: number) => {
                        const Icon = tipoIcon[it.tipo as Tipo];
                        const recente = now - new Date(it.created_at).getTime() < RECEBIDO_AGORA_MS;
                        // Próximos 6 thumbs para prefetch quando este entrar na viewport.
                        const prefetchNext = lista
                          .slice(idx + 1, idx + 7)
                          .map((n: any) => n.thumbUrl || n.url)
                          .filter(Boolean) as string[];
                        return (
                          <Card key={it.id} className={`facom-glow overflow-hidden group cursor-pointer relative ${selectMode && selected.has(it.id) ? "ring-2 ring-destructive" : ""}`}>
                            {selectMode && (
                              <label className="absolute top-1 left-1 z-10 bg-background/90 rounded p-1 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                <Checkbox checked={selected.has(it.id)} onCheckedChange={() => toggleSelected(it.id)} aria-label="Selecionar mídia" />
                              </label>
                            )}
                            <button
                              onClick={() => selectMode ? toggleSelected(it.id) : setPreview(it)}
                              className="block relative aspect-square w-full bg-muted overflow-hidden"
                            >
                              {(it.tipo === "imagem" || it.tipo === "assinatura") && (it.thumbUrl || it.url) ? (
                                <MediaThumb
                                  src={it.thumbUrl || it.url}
                                  alt={it.nome}
                                  kind="imagem"
                                  fit={it.tipo === "assinatura" ? "contain" : "cover"}
                                  itemId={it.onedrive_item_id ?? null}
                                  anexoId={it.id}
                                  prefetchNext={prefetchNext}
                                />
                              ) : it.tipo === "video" && (it.thumbUrl || it.url) ? (
                                <MediaThumb
                                  src={it.thumbUrl || it.url}
                                  alt={it.nome}
                                  kind="video"
                                  fit="cover"
                                  itemId={it.onedrive_item_id ?? null}
                                  anexoId={it.id}
                                  prefetchNext={prefetchNext}
                                />
                              ) : (
                                <div className="w-full h-full grid place-items-center text-muted-foreground"><Icon size={40} /></div>
                              )}
                              {recente && !selectMode && (
                                <Badge className="absolute top-1 left-1 bg-emerald-600 text-white border-0">
                                  <Broadcast size={10} className="mr-1 animate-pulse" /> Recebido agora
                                </Badge>
                              )}
                              <Badge variant="outline" className="absolute top-1 right-1 bg-background/90 text-[10px] uppercase">{it.tipo}</Badge>
                            </button>
                            <div className="p-2 text-xs">
                              <div className="font-medium truncate">
                                {it.tipo === "assinatura"
                                  ? `Assinatura — ${it.autor?.nome ?? "Usuário"}`
                                  : (it.legenda || it.nome)}
                              </div>
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
              {(preview.tipo === "imagem" || preview.tipo === "assinatura") && preview.url && (
                <div className={`w-full max-h-[80vh] flex items-center justify-center ${preview.tipo === "assinatura" ? "bg-white p-6" : "bg-black"}`}>
                  <img
                    src={preview.url}
                    alt={preview.legenda || preview.nome}
                    className="max-w-full max-h-[80vh] object-contain"
                  />
                </div>
              )}
              {preview.tipo === "video" && preview.url && (
                <video src={preview.url} controls autoPlay className="w-full max-h-[80vh] bg-black" />
              )}
              {preview.tipo === "pdf" && preview.url && (
                <iframe src={preview.url} title={preview.nome} className="w-full h-[80vh] bg-white" />
              )}
              <div className="bg-background text-foreground p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm min-w-0">
                  <div className="font-medium truncate">
                    {preview.tipo === "assinatura"
                      ? `Assinatura — ${preview.autor?.nome ?? "Usuário"}`
                      : (preview.legenda || preview.nome)}
                  </div>
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

      <AlertDialog open={confirmStep === 1} onOpenChange={(o) => !o && setConfirmStep(0)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selected.size} mídia(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente os arquivos selecionados da galeria e do armazenamento. Não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); setConfirmStep(2); }}>
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmStep === 2} onOpenChange={(o) => !o && !deleting && setConfirmStep(0)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirme novamente: <strong>{selected.size} mídia(s)</strong> serão excluídas definitivamente. Essa é a sua última chance de cancelar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleting && progress.total > 0 && (
            <div className="my-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span>Excluindo…</span>
                <span className="tabular-nums">{progress.done}/{progress.total}</span>
              </div>
              <Progress value={(progress.done / Math.max(1, progress.total)) * 100} />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Não, cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); doDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo…" : "Sim, excluir definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function MediaThumb({
  src,
  alt,
  kind,
  fit = "cover",
}: {
  src: string;
  alt: string;
  kind: "imagem" | "video";
  fit?: "cover" | "contain";
}) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const bustedSrc = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}r=${attempt}`;
  const fitCls = fit === "contain" ? "object-contain p-2" : "object-cover group-hover:scale-105";

  function retry(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setState("loading");
    setAttempt((n) => n + 1);
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-muted">
      {state === "loading" && <div className="absolute inset-0 animate-pulse bg-muted" />}
      {state === "error" ? (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground bg-muted p-2">
          <div className="flex flex-col items-center gap-2 text-[10px] uppercase tracking-wider text-center">
            {kind === "imagem" ? <ImageIcon size={28} /> : <FilmStrip size={28} />}
            <span>Prévia indisponível</span>
            <button
              type="button"
              onClick={retry}
              className="mt-1 px-2 py-1 rounded border border-border bg-background text-foreground text-[10px] hover:bg-accent"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      ) : kind === "imagem" ? (
        <img
          key={attempt}
          src={bustedSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setState("loaded")}
          onError={() => {
            console.warn("[galeria] falha ao carregar imagem", src);
            setState("error");
          }}
          className={`w-full h-full ${fitCls} transition-transform ${state === "loaded" ? "opacity-100" : "opacity-0"}`}
        />
      ) : (
        <video
          key={attempt}
          src={bustedSrc}
          muted
          preload="metadata"
          onLoadedData={() => setState("loaded")}
          onError={() => {
            console.warn("[galeria] falha ao carregar vídeo", src);
            setState("error");
          }}
          className={`w-full h-full ${fitCls} ${state === "loaded" ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}


