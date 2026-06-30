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
  // ---------------- Dashboard ----------------
  { key: "dashboard_novo_rdo", label: "Novo RDO", screenKey: "dashboard", screenName: "Dashboard", selectorHint: "CTA principal de criar RDO", defaultEffect: "rocket" },
  { key: "dashboard_ver_rdos", label: "Ver RDOs", screenKey: "dashboard", screenName: "Dashboard", selectorHint: "Atalho para lista de RDOs", defaultEffect: "badgeArrow" },
  { key: "dashboard_drill_fechar", label: "Fechar drill", screenKey: "dashboard", screenName: "Dashboard", selectorHint: "Fecha o painel drill-down", defaultEffect: "none" },
  { key: "dashboard_abrir_relatorio", label: "Abrir relatório completo", screenKey: "dashboard", screenName: "Dashboard", selectorHint: "Navega para o relatório completo", defaultEffect: "badgeArrow" },

  // ---------------- RDO ----------------
  { key: "rdo_salvar_rascunho", label: "Salvar rascunho", screenKey: "rdoNovo", screenName: "RDO – Novo", selectorHint: "Botão de salvar rascunho", defaultEffect: "typewriter" },
  { key: "rdo_enviar_aprovacao", label: "Concluir / Enviar RDO", screenKey: "rdoNovo", screenName: "RDO – Novo", selectorHint: "Botão principal de envio", defaultEffect: "rocket" },
  { key: "rdo_proximo_passo", label: "Próximo passo", screenKey: "rdoNovo", screenName: "RDO – Novo", selectorHint: "Avança o wizard", defaultEffect: "badgeArrow" },
  { key: "rdo_passo_anterior", label: "Passo anterior", screenKey: "rdoNovo", screenName: "RDO – Novo", selectorHint: "Volta no wizard", defaultEffect: "none" },
  { key: "rdo_importar_clima", label: "Importar clima", screenKey: "rdoNovo", screenName: "RDO – Novo", selectorHint: "Importa clima da obra/CEP", defaultEffect: "shine" },
  { key: "rdo_detectar_cep", label: "Detectar CEP", screenKey: "rdoNovo", screenName: "RDO – Novo", selectorHint: "Detecta o CEP via geolocalização", defaultEffect: "spark" },
  { key: "rdo_abrir_camera", label: "Abrir câmera", screenKey: "rdoNovo", screenName: "RDO – Novo", selectorHint: "Captura de foto", defaultEffect: "expand" },
  { key: "rdo_exportar_pdf", label: "Exportar PDF", screenKey: "rdo", screenName: "RDO – Lista", selectorHint: "Exportação de PDF", defaultEffect: "shine" },
  { key: "rdo_exportar_csv", label: "Exportar CSV", screenKey: "rdo", screenName: "RDO – Lista", selectorHint: "Exportação de CSV", defaultEffect: "shine" },
  { key: "rdo_aprovar", label: "Aprovar RDO", screenKey: "rdoDetalhe", screenName: "RDO – Detalhes", selectorHint: "Aprovação do RDO", defaultEffect: "spark" },
  { key: "rdo_reprovar", label: "Reprovar RDO", screenKey: "rdoDetalhe", screenName: "RDO – Detalhes", selectorHint: "Reprovação do RDO", defaultEffect: "none", critical: true },
  { key: "rdo_excluir", label: "Excluir RDO", screenKey: "rdoDetalhe", screenName: "RDO – Detalhes", selectorHint: "Exclusão de RDO", defaultEffect: "none", critical: true },
  { key: "rdo_desabilitar", label: "Desabilitar RDO", screenKey: "rdoDetalhe", screenName: "RDO – Detalhes", selectorHint: "Desabilitar RDO (admin)", defaultEffect: "none", critical: true },
  { key: "rdo_editar_clima", label: "Editar previsão", screenKey: "rdoDetalhe", screenName: "RDO – Detalhes", selectorHint: "Editar previsão do rascunho", defaultEffect: "typewriter" },
  { key: "rdo_assinar", label: "Assinar RDO", screenKey: "rdoDetalhe", screenName: "RDO – Detalhes", selectorHint: "Coleta de assinatura", defaultEffect: "flip" },

  // ---------------- Galeria ----------------
  { key: "galeria_upload", label: "Enviar arquivo", screenKey: "galeria", screenName: "Galeria de Obra", selectorHint: "Upload de foto/arquivo", defaultEffect: "rocket" },
  { key: "galeria_baixar", label: "Baixar arquivo", screenKey: "galeria", screenName: "Galeria de Obra", selectorHint: "Download de mídia", defaultEffect: "shine" },

  // ---------------- Obras ----------------
  { key: "obras_nova", label: "Nova obra", screenKey: "obras", screenName: "Obras", selectorHint: "Criar nova obra", defaultEffect: "circleExpand" },
  { key: "obras_editar", label: "Editar obra", screenKey: "obraDetalhe", screenName: "Obra – Detalhes", selectorHint: "Editar dados da obra", defaultEffect: "expand" },
  { key: "obras_excluir", label: "Excluir obra", screenKey: "obraDetalhe", screenName: "Obra – Detalhes", selectorHint: "Excluir obra", defaultEffect: "none", critical: true },

  // ---------------- Cadastros ----------------
  { key: "cadastros_novo", label: "Novo cadastro", screenKey: "cadastros", screenName: "Cadastros", selectorHint: "Criar registro", defaultEffect: "expand" },
  { key: "cadastros_editar", label: "Editar cadastro", screenKey: "cadastros", screenName: "Cadastros", selectorHint: "Editar registro", defaultEffect: "iconSwap" },
  { key: "cadastros_remover", label: "Remover cadastro", screenKey: "cadastros", screenName: "Cadastros", selectorHint: "Remover registro", defaultEffect: "none", critical: true },

  // ---------------- Empresa ----------------
  { key: "empresa_salvar", label: "Salvar empresa", screenKey: "empresa", screenName: "Empresa", selectorHint: "Salvar dados da empresa", defaultEffect: "typewriter" },
  { key: "empresa_upload_logo", label: "Upload logo", screenKey: "empresa", screenName: "Empresa", selectorHint: "Envio do logo", defaultEffect: "rocket" },

  // ---------------- Usuários ----------------
  { key: "usuarios_convidar", label: "Convidar usuário", screenKey: "configuracoesUsuarios", screenName: "Config. – Usuários", selectorHint: "Convidar novo usuário", defaultEffect: "rocket" },
  { key: "usuarios_aprovar", label: "Aprovar usuário", screenKey: "configuracoesUsuarios", screenName: "Config. – Usuários", selectorHint: "Aprovar acesso", defaultEffect: "spark" },
  { key: "usuarios_remover", label: "Remover usuário", screenKey: "configuracoesUsuarios", screenName: "Config. – Usuários", selectorHint: "Remover usuário", defaultEffect: "none", critical: true },

  // ---------------- Grupos ----------------
  { key: "grupos_criar", label: "Criar grupo", screenKey: "configuracoesGrupos", screenName: "Config. – Grupos", selectorHint: "Criar grupo/equipe", defaultEffect: "circleExpand" },
  { key: "grupos_adicionar_membro", label: "Adicionar membro", screenKey: "configuracoesGrupos", screenName: "Config. – Grupos", selectorHint: "Adicionar membro ao grupo", defaultEffect: "expand" },

  // ---------------- OneDrive ----------------
  { key: "onedrive_abrir", label: "Abrir OneDrive", screenKey: "configuracoesOnedrive", screenName: "Config. – OneDrive", selectorHint: "Abrir repositório", defaultEffect: "badgeArrow" },
  { key: "onedrive_validar", label: "Validar conexão", screenKey: "configuracoesOnedrive", screenName: "Config. – OneDrive", selectorHint: "Validar conta/pasta", defaultEffect: "spark" },

  // ---------------- Configurações ----------------
  { key: "config_salvar", label: "Salvar configurações", screenKey: "configuracoes", screenName: "Configurações", selectorHint: "Salvar configuração", defaultEffect: "typewriter" },

  // ---------------- Relatórios ----------------
  { key: "relatorios_gerar", label: "Gerar relatório", screenKey: "relatorios", screenName: "Relatórios", selectorHint: "Gera o relatório", defaultEffect: "spark" },
  { key: "relatorios_exportar", label: "Exportar relatório", screenKey: "relatorios", screenName: "Relatórios", selectorHint: "Exporta o relatório", defaultEffect: "shine" },

  // ---------------- Auth ----------------
  { key: "auth_entrar", label: "Entrar", screenKey: "auth", screenName: "Login", selectorHint: "Botão de login", defaultEffect: "expand" },
  { key: "auth_criar_conta", label: "Criar conta", screenKey: "auth", screenName: "Login", selectorHint: "Criar conta", defaultEffect: "rocket" },
  { key: "auth_google", label: "Entrar com Google", screenKey: "auth", screenName: "Login", selectorHint: "Login social", defaultEffect: "flip" },

  // ---------------- Globais ----------------
  { key: "global_voltar", label: "Voltar", screenKey: "global", screenName: "Global", selectorHint: "Botão voltar", defaultEffect: "none" },
  { key: "global_cancelar", label: "Cancelar", screenKey: "global", screenName: "Global", selectorHint: "Cancelar ação", defaultEffect: "none", critical: true },
  { key: "global_fechar", label: "Fechar", screenKey: "global", screenName: "Global", selectorHint: "Fechar modal", defaultEffect: "none" },
  { key: "global_salvar", label: "Salvar (genérico)", screenKey: "global", screenName: "Global", selectorHint: "Botão salvar reutilizável", defaultEffect: "shine" },
];

export function findButton(key: string): ButtonRegistryEntry | undefined {
  return buttonRegistry.find((b) => b.key === key);
}
