import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const nivelEnum = z.enum(["ver", "editar", "aprovar"]);
const sujeitoEnum = z.enum(["user", "grupo"]);

// ============== GRUPOS ==============

export const listarGrupos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tipo?: "global" | "equipe_obra"; obra_id?: string | null }) =>
    z.object({ tipo: z.enum(["global", "equipe_obra"]).optional(), obra_id: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("grupos")
      .select("id, nome, descricao, tipo, obra_id, created_at, grupo_membros(user_id)")
      .order("nome");
    if (data.tipo) q = q.eq("tipo", data.tipo);
    if (data.obra_id) q = q.eq("obra_id", data.obra_id);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []).map((g: any) => ({
      ...g,
      membros_count: g.grupo_membros?.length ?? 0,
      membros: (g.grupo_membros ?? []).map((m: any) => m.user_id),
    }));
  });

export const criarGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { nome: string; tipo: "global" | "equipe_obra"; obra_id?: string | null; descricao?: string }) =>
    z.object({
      nome: z.string().min(2).max(120),
      tipo: z.enum(["global", "equipe_obra"]),
      obra_id: z.string().uuid().nullable().optional(),
      descricao: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: prof } = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (!prof?.empresa_id) throw new Error("Empresa não encontrada");
    if (data.tipo === "equipe_obra" && !data.obra_id) throw new Error("Equipe por obra requer obra_id");
    const { data: row, error } = await context.supabase
      .from("grupos")
      .insert({
        empresa_id: prof.empresa_id,
        nome: data.nome,
        descricao: data.descricao ?? null,
        tipo: data.tipo,
        obra_id: data.tipo === "equipe_obra" ? data.obra_id! : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const excluirGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("grupos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const adicionarMembro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { grupo_id: string; user_id: string }) =>
    z.object({ grupo_id: z.string().uuid(), user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("grupo_membros").insert({ grupo_id: data.grupo_id, user_id: data.user_id });
    if (error && !String(error.message).includes("duplicate")) throw error;
    return { ok: true };
  });

export const removerMembro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { grupo_id: string; user_id: string }) =>
    z.object({ grupo_id: z.string().uuid(), user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("grupo_membros").delete().eq("grupo_id", data.grupo_id).eq("user_id", data.user_id);
    if (error) throw error;
    return { ok: true };
  });

// ============== RDO ACESSOS ==============

export const listarAcessosRdo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rdo_id: string }) => z.object({ rdo_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: acessos, error } = await context.supabase
      .from("rdo_acessos")
      .select("id, sujeito_tipo, sujeito_id, nivel, created_at")
      .eq("rdo_id", data.rdo_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = acessos ?? [];
    const userIds = rows.filter((r) => r.sujeito_tipo === "user").map((r) => r.sujeito_id);
    const grupoIds = rows.filter((r) => r.sujeito_tipo === "grupo").map((r) => r.sujeito_id);
    const [usersRes, gruposRes] = await Promise.all([
      userIds.length
        ? context.supabase.from("profiles").select("id, nome, email").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      grupoIds.length
        ? context.supabase.from("grupos").select("id, nome, tipo, obra_id").in("id", grupoIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const uMap = new Map((usersRes.data ?? []).map((u: any) => [u.id, u]));
    const gMap = new Map((gruposRes.data ?? []).map((g: any) => [g.id, g]));
    return rows.map((r) => ({
      id: r.id,
      sujeito_tipo: r.sujeito_tipo,
      sujeito_id: r.sujeito_id,
      nivel: r.nivel,
      created_at: r.created_at,
      label: r.sujeito_tipo === "user"
        ? (uMap.get(r.sujeito_id)?.nome ?? uMap.get(r.sujeito_id)?.email ?? r.sujeito_id.slice(0, 8))
        : (gMap.get(r.sujeito_id)?.nome ?? r.sujeito_id.slice(0, 8)),
      detalhe: r.sujeito_tipo === "user"
        ? uMap.get(r.sujeito_id)?.email
        : (gMap.get(r.sujeito_id)?.tipo === "equipe_obra" ? "equipe da obra" : "grupo global"),
    }));
  });

export const concederAcessoRdo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rdo_id: string; sujeito_tipo: "user" | "grupo"; sujeito_id: string; nivel: "ver" | "editar" | "aprovar" }) =>
    z.object({
      rdo_id: z.string().uuid(),
      sujeito_tipo: sujeitoEnum,
      sujeito_id: z.string().uuid(),
      nivel: nivelEnum,
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const rdo = await context.supabase.from("rdos").select("empresa_id").eq("id", data.rdo_id).maybeSingle();
    if (!rdo.data) throw new Error("RDO não encontrado");
    const { error } = await context.supabase
      .from("rdo_acessos")
      .upsert(
        {
          rdo_id: data.rdo_id,
          empresa_id: rdo.data.empresa_id,
          sujeito_tipo: data.sujeito_tipo,
          sujeito_id: data.sujeito_id,
          nivel: data.nivel,
          created_by: context.userId,
        },
        { onConflict: "rdo_id,sujeito_tipo,sujeito_id" },
      );
    if (error) throw error;
    return { ok: true };
  });

export const revogarAcessoRdo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("rdo_acessos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// Lookup util — usuários da empresa para o seletor
export const listarUsuariosDaEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, nome, email")
      .order("nome");
    if (error) throw error;
    return data ?? [];
  });
