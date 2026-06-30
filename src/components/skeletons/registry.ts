import type { SkeletonEffectType, SkeletonLayoutType } from "./types";

export type ScreenRegistryEntry = {
  key: string;
  name: string;
  path?: string;
  layout: SkeletonLayoutType;
  defaultEffect: SkeletonEffectType;
};

export const screenRegistry: ScreenRegistryEntry[] = [
  { key: "dashboard", name: "Dashboard", path: "/dashboard", layout: "dashboard", defaultEffect: "layered" },
  { key: "obras", name: "Obras", path: "/obras", layout: "card", defaultEffect: "pulse" },
  { key: "obraDetalhe", name: "Detalhes da Obra", path: "/obras/$obraId", layout: "form", defaultEffect: "shimmer" },
  { key: "rdo", name: "RDO – Lista", path: "/rdo", layout: "table", defaultEffect: "staggered" },
  { key: "rdoNovo", name: "RDO – Novo / Edição", path: "/rdo/novo", layout: "form", defaultEffect: "shimmer" },
  { key: "rdoDetalhe", name: "RDO – Detalhes", path: "/rdo/$rdoId", layout: "form", defaultEffect: "shimmer" },
  { key: "galeria", name: "Galeria de Obra / Fotos", path: "/galeria", layout: "gallery", defaultEffect: "typewriter" },
  { key: "cadastrosMaoDeObra", name: "Cadastros – Mão de Obra", path: "/cadastros/mao-de-obra", layout: "table", defaultEffect: "shimmer" },
  { key: "cadastrosEquipamentos", name: "Cadastros – Equipamentos", path: "/cadastros/equipamentos", layout: "table", defaultEffect: "shimmer" },
  { key: "cadastrosOcorrencias", name: "Cadastros – Ocorrências", path: "/cadastros/ocorrencias", layout: "table", defaultEffect: "shimmer" },
  { key: "empresa", name: "Empresa", path: "/empresa", layout: "form", defaultEffect: "pulse" },
  { key: "relatorios", name: "Relatórios", path: "/relatorios", layout: "table", defaultEffect: "outline" },
  { key: "configuracoes", name: "Configurações", path: "/configuracoes", layout: "default", defaultEffect: "pulse" },
  { key: "configuracoesUsuarios", name: "Config. – Usuários", path: "/configuracoes/usuarios", layout: "table", defaultEffect: "shimmer" },
  { key: "configuracoesPermissoes", name: "Config. – Permissões", path: "/configuracoes/permissoes", layout: "table", defaultEffect: "shimmer" },
  { key: "configuracoesGrupos", name: "Config. – Grupos", path: "/configuracoes/grupos", layout: "table", defaultEffect: "shimmer" },
  { key: "configuracoesOnedrive", name: "Config. – OneDrive", path: "/configuracoes/onedrive", layout: "dashboard", defaultEffect: "gradient" },
  { key: "configuracoesAuditoria", name: "Config. – Auditoria", path: "/configuracoes/auditoria", layout: "table", defaultEffect: "cascade" },
];

export function findScreen(key: string): ScreenRegistryEntry | undefined {
  return screenRegistry.find((s) => s.key === key);
}
