/**
 * Autenticação das rotas HTTP internas do RDO.
 *
 * Usa exclusivamente a autenticação própria do RDO (sessão do usuário),
 * independente da autenticação técnica do backend com o Microsoft Graph.
 * Somente servidor.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ContextoApi = {
  supabase: SupabaseClient<Database>;
  userId: string;
  empresaId: string | null;
};

export class ApiAuthError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function respostaErro(status: number, codigo: string, mensagem: string) {
  return Response.json({ error: codigo, message: mensagem }, { status });
}

/** Valida o Bearer da sessão do RDO e devolve um cliente com RLS do usuário. */
export async function autenticarRequisicao(request: Request): Promise<ContextoApi> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new ApiAuthError(500, "Backend do RDO não configurado.");

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) throw new ApiAuthError(401, "Autenticação necessária.");

  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new ApiAuthError(401, "Sessão inválida ou expirada.");

  const perfil = await supabase.from("profiles").select("empresa_id").eq("id", data.user.id).maybeSingle();
  return { supabase, userId: data.user.id, empresaId: perfil.data?.empresa_id ?? null };
}
