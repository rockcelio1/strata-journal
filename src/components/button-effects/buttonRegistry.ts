import type { ButtonEffectType } from "./buttonEffects";

export type ButtonRegistryEntry = {
  key: string;
  label: string;
  screenKey: string;
  screenName: string;
  selectorHint: string;
  defaultEffect: ButtonEffectType;
  /** Botões destrutivos/críticos: nunca aplicar efeitos exagerados por padrão. */
  critical?: boolean;
};

/**
 * Registro central dos botões do sistema. Cada entrada é opt-in:
 * só botões envolvidos com <ButtonEffectRenderer buttonKey="..."> recebem efeito.
 * Adicionar novos botões aqui é seguro — apenas habilita a configuração na tela.
 */
export const buttonRegistry: ButtonRegistryEntry[] = [
  // Dashboard
  { key: "dashboard_novo_rdo", label: "Novo RDO", screenKey: "dashboard", screenName: "Dashboard", selectorHint: "CTA principal de criar RDO", defaultEffect: "rocket" },
  { key: "dashboard_ver_rdos", label: "Ver RDOs", screenKey: "dashboard", screenName: "Dashboard", selectorHint: "Atalho para lista de RDOs", defaultEffect: "badgeArrow" },

  // RDO
  { key: "rdo_salvar_rascunho", label: "Salvar rascunho", screenKey: "rdoNovo", screenName: "RDO – Novo", selectorHint: "Botão de salvar rascunho", defaultEffect: "typewriter" },
  { key: "rdo_enviar_aprovacao", label: "Enviar para aprovação", screenKey: "rdoNovo", screenName: "RDO – Novo", selectorHint: "Botão principal de envio", defaultEffect: "rocket" },
  { key: "rdo_exportar_pdf", label: "Exportar PDF", screenKey: "rdo", screenName: "RDO – Lista", selectorHint: "Exportação de PDF", defaultEffect: "shine" },
  { key: "rdo_exportar_csv", label: "Exportar CSV", screenKey: "rdo", screenName: "RDO – Lista", selectorHint: "Exportação de CSV", defaultEffect: "shine" },
  { key: "rdo_aprovar", label: "Aprovar RDO", screenKey: "rdoDetalhe", screenName: "RDO – Detalhes", selectorHint: "Aprovação do RDO", defaultEffect: "spark" },
  { key: "rdo_reprovar", label: "Reprovar RDO", screenKey: "rdoDetalhe", screenName: "RDO – Detalhes", selectorHint: "Reprovação do RDO", defaultEffect: "none", critical: true },
  { key: "rdo_excluir", label: "Excluir RDO", screenKey: "rdoDetalhe", screenName: "RDO – Detalhes", selectorHint: "Exclusão de RDO", defaultEffect: "none", critical: true },

  // Galeria
  { key: "galeria_upload", label: "Enviar arquivo", screenKey: "galeria", screenName: "Galeria de Obra", selectorHint: "Upload de foto/arquivo", defaultEffect: "rocket" },

  // Obras
  { key: "obras_nova", label: "Nova obra", screenKey: "obras", screenName: "Obras", selectorHint: "Criar nova obra", defaultEffect: "circleExpand" },

  // Cadastros
  { key: "cadastros_novo", label: "Novo cadastro", screenKey: "cadastros", screenName: "Cadastros", selectorHint: "Criar registro", defaultEffect: "expand" },

  // Configurações
  { key: "config_salvar", label: "Salvar configurações", screenKey: "configuracoes", screenName: "Configurações", selectorHint: "Salvar configuração", defaultEffect: "typewriter" },

  // Genéricos
  { key: "global_voltar", label: "Voltar", screenKey: "global", screenName: "Global", selectorHint: "Botão voltar", defaultEffect: "none" },
  { key: "global_cancelar", label: "Cancelar", screenKey: "global", screenName: "Global", selectorHint: "Cancelar ação", defaultEffect: "none", critical: true },
  { key: "global_fechar", label: "Fechar", screenKey: "global", screenName: "Global", selectorHint: "Fechar modal", defaultEffect: "none" },
];

export function findButton(key: string): ButtonRegistryEntry | undefined {
  return buttonRegistry.find((b) => b.key === key);
}
