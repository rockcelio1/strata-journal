
-- ============ ENUMS (idempotente) ============
DO $$ BEGIN CREATE TYPE public.tarefa_controle AS ENUM ('porcentagem','produtividade','misto'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tarefa_status AS ENUM ('nao_iniciada','em_andamento','concluida','paralisada','cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Novos valores no rdo_status (mantém os existentes)
ALTER TYPE public.rdo_status ADD VALUE IF NOT EXISTS 'em_revisao';
ALTER TYPE public.rdo_status ADD VALUE IF NOT EXISTS 'revisao_solicitada';
ALTER TYPE public.rdo_status ADD VALUE IF NOT EXISTS 'reaberto';
ALTER TYPE public.rdo_status ADD VALUE IF NOT EXISTS 'cancelado';

-- Novo recurso e ação de permissão
ALTER TYPE public.app_resource ADD VALUE IF NOT EXISTS 'templates_tarefas';
ALTER TYPE public.app_resource ADD VALUE IF NOT EXISTS 'listas_tarefas';
ALTER TYPE public.app_action ADD VALUE IF NOT EXISTS 'importar';
ALTER TYPE public.app_action ADD VALUE IF NOT EXISTS 'solicitar_revisao';

-- ============ COLUNAS EXTRAS EM TABELAS EXISTENTES ============
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS numero_contrato text,
  ADD COLUMN IF NOT EXISTS responsavel_tecnico text,
  ADD COLUMN IF NOT EXISTS grupo_obra text;

ALTER TABLE public.mao_de_obra
  ADD COLUMN IF NOT EXISTS disciplina text;

ALTER TABLE public.equipamentos
  ADD COLUMN IF NOT EXISTS disciplina text,
  ADD COLUMN IF NOT EXISTS obrigatorio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS controla_horas boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS controla_quantidade boolean NOT NULL DEFAULT false;

ALTER TABLE public.rdos
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revision_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS revision_requested_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revision_reason text,
  ADD COLUMN IF NOT EXISTS final_pdf_url text;

ALTER TABLE public.rdo_anexos
  ADD COLUMN IF NOT EXISTS tarefa_item_id uuid,
  ADD COLUMN IF NOT EXISTS rdo_tarefa_avanco_id uuid,
  ADD COLUMN IF NOT EXISTS ocorrencia_id uuid,
  ADD COLUMN IF NOT EXISTS contexto text;

-- ============ TEMPLATES DE TAREFAS ============
CREATE TABLE IF NOT EXISTS public.templates_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  tipo_controle public.tarefa_controle NOT NULL DEFAULT 'porcentagem',
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates_tarefas TO authenticated;
GRANT ALL ON public.templates_tarefas TO service_role;
ALTER TABLE public.templates_tarefas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "templates_tarefas_select" ON public.templates_tarefas;
CREATE POLICY "templates_tarefas_select" ON public.templates_tarefas FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()));
DROP POLICY IF EXISTS "templates_tarefas_mutate" ON public.templates_tarefas;
CREATE POLICY "templates_tarefas_mutate" ON public.templates_tarefas FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()));

CREATE TABLE IF NOT EXISTS public.template_tarefa_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.templates_tarefas(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.template_tarefa_itens(id) ON DELETE CASCADE,
  item_code text NOT NULL,
  descricao text NOT NULL,
  is_etapa boolean NOT NULL DEFAULT false,
  unidade text,
  planned_quantity numeric,
  default_realized_quantity numeric DEFAULT 0,
  default_percent numeric DEFAULT 0,
  sort_order numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, item_code)
);
CREATE INDEX IF NOT EXISTS idx_tt_itens_template ON public.template_tarefa_itens(template_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_tarefa_itens TO authenticated;
GRANT ALL ON public.template_tarefa_itens TO service_role;
ALTER TABLE public.template_tarefa_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tti_all" ON public.template_tarefa_itens;
CREATE POLICY "tti_all" ON public.template_tarefa_itens FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()));

-- ============ LISTAS DE TAREFAS POR OBRA ============
CREATE TABLE IF NOT EXISTS public.obra_listas_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.templates_tarefas(id),
  nome text NOT NULL,
  tipo_controle public.tarefa_controle NOT NULL DEFAULT 'porcentagem',
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_listas_tarefas TO authenticated;
GRANT ALL ON public.obra_listas_tarefas TO service_role;
ALTER TABLE public.obra_listas_tarefas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "olt_all" ON public.obra_listas_tarefas;
CREATE POLICY "olt_all" ON public.obra_listas_tarefas FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()));

