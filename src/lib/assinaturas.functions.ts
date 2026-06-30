import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const sujeitoSchema = z.object({
  sujeito_tipo: z.enum(["user", "grupo"]),
  sujeito_id: z.string().uuid(),
});

// Lista signatários requeridos do RDO (com nome resolvido)
export const listSignatarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rdo_id: string }) => z.object({ rdo_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const [{ data: reqs, error: e1 }, { data: assin, error: e2 }] = await Promise.all([
      supabase
        .from("rdo_signatarios_requeridos")
        .select("id, sujeito_tipo, sujeito_id, created_at")
        .eq("rdo_id", data.rdo_id),
      supabase
        .from("rdo_assinaturas")
        .select("id, user_id, via_grupo_id, storage_path, assinado_em")
        .eq("rdo_id", data.rdo_id),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;

    const userIds = (reqs ?? []).filter((r) => r.sujeito_tipo === "user").map((r) => r.sujeito_id);
    const grupoIds = (reqs ?? []).filter((r) => r.sujeito_tipo === "grupo").map((r) => r.sujeito_id);

    const [users, grupos, membros] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("id, nome, email").in("id", userIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      grupoIds.length
        ? supabase.from("grupos").select("id, nome").in("id", grupoIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      grupoIds.length
        ? supabase.from("grupo_membros").select("grupo_id, user_id").in("grupo_id", grupoIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);
    if (users.error) throw users.error;
    if (grupos.error) throw grupos.error;
    if (membros.error) throw membros.error;

    const membroUserIds = Array.from(new Set((membros.data ?? []).map((m: any) => m.user_id).filter(Boolean)));
    const membroProfiles = membroUserIds.length
      ? await supabase.from("profiles").select("id, nome, email").in("id", membroUserIds)
      : { data: [] as any[], error: null };
    if (membroProfiles.error) throw membroProfiles.error;

    const profilesById = new Map([...(users.data ?? []), ...(membroProfiles.data ?? [])].map((p: any) => [p.id, p]));

    const assinPorUser = new Map<string, any>();
    for (const a of assin ?? []) assinPorUser.set(a.user_id, a);

    const enriched = (reqs ?? []).map((r) => {
      if (r.sujeito_tipo === "user") {
        const p = (users.data ?? []).find((u: any) => u.id === r.sujeito_id);
        return {
          ...r,
          nome: p?.nome ?? "—",
          email: p?.email ?? null,
          membros: null as any,
          assinado: !!assinPorUser.get(r.sujeito_id),
          assinatura: assinPorUser.get(r.sujeito_id) ?? null,
        };
      }
      const g = (grupos.data ?? []).find((x: any) => x.id === r.sujeito_id);
      const grupoMembros = (membros.data ?? []).filter((m: any) => m.grupo_id === r.sujeito_id).map((m: any) => ({
        user_id: m.user_id,
        nome: profilesById.get(m.user_id)?.nome ?? "—",
        assinado: !!assinPorUser.get(m.user_id),
      }));
      return {
        ...r,
        nome: g?.nome ?? "—",
        email: null,
        membros: grupoMembros,
        assinado: grupoMembros.length > 0 && grupoMembros.every((m: any) => m.assinado),
        assinatura: null,
      };
    });

    return { signatarios: enriched, assinaturas: assin ?? [] };
  });

export const addSignatario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rdo_id: string; sujeito_tipo: "user" | "grupo"; sujeito_id: string }) =>
    z.object({ rdo_id: z.string().uuid() }).merge(sujeitoSchema).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("empresa_id").eq("id", userId).maybeSingle();
    if (!prof?.empresa_id) throw new Error("Empresa não encontrada");
    const { error } = await supabase.from("rdo_signatarios_requeridos").insert({
      rdo_id: data.rdo_id,
      empresa_id: prof.empresa_id,
      sujeito_tipo: data.sujeito_tipo,
      sujeito_id: data.sujeito_id,
      created_by: userId,
    });
    if (error) throw error;
    return { ok: true };
  });

export const removeSignatario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("rdo_signatarios_requeridos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// Registra assinatura do próprio usuário: faz upload base64 → storage e insere metadados
export const assinarRdo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rdo_id: string; base64: string; mime?: string; hash?: string; geo?: any }) =>
    z
      .object({
        rdo_id: z.string().uuid(),
        base64: z.string().min(10),
        mime: z.string().default("image/png"),
        hash: z.string().nullable().optional(),
        geo: z.any().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("empresa_id").eq("id", userId).maybeSingle();
    if (!prof?.empresa_id) throw new Error("Empresa não encontrada");
    const empresaId = prof.empresa_id;

    const ext = data.mime?.includes("jpeg") ? "jpg" : "png";
    const path = `${empresaId}/${data.rdo_id}/assinatura-${userId}-${Date.now()}.${ext}`;
    const buf = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const up = await supabase.storage.from("rdo-anexos").upload(path, buf, {
      contentType: data.mime || "image/png",
      upsert: true,
    });
    if (up.error) throw up.error;

    // Detecta se assina via grupo (qualquer grupo do qual é membro)
    const { data: viaGrupos } = await supabase
      .from("rdo_signatarios_requeridos")
      .select("sujeito_id, sujeito_tipo")
      .eq("rdo_id", data.rdo_id)
      .eq("sujeito_tipo", "grupo");
    let viaGrupoId: string | null = null;
    if (viaGrupos && viaGrupos.length) {
      const { data: meusGrupos } = await supabase
        .from("grupo_membros")
        .select("grupo_id")
        .eq("user_id", userId)
        .in(
          "grupo_id",
          viaGrupos.map((g) => g.sujeito_id),
        );
      viaGrupoId = meusGrupos?.[0]?.grupo_id ?? null;
    }

    const { error } = await supabase.from("rdo_assinaturas").insert({
      rdo_id: data.rdo_id,
      empresa_id: empresaId,
      user_id: userId,
      via_grupo_id: viaGrupoId,
      storage_path: path,
      hash_sha256: data.hash ?? null,
      geo: data.geo ?? null,
      user_agent: null,
    });
    if (error) throw error;

    // Também registra como anexo do RDO para aparecer na galeria "Assinaturas"
    await supabase.from("rdo_anexos").insert({
      rdo_id: data.rdo_id,
      empresa_id: empresaId,
      autor_id: userId,
      nome: `assinatura-${userId}.${ext}`,
      legenda: "Assinatura digital",
      storage_path: path,
      mime_type: data.mime || "image/png",
    });

    return { ok: true, storage_path: path };
  });

// Lista usuários da empresa para escolher como signatário
export const listEmpresaUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, nome, email")
      .eq("aprovado", true)
      .order("nome");
    if (error) throw error;
    return data ?? [];
  });

export const listEmpresaGrupos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("grupos").select("id, nome, tipo, obra_id").order("nome");
    if (error) throw error;
    return data ?? [];
  });
