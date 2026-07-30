/**
 * Administração da conexão OneDrive: trilha de auditoria e permissões
 * de leitura/escrita por usuário. Tudo validado no servidor.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function exigirAdmin(supabase: any, userId: string) {
  const { ehAdmin } = await import("@/lib/onedrive-permissoes.server");
  if (!(await ehAdmin(supabase, userId))) {
    throw new Error("Apenas administradores podem gerenciar a conexão do OneDrive.");
  }
}

/** Histórico: quem vinculou, quem reautorizou e quando. */
export const onedriveHistorico = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context.supabase, context.userId);
    const { listarAuditoria } = await import("@/lib/onedrive-auditoria.server");
    return { eventos: await listarAuditoria(50) };
  });

/** Lista os usuários da empresa com a permissão atual de OneDrive. */
export const onedriveListarPermissoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: me } = await context.supabase
      .from("profiles")
      .select("empresa_id")
      .eq("id", context.userId)
      .maybeSingle();

    let q = (supabaseAdmin as any).from("profiles").select("id, nome, email, cargo, empresa_id").order("nome");
    if (me?.empresa_id) q = q.eq("empresa_id", me.empresa_id);
    const { data: perfis, error } = await q;
    if (error) throw error;

    const { data: perms } = await (supabaseAdmin as any)
      .from("onedrive_permissoes")
      .select("user_id, pode_ler, pode_escrever, updated_at");
    const mapa = new Map<string, any>(((perms ?? []) as any[]).map((p) => [p.user_id, p]));

    return {
      usuarios: ((perfis ?? []) as any[]).map((p) => {
        const perm = mapa.get(p.id);
        return {
          id: p.id as string,
          nome: (p.nome as string) || (p.email as string) || "Usuário",
          email: (p.email as string) ?? null,
          cargo: (p.cargo as string) ?? null,
          podeLer: perm ? !!perm.pode_ler : true,
          podeEscrever: perm ? !!perm.pode_escrever : false,
          definido: !!perm,
          atualizadoEm: perm?.updated_at ?? null,
        };
      }),
    };
  });

/** Concede ou revoga leitura/escrita do OneDrive para um usuário. */
export const onedriveDefinirPermissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; podeLer: boolean; podeEscrever: boolean }) =>
    z.object({ userId: z.string().uuid(), podeLer: z.boolean(), podeEscrever: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await (supabaseAdmin as any).from("onedrive_permissoes").upsert(
      {
        user_id: data.userId,
        pode_ler: data.podeLer,
        pode_escrever: data.podeEscrever,
        concedido_por: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;

    const { data: alvo } = await (supabaseAdmin as any)
      .from("profiles")
      .select("nome, email")
      .eq("id", data.userId)
      .maybeSingle();

    const { registrarAuditoria } = await import("@/lib/onedrive-auditoria.server");
    await registrarAuditoria({
      userId: context.userId,
      acao: "permissao_alterada",
      conta: alvo?.email ?? null,
      detalhe: `${alvo?.nome ?? "Usuário"}: ${data.podeLer ? "pode ler" : "sem leitura"}, ${
        data.podeEscrever ? "pode gravar" : "sem gravação"
      }`,
    });

    return { ok: true as const };
  });

/** Permissão do próprio usuário logado (usada para esconder ações na tela). */
export const onedriveMinhaPermissao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { permissaoDe } = await import("@/lib/onedrive-permissoes.server");
    return permissaoDe(context.supabase, context.userId);
  });
