# Plano — Diário de Obra: melhoria incremental

Escopo enorme. Divido em **6 fases entregáveis**. Cada fase é auto-contida, migra sem quebrar, e recebe a tarja `<NewBadge since="..." />` já criada. Confirme por qual fase começar (ou "todas em ordem").

## Fase 1 — Fundação de banco (migrations seguras)
Migration única com `CREATE TABLE IF NOT EXISTS` + GRANTs + RLS para as novas tabelas, mantendo a nomenclatura PT-BR já usada no projeto (aliases dos nomes EN do prompt):

- `templates_tarefas` (task_templates)
- `template_tarefa_itens` (task_template_items)
- `obra_listas_tarefas` (work_task_lists)
- `obra_tarefa_itens` (work_task_items)
- `rdo_tarefa_avancos` (report_task_updates)
- `import_jobs_tarefas` (task_import_jobs)
- `obra_funcoes_permitidas` (work_allowed_labor_roles) → FK `mao_de_obra`
- `obra_equipamentos_permitidos` (work_allowed_equipment) → FK `equipamentos`
- `obra_anexos` (work_attachments)

Ajustes em tabelas existentes (`ADD COLUMN IF NOT EXISTS`):
- `rdo_anexos`: `tarefa_item_id`, `rdo_tarefa_avanco_id`, `ocorrencia_id`, `legenda` (já existe), `contexto`
- `rdos`: `submitted_at/by`, `revision_requested_at/by/reason`, `final_pdf_url` (aproveita `approved_at/by` já existente via audit)
- `obras`: `numero_contrato`, `responsavel_tecnico`, `grupo_obra`, `foto_principal_path`

Novos enums:
- `tarefa_controle` (`porcentagem`,`produtividade`,`misto`)
- `tarefa_status` (`nao_iniciada`,`em_andamento`,`concluida`,`paralisada`,`cancelada`)

RLS: todas por `empresa_id = private.get_user_empresa(auth.uid())`; mutação restrita via `has_permission`. Autor/planejador/admin conforme perfis.

## Fase 2 — Cadastros globais (Mão de obra + Equipamentos + Ocorrências)
- Seed idempotente das disciplinas/funções e equipamentos listados (só insere se `NOT EXISTS`).
- Adiciona coluna `disciplina` em `mao_de_obra` e `equipamentos`.
- Tela `cadastros.mao-de-obra` ganha abas: Disciplinas / Funções globais / Personalizados.
- Tela `cadastros.equipamentos` ganha campos: tipo, disciplina, obrigatório, controle horas, controle qtd.
- Seed dos tipos de ocorrência obrigatórios em `tipos_ocorrencia`.

## Fase 3 — Módulo Templates de Tarefas
Rotas novas sob `_authenticated/`:
- `cadastros.templates-tarefas.tsx` (lista + CRUD)
- `cadastros.templates-tarefas.$id.tsx` (editor hierárquico)
- `cadastros.templates-tarefas.importar.tsx` (upload xlsx → parse → preview → mapear colunas → commit)

Server fns em `src/lib/templates-tarefas.functions.ts`:
- `listTemplates`, `criarTemplate`, `duplicarTemplate`, `excluirTemplate`
- `listItens`, `salvarItens` (batch)
- `parseExcelTemplate` (client-side, usa `xlsx`), `commitImport` (server)
- Download dos modelos `.xlsx` (porcentagem/produtividade) via arquivo estático.

Dependências novas: `xlsx`, `file-saver` (zod/react-hook-form/date-fns/lucide/sonner/recharts já existem).

## Fase 4 — Vinculação à obra
Em `obras.$obraId.tsx` adicionar abas:
- **Lista de tarefas** — importar template, criar manual, duplicar, editar, excluir (bloqueia se há RDO vinculado). Indicadores: total/não iniciadas/em andamento/concluídas/% avanço.
- **Equipes permitidas** — multi-select de `mao_de_obra`.
- **Equipamentos permitidos** — multi-select de `equipamentos`.
- **Anexos/Projetos** — upload PDFs para bucket `obra-fotos` (subpasta `anexos/`).

`obras.index.tsx`: adicionar contadores (relatórios, fotos, vídeos, ocorrências, % avanço geral) via view agregada.

## Fase 5 — RDO: atividades, aprovação, permissões
`rdo.$rdoId.tsx` — seção Atividades reformulada:
- Escolher entre "Da lista" (dropdown de `obra_tarefa_itens`) ou "Avulsa".
- Campos: previsto/realizado acumulado (read-only) + realizado hoje / % hoje / status / horas / comentário / MO / equipamentos / fotos com legenda.
- Salva em `rdo_tarefa_avancos`; trigger recalcula `obra_tarefa_itens.realizado_quantity` e `percent_complete`.

Fluxo de aprovação (novo card `RdoAprovacaoCard.tsx`):
- Botões: Enviar para aprovação → Aprovar / Solicitar revisão (motivo obrigatório) / Reabrir.
- RPCs SECURITY DEFINER com checagem `has_permission('rdos','aprovar')`.
- Status adicionais no enum `rdo_status`: `enviado`, `em_revisao`, `reaberto` (mantém existentes).
- Após aprovado, `final_pdf_url` populado pela geração de PDF já existente.

Permissões — adiciona ao enum `app_action`/`app_resource` (se preciso):
- `rdos.aprovar`, `rdos.solicitar_revisao`, `templates.editar`, `obras.vincular_recursos`.
- Seed `role_permissions` para admin/master/planejador/encarregado/consulta.

## Fase 6 — Export Excel + PDF com fotos por atividade + dashboard
- `src/lib/export-excel.functions.ts` — gera workbook 9 abas (Relatórios/Horário/Clima/MO/Equip/Atividades/Ocorrências/Comentários/Mídias) usando `xlsx`. Botões em `relatorios.$dim` e detalhe da obra.
- `src/lib/rdo-pdf.ts` — grid de fotos com legenda `item_code - descricao` abaixo (padrão RDO nº 33).
- `dashboard.tsx` — cards novos: HH por obra, RDOs pendentes/aprovados/revisão, avanço por etapa, produtividade prev×real, atividades fora do escopo. Usa `recharts` (já instalado).

---

## Regras de segurança aplicadas em todas as fases
- Toda migration: `IF NOT EXISTS` em tabelas, colunas, tipos, políticas.
- `GRANT SELECT/INSERT/UPDATE/DELETE ... TO authenticated` + `GRANT ALL ... TO service_role` para toda tabela nova.
- RLS `ENABLE` + policies escopadas a `empresa_id`.
- Nenhum `DROP` de tabela ou coluna existente.
- Nenhuma edição em `src/integrations/supabase/*` (auto-gen).
- `<NewBadge since="2026-07-05" />` em cada UI nova.

## Dependências a adicionar
`xlsx`, `file-saver`, `@types/file-saver`. (uuid, zod, rhf, recharts, date-fns, lucide, sonner já presentes.)

## Como proceder
Responda com uma das opções:
1. **"Fase 1"** — só banco (mais seguro, valida schema antes de UI).
2. **"Fases 1+2"** — banco + cadastros globais.
3. **"Todas em ordem"** — executo fase por fase, uma por turno, esperando você validar entre elas.
4. **Outra combinação** que preferir.
