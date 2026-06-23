import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
    return data;
  });

export const getObra = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: obra, error } = await context.supabase
      .from("obras").select("*, responsavel:profiles!obras_responsavel_id_fkey(id, nome)").eq("id", data.id).maybeSingle();
    if (error) throw error;
    if (!obra) throw new Error("Obra não encontrada");

    const [rdosRes, rdoIdsRes] = await Promise.all([
      context.supabase.from("rdos").select("id, numero, data, status").eq("obra_id", data.id).order("data", { ascending: false }).limit(20),
      context.supabase.from("rdos").select("id").eq("obra_id", data.id),
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
      obra,
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
    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (!me.data) throw new Error("Sem empresa");
    const { error, data: created } = await context.supabase.from("obras").insert({ ...data, empresa_id: me.data.empresa_id }).select().single();
    if (error) throw error;
    return created;
  });

export const updateObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => obraSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("obras").update(rest).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("obras").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
