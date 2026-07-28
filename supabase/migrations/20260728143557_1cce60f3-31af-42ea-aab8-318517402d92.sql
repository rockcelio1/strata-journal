
-- backup_history: auditoria de todas as operações
CREATE TABLE public.backup_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_email TEXT,
  operacao TEXT NOT NULL CHECK (operacao IN ('backup','restore','dry_run')),
  origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','agendado')),
  schedule_id UUID,
  grupos_selecionados TEXT[] NOT NULL DEFAULT '{}',
  buckets_selecionados TEXT[] NOT NULL DEFAULT '{}',
  modo_restore TEXT CHECK (modo_restore IN ('merge','replace')),
  criptografado BOOLEAN NOT NULL DEFAULT false,
  contagens JSONB NOT NULL DEFAULT '{}'::jsonb,
  validacoes JSONB,
  resultado TEXT NOT NULL CHECK (resultado IN ('sucesso','erro','parcial','pendente')),
  mensagem TEXT,
  arquivo_path TEXT,
  arquivo_tamanho_bytes BIGINT,
  duracao_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.backup_history TO authenticated;
GRANT ALL ON public.backup_history TO service_role;
ALTER TABLE public.backup_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_master_select_backup_history" ON public.backup_history
  FOR SELECT TO authenticated
  USING (
    empresa_id = private.get_user_empresa(auth.uid())
    AND private.is_admin_or_master(auth.uid())
  );
CREATE POLICY "admin_master_insert_backup_history" ON public.backup_history
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = private.get_user_empresa(auth.uid())
    AND private.is_admin_or_master(auth.uid())
  );
CREATE INDEX idx_backup_history_empresa_created ON public.backup_history(empresa_id, created_at DESC);

-- backup_schedules: agendamentos automáticos
CREATE TABLE public.backup_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  frequencia TEXT NOT NULL CHECK (frequencia IN ('diario','semanal','mensal')),
  hora_utc SMALLINT NOT NULL DEFAULT 3 CHECK (hora_utc BETWEEN 0 AND 23),
  dia_semana SMALLINT CHECK (dia_semana BETWEEN 0 AND 6),
  dia_mes SMALLINT CHECK (dia_mes BETWEEN 1 AND 28),
  grupos TEXT[] NOT NULL DEFAULT '{}',
  buckets TEXT[] NOT NULL DEFAULT '{}',
  retencao_dias INTEGER NOT NULL DEFAULT 30 CHECK (retencao_dias BETWEEN 1 AND 365),
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultima_execucao TIMESTAMPTZ,
  proxima_execucao TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_schedules TO authenticated;
GRANT ALL ON public.backup_schedules TO service_role;
ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_master_manage_backup_schedules" ON public.backup_schedules
  FOR ALL TO authenticated
  USING (
    empresa_id = private.get_user_empresa(auth.uid())
    AND private.is_admin_or_master(auth.uid())
  )
  WITH CHECK (
    empresa_id = private.get_user_empresa(auth.uid())
    AND private.is_admin_or_master(auth.uid())
  );
CREATE TRIGGER trg_backup_schedules_updated_at
  BEFORE UPDATE ON public.backup_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Função de limpeza por retenção (chamada pelo cron)
CREATE OR REPLACE FUNCTION public.cleanup_old_backups()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_removed INTEGER := 0;
BEGIN
  WITH del AS (
    DELETE FROM public.backup_history h
    USING public.backup_schedules s
    WHERE h.schedule_id = s.id
      AND h.origem = 'agendado'
      AND h.created_at < now() - make_interval(days => s.retencao_dias)
    RETURNING h.id
  )
  SELECT count(*) INTO v_removed FROM del;
  RETURN v_removed;
END $$;
