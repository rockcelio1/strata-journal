/**
 * Traduz ações e detalhes de auditoria em texto amigável.
 * Cobre eventos gerados por triggers (permissao_*_role_permissions,
 * permissao_*_user_permission_overrides, rdo_acesso_*) e os rótulos
 * criados manualmente em Usuários/Convites.
 */

const RECURSO_LABELS: Record<string, string> = {
  rdo: "RDO",
  obras: "Obras",
  equipamentos: "Equipamentos",
  mao_de_obra: "Mão de obra",
  ocorrencias: "Ocorrências",
  tipos_ocorrencia: "Tipos de ocorrência",
  lista_tarefas: "Lista de tarefas",
  templates_tarefas: "Modelos de tarefas",
  usuarios: "Usuários",
  permissoes: "Permissões",
  grupos: "Grupos",
  empresa: "Empresa",
  configuracoes: "Configurações",
  relatorios: "Relatórios",
  galeria: "Galeria",
  onedrive: "OneDrive",
  ajuda: "Ajuda",
  notificacoes: "Notificações",
};

const ACAO_RECURSO_LABELS: Record<string, string> = {
  ver: "visualizar",
  criar: "criar",
  editar: "editar",
  excluir: "excluir",
  aprovar: "aprovar",
  reprovar: "reprovar",
  exportar: "exportar",
  importar: "importar",
  compartilhar: "compartilhar",
  duplicar: "duplicar",
  assinar: "assinar",
  enviar: "enviar",
  reabrir: "reabrir",
  gerenciar: "gerenciar",
};

const PAPEIS: Record<string, string> = {
  master: "Master",
  admin: "Administrador",
  planejador: "Planejador",
  operador: "Operador",
  viewer: "Somente leitura",
};

const NIVEIS: Record<string, string> = {
  leitura: "somente leitura",
  edicao: "edição",
  aprovacao: "aprovação",
  total: "acesso total",
};

const ACAO_TOP_LEVEL: Record<string, string> = {
  // Usuários / convites
  convite_criado: "Convite criado",
  convite_reenviado: "Convite reenviado",
  convite_revogado: "Convite revogado",
  usuario_criado: "Usuário criado",
  usuario_editado: "Usuário editado",
  usuario_excluido: "Usuário excluído",
  usuario_desabilitado: "Usuário desabilitado",
  usuario_habilitado: "Usuário habilitado",
  usuario_aprovado: "Usuário aprovado",
  usuario_reprovado: "Aprovação removida",
  senha_definida: "Senha redefinida",
  senha_reset_enviado: "E-mail de reset enviado",
  papel_alterado: "Papel alterado",
};

function opLabel(op?: string): string {
  const o = (op ?? "").toUpperCase();
  if (o === "INSERT") return "Concedeu";
  if (o === "DELETE") return "Revogou";
  if (o === "UPDATE") return "Alterou";
  return "Registro";
}

function papelLabel(v?: string): string {
  if (!v) return "";
  return PAPEIS[v] ?? v;
}

function recursoLabel(v?: string): string {
  if (!v) return "";
  return RECURSO_LABELS[v] ?? v;
}

function acaoRecursoLabel(v?: string): string {
  if (!v) return "";
  return ACAO_RECURSO_LABELS[v] ?? v;
}

