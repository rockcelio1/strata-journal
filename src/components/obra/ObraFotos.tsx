import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { House, Plus, Star, Trash, CaretLeft, CaretRight, X, Warning, Spinner } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  listObraFotos,
  registerObraFoto,
  setObraCapa,
  deleteObraFoto,
} from "@/lib/obra-fotos.functions";

const BUCKET = "obra-fotos";

type Foto = {
  id: string;
  storage_path: string;
  nome: string | null;
  mime_type: string | null;
  blur_data_url: string | null;
  largura: number | null;
  altura: number | null;
  url: string | null;
};

type ViewState = { zoom: number; fit: "fit" | "actual"; tx: number; ty: number };
const DEFAULT_VIEW: ViewState = { zoom: 1, fit: "fit", tx: 0, ty: 0 };

async function makeBlurDataUrl(file: File): Promise<{ blur: string; w: number; h: number } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const ratio = bmp.width / bmp.height;
    const w = 16;
    const h = Math.max(1, Math.round(w / ratio));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, w, h);
    return { blur: canvas.toDataURL("image/jpeg", 0.5), w: bmp.width, h: bmp.height };
  } catch {
    return null;
  }
}

export function ObraFotos({
  obraId,
  empresaId,
  className,
}: {
  obraId: string;
  empresaId: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listObraFotos);
  const registerFn = useServerFn(registerObraFoto);
  const setCapaFn = useServerFn(setObraCapa);
  const deleteFn = useServerFn(deleteObraFoto);

  const { data, isLoading } = useQuery({
    queryKey: ["obra-fotos", obraId],
    queryFn: () => listFn({ data: { obra_id: obraId } }),
  });

  const fotos: Foto[] = (data?.fotos ?? []) as any;
  const capa = data?.capa ?? null;
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Estado de zoom/fit/pan persistido por foto (por id)
  const viewsRef = useRef<Map<string, ViewState>>(new Map());
  const [view, setView] = useState<ViewState>(DEFAULT_VIEW);

  // Loading/erro da imagem no lightbox
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgKey, setImgKey] = useState(0); // para retry

  useEffect(() => {
    if (active >= fotos.length) setActive(0);
  }, [fotos.length, active]);

  const current = fotos[active] ?? null;
  const heroUrl = current?.url ?? capa?.url ?? null;
  const heroBlur = current?.blur_data_url ?? capa?.blur ?? null;

  // Carrega o estado salvo ao mudar de foto ou abrir o lightbox
  useEffect(() => {
    if (!current) { setView(DEFAULT_VIEW); return; }
    setView(viewsRef.current.get(current.id) ?? DEFAULT_VIEW);
    setImgError(false);
    setImgLoading(true);
  }, [current?.id, lightbox]);

  const updateView = useCallback((patch: Partial<ViewState> | ((v: ViewState) => ViewState)) => {
    setView((prev) => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      if (current) viewsRef.current.set(current.id, next);
      return next;
    });
  }, [current]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["obra-fotos", obraId] });

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (!list.length) throw new Error("Selecione apenas imagens");
      for (const file of list) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const id = (crypto as any).randomUUID?.() ?? Math.random().toString(36).slice(2);
        const path = `${empresaId}/${obraId}/${id}.${ext}`;
        const up = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (up.error) throw up.error;
        const meta = await makeBlurDataUrl(file);
        await registerFn({
          data: {
            obra_id: obraId,
            storage_path: path,
            nome: file.name,
            mime_type: file.type,
            tamanho_bytes: file.size,
            largura: meta?.w ?? null,
            altura: meta?.h ?? null,
            blur_data_url: meta?.blur ?? null,
            set_capa: !capa,
          },
        });
      }
    },
    onSuccess: () => { toast.success("Fotos enviadas"); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? "Falha no upload"),
  });

  const setCapa = useMutation({
    mutationFn: (foto_id: string | null) => setCapaFn({ data: { obra_id: obraId, foto_id } }),
    onSuccess: () => { toast.success("Capa atualizada"); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao definir capa"),
  });

  const removeFoto = useMutation({
    mutationFn: (foto_id: string) => deleteFn({ data: { foto_id } }),
    onSuccess: () => { toast.success("Foto removida"); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover"),
  });

  const go = (delta: number) => {
    if (!fotos.length) return;
    setActive((i) => (i + delta + fotos.length) % fotos.length);
  };

  // Preload vizinhas para acelerar navegação
  useEffect(() => {
    if (!lightbox || !fotos.length) return;
    const preload = (u: string | null) => { if (u) { const im = new Image(); im.src = u; } };
    preload(fotos[(active + 1) % fotos.length]?.url ?? null);
    preload(fotos[(active - 1 + fotos.length) % fotos.length]?.url ?? null);
  }, [lightbox, active, fotos]);

  // Refs para foco/trap
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  // Focus autofocus + trap + restore
  useEffect(() => {
    if (!lightbox) return;
    lastFocusRef.current = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dialogRef.current) return;
      const nodes = dialogRef.current.querySelectorAll<HTMLElement>(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
      );
      const focusables = Array.from(nodes).filter((n) => !n.hasAttribute("disabled"));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      lastFocusRef.current?.focus?.();
    };
  }, [lightbox]);

  // Atalhos de teclado
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setLightbox(false); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "+" || e.key === "=") { e.preventDefault(); updateView((v) => ({ ...v, fit: "fit", zoom: Math.min(5, v.zoom + 0.25) })); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); updateView((v) => ({ ...v, fit: "fit", zoom: Math.max(1, v.zoom - 0.25) })); }
      else if (e.key === "0") { e.preventDefault(); updateView({ fit: "fit", zoom: 1, tx: 0, ty: 0 }); }
      else if (e.key === "1") { e.preventDefault(); updateView({ fit: "actual", zoom: 1, tx: 0, ty: 0 }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, fotos.length, updateView]);

  // ===== Gestos: pinch + pan =====
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<{
    startDist: number;
    startZoom: number;
    startTx: number;
    startTy: number;
    startMid: { x: number; y: number };
    panning: boolean;
    lastPan: { x: number; y: number };
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = Array.from(pointersRef.current.values());
    if (pts.length === 2) {
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      gestureRef.current = {
        startDist: dist,
        startZoom: view.zoom,
        startTx: view.tx,
        startTy: view.ty,
        startMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        panning: false,
        lastPan: { x: e.clientX, y: e.clientY },
      };
    } else if (pts.length === 1 && (view.zoom > 1 || view.fit === "actual")) {
      gestureRef.current = {
        startDist: 0, startZoom: view.zoom, startTx: view.tx, startTy: view.ty,
        startMid: { x: e.clientX, y: e.clientY },
        panning: true, lastPan: { x: e.clientX, y: e.clientY },
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gestureRef.current;
    if (!g) return;
    const pts = Array.from(pointersRef.current.values());
    if (pts.length === 2) {
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const scale = dist / (g.startDist || dist);
      const zoom = Math.max(1, Math.min(5, g.startZoom * scale));
      updateView((v) => ({ ...v, fit: "fit", zoom }));
    } else if (pts.length === 1 && g.panning) {
      const dx = e.clientX - g.lastPan.x;
      const dy = e.clientY - g.lastPan.y;
      g.lastPan = { x: e.clientX, y: e.clientY };
      updateView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) gestureRef.current = null;
  };

  const empty = !isLoading && fotos.length === 0;
  const isCapa = useMemo(
    () => current && capa && current.storage_path === capa.path,
    [current, capa],
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className="relative aspect-[4/3] rounded-md overflow-hidden border border-border bg-gradient-to-br from-muted via-background to-muted/60 group"
        role="region"
        aria-label="Fotos da obra"
      >
        {heroBlur && (
          <img src={heroBlur} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-110 blur-lg opacity-80" />
        )}

        {heroUrl ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setLightbox(true)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setLightbox(true); }}
            className="absolute inset-0 w-full h-full cursor-zoom-in"
            aria-label="Abrir foto em tela cheia"
          >
            <img src={heroUrl} alt={current?.nome ?? "Foto da obra"} loading="lazy" decoding="async" className="relative w-full h-full object-cover" />
          </div>
        ) : (
          <PremiumPlaceholder />
        )}

        {fotos.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-background/80 border border-border hover:bg-background" aria-label="Foto anterior">
              <CaretLeft size={16} />
            </button>
            <button type="button" onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-background/80 border border-border hover:bg-background" aria-label="Próxima foto">
              <CaretRight size={16} />
            </button>
          </>
        )}

        {isCapa && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide bg-brand text-brand-foreground px-1.5 py-0.5 rounded">
            <Star size={10} weight="fill" /> Capa
          </span>
        )}
        {fotos.length > 0 && (
          <span className="absolute bottom-2 right-2 text-[10px] tabular-nums bg-background/80 border border-border px-1.5 py-0.5 rounded">
            {active + 1}/{fotos.length}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) upload.mutate(e.target.files); e.target.value = ""; }}
        />
        <Button size="sm" variant="outline" className="flex-1" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
          <Plus size={14} /> {upload.isPending ? "Enviando…" : "Adicionar"}
        </Button>
        {current && (
          <>
            <Button size="sm" variant={isCapa ? "secondary" : "outline"} onClick={() => setCapa.mutate(isCapa ? null : current.id)} disabled={setCapa.isPending} title={isCapa ? "Remover como capa" : "Definir como capa"} aria-label="Definir como capa">
              <Star size={14} weight={isCapa ? "fill" : "regular"} />
            </Button>
            <Button size="sm" variant="outline" onClick={() => { if (confirm("Remover esta foto?")) removeFoto.mutate(current.id); }} disabled={removeFoto.isPending} aria-label="Remover foto">
              <Trash size={14} />
            </Button>
          </>
        )}
      </div>

      {fotos.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {fotos.map((f, i) => (
            <button key={f.id} type="button" onClick={() => setActive(i)} className={cn("relative shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition", i === active ? "border-brand" : "border-transparent opacity-70 hover:opacity-100")} aria-label={`Foto ${i + 1}`}>
              {f.blur_data_url && <img src={f.blur_data_url} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />}
              {f.url && <img src={f.url} alt={f.nome ?? ""} loading="lazy" decoding="async" className="relative w-full h-full object-cover" />}
            </button>
          ))}
        </div>
      )}

      {empty && (
        <p className="text-[11px] text-muted-foreground text-center">
          Nenhuma foto ainda. Envie a primeira para definir a capa.
        </p>
      )}

      {lightbox && heroUrl && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal
          aria-label={`Visualização ampliada${current?.nome ? `: ${current.nome}` : ""}`}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 overflow-hidden"
          onClick={() => setLightbox(false)}
          onWheel={(e) => {
            e.preventDefault();
            updateView((v) => ({ ...v, fit: "fit", zoom: Math.min(5, Math.max(1, v.zoom + (e.deltaY < 0 ? 0.2 : -0.2))) }));
          }}
        >
          <button ref={closeBtnRef} type="button" className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 inline-flex items-center justify-center z-10" aria-label="Fechar (Esc)" onClick={(e) => { e.stopPropagation(); setLightbox(false); }}>
            <X size={18} />
          </button>
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10" onClick={(e) => e.stopPropagation()} role="toolbar" aria-label="Controles de visualização">
            <button type="button" onClick={() => updateView((v) => ({ ...v, fit: "fit", zoom: Math.max(1, v.zoom - 0.25) }))} className="px-3 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 text-sm" aria-label="Diminuir zoom (tecla -)" title="Diminuir zoom (-)">−</button>
            <span className="text-white text-xs tabular-nums w-12 text-center" aria-live="polite">
              {view.fit === "actual" ? "1:1" : `${Math.round(view.zoom * 100)}%`}
            </span>
            <button type="button" onClick={() => updateView((v) => ({ ...v, fit: "fit", zoom: Math.min(5, v.zoom + 0.25) }))} className="px-3 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 text-sm" aria-label="Aumentar zoom (tecla +)" title="Aumentar zoom (+)">+</button>
            <div className="mx-1 h-6 w-px bg-white/20" aria-hidden />
            <button type="button" onClick={() => updateView({ fit: "fit", zoom: 1, tx: 0, ty: 0 })} className={cn("px-3 h-9 rounded-full text-xs text-white hover:bg-white/20", view.fit === "fit" ? "bg-white/25" : "bg-white/10")} aria-label="Ajustar à tela (tecla 0)" aria-pressed={view.fit === "fit"} title="Ajustar à tela (0)">Ajustar</button>
            <button type="button" onClick={() => updateView({ fit: "actual", zoom: 1, tx: 0, ty: 0 })} className={cn("px-3 h-9 rounded-full text-xs text-white hover:bg-white/20", view.fit === "actual" ? "bg-white/25" : "bg-white/10")} aria-label="Tamanho real 1 para 1 (tecla 1)" aria-pressed={view.fit === "actual"} title="Tamanho real 1:1 (1)">1:1</button>
          </div>

          {fotos.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 inline-flex items-center justify-center z-10" aria-label="Foto anterior (seta esquerda)" title="Anterior (←)">
                <CaretLeft size={18} />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 inline-flex items-center justify-center z-10" aria-label="Próxima foto (seta direita)" title="Próxima (→)">
                <CaretRight size={18} />
              </button>
            </>
          )}

          <div
            className={cn("relative touch-none", view.fit === "actual" ? "overflow-hidden max-w-[95vw] max-h-[90vh]" : "")}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ touchAction: "none" }}
          >
            {/* Blur base enquanto carrega */}
            {heroBlur && imgLoading && !imgError && (
              <img src={heroBlur} alt="" aria-hidden className="max-w-[95vw] max-h-[90vh] object-contain blur-xl opacity-70" />
            )}

            {!imgError && (
              <img
                key={imgKey}
                src={heroUrl}
                alt={current?.nome ?? "Foto da obra"}
                onLoad={() => setImgLoading(false)}
                onError={() => { setImgLoading(false); setImgError(true); }}
                className={cn(
                  "select-none transition-transform will-change-transform",
                  view.fit === "fit"
                    ? cn("max-w-[95vw] max-h-[90vh] object-contain", view.zoom > 1 ? "cursor-grab" : "cursor-zoom-in")
                    : "block cursor-grab",
                  heroBlur && imgLoading ? "absolute inset-0 opacity-0" : "opacity-100",
                )}
                style={{
                  transform:
                    view.fit === "fit"
                      ? `translate(${view.tx}px, ${view.ty}px) scale(${view.zoom})`
                      : `translate(${view.tx}px, ${view.ty}px)`,
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  updateView((v) => v.zoom > 1 || v.fit === "actual" ? DEFAULT_VIEW : { ...v, fit: "fit", zoom: 2 });
                }}
                draggable={false}
              />
            )}

            {imgLoading && !imgError && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none" role="status" aria-live="polite">
                <Spinner size={36} className="text-white animate-spin" />
                <span className="sr-only">Carregando imagem…</span>
              </div>
            )}

            {imgError && (
              <div className="flex flex-col items-center justify-center gap-3 p-8 text-white" role="alert">
                <Warning size={40} className="text-amber-400" />
                <p className="text-sm">Não foi possível carregar a imagem.</p>
                <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setImgError(false); setImgLoading(true); setImgKey((k) => k + 1); }}>
                  Tentar novamente
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PremiumPlaceholder() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-foreground/40">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 10%, hsl(var(--brand)/0.18), transparent 45%), radial-gradient(circle at 80% 90%, hsl(var(--brand)/0.10), transparent 50%)",
        }}
        aria-hidden
      />
      <House size={44} weight="duotone" />
      <span className="text-[10px] uppercase tracking-[0.2em]">Foto da obra</span>
    </div>
  );
}
