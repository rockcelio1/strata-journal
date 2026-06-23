import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { getMe, updateEmpresaLogo } from "@/lib/core.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Building2, Upload, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/configuracoes/sistema")({
  component: SistemaPage,
});

const BUCKET = "empresa-logos";

function SistemaPage() {
  const getMeFn = useServerFn(getMe);
  const updateLogoFn = useServerFn(updateEmpresaLogo);
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });
  const empresaId = me?.empresa?.id as string | undefined;
  const logoUrl = (me?.empresa as any)?.logo_url as string | null | undefined;

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const saveLogo = useMutation({
    mutationFn: (url: string | null) => updateLogoFn({ data: { logo_url: url } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });

  async function handleFile(file: File) {
    if (!empresaId) return;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const okExt = ["jpg", "jpeg", "png", "bmp", "webp", "svg", "gif", "img"].includes(ext);
    const okMime = file.type.startsWith("image/");
    if (!okMime && !okExt) return toast.error("Formato inválido. Use JPG, JPEG, PNG, BMP, WEBP, SVG, GIF ou IMG.");
    if (file.size > 2 * 1024 * 1024) return toast.error("Máximo 2 MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${empresaId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      await saveLogo.mutateAsync(data.publicUrl);
      toast.success("Logotipo atualizado");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao enviar");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemove() {
    try {
      await saveLogo.mutateAsync(null);
      toast.success("Logotipo removido");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao remover");
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-serif text-xl">Sistema</h2>
        <p className="text-sm text-muted-foreground">Identidade visual e parâmetros gerais da empresa.</p>
      </div>

      {/* Logo */}
      <div className="border border-border rounded-lg bg-card p-5 space-y-4">
        <div>
          <h3 className="font-medium">Logotipo da empresa</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Aparece no cabeçalho do sistema (web e mobile — Android/iOS) e nos relatórios.
            PNG ou SVG com fundo transparente, até 2 MB.
          </p>
        </div>

        <div className="flex items-start gap-6 flex-wrap">
          {/* Preview web */}
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cabeçalho web</div>
            <div className="h-14 px-4 rounded-md bg-brand text-brand-foreground flex items-center gap-2 min-w-[220px]">
              <LogoMark url={logoUrl ?? null} className="h-8 w-8" />
              <span className="font-serif text-base">{me?.empresa?.nome ?? "Sua empresa"}</span>
            </div>
          </div>

          {/* Preview mobile */}
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">App mobile (Android / iOS)</div>
            <div className="w-[180px] h-[320px] rounded-[28px] border-4 border-foreground/80 bg-background overflow-hidden shadow-sm">
              <div className="h-10 bg-brand text-brand-foreground flex items-center gap-1.5 px-3">
                <LogoMark url={logoUrl ?? null} className="h-6 w-6" />
                <span className="text-[11px] font-serif truncate">{me?.empresa?.nome ?? "Empresa"}</span>
              </div>
              <div className="p-3 space-y-2">
                <div className="h-3 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted rounded" />
                <div className="h-16 w-full bg-muted/60 rounded" />
                <div className="h-3 w-2/3 bg-muted rounded" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {logoUrl ? "Substituir logotipo" : "Enviar logotipo"}
          </Button>
          {logoUrl && (
            <Button variant="outline" onClick={handleRemove} disabled={uploading || saveLogo.isPending}>
              <Trash2 className="h-4 w-4 mr-2" /> Remover
            </Button>
          )}
        </div>
      </div>

      <div className="border border-dashed border-border rounded-lg p-6 text-sm text-muted-foreground bg-muted/30">
        Em breve: fuso horário, numeração de RDO, integração climática, modelos de PDF.
      </div>
    </section>
  );
}

export function LogoMark({ url, className }: { url: string | null; className?: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt="Logo"
        className={`${className ?? "h-8 w-8"} object-contain rounded-sm bg-white/10 p-0.5`}
      />
    );
  }
  return (
    <div className={`${className ?? "h-8 w-8"} rounded-md bg-brand-foreground/15 grid place-items-center`}>
      <Building2 className="h-1/2 w-1/2" />
    </div>
  );
}
