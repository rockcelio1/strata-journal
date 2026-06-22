
# Diário de Obra — Plano de Implementação

SaaS corporativo para gestão de canteiros de obras, multi-tenant por empresa, com RLS no Lovable Cloud (Supabase gerenciado). Stack: TanStack Start + React 19 + Tailwind v4 + shadcn + Lovable Cloud.

## 1. Arquitetura e navegação

Layout raiz com **menu superior azul** (logo, nome da empresa, navegação principal, perfil/sair) e **menu lateral** dedicado à seção de Cadastros. Rotas:

- `/auth` — login / signup (público)
- `/_authenticated/` — gate gerenciado (redireciona não-logados)
  - `/dashboard` — Bento Grid de KPIs
  - `/obras` — lista/cards de obras
  - `/obras/$obraId` — detalhe da obra (abas: visão geral, equipe, equipamentos, RDOs)
  - `/rdo` — lista de RDOs com filtros de status
  - `/rdo/novo` — criação
  - `/rdo/$rdoId` — visualização + fluxo de aprovação
  - `/cadastros` (layout com sidebar)
    - `/cadastros/mao-de-obra`
    - `/cadastros/equipamentos`
    - `/cadastros/ocorrencias` (tipos/catálogo)
  - `/empresa` — dados da empresa, membros, convites

## 2. Modelo de dados (Lovable Cloud)

Tabelas principais (todas com RLS isolando por `empresa_id`):

- `empresas` — id, nome, cnpj, created_at
- `profiles` — id (=auth.uid), empresa_id, nome, email, cargo
- `user_roles` — user_id, empresa_id, role (`admin` | `engenheiro` | `mestre` | `visualizador`) — tabela separada conforme regra de segurança
- `convites` — empresa_id, email, role, token, expires_at
- `obras` — empresa_id, nome, endereço, cliente, responsável, datas previstas, status (planejamento/em andamento/pausada/concluída), %_avanço
- `mao_de_obra` — empresa_id, nome, função, empresa_terceira, contato, ativo
- `equipamentos` — empresa_id, nome, tipo, identificação, status (disponível/em uso/manutenção)
- `tipos_ocorrencia` — empresa_id, nome, severidade
- `rdos` — empresa_id, obra_id, data, autor_id, clima_manha/tarde/noite, observações, status (`rascunho` | `enviado` | `aprovado` | `reprovado`), aprovado_por, aprovado_em
- `rdo_mao_de_obra` — rdo_id, mao_de_obra_id, horas, atividade
- `rdo_equipamentos` — rdo_id, equipamento_id, horas_uso, status
- `rdo_ocorrencias` — rdo_id, tipo_ocorrencia_id, descrição, foto_url
- `rdo_atividades` — rdo_id, descrição, %_executado

**Função SECURITY DEFINER** `has_role(_user_id, _empresa_id, _role)` para policies sem recursão. **Trigger** no signup: cria `empresas` + `profiles` + atribui role `admin` (primeiro signup = nova empresa).

Todas as tabelas em `public` recebem `GRANT` para `authenticated` + `service_role` na mesma migration.

## 3. Autenticação e multi-tenant

- Supabase Auth: **email/senha + Google** (via broker `lovable.auth.signInWithOAuth`)
- Signup → trigger cria empresa nova, usuário vira `admin`
- Página `/empresa` permite admin convidar membros por email (gera convite; ao aceitar, vincula à empresa existente)
- `/reset-password` para recuperação
- Layout `_authenticated` gerenciado pela integração (não autoral)

## 4. Módulos

**Dashboard (Bento Grid)**: cards de tamanhos variados — obras ativas, RDOs pendentes de aprovação, ocorrências da semana, gráfico de produtividade, últimos RDOs, % avanço por obra.

**Obras**: alternância cards/lista, filtro por status, busca, criar/editar via dialog, página de detalhe com abas.

**RDO**: formulário em etapas (data+obra+clima → atividades → mão de obra → equipamentos → ocorrências → revisão). Status visual com badges. Fluxo: rascunho → enviado (autor) → aprovado/reprovado (admin/engenheiro). Histórico de aprovação.

**Cadastros**: CRUD simples em tabelas com busca, filtros, soft-delete (ativo/inativo). Sidebar fixa esquerda dentro de `/cadastros`.

## 5. Design

Minimalista premium, paleta monocromática quente:
- Background `oklch(0.985 0.005 80)` (off-white quente)
- Foreground `oklch(0.22 0.01 60)` (carvão)
- Accent azul para menu superior `oklch(0.45 0.15 250)`
- Tipografia: **Inter Tight** (UI sans geométrica) + **Fraunces** (títulos serifados), carregados via `<link>` no `__root.tsx`
- Tokens em `src/styles.css` `@theme inline`, sem classes hardcoded
- shadcn para componentes base (Card, Dialog, Table, Tabs, Badge, Form, Sidebar)

## 6. Implementação técnica

- Server functions em `src/lib/*.functions.ts` com `requireSupabaseAuth`
- TanStack Query: `ensureQueryData` nos loaders + `useSuspenseQuery` nos componentes
- Mutations via `useMutation` + invalidação de queryKeys
- Toda escrita scoped por `empresa_id` derivado do `userId` no servidor (nunca do cliente)
- Zod para validação de inputs

## 7. Ordem de execução

1. Ativar Lovable Cloud + migration completa (schema + RLS + GRANTs + trigger signup)
2. Design tokens + layout raiz (header azul + estrutura)
3. Auth (login/signup/reset + Google)
4. Cadastros (Mão de obra, Equipamentos, Tipos de ocorrência) — base para o RDO
5. Obras (CRUD + detalhe)
6. RDO (formulário + fluxo de aprovação)
7. Dashboard (Bento Grid consumindo dados reais)
8. Página de Empresa (membros + convites)

## Observações

- Banco começa vazio (sem seed) conforme pedido.
- Próximas iterações: upload de fotos para ocorrências (Lovable Cloud Storage), exportação de RDO em PDF, notificações de aprovação por email.
- Quando quiser anexar as telas de referência, posso ajustar o layout sem refazer dados/lógica.
