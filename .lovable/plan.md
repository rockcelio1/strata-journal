## Escopo

Cinco frentes em um único lote, com foco em desbloquear o usuário antes de expandir conteúdo:

### 1. Corrigir tela "Ajuda" (Algo deu errado)

- Reproduzir com Playwright para capturar o erro real do `errorComponent`.
- Suspeitas mais prováveis:
  - `listChangelog` faz `select("*, help_articles(slug, title)")` mas `system_changelog` pode não ter FK explícita para `help_articles` → PostgREST 400. Trocar para dois `select` ou embed nomeado.
  - `Route.useSearch()` com `search: {} as any` na navegação pode quebrar o zod schema. Padronizar `navigate({ search: (prev) => ({ ...prev, q: undefined, tutorial: undefined }) })`.
- Adicionar `errorComponent` e `notFoundComponent` locais em todas as rotas `/ajuda/*` para mostrar mensagem acionável em vez do fallback global.

### 2. Galeria da Obra sem imagens

- Verificar por que `listGaleria` retorna `url = null` no OneDrive (o `onedrive_download_url` requer bearer e não abre em `<img>` direto).
- Reaproveitar o proxy existente `/api/public/onedrive-file/$itemId` (usado no RDO): trocar o cálculo de `url` para `onedrive_item_id ? `/api/public/onedrive-file/${itemId}?token=...` : signedUrl`.
- Reusar `SmartImage` já criado (placeholder + retry) para as miniaturas da galeria.

### 3. Páginas dedicadas de FAQ e Glossário

- Criar rotas:
  - `src/routes/_authenticated/ajuda.faq.tsx` — lista artigos com `module_key = 'faq'` agrupados por categoria, com busca local.
  - `src/routes/_authenticated/ajuda.glossario.tsx` — lista artigos com `module_key = 'glossario'` ordenados por título, com índice A-Z.
- Adicionar cards de entrada na home `/ajuda` para FAQ e Glossário.
- Migration de dados: seed inicial de ~15 perguntas frequentes e ~20 termos do glossário (todos como `help_articles` com `module_key` correspondente e categoria própria "FAQ" / "Glossário"). Sem alteração de schema.
- Garantir que `searchHelp` já cobre esses artigos (já cobre — mesmo `help_articles`), apenas exibir o `module_key` como badge nos resultados.

### 4. Tutorial "Novo RDO" abrindo na tela certa

- Alterar `InteractiveTutorial` para aceitar `route_path` do tutorial e, se o usuário não estiver na rota, navegar para lá antes do passo 1.
- Adicionar coluna opcional `route_path text` em `help_tutorials` (migration).
- Atualizar seed do tutorial "novo-rdo" com `route_path = '/rdo/novo'`.
- No botão "Começar tutorial" (home /ajuda), navegar para `route_path` e adicionar `?tutorial=<slug>` para abrir automaticamente.
- Marcar elementos-chave da tela `/rdo/novo` com `data-help="rdo-novo-<passo>"` correspondentes ao `selector` de cada `help_tutorial_steps`.

### 5. `help_search_logs` — qualidade e RLS

- Migration:
  - Adicionar coluna `results_count int NOT NULL DEFAULT 0` (já existe? verificar) e `clicked_article_id`.
  - Ajustar policy INSERT para exigir `empresa_id = private.get_user_empresa(auth.uid()) AND user_id = auth.uid()` (hoje só valida user_id).
  - Criar índice `(empresa_id, created_at desc)` para relatórios.
- `searchHelp`: sempre preencher `empresa_id` a partir do profile do usuário; nunca `null`.
- Nova server fn `logSearchClick({ search_log_id, article_id })` para registrar cliques (chamada ao abrir artigo a partir dos resultados).
- Ranking simples no backend: priorizar match em `title` > `tags` > `summary` > `content` via 3 queries e merge sem duplicar.

### Ordem de execução

1. Migration (help_tutorials.route_path, help_search_logs policy + índice, seed FAQ/Glossário/tutorial).
2. Backend `help.functions.ts` (correção do embed do changelog, ranking, `logSearchClick`).
3. Rotas `ajuda.faq.tsx`, `ajuda.glossario.tsx`, `errorComponent` em todas as `ajuda.*`.
4. `InteractiveTutorial` + botão "Começar tutorial" + `data-help` no formulário RDO.
5. `listGaleria` usando proxy OneDrive + `SmartImage`.
6. Verificação Playwright: `/ajuda` carrega, `/ajuda/faq`, `/ajuda/glossario`, tutorial abre `/rdo/novo` no passo 1, galeria mostra thumbs.

## Detalhes técnicos

**Arquivos criados:**
- `supabase/migrations/<ts>_help_faq_glossario_tutorial.sql`
- `src/routes/_authenticated/ajuda.faq.tsx`
- `src/routes/_authenticated/ajuda.glossario.tsx`

**Arquivos editados:**
- `src/lib/help.functions.ts` — fix changelog embed, ranking, `logSearchClick`, empresa_id garantido.
- `src/components/help/InteractiveTutorial.tsx` — navegação para `route_path` antes do passo 1.
- `src/routes/_authenticated/ajuda.index.tsx` — cards FAQ/Glossário, botão "Começar tutorial" navega para rota + `?tutorial=`.
- `src/routes/_authenticated/rdo.novo.tsx` — atributos `data-help="rdo-novo-*"`.
- `src/routes/_authenticated/galeria.tsx` — usar `SmartImage`.
- `src/lib/rdo.functions.ts` (`listGaleria`) — proxy OneDrive.

**Sem quebrar:**
- Não altero `_authenticated/route.tsx`, `types.ts`, `client.ts`, `auth-middleware.ts`.
- Sem novas dependências npm.