/**
 * Permissões de leitura/escrita no OneDrive por usuário (somente servidor).
 *
 * Administradores têm acesso total. Para os demais, vale o que estiver na
 * tabela `onedrive_permissoes` (padrão: pode ler, não pode escrever).
 */

export type PermissaoOneDrive = { podeLer: boolean; podeEscrever: boolean; admin: boolean };

const PADRAO = { podeLer: true, podeEscrever: false };

export async function ehAdmin(supabase: any, userId: string): Promise<boolean> {
  const { temPermissao } = await import("./security/permissao.server");
  return await temPermissao(supabase, userId, "integracoes.onedrive", "editar");
}

export async function permissaoDe(supabase: any, userId: string): Promise<PermissaoOneDrive> {
  if (await ehAdmin(supabase, userId)) return { podeLer: true, podeEscrever: true, admin: true };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("onedrive_permissoes")
    .select("pode_ler, pode_escrever")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    podeLer: data ? !!data.pode_ler : PADRAO.podeLer,
    podeEscrever: data ? !!data.pode_escrever : PADRAO.podeEscrever,
    admin: false,
  };
}

export async function exigirLeitura(supabase: any, userId: string) {
  const p = await permissaoDe(supabase, userId);
  if (!p.podeLer) {
    throw new Error("Você não tem permissão para consultar os arquivos do OneDrive. Peça liberação a um administrador.");
  }
  return p;
}

export async function exigirEscrita(supabase: any, userId: string) {
  const p = await permissaoDe(supabase, userId);
  if (!p.podeEscrever) {
    throw new Error("Você não tem permissão para enviar ou alterar arquivos no OneDrive. Peça liberação a um administrador.");
  }
  return p;
}
