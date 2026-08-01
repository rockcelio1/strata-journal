import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/integrations/supabase/types";

/**
 * Verifica se um usuário possui uma permissão específica no servidor.
 * Reutiliza a lógica do banco de dados (RPC has_permission) para garantir consistência.
 */
export async function temPermissao(
  supabase: SupabaseClient<Database>,
  userId: string,
  recurso: string,
  acao: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_permission", {
    _user_id: userId,
    _resource: recurso as any,
    _action: acao as any,
  });

  if (error) {
    console.error(`[security] Erro ao verificar permissão (${recurso}:${acao}):`, error.message);
    return false;
  }

  return !!data;
}

/**
 * Exceção lançada quando o acesso é negado por falta de permissão.
 */
export class AcessoNegadoError extends Error {
  constructor(recurso: string, acao: string) {
    super(`Acesso negado: você não tem permissão para ${acao} em ${recurso}.`);
    this.name = "AcessoNegadoError";
  }
}

/**
 * Garante que o usuário tenha a permissão necessária.
 * Lança AcessoNegadoError se falhar.
 */
export async function exigirPermissao(
  supabase: SupabaseClient<Database>,
  userId: string,
  recurso: string,
  acao: string
) {
  const permitido = await temPermissao(supabase, userId, recurso, acao);
  if (!permitido) {
    throw new AcessoNegadoError(recurso, acao);
  }
}
