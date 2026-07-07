## Objetivo
Tornar toda a aplicação 100% responsiva (relógio → ultrawide), com tipografia fluida, alvos de toque ≥44px, sem scroll horizontal, e componentes complexos (tabelas, modais, header) resilientes.

## Escopo (em ordem de execução)

### 1. Fundação global (`src/styles.css`)
- Já existe `font-size: clamp(...)` no body — expandir para h1/h2/h3 (já parcial) e adicionar utilitários fluidos:
  - `--space-fluid-*` via `clamp()` para paddings/gaps consistentes.
  - Utilitário `.no-x-scroll` reforçando `overflow-x: hidden` em wrappers de rota.
- Garantir `min-h-dvh` (não `min-h-screen`) para telas cheias.
- Container padrão: `w-full max-w-[100rem] mx-auto px-[clamp(0.75rem,3vw,2rem)]`.
- Regra `@media (hover: none)` já existe — estender para desativar `:hover` transforms indevidos.

### 2. AppShell (`src/components/app-shell.tsx`)
- Header em grid `grid-cols-[auto_minmax(0,1fr)_auto]` com `min-w-0` no bloco central e `truncate` no título; badge "RDO em rascunho/finalizado" e indicadores movem-se para uma segunda linha `sm:` inline.
- Botão flutuante do rascunho: `max-w-[calc(100vw-1.5rem)]`, `bottom: env(safe-area-inset-bottom)`, alvos ≥44px (já garantido), texto com `truncate`.
- Bottom-tabbar mobile (se existir) com `padding-bottom: env(safe-area-inset-bottom)`.
- Sidebar: `Sheet` em `<md`, fixa em `md+`.

### 3. Páginas de listagem (Obras, RDOs, Cadastros, Galeria, Relatórios)
- Substituir tabelas por padrão dual:
  - `<md`: cards empilhados (`grid gap-3`).
  - `md+`: `<table>` dentro de `<div class="overflow-x-auto">` com `min-w-full`.
- Toolbars: `flex flex-wrap gap-2` com `min-w-0` nos filtros; busca ocupa `flex-1 min-w-[12rem]`.

### 4. RDO Novo / Detalhe
- Layout duas colunas em `lg+` (`grid-cols-[minmax(0,2fr)_minmax(0,1fr)]`), pilha única `<lg`.
- Fotos: grid `grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]`, cada foto em wrapper `aspect-square` + `object-cover`.
- Botões de ação (Salvar/Concluir/Assinar) em barra sticky no rodapé em mobile (`sticky bottom-0 bg-background/95 backdrop-blur`) para não caçar scroll.
- Assinaturas/Câmera: modal full-screen em mobile (`h-dvh w-screen sm:h-auto sm:w-auto sm:max-w-lg`).

### 5. Dashboard + gráficos 3D
- Cards em `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`; gráficos com `aspect-[16/10]` e `w-full`.
- `QuotaChart3D` embrulhado em container com `min-h-[16rem] max-h-[70dvh]`.

### 6. Modais / Dialogs
- Ajuste base em `src/components/ui/dialog.tsx` e `alert-dialog.tsx`:
  - `DialogContent`: `max-h-[90dvh] overflow-y-auto w-[calc(100vw-1.5rem)] sm:max-w-lg`.
  - Overlay já bloqueia scroll do fundo (Radix).

### 7. Ergonomia touch
- Auditar `size="icon"` (36px) e trocar para `h-11 w-11` quando for alvo primário.
- Adicionar `aria-label` onde faltar em botões de ícone.

## Detalhes técnicos
- Nada de lógica de negócio alterada — só apresentação/CSS/estrutura JSX.
- Sem novas dependências.
- `tsgo` roda automático; validarei build depois das edições.
- Verificação visual: Playwright em 3 viewports (360×640, 768×1024, 1440×900) capturando dashboard, RDO novo, RDO detalhe, listagem de obras.

## Fora de escopo
- Redesign visual (paleta/tipografia permanecem).
- Mudanças no schema Supabase ou server functions.
- Testes automatizados novos (Vitest/Playwright a11y) — pode virar follow-up.

## Entrega
Commits agrupados por seção acima; ao final, screenshots em 3 breakpoints anexos ao resumo.