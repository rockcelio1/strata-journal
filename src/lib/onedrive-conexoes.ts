/**
 * Utilitários puros da conexão OneDrive do workspace.
 *
 * Ficam separados das server functions para poderem ser testados sem rede:
 * detecção das conexões disponíveis, máscara segura da chave, texto de
 * pedido de liberação ao admin e checklist de diagnóstico de vínculo.
 */

/** Escopos do Microsoft Graph exigidos pelo sistema. */
export const ESCOPOS_ONEDRIVE = ["Files.ReadWrite", "User.Read", "offline_access"] as const;

/** Prefixo das variáveis de ambiente criadas ao vincular a conexão ao projeto. */
const PREFIXO = "MICROSOFT_ONEDRIVE_API_KEY";

export type ConexaoDisponivel = {
  /** Nome da variável de ambiente (ex.: MICROSOFT_ONEDRIVE_API_KEY_2). */
  envName: string;
  /** Identificador seguro da conexão, sem expor a chave. */
  id: string;
  /** Rótulo amigável mostrado na tela de vínculo. */
  rotulo: string;
  /** É a conexão padrão (primeira vinculada ao projeto)? */
  padrao: boolean;
};

/** Mascara a chave da conexão: nunca exibimos o valor completo na tela. */
export function mascararChave(chave: string): string {
  const limpa = chave.trim();
  if (limpa.length <= 8) return "••••";
  return `${limpa.slice(0, 4)}••••${limpa.slice(-4)}`;
}

/**
 * Lista as conexões OneDrive já disponíveis para este projeto, a partir das
 * variáveis injetadas pelo workspace. Sem nenhuma vinculada, devolve [].
 */
export function detectarConexoes(env: Record<string, string | undefined>): ConexaoDisponivel[] {
  return Object.keys(env)
    .filter((k) => k === PREFIXO || k.startsWith(`${PREFIXO}_`))
    .filter((k) => (env[k] ?? "").trim().length > 0)
    .sort((a, b) => a.length - b.length || a.localeCompare(b))
    .map((envName, i) => ({
      envName,
      id: mascararChave(env[envName]!),
      rotulo: envName === PREFIXO ? "Conexão OneDrive do workspace" : `Conexão OneDrive #${envName.split("_").pop()}`,
      padrao: i === 0,
    }));
}

/** A variável informada é uma conexão OneDrive válida deste projeto? */
export function conexaoPermitida(env: Record<string, string | undefined>, envName: string): boolean {
  return detectarConexoes(env).some((c) => c.envName === envName);
}

export type ContextoFalha = {
  conexaoId?: string | null;
  conta?: string | null;
  organizacao?: string | null;
  requestId?: string | null;
  status?: number | null;
  erro?: string | null;
  projeto?: string | null;
  usuario?: string | null;
};

/**
 * Texto pronto para o usuário enviar ao administrador do workspace pedindo
 * liberação da conta na conexão OneDrive.
 */
export function montarPedidoLiberacao(ctx: ContextoFalha): string {
  const linhas = [
    "Olá! Preciso de liberação na conexão OneDrive do workspace no Lovable.",
    "",
    "O que fazer (Configurações do workspace → Conectores → OneDrive):",
    "1. Abrir a conexão OneDrive e conceder acesso ao meu usuário na seção de permissões.",
    `2. Confirmar que os escopos autorizados incluem: ${ESCOPOS_ONEDRIVE.join(", ")}.`,
    "3. Vincular a conexão a este projeto (a vinculação é por projeto, não basta existir no workspace).",
    "4. Se o token estiver expirado, refazer o OAuth com a conta corporativa correta.",
    "",
    "Dados do erro para o diagnóstico:",
    `- Projeto: ${ctx.projeto ?? "(não informado)"}`,
    `- Meu usuário no sistema: ${ctx.usuario ?? "(não informado)"}`,
    `- Conta/organização detectada: ${ctx.organizacao ?? ctx.conta ?? "(nenhuma — conexão não respondeu)"}`,
    `- ID da conexão: ${ctx.conexaoId ?? "(sem conexão vinculada ao projeto)"}`,
    `- Status HTTP: ${ctx.status ?? "sem resposta"}`,
    `- request-id: ${ctx.requestId ?? "(não retornado)"}`,
    `- Mensagem: ${ctx.erro ?? "(sem mensagem)"}`,
  ];
  return linhas.join("\n");
}

export type Diagnostico = {
  conexaoId: string;
  organizacao: string;
  requestId: string;
  status: string;
  checklist: string[];
};

/** Diagnóstico completo exibido quando a vinculação falha. */
export function montarDiagnosticoVinculo(ctx: ContextoFalha): Diagnostico {
  return {
    conexaoId: ctx.conexaoId ?? "nenhuma conexão vinculada ao projeto",
    organizacao: ctx.organizacao ?? ctx.conta ?? "não foi possível identificar a conta",
    requestId: ctx.requestId ?? "não retornado pela Microsoft",
    status: ctx.status != null ? String(ctx.status) : "sem resposta",
    checklist: [
      "Conectores → OneDrive: a conexão existe e está com o OAuth válido (reautorize se expirou).",
      "Conectores → OneDrive → permissões: seu usuário está na lista de quem pode usar a conexão.",
      `Escopos autorizados incluem ${ESCOPOS_ONEDRIVE.join(", ")}.`,
      "A conexão está vinculada a ESTE projeto (a vinculação é por projeto).",
      "Após ajustar, use “Verificar novamente” aqui — a tela atualiza sozinha, sem recarregar.",
    ],
  };
}
