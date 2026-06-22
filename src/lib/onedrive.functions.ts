import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_onedrive/v1.0";

function slugSegment(s: string): string {
  return (s || "sem-nome")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "sem-nome";
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

const MESES_PT = ["janeiro","fevereiro","marco","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

export const uploadOneDriveAnexo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rdo_id: string; nome: string; mime_type: string; tamanho_bytes: number; base64: string; legenda?: string }) =>
    z.object({
      rdo_id: z.string().uuid(),
      nome: z.string().min(1).max(200),
      mime_type: z.string().min(1).max(120),
      tamanho_bytes: z.number().int().min(0).max(50 * 1024 * 1024),
      base64: z.string().min(1),
      legenda: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.MICROSOFT_ONEDRIVE_API_KEY;
    if (!apiKey || !connKey) throw new Error("OneDrive não está conectado. Conecte o conector OneDrive no projeto.");

    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (!me.data?.empresa_id) throw new Error("Sem empresa");

    const ctx = await context.supabase
      .from("rdos")
      .select("id, data, obra_id, obras(nome), empresas:empresa_id(nome)")
      .eq("id", data.rdo_id)
      .maybeSingle();
    if (ctx.error || !ctx.data) throw new Error("RDO não encontrado");

    const empresaNome = (ctx.data as any).empresas?.nome ?? "Empresa";
    const obraNome = (ctx.data as any).obras?.nome ?? "Obra";
    const d = ctx.data.data ? new Date(ctx.data.data + "T00:00:00") : new Date();
    const ano = String(d.getFullYear());
    const mes = `${String(d.getMonth() + 1).padStart(2, "0")}-${MESES_PT[d.getMonth()]}`;
    const dia = d.toISOString().slice(0, 10);

    const safeName = slugSegment(data.nome.replace(/\.[^.]+$/, "")) + (data.nome.match(/\.[^.]+$/)?.[0] ?? "");
    const filename = `${Date.now()}-${safeName}`;
    const folder = `DiarioDeObra/${slugSegment(empresaNome)}/${slugSegment(obraNome)}/${ano}/${mes}/${dia}`;
    const fullPath = `${folder}/${filename}`;

    // Decode base64 → Uint8Array
    const binary = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));

    const url = `${GATEWAY_URL}/me/drive/root:/${encodePath(fullPath)}:/content`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Connection-Api-Key": connKey,
        "Content-Type": data.mime_type,
      },
      body: binary,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OneDrive upload falhou (${res.status}): ${body.slice(0, 300)}`);
    }
    const item = await res.json() as {
      id: string; name: string; webUrl?: string; size?: number;
      "@microsoft.graph.downloadUrl"?: string;
      thumbnails?: Array<{ medium?: { url: string }; large?: { url: string } }>;
    };

    const { data: created, error } = await context.supabase.from("rdo_anexos").insert({
      rdo_id: data.rdo_id,
      empresa_id: me.data.empresa_id,
      autor_id: context.userId,
      nome: data.legenda ? `${data.nome} — ${data.legenda}` : data.nome,
      legenda: data.legenda ?? null,
      storage_path: fullPath,
      mime_type: data.mime_type,
      tamanho_bytes: item.size ?? data.tamanho_bytes,
      storage_provider: "onedrive",
      onedrive_item_id: item.id,
      onedrive_web_url: item.webUrl ?? null,
      onedrive_download_url: item["@microsoft.graph.downloadUrl"] ?? null,
      thumbnail_url: item.thumbnails?.[0]?.medium?.url ?? null,
    }).select().single();
    if (error) throw error;
    return created;
  });
