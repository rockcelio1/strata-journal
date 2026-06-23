## Objetivo

Permitir que Master/Admin (e Gestor de Acessos) conceda acesso a RDOs também para **grupos**, não só usuários individuais. Dois tipos de grupos: globais (da empresa) e equipes vinculadas a uma obra. Três níveis: **Ver / Editar / Aprovar**.

## Banco de dados (1 migração)

Novas tabelas em `public`:

- `grupos` — id, empresa_id, nome, descricao, tipo `'global' | 'equipe_obra'`, obra_id (nullable, obrigatório quando `tipo='equipe_obra'`), created_at/updated_at.
- `grupo_membros` — id, grupo_id, user_id, created_at; unique(grupo_id, user_id).
- `rdo_acessos` — id, rdo_id, empresa_id, sujeito_tipo `'user' | 'grupo'`, sujeito_id (uuid do user OU do grupo), nivel `'ver' | 'editar' | 'aprovar'`, created_at, created_by. Unique(rdo_id, sujeito_tipo, sujeito_id).

Função `private.can_access_rdo(_user, _rdo, _nivel)` (SECURITY DEFINER) que retorna true se:
- usuário é admin/master da empresa do RDO, OU
- usuário é o autor do RDO, OU
- existe `rdo_acessos` com `sujeito_tipo='user'` e `sujeito_id=_user` e `nivel >= _nivel`, OU
- existe `rdo_acessos` com `sujeito_tipo='grupo'` e o grupo contém o usuário e `nivel >= _nivel`.

Wrapper `public.can_access_rdo(...)` SECURITY INVOKER que chama o privado.

RLS:
- `grupos`, `grupo_membros`: SELECT para mesma empresa; INSERT/UPDATE/DELETE só para quem tem `permissoes.editar` (admin/master/gestor_acessos).
- `rdo_acessos`: SELECT para quem tem `rdos.ver` na empresa; INSERT/DELETE só para admin/master ou `permissoes.editar`.
- Atualiza policies de `rdos` para considerar `can_access_rdo` ao lado das regras atuais.

GRANTS padrão para `authenticated` e `service_role`.

Trigger de auditoria em `rdo_acessos` registrando concessão/remoção em `audit_logs_usuarios`.

## Server functions (`src/lib/grupos.functions.ts`)

- `listarGrupos({ tipo?, obra_id? })`
- `criarGrupo({ nome, tipo, obra_id?, descricao? })`
- `excluirGrupo({ id })`
- `adicionarMembro({ grupo_id, user_id })` / `removerMembro({ grupo_id, user_id })`
- `listarAcessosRdo({ rdo_id })` — retorna users + grupos com nível
- `concederAcessoRdo({ rdo_id, sujeito_tipo, sujeito_id, nivel })`
- `revogarAcessoRdo({ id })`

Todas exigem `permissoes.editar` para mutações; leitura exige `rdos.ver` + mesma empresa.

## UI

1. Nova página `/configuracoes/grupos` (Master/Admin/Gestor de Acessos):
   - Aba "Grupos globais" e aba "Equipes por obra".
   - CRUD de grupos, gerenciamento de membros.

2. Na tela de detalhe do RDO (`rdo.$rdoId.tsx`), novo card **"Acesso ao RDO"** (visível para Master/Admin):
   - Lista usuários e grupos com nível atual.
   - Seletor para adicionar acesso: tipo (usuário/grupo) + alvo + nível (Ver/Editar/Aprovar).
   - Botão de revogar por linha.

3. Sidebar de Configurações ganha item "Grupos & equipes".

## Arquivos

**Novos:**
- `supabase/migrations/<ts>_rdo_grupos_acesso.sql`
- `src/lib/grupos.functions.ts`
- `src/routes/_authenticated/configuracoes.grupos.tsx`
- `src/components/rdo/RdoAcessoCard.tsx`

**Editados:**
- `src/routes/_authenticated/rdo.$rdoId.tsx` (montar `RdoAcessoCard`)
- `src/routes/_authenticated/configuracoes.tsx` (novo item de menu)
- `src/integrations/supabase/types.ts` (regenerado)

## Observações

- O nível "aprovar" implica também "editar" e "ver"; "editar" implica "ver". A função `can_access_rdo` compara via ordem `ver < editar < aprovar`.
- O autor do RDO sempre tem nível "editar" implícito (não precisa entrada em `rdo_acessos`).
- Master/Admin têm acesso total — não dependem de `rdo_acessos`.
