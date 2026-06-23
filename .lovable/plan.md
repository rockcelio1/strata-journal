## Objetivo

Permitir editar a permissão detalhada (matriz recurso × ação) do papel de cada usuário e aplicar overrides por usuário. Apenas admin/master e o novo papel "Gestor de Acessos" podem editar. A aplicação ocorre tanto no banco (RLS) quanto na UI (esconder botões/menus).

## Modelo de permissões

Recursos: `obras`, `rdos`, `usuarios`, `relatorios`, `equipamentos`, `mao_de_obra`, `ocorrencias`, `convites`, `empresa`, `permissoes`.
Ações: `ver`, `criar`, `editar`, `excluir`, `aprovar`, `exportar`.

Chave de permissão = `{recurso}.{acao}` (ex.: `rdos.aprovar`, `usuarios.editar`).

## Banco (migration)

1. Adicionar valor `gestor_acessos` ao enum `app_role`.
2. Criar enums:
   - `app_resource` (obras, rdos, usuarios, relatorios, equipamentos, mao_de_obra, ocorrencias, convites, empresa, permissoes)
   - `app_action` (ver, criar, editar, excluir, aprovar, exportar)
3. Criar tabela `role_permissions(empresa_id, role, resource, action, allowed)` — default por papel, escopo por empresa, com `unique(empresa_id, role, resource, action)`.
4. Criar tabela `user_permission_overrides(empresa_id, user_id, resource, action, allowed)` — sobrescreve o papel para um usuário, `unique(empresa_id, user_id, resource, action)`.
5. Seed dos defaults por papel (admin: tudo; engenheiro: ver/criar/editar/exportar em obras/rdos/relatorios; encarregado: ver/criar em rdos; visualizador: só `ver` + `exportar` em relatorios; gestor_acessos: tudo de `usuarios` + `permissoes`).
6. Função `private.has_permission(_user_id uuid, _resource app_resource, _action app_action)` SECURITY DEFINER que:
   - lê override por usuário se existir; senão lê `role_permissions` do papel do usuário na empresa ativa.
7. Wrapper público `public.has_permission(...)` SECURITY INVOKER chamando a função privada.
8. GRANTs e RLS:
   - `role_permissions`, `user_permission_overrides`: SELECT para `authenticated` na própria empresa; INSERT/UPDATE/DELETE somente para quem tem `permissoes.editar` (admin ou gestor_acessos).
   - Atualizar policies das tabelas existentes para usar `has_permission` em vez de checagens hard-coded onde fizer sentido (mantendo compatibilidade com `has_role`/`has_admin_access`).
9. Trigger de auditoria em `role_permissions` e `user_permission_overrides` → `audit_logs_usuarios` (quem alterou, antes/depois).

## Server functions (`src/lib/permissoes.functions.ts`)

- `listarMatrizPermissoes()` → retorna defaults por papel + overrides por usuário da empresa.
- `atualizarPermissaoPapel({ role, resource, action, allowed })` — exige `permissoes.editar`; upsert em `role_permissions`.
- `atualizarOverrideUsuario({ user_id, resource, action, allowed | null })` — `null` remove o override.
- `resetarOverridesUsuario({ user_id })`.
- `minhasPermissoes()` — chamada pelo cliente para hidratar o contexto (lista de chaves permitidas).

Todas com `requireSupabaseAuth` + checagem via `has_permission`.

## Cliente

1. `src/hooks/usePermissoes.ts`: `useQuery(['minhas-permissoes'])` que chama `minhasPermissoes`, expõe `can(resource, action)` e `canAny([...])`. Cache de 5 min, invalidado em SIGNED_IN/USER_UPDATED.
2. `src/components/Can.tsx`: `<Can resource="rdos" action="aprovar">…</Can>` para esconder elementos.
3. Aplicar `can(...)` para esconder botões/menus em:
   - sidebar/menu principal (esconde itens de Usuários, Relatórios, Permissões conforme `ver`)
   - botões "Novo", "Editar", "Excluir", "Aprovar", "Exportar" em obras, RDOs, equipamentos, mão de obra, ocorrências, relatórios.
4. Em `_authenticated`: pré-carregar `minhasPermissoes` no contexto do router para `beforeLoad` de subrotas restritas (ex.: rota `/configuracoes/permissoes` exige `permissoes.editar`).

## Tela `/configuracoes/permissoes`

- **Aba 1 — Por papel**: matriz papel × recurso × ação com checkboxes. Linhas = recursos, colunas agrupadas por ação, abas/seletor por papel. Toggle persiste com debounce; mostra "Salvo" inline.
- **Aba 2 — Por usuário (overrides)**: busca usuário → mostra papel atual + matriz com 3 estados (herdar / permitir / negar). Botão "Resetar para o papel".
- **Aba 3 — Auditoria**: lista últimas alterações de permissões.
- Acesso restrito a `permissoes.editar` (admin ou gestor_acessos).

## Página de usuários

- Novo papel `gestor_acessos` aparece no `Select` de papel.
- Tooltip explicando o que cada papel pode fazer.
- Botão "Permissões avançadas" por usuário → abre a aba 2 com o usuário pré-selecionado.

## Detalhes técnicos

- Enum nuevo requer `ALTER TYPE app_role ADD VALUE 'gestor_acessos'` em migration separada do uso (Postgres exige commit antes de uso). Solução: a primeira migration só adiciona o valor; a segunda cria as tabelas/funções e usa o valor.
- Seed de defaults: feito via `INSERT … SELECT` cruzando empresas existentes × papéis × (resource, action), com `ON CONFLICT DO NOTHING`. Trigger `after insert on empresas` semeia defaults para novas empresas.
- `has_permission` é `STABLE` e usa índice em `(empresa_id, user_id, resource, action)` para override e `(empresa_id, role, resource, action)` para defaults.
- UI nunca depende só do `can(...)` — toda ação chama server fn que revalida via `has_permission`.

## Arquivos

Novos:
- `supabase/migrations/<ts>_app_role_gestor_acessos.sql`
- `supabase/migrations/<ts>_permissoes_detalhadas.sql`
- `src/lib/permissoes.functions.ts`
- `src/hooks/usePermissoes.ts`
- `src/components/Can.tsx`
- `src/routes/_authenticated/configuracoes.permissoes.tsx`

Editados:
- `src/integrations/supabase/types.ts` (regen pós-migration)
- `src/routes/_authenticated/configuracoes.usuarios.tsx` (botão "Permissões avançadas", novo papel)
- `src/components/layout/*` (sidebar usa `can(...)`)
- Rotas que mostram botões de ação (RDO, obras, equipamentos, etc.) — envolver em `<Can>`.
