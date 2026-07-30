/**
 * Trilha de auditoria da conexão OneDrive (somente servidor).
 *
 * Registra quem vinculou, quem reautorizou, quando as credenciais mudaram e
 * quem alterou permissões de acesso. Consultada em Configurações → OneDrive.
 */

export type AcaoOneDrive =
  | "login"
  | "reautorizacao"
  | "desconexao"
  | "vinculo_sistema"
  | "desvinculo_sistema"
  | "permissao_alterada";

export const ROTULO_ACAO: Record<AcaoOneDrive, string> = {
  login: "Conectou a conta Microsoft",
  reautorizacao: "Reautorizou a conta Microsoft",
  desconexao: "Desconectou a conta Microsoft",
  vinculo_sistema: "Definiu a conta do sistema",
  desvinculo_sistema: "Removeu a conta do sistema",
  permissao_alterada: "Alterou permissões de usuário",
};

type Registro = {
  userId: string | null;
  acao: AcaoOneDrive;
  conta?: string | null;
  escopos?: string[];
  detalhe?: string | null;
};

/** Grava um evento de auditoria. Nunca derruba o fluxo principal. */
export async function registrarAuditoria(r: Registro): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("onedrive_auditoria").insert({
      user_id: r.userId,
      acao: r.acao,
      conta: r.conta ?? null,
      escopos: r.escopos ?? [],
      detalhe: r.detalhe ?? null,
    });
  } catch (e) {
    console.error("[onedrive:auditoria] falha ao registrar", e);
  }
}

export type EventoAuditoria = {
  id: string;
  acao: AcaoOneDrive;
  rotulo: string;
  conta: string | null;
  escopos: string[];
  detalhe: string | null;
  criadoEm: string;
  usuario: string;
};

/** Últimos eventos, já com o nome de quem executou. */
export async function listarAuditoria(limite = 50): Promise<EventoAuditoria[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("onedrive_auditoria")
    .select("id, user_id, acao, conta, escopos, detalhe, criado_em")
    .order("criado_em", { ascending: false })
    .limit(Math.min(Math.max(limite, 1), 200));
  if (error) throw error;

  const linhas = (data ?? []) as Array<Record<string, any>>;
  const ids = [...new Set(linhas.map((l) => l.user_id).filter(Boolean))];
  const nomes = new Map<string, string>();
  if (ids.length) {
    const { data: perfis } = await (supabaseAdmin as any)
      .from("profiles")
      .select("id, nome, email")
      .in("id", ids);
    for (const p of (perfis ?? []) as Array<Record<string, any>>) {
      nomes.set(p.id, p.nome || p.email || "Usuário");
    }
  }

  return linhas.map((l) => ({
    id: l.id,
    acao: l.acao as AcaoOneDrive,
    rotulo: ROTULO_ACAO[l.acao as AcaoOneDrive] ?? l.acao,
    conta: l.conta ?? null,
    escopos: (l.escopos ?? []) as string[],
    detalhe: l.detalhe ?? null,
    criadoEm: l.criado_em,
    usuario: l.user_id ? (nomes.get(l.user_id) ?? "Usuário removido") : "Sistema",
  }));
}