/** Título curto e legível para a coluna principal. */
export function friendlyAction(acao: string, detalhes: any): string {
  if (ACAO_TOP_LEVEL[acao]) return ACAO_TOP_LEVEL[acao];

  const det = detalhes ?? {};
  const rec = det.new ?? det.old ?? {};
  const op = det.op ?? (acao.endsWith("_insert") ? "INSERT"
                     : acao.endsWith("_update") ? "UPDATE"
                     : acao.endsWith("_delete") ? "DELETE" : "");

  if (acao.includes("role_permissions")) {
    const verbo = op === "INSERT" ? (rec.allowed === false ? "Bloqueou" : "Concedeu")
                : op === "DELETE" ? "Removeu"
                : "Alterou";
    return `${verbo} permissão de papel`;
  }
  if (acao.includes("user_permission_overrides")) {
    const verbo = op === "INSERT" ? "Adicionou exceção de permissão"
                : op === "DELETE" ? "Removeu exceção de permissão"
                : "Alterou exceção de permissão";
    return verbo;
  }
  if (acao.startsWith("rdo_acesso_")) {
    if (acao.endsWith("insert")) return "Compartilhou RDO";
    if (acao.endsWith("delete")) return "Removeu acesso ao RDO";
    return "Alterou acesso ao RDO";
  }

  // fallback: primeira letra maiúscula sem underscores
  return acao.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** Resumo curto em uma linha, para exibir ao lado do autor. */
export function friendlySummary(acao: string, detalhes: any): string {
  const det = detalhes ?? {};
  const rec = det.new ?? det.old ?? {};

  if (acao.includes("role_permissions") && rec.role) {
    const alvo = papelLabel(rec.role);
    const partes = [
      `papel ${alvo}`,
      rec.resource ? recursoLabel(rec.resource) : null,
      rec.action ? `(${acaoRecursoLabel(rec.action)})` : null,
      rec.allowed === false ? "— negado" : rec.allowed === true ? "— permitido" : null,
    ].filter(Boolean);
    return partes.join(" · ");
  }
  if (acao.includes("user_permission_overrides")) {
    const partes = [
      rec.resource ? recursoLabel(rec.resource) : null,
      rec.action ? `(${acaoRecursoLabel(rec.action)})` : null,
      rec.allowed === false ? "— negado" : rec.allowed === true ? "— permitido" : null,
    ].filter(Boolean);
    return partes.join(" · ");
  }
  if (acao.startsWith("rdo_acesso_")) {
    const partes = [
      rec.nivel ? `nível ${NIVEIS[rec.nivel] ?? rec.nivel}` : null,
      rec.sujeito_tipo === "grupo" ? "para grupo"
        : rec.sujeito_tipo === "user" ? "para usuário" : null,
    ].filter(Boolean);
    return partes.join(" · ");
  }
  return "";
}

export type FriendlyField = { label: string; value: string };

/** Lista de campos legíveis para o dialog de detalhes. */
export function friendlyDetails(acao: string, detalhes: any): FriendlyField[] {
  const det = detalhes ?? {};
  const rec = det.new ?? det.old ?? {};
  const old = det.old ?? {};
  const out: FriendlyField[] = [];

  const push = (label: string, value: unknown) => {
    if (value === undefined || value === null || value === "") return;
    out.push({ label, value: String(value) });
  };

  push("Operação", opLabel(det.op));

  if (acao.includes("role_permissions") || acao.includes("user_permission_overrides")) {
    if (rec.role) push("Papel", papelLabel(rec.role));
    if (rec.user_id) push("Usuário", rec.user_id);
    if (rec.resource) push("Recurso", recursoLabel(rec.resource));
    if (rec.action) push("Ação", acaoRecursoLabel(rec.action));
    if (rec.allowed !== undefined) push("Permitido", rec.allowed ? "Sim" : "Não");
    if (det.op === "UPDATE" && old.allowed !== undefined && old.allowed !== rec.allowed) {
      push("Antes estava", old.allowed ? "Permitido" : "Negado");
    }
  } else if (acao.startsWith("rdo_acesso_")) {
    if (rec.rdo_id) push("RDO", rec.rdo_id);
    if (rec.sujeito_tipo) push("Tipo de alvo", rec.sujeito_tipo === "grupo" ? "Grupo" : "Usuário");
    if (rec.sujeito_id) push("Alvo", rec.sujeito_id);
    if (rec.nivel) push("Nível", NIVEIS[rec.nivel] ?? rec.nivel);
  } else {
    // fallback: mostra pares chave/valor conhecidos
    for (const [k, v] of Object.entries(rec)) {
      if (["id", "empresa_id", "created_at", "updated_at"].includes(k)) continue;
      if (v === null || typeof v === "object") continue;
      push(k, v as any);
    }
  }
  return out;
}
