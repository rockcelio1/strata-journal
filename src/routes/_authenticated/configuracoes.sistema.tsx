import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { getMe, updateEmpresaLogo, listLogoVersions, restoreLogoVersion } from "@/lib/core.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Building2, Upload, Trash2, Loader2, History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/configuracoes/sistema")({
  component: SistemaPage,
});

const BUCKET = "empresa-logos";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const MIN_DIM = 64;
const MAX_DIM = 2048;
const TARGET_MAX = 512; // redimensiona para no máx. 512px (lado maior) ao converter

type Preview = { file: File; url: string; width: number; height: number; sizeKb: number; isSvg: boolean };

async function readImageMeta(file: File): Promise<Preview> {
  const url = URL.createObjectURL(file);
  const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
  if (isSvg) return { file, url, width: 0, height: 0, sizeKb: Math.round(file.size / 1024), isSvg: true };
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Imagem inválida ou corrompida"));
    img.src = url;
  });
  return { file, url, width: img.naturalWidth, height: img.naturalHeight, sizeKb: Math.round(file.size / 1024), isSvg: false };
}

async function toWebp(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, TARGET_MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar WebP"))), "image/webp", 0.9),
  );
  return { blob, width: w, height: h };
}

function SistemaPage() {
  const getMeFn = useServerFn(getMe);
  const updateLogoFn = useServerFn(updateEmpresaLogo);
  const listVersionsFn = useServerFn(listLogoVersions);
  const restoreFn = useServerFn(restoreLogoVersion);
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });
  const { data: versions = [] } = useQuery({ queryKey: ["logo-versions"], queryFn: () => listVersionsFn() });
  const empresaId = me?.empresa?.id as string | undefined;
  const logoUrl = (me?.empresa as any)?.logo_url as string | null | undefined;
  const isAdmin = useMemo(() => (me?.roles ?? []).some((r: string) => r === "admin" || r === "master"), [me]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["me"] });
    qc.invalidateQueries({ queryKey: ["logo-versions"] });
  };

  async function onSelect(file: File) {
    setError(null); setPreview(null);
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const okExt = ["jpg", "jpeg", "png", "bmp", "webp", "svg", "gif", "img"].includes(ext);
    if (!file.type.startsWith("image/") && !okExt) { setError("Formato inválido. Use JPG, JPEG, PNG, BMP, WEBP, SVG, GIF ou IMG."); return; }
    if (file.size > MAX_BYTES) { setError(`Arquivo muito grande: ${(file.size / 1024 / 1024).toFixed(2)} MB. Máximo 2 MB.`); return; }
    try {
      const meta = await readImageMeta(file);
      if (!meta.isSvg) {
        if (meta.width < MIN_DIM || meta.height < MIN_DIM) {
          setError(`Dimensões muito pequenas (${meta.width}×${meta.height}). Mínimo ${MIN_DIM}×${MIN_DIM}px.`);
          return;
        }
        if (meta.width > MAX_DIM || meta.height > MAX_DIM) {
          setError(`Dimensões muito grandes (${meta.width}×${meta.height}). Máximo ${MAX_DIM}×${MAX_DIM}px.`);
          return;
        }
      }
      setPreview(meta);
    } catch (e: any) {
      setError(e.message ?? "Não foi possível ler a imagem.");
    }
  }

  async function confirmUpload() {
    if (!empresaId || !preview) return;
    setUploading(true);
    try {
      let blob: Blob = preview.file;
      let contentType = preview.file.type || "application/octet-stream";
      let ext = (preview.file.name.split(".").pop() || "png").toLowerCase();
      let width = preview.width, height = preview.height;

      // Converte para WebP padrão (exceto SVG, que mantemos como vetor)
      if (!preview.isSvg) {
        const out = await toWebp(preview.file);
        blob = out.blob; width = out.width; height = out.height;
        contentType = "image/webp"; ext = "webp";
      }

      const path = `${empresaId}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
        cacheControl: "3600", upsert: true, contentType,
      });
      if (upErr) throw upErr;
      // Bucket é privado; geramos uma URL assinada de longa duração (10 anos).
      const { data: signed, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Falha ao gerar URL do logotipo");
      await updateLogoFn({ data: {
        logo_url: signed.signedUrl, storage_path: path, mime_type: contentType,
        tamanho_bytes: blob.size, width: preview.isSvg ? null : width, height: preview.isSvg ? null : height,
      } });
      invalidate();
      toast.success("Logotipo atualizado");
      URL.revokeObjectURL(preview.url);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao enviar");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    try {
      await updateLogoFn({ data: { logo_url: null } });
      invalidate();
      toast.success("Logotipo restaurado para o padrão");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao remover");
    }
  }

  async function handleRestore(versionId: string) {
    try {
      const r: any = await restoreFn({ data: { version_id: versionId } });
      invalidate();
      toast.success("Versão restaurada");
      return r;
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao restaurar");
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-serif text-xl">Sistema</h2>
        <p className="text-sm text-muted-foreground">Identidade visual e parâmetros gerais da empresa.</p>
      </div>

      <div className="border border-border rounded-lg bg-card p-5 space-y-4">
        <div>
          <h3 className="font-medium">Logotipo da empresa</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Aceita JPG, JPEG, PNG, BMP, WEBP, SVG, GIF e IMG · até 2 MB · entre {MIN_DIM}×{MIN_DIM} e {MAX_DIM}×{MAX_DIM}px.
            Imagens não-SVG são convertidas automaticamente para WebP (máx. {TARGET_MAX}px) para garantir consistência e desempenho.
          </p>
        </div>

        <div className="flex items-start gap-6 flex-wrap">
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cabeçalho web</div>
            <div className="h-14 px-4 rounded-md bg-brand text-brand-foreground flex items-center gap-2 min-w-[220px]">
              <LogoMark url={logoUrl ?? null} className="h-8 w-8" />
              <span className="font-serif text-base">{me?.empresa?.nome ?? "Sua empresa"}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">App mobile</div>
            <div className="w-[180px] h-[320px] rounded-[28px] border-4 border-foreground/80 bg-background overflow-hidden shadow-sm">
              <div className="h-10 bg-brand text-brand-foreground flex items-center gap-1.5 px-3">
                <LogoMark url={logoUrl ?? null} className="h-6 w-6" />
                <span className="text-[11px] font-serif truncate">{me?.empresa?.nome ?? "Empresa"}</span>
              </div>
              <div className="p-3 space-y-2">
                <div className="h-3 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted rounded" />
                <div className="h-16 w-full bg-muted/60 rounded" />
              </div>
            </div>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/bmp,image/webp,image/svg+xml,image/gif,.jpg,.jpeg,.png,.bmp,.webp,.svg,.gif,.img"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onSelect(f); }}
        />

        {error && (
          <div role="alert" className="text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {preview && (
          <div className="border border-border rounded-md p-3 bg-muted/30 space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
              <img src={preview.url} alt="Pré-visualização" className="h-20 w-20 object-contain bg-white rounded border border-border" />
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div><b>{preview.file.name}</b></div>
                <div>{preview.sizeKb} KB {preview.isSvg ? "· SVG (vetor)" : `· ${preview.width}×${preview.height}px`}</div>
                {!preview.isSvg && <div>Será convertido para WebP otimizado.</div>}
              </div>
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }} disabled={uploading}>Cancelar</Button>
                <Button onClick={confirmUpload} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Confirmar e salvar
                </Button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border">
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Como ficará no cabeçalho</div>
                <div className="h-14 px-4 rounded-md bg-brand text-brand-foreground flex items-center gap-2">
                  <img src={preview.url} alt="" className="h-8 w-8 object-contain" />
                  <span className="font-serif text-base truncate">{me?.empresa?.nome ?? "Sua empresa"}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Como ficará na tela de login</div>
                <div className="h-32 rounded-md bg-background border border-border flex flex-col items-center justify-center gap-2 p-3">
                  <img src={preview.url} alt="" className="h-12 w-12 object-contain" />
                  <div className="font-serif text-sm">{me?.empresa?.nome ?? "Sua empresa"}</div>
                  <div className="h-2 w-24 bg-muted rounded" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4 mr-2" />
            {logoUrl ? "Substituir logotipo" : "Enviar logotipo"}
          </Button>
          {logoUrl && isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={uploading}>
                  <Trash2 className="h-4 w-4 mr-2" /> Remover (restaurar padrão)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover logotipo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O sistema voltará a usar o logotipo padrão. As versões anteriores ficam no histórico e podem ser restauradas a qualquer momento.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRemove}>Remover</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {logoUrl && !isAdmin && (
            <p className="text-xs text-muted-foreground self-center">Apenas administradores podem remover o logotipo.</p>
          )}
        </div>
      </div>

      {/* Histórico de versões */}
      <div className="border border-border rounded-lg bg-card p-5">
        <h3 className="font-medium flex items-center gap-2 mb-3"><History className="h-4 w-4" /> Histórico do logotipo</h3>
        {(versions as any[]).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma versão registrada ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(versions as any[]).map((v) => (
              <li key={v.id} className="py-2 flex items-center gap-3">
                <img src={v.logo_url} alt="" className="h-10 w-10 object-contain bg-white rounded border border-border" />
                <div className="text-xs flex-1 min-w-0">
                  <div className="truncate">{new Date(v.created_at).toLocaleString("pt-BR")} · {v.autor?.nome ?? "—"}</div>
                  <div className="text-muted-foreground">
                    {v.width && v.height ? `${v.width}×${v.height}px · ` : ""}{v.tamanho_bytes ? `${Math.round(v.tamanho_bytes / 1024)} KB` : ""} {v.mime_type ? `· ${v.mime_type}` : ""}
                  </div>
                </div>
                {isAdmin && v.logo_url !== logoUrl && (
                  <Button size="sm" variant="outline" onClick={() => handleRestore(v.id)}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Restaurar
                  </Button>
                )}
                {v.logo_url === logoUrl && <span className="text-xs text-muted-foreground">atual</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border border-dashed border-border rounded-lg p-6 text-sm text-muted-foreground bg-muted/30">
        Em breve: fuso horário, numeração de RDO, integração climática, modelos de PDF.
      </div>
    </section>
  );
}

export function LogoMark({ url, className }: { url: string | null; className?: string }) {
  const resolved = useResolvedLogoUrl(url);
  if (resolved) {
    return (
      <img
        src={resolved}
        alt="Logo"
        loading="eager"
        decoding="async"
        className={`${className ?? "h-8 w-8"} object-contain`}
        style={{ imageRendering: "auto" }}
      />
    );
  }
  return (
    <div className={`${className ?? "h-8 w-8"} rounded-md bg-brand-foreground/15 grid place-items-center`}>
      <Building2 className="h-1/2 w-1/2" />
    </div>
  );
}

// Resolve URLs antigas (`/object/public/empresa-logos/...`) gerando uma URL assinada
// em tempo de execução. Bucket é privado por política do workspace.
function useResolvedLogoUrl(url: string | null): string | null {
  const [resolved, setResolved] = useState<string | null>(url);
  const lastRef = useRef<string | null>(null);
  if (lastRef.current !== url) {
    lastRef.current = url;
    if (!url) {
      if (resolved !== null) setResolved(null);
    } else if (url.includes(`/object/public/${BUCKET}/`)) {
      const path = url.split(`/object/public/${BUCKET}/`)[1]?.split("?")[0];
      if (path) {
        supabase.storage.from(BUCKET).createSignedUrl(decodeURIComponent(path), 60 * 60 * 24 * 7).then(({ data }) => {
          if (data?.signedUrl) setResolved(data.signedUrl);
        });
      } else if (resolved !== url) setResolved(url);
    } else if (resolved !== url) {
      setResolved(url);
    }
  }
  return resolved;
}
