import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { exigirPermissao } from "./security/permissao.server";

const obraSchema = z.object({
  nome: z.string().min(1),
  codigo: z.string().nullable().optional(),
  cliente: z.string().nullable().optional(),
  endereco: z.string().nullable().optional(),
  data_inicio: z.string().nullable().optional(),
  data_previsao_fim: z.string().nullable().optional(),
  status: z.enum(["planejamento", "em_andamento", "pausada", "concluida"]).default("planejamento"),
  avanco_pct: z.number().min(0).max(100).default(0),
  descricao: z.string().nullable().optional(),
});

export const listObras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("obras").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as any[];
    const paths = Array.from(new Set(rows.map((r) => r.foto_capa_path).filter(Boolean)));
    const thumbs: Record<string, string> = {};
    // Miniaturas geradas pelo transformador de imagem do Storage — reduzem
    // bytes transferidos e padronizam o recorte para a grade/lista/tabela.
    await Promise.all(
      paths.map(async (p) => {
        const { data: s } = await context.supabase.storage
          .from("obra-fotos")
          .createSignedUrl(p as string, 3600, {
            transform: { width: 640, height: 360, resize: "cover", quality: 70 },
          });
        if (s?.signedUrl) thumbs[p as string] = s.signedUrl;
      }),
    );
    return rows.map((r) => ({
      ...r,
      foto_capa_url: r.foto_capa_path ? thumbs[r.foto_capa_path] ?? null : null,
      foto_capa_thumb_url: r.foto_capa_path ? thumbs[r.foto_capa_path] ?? null : null,
    }));
  });

export const listObrasOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("obras")
      .select("id, nome")
      .order("nome", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });



export const getObra = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: obra, error } = await context.supabase
      .from("obras").select("*").eq("id", data.id).maybeSingle();
    if (error) throw error;
    if (!obra) throw new Error("Obra não encontrada");

    let responsavel: { id: string; nome: string } | null = null;
    if (obra.responsavel_id) {
      const r = await context.supabase.from("profiles").select("id, nome").eq("id", obra.responsavel_id).maybeSingle();
      responsavel = r.data as any;
    }

    const [rdosRes, rdoIdsRes] = await Promise.all([
      context.supabase.from("rdos").select("id, numero, data, status").eq("obra_id", data.id).is("deleted_at", null).order("data", { ascending: false }).limit(20),
      context.supabase.from("rdos").select("id").eq("obra_id", data.id).is("deleted_at", null),
    ]);
    const rdoIds = (rdoIdsRes.data ?? []).map((r: any) => r.id);

    let atividadesCount = 0, ocorrenciasCount = 0, fotosCount = 0;
    let fotosRecentes: any[] = [];
    if (rdoIds.length) {
      const [ativC, ocC, fotC, fotR] = await Promise.all([
        context.supabase.from("rdo_atividades").select("id", { count: "exact", head: true }).in("rdo_id", rdoIds),
        context.supabase.from("rdo_ocorrencias").select("id", { count: "exact", head: true }).in("rdo_id", rdoIds),
        context.supabase.from("rdo_anexos").select("id", { count: "exact", head: true }).in("rdo_id", rdoIds).like("mime_type", "image/%"),
        context.supabase.from("rdo_anexos").select("id, nome, storage_path, storage_provider, onedrive_download_url, onedrive_web_url, thumbnail_url, mime_type, created_at")
          .in("rdo_id", rdoIds).like("mime_type", "image/%").order("created_at", { ascending: false }).limit(12),
      ]);
      atividadesCount = ativC.count ?? 0;
      ocorrenciasCount = ocC.count ?? 0;
      fotosCount = fotC.count ?? 0;
      fotosRecentes = await Promise.all((fotR.data ?? []).map(async (a: any) => {
        let url: string | null = null;
        if (a.storage_provider === "onedrive") {
          url = a.thumbnail_url ?? a.onedrive_download_url ?? a.onedrive_web_url ?? null;
        } else {
          const s = await context.supabase.storage.from("rdo-anexos").createSignedUrl(a.storage_path, 3600);
          url = s.data?.signedUrl ?? null;
        }
        return { id: a.id, url, nome: a.nome };
      }));
    }

    return {
      obra: { ...obra, responsavel },
      rdos: rdosRes.data ?? [],
      stats: {
        relatorios: rdoIds.length,
        atividades: atividadesCount,
        ocorrencias: ocorrenciasCount,
        comentarios: 0,
        fotos: fotosCount,
      },
      fotos_recentes: fotosRecentes,
    };
  });

export const createObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => obraSchema.parse(d))
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "obras", "criar");
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    const empresaId = me.data?.empresa_id;
    if (!empresaId) throw new Error("Sem empresa");
    const { error, data: created } = await context.supabase.from("obras").insert({ ...data, empresa_id: empresaId }).select().single();
    if (error) throw error;
    return created;
  });

export const updateObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => obraSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "obras", "editar");
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("obras").update(rest).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "obras", "excluir");
    const { error } = await context.supabase.from("obras").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// --- Cache de previsão por obra (Open-Meteo) ---
export const getObraClimaCache = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { obra_id: string }) => z.object({ obra_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("obras")
      .select("clima_cache, clima_cache_at")
      .eq("id", data.obra_id)
      .maybeSingle();
    if (error) throw error;
    return { cache: (row as any)?.clima_cache ?? null, cache_at: (row as any)?.clima_cache_at ?? null };
  });

export const saveObraClimaCache = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ obra_id: z.string().uuid(), cache: z.any() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("obras")
      .update({ clima_cache: data.cache, clima_cache_at: new Date().toISOString() } as any)
      .eq("id", data.obra_id);
    if (error) throw error;
    return { ok: true };
  });

// --- Cache de coordenadas (lat/lng) por obra ---
export const getObraGeo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { obra_id: string }) => z.object({ obra_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("obras")
      .select("geo_lat, geo_lng, geo_endereco, geo_at, endereco")
      .eq("id", data.obra_id)
      .maybeSingle();
    if (error) throw error;
    return row as any;
  });

export const saveObraGeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obra_id: z.string().uuid(),
      lat: z.number(),
      lng: z.number(),
      endereco: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("obras")
      .update({
        geo_lat: data.lat,
        geo_lng: data.lng,
        geo_endereco: data.endereco ?? null,
        geo_at: new Date().toISOString(),
      } as any)
      .eq("id", data.obra_id);
    if (error) throw error;
    return { ok: true };
  });