CREATE TABLE IF NOT EXISTS public.obra_tarefa_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  task_list_id uuid NOT NULL REFERENCES public.obra_listas_tarefas(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.obra_tarefa_itens(id) ON DELETE CASCADE,
  item_code text NOT NULL,
  descricao text NOT NULL,
  is_etapa boolean NOT NULL DEFAULT false,
  unidade text,
  planned_quantity numeric,
  realized_quantity numeric NOT NULL DEFAULT 0,
  percent_complete numeric NOT NULL DEFAULT 0,
  status public.tarefa_status NOT NULL DEFAULT 'nao_iniciada',
  sort_order numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_list_id, item_code)
);
CREATE INDEX IF NOT EXISTS idx_oti_list ON public.obra_tarefa_itens(task_list_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_oti_obra ON public.obra_tarefa_itens(obra_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_tarefa_itens TO authenticated;
GRANT ALL ON public.obra_tarefa_itens TO service_role;
ALTER TABLE public.obra_tarefa_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oti_all" ON public.obra_tarefa_itens;
CREATE POLICY "oti_all" ON public.obra_tarefa_itens FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()));

-- ============ AVANÇOS DE TAREFA POR RDO ============
CREATE TABLE IF NOT EXISTS public.rdo_tarefa_avancos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  rdo_id uuid NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  task_list_id uuid REFERENCES public.obra_listas_tarefas(id) ON DELETE SET NULL,
  task_item_id uuid REFERENCES public.obra_tarefa_itens(id) ON DELETE SET NULL,
  item_code text,
  descricao text NOT NULL,
  is_extra_activity boolean NOT NULL DEFAULT false,
  unidade text,
  planned_quantity numeric,
  previous_realized_quantity numeric,
  realized_today numeric,
  accumulated_realized numeric,
  previous_percent numeric,
  percent_today numeric,
  accumulated_percent numeric,
  status public.tarefa_status,
  start_time time,
  end_time time,
  total_hours interval,
  comment text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rta_rdo ON public.rdo_tarefa_avancos(rdo_id);
CREATE INDEX IF NOT EXISTS idx_rta_item ON public.rdo_tarefa_avancos(task_item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdo_tarefa_avancos TO authenticated;
GRANT ALL ON public.rdo_tarefa_avancos TO service_role;
ALTER TABLE public.rdo_tarefa_avancos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rta_all" ON public.rdo_tarefa_avancos;
CREATE POLICY "rta_all" ON public.rdo_tarefa_avancos FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()));

-- ============ JOBS DE IMPORTAÇÃO ============
CREATE TABLE IF NOT EXISTS public.import_jobs_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.templates_tarefas(id) ON DELETE SET NULL,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  file_name text,
  import_type text,
  status text NOT NULL DEFAULT 'pendente',
  total_rows integer DEFAULT 0,
  imported_rows integer DEFAULT 0,
  error_rows integer DEFAULT 0,
  error_log jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_jobs_tarefas TO authenticated;
GRANT ALL ON public.import_jobs_tarefas TO service_role;
ALTER TABLE public.import_jobs_tarefas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ijt_all" ON public.import_jobs_tarefas;
CREATE POLICY "ijt_all" ON public.import_jobs_tarefas FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()));

-- ============ RECURSOS PERMITIDOS POR OBRA ============
CREATE TABLE IF NOT EXISTS public.obra_funcoes_permitidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  mao_de_obra_id uuid NOT NULL REFERENCES public.mao_de_obra(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_id, mao_de_obra_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_funcoes_permitidas TO authenticated;
GRANT ALL ON public.obra_funcoes_permitidas TO service_role;
ALTER TABLE public.obra_funcoes_permitidas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ofp_all" ON public.obra_funcoes_permitidas;
CREATE POLICY "ofp_all" ON public.obra_funcoes_permitidas FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()));

CREATE TABLE IF NOT EXISTS public.obra_equipamentos_permitidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_id, equipamento_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_equipamentos_permitidos TO authenticated;
GRANT ALL ON public.obra_equipamentos_permitidos TO service_role;
ALTER TABLE public.obra_equipamentos_permitidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oep_all" ON public.obra_equipamentos_permitidos;
CREATE POLICY "oep_all" ON public.obra_equipamentos_permitidos FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()));

CREATE TABLE IF NOT EXISTS public.obra_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text,
  storage_path text NOT NULL,
  descricao text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_anexos TO authenticated;
GRANT ALL ON public.obra_anexos TO service_role;
ALTER TABLE public.obra_anexos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oa_all" ON public.obra_anexos;
CREATE POLICY "oa_all" ON public.obra_anexos FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()));

-- ============ TRIGGERS updated_at ============
DO $$ BEGIN
  CREATE TRIGGER trg_tt_updated BEFORE UPDATE ON public.templates_tarefas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_tti_updated BEFORE UPDATE ON public.template_tarefa_itens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_olt_updated BEFORE UPDATE ON public.obra_listas_tarefas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_oti_updated BEFORE UPDATE ON public.obra_tarefa_itens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_rta_updated BEFORE UPDATE ON public.rdo_tarefa_avancos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
