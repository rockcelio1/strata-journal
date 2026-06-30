import type { SkeletonEffectType, SkeletonLayoutType } from "./types";

export type ScreenRegistryEntry = {
  key: string;
  name: string;
  path?: string;
  layout: SkeletonLayoutType;
  defaultEffect: SkeletonEffectType;
};

export const screenRegistry: ScreenRegistryEntry[] = [
  { key: "dashboard", name: "Dashboard", path: "/dashboard", layout: "dashboard", defaultEffect: "none" },
  { key: "obras", name: "Obras", path: "/obras", layout: "card", defaultEffect: "none" },
  { key: "obraDetalhe", name: "Detalhes da Obra", path: "/obras/$obraId", layout: "form", defaultEffect: "none" },
  { key: "rdo", name: "RDO – Lista", path: "/rdo", layout: "table", defaultEffect: "none" },
  { key: "rdoNovo", name: "RDO – Novo / Edição", path: "/rdo/novo", layout: "form", defaultEffect: "none" },
  { key: "rdoDetalhe", name: "RDO – Detalhes", path: "/rdo/$rdoId", layout: "form", defaultEffect: "none" },
  { key: "galeria", name: "Galeria de Obra / Fotos", path: "/galeria", layout: "gallery", defaultEffect: "none" },
  { key: "cadastrosMaoDeObra", name: "Cadastros – Mão de Obra", path: "/cadastros/mao-de-obra", layout: "table", defaultEffect: "none" },
  { key: "cadastrosEquipamentos", name: "Cadastros – Equipamentos", path: "/cadastros/equipamentos", layout: "table", defaultEffect: "none" },
  { key: "cadastrosOcorrencias", name: "Cadastros – Ocorrências", path: "/cadastros/ocorrencias", layout: "table", defaultEffect: "none" },
  { key: "empresa", name: "Empresa", path: "/empresa", layout: "form", defaultEffect: "none" },
  { key: "relatorios", name: "Relatórios", path: "/relatorios", layout: "table", defaultEffect: "none" },
  { key: "configuracoes", name: "Configurações", path: "/configuracoes", layout: "default", defaultEffect: "none" },
  { key: "configuracoesUsuarios", name: "Config. – Usuários", path: "/configuracoes/usuarios", layout: "table", defaultEffect: "none" },
  { key: "configuracoesPermissoes", name: "Config. – Permissões", path: "/configuracoes/permissoes", layout: "table", defaultEffect: "none" },
  { key: "configuracoesGrupos", name: "Config. – Grupos", path: "/configuracoes/grupos", layout: "table", defaultEffect: "none" },
  { key: "configuracoesOnedrive", name: "Config. – OneDrive", path: "/configuracoes/onedrive", layout: "dashboard", defaultEffect: "none" },
  { key: "configuracoesAuditoria", name: "Config. – Auditoria", path: "/configuracoes/auditoria", layout: "table", defaultEffect: "none" },
];

export function findScreen(key: string): ScreenRegistryEntry | undefined {
  return screenRegistry.find((s) => s.key === key);
}
