import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { House, Plus, Star, Trash, CaretLeft, CaretRight, X } from "@phosphor-icons/react";
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

/** Gera um data URL minúsculo (10px) para usar como blur placeholder. */
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
    const blur = canvas.toDataURL("image/jpeg", 0.5);
    return { blur, w: bmp.width, h: bmp.height };
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
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState<"fit" | "actual">("fit");
  const fileRef = useRef<HTMLInputElement>(null);

  // mantém index válido
  useEffect(() => {
    if (active >= fotos.length) setActive(0);
  }, [fotos.length, active]);

  const current = fotos[active] ?? null;
  const heroUrl = current?.url ?? capa?.url ?? null;
  const heroBlur = current?.blur_data_url ?? capa?.blur ?? null;

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
            set_capa: !capa, // se ainda não houver capa, define
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Fotos enviadas");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha no upload"),
  });

  const setCapa = useMutation({
    mutationFn: (foto_id: string | null) => setCapaFn({ data: { obra_id: obraId, foto_id } }),
    onSuccess: () => {
      toast.success("Capa atualizada");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao definir capa"),
  });

  const removeFoto = useMutation({
    mutationFn: (foto_id: string) => deleteFn({ data: { foto_id } }),
    onSuccess: () => {
      toast.success("Foto removida");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover"),
  });

  const go = (delta: number) => {
    if (!fotos.length) return;
    setActive((i) => (i + delta + fotos.length) % fotos.length);
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
        {/* Blur placeholder de fundo */}
        {heroBlur && (
          <img
            src={heroBlur}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-lg opacity-80"
          />
        )}

        {heroUrl ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => { setZoom(1); setLightbox(true); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setZoom(1); setLightbox(true); } }}
            className="absolute inset-0 w-full h-full cursor-zoom-in"
            aria-label="Abrir foto em tela cheia"
          >
            <img
              src={heroUrl}
              alt={current?.nome ?? "Foto da obra"}
              loading="lazy"
              decoding="async"
              className="relative w-full h-full object-cover"
            />
          </div>
        ) : (
          <PremiumPlaceholder />
        )}

        {/* Setas */}
        {fotos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-background/80 border border-border hover:bg-background"
              aria-label="Foto anterior"
            >
              <CaretLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-background/80 border border-border hover:bg-background"
              aria-label="Próxima foto"
            >
              <CaretRight size={16} />
            </button>
          </>
        )}

        {/* Selo de capa */}
        {isCapa && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide bg-brand text-brand-foreground px-1.5 py-0.5 rounded">
            <Star size={10} weight="fill" /> Capa
          </span>
        )}

        {/* Contador */}
        {fotos.length > 0 && (
          <span className="absolute bottom-2 right-2 text-[10px] tabular-nums bg-background/80 border border-border px-1.5 py-0.5 rounded">
            {active + 1}/{fotos.length}
          </span>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) upload.mutate(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
        >
          <Plus size={14} /> {upload.isPending ? "Enviando…" : "Adicionar"}
        </Button>
        {current && (
          <>
            <Button
              size="sm"
              variant={isCapa ? "secondary" : "outline"}
              onClick={() => setCapa.mutate(isCapa ? null : current.id)}
              disabled={setCapa.isPending}
              title={isCapa ? "Remover como capa" : "Definir como capa"}
              aria-label="Definir como capa"
            >
              <Star size={14} weight={isCapa ? "fill" : "regular"} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (confirm("Remover esta foto?")) removeFoto.mutate(current.id);
              }}
              disabled={removeFoto.isPending}
              aria-label="Remover foto"
            >
              <Trash size={14} />
            </Button>
          </>
        )}
      </div>

      {/* Tira de miniaturas */}
      {fotos.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {fotos.map((f, i) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "relative shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition",
                i === active ? "border-brand" : "border-transparent opacity-70 hover:opacity-100",
              )}
              aria-label={`Foto ${i + 1}`}
            >
              {f.blur_data_url && (
                <img src={f.blur_data_url} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />
              )}
              {f.url && (
                <img
                  src={f.url}
                  alt={f.nome ?? ""}
                  loading="lazy"
                  decoding="async"
                  className="relative w-full h-full object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}

      {empty && (
        <p className="text-[11px] text-muted-foreground text-center">
          Nenhuma foto ainda. Envie a primeira para definir a capa.
        </p>
      )}

      {/* Lightbox */}
      {lightbox && heroUrl && (
        <div
          role="dialog"
          aria-modal
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 overflow-auto"
          onClick={() => setLightbox(false)}
          onWheel={(e) => {
            e.preventDefault();
            setZoom((z) => Math.min(5, Math.max(1, z + (e.deltaY < 0 ? 0.2 : -0.2))));
          }}
        >
          <button
            type="button"
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 inline-flex items-center justify-center z-10"
            aria-label="Fechar"
            onClick={(e) => { e.stopPropagation(); setLightbox(false); }}
          >
            <X size={18} />
          </button>
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
              className="px-3 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 text-sm"
              aria-label="Diminuir zoom"
            >−</button>
            <span className="text-white text-xs tabular-nums w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
              className="px-3 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 text-sm"
              aria-label="Aumentar zoom"
            >+</button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="px-3 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 text-xs"
              aria-label="Redefinir zoom"
            >100%</button>
          </div>
          {fotos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); go(-1); setZoom(1); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 inline-flex items-center justify-center z-10"
                aria-label="Anterior"
              >
                <CaretLeft size={18} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); go(1); setZoom(1); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 inline-flex items-center justify-center z-10"
                aria-label="Próxima"
              >
                <CaretRight size={18} />
              </button>
            </>
          )}
          <img
            src={heroUrl}
            alt={current?.nome ?? "Foto da obra"}
            className={cn("max-w-[95vw] max-h-[90vh] object-contain transition-transform select-none", zoom > 1 ? "cursor-zoom-out" : "cursor-zoom-in")}
            style={{ transform: `scale(${zoom})` }}
            onClick={(e) => {
              e.stopPropagation();
              setZoom((z) => (z >= 2 ? 1 : z + 1));
            }}
          />
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
