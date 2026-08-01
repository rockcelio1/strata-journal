import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/integrations/supabase/types";

/**
 * Chaves canônicas de recurso (tabela public.app_recursos).
 * Qualquer chave fora desta lista é considerada "não catalogada" e cai no
 * fallback de administrador/master — assim novas áreas do sistema continuam
 * protegidas sem bloquear usuários legítimos por engano.
 */
const RECURSOS_CANONICOS = new Set([
  "admin.auditoria", "admin.backup", "admin.convites", "admin.email", "admin.empresa",
  "admin.lgpd", "admin.permissoes", "admin.usuarios",
  "cadastros.equipamentos", "cadastros.mao_de_obra", "cadastros.ocorrencias", "cadastros.tarefas",
  "chamados.base_conhecimento", "chamados.tickets",
  "diario.anexos", "diario.assinaturas", "diario.rdos",
  "obras.fotos", "obras.obras",
  "patrimonio.bens", "patrimonio.emprestimos", "patrimonio.manutencao",
  "protocolo.movimentacoes", "protocolo.protocolos",
  "relatorios.analises", "relatorios.dashboard",
]);

/** Apelidos usados no código → chave canônica do catálogo de recursos. */
const ALIAS_RECURSO: Record<string, string> = {
  rdos: "diario.rdos",
  rdo: "diario.rdos",
  "rdos.anexos": "diario.anexos",
  anexos: "diario.anexos",
  assinaturas: "diario.assinaturas",
  obras: "obras.obras",
  "obras.anexos": "obras.fotos",
  usuarios: "admin.usuarios",
  "configuracoes.usuarios": "admin.usuarios",
  "configuracoes.empresa": "admin.empresa",
  "configuracoes.email": "admin.email",
  "configuracoes.backup": "admin.backup",
  "configuracoes.lgpd": "admin.lgpd",
  empresa: "admin.empresa",
  permissoes: "admin.permissoes",
  convites: "admin.convites",
  relatorios: "relatorios.analises",
  equipamentos: "cadastros.equipamentos",
  mao_de_obra: "cadastros.mao_de_obra",
  ocorrencias: "cadastros.ocorrencias",
  templates_tarefas: "cadastros.tarefas",
  lista_tarefas: "cadastros.tarefas",
  listas_tarefas: "cadastros.tarefas",
};

/** Apelidos de ação → ação canônica. */
const ALIAS_ACAO: Record<string, string> = {
  visualizar: "ver",
  ler: "ver",
  listar: "ver",
  remover: "excluir",
  deletar: "excluir",
  atualizar: "editar",
  adicionar: "criar",
};

export function normalizarRecurso(recurso: string) {
  return ALIAS_RECURSO[recurso] ?? recurso;
}

export function normalizarAcao(acao: string) {
  return ALIAS_ACAO[acao] ?? acao;
}

async function ehAdminOuMaster(supabase: SupabaseClient<Database>, userId: string) {
  const [admin, master] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" as any }),
    supabase.rpc("has_role", { _user_id: userId, _role: "master" as any }),
  ]);
  return !!admin.data || !!master.data;
}

/**
 * Verifica se um usuário possui uma permissão específica no servidor.
 * Reutiliza a função `pode()` do banco (mesma fonte de verdade usada pela UI
 * através de `meus_acessos()`), garantindo consistência entre tela e API.
 */
export async function temPermissao(
  supabase: SupabaseClient<Database>,
  userId: string,
  recurso: string,
  acao: string,
): Promise<boolean> {
  const rec = normalizarRecurso(recurso);
  const act = normalizarAcao(acao);

  // Recurso ainda não catalogado (ex.: integrações): exige admin/master.
  if (!RECURSOS_CANONICOS.has(rec)) {
    return await ehAdminOuMaster(supabase, userId);
  }

  const { data, error } = await supabase.rpc("pode", {
    _user: userId,
    _recurso: rec,
    _acao: act,
  } as any);

  if (error) {
    console.error(`[security] Erro ao verificar permissão (${rec}:${act}):`, error.message);
    // Falha na verificação granular não pode derrubar administradores.
    return await ehAdminOuMaster(supabase, userId);
  }

  if (data) return true;
  // Admin/master mantêm acesso pleno mesmo sem grant explícito.
  return await ehAdminOuMaster(supabase, userId);
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
  acao: string,
) {
  const permitido = await temPermissao(supabase, userId, recurso, acao);
  if (!permitido) {
    throw new AcessoNegadoError(normalizarRecurso(recurso), normalizarAcao(acao));
  }
}
