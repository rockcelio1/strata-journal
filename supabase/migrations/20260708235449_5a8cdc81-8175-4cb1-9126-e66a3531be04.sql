
-- =========================================================================
-- ONDA 2 — P1 backend: tabelas de segurança, LGPD e observabilidade
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1) rate_limits
-- -------------------------------------------------------------------------
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  route text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT date_trunc('minute', now()),
  request_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, route, window_start)
);
CREATE INDEX idx_rate_limits_user_route_window ON public.rate_limits(user_id, route, window_start DESC);
CREATE INDEX idx_rate_limits_cleanup ON public.rate_limits(window_start);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limits TO authenticated;
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limits_own_select" ON public.rate_limits
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "rate_limits_own_write" ON public.rate_limits
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_rate_limits_updated_at BEFORE UPDATE ON public.rate_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------------------
-- 2) ai_usage_limits
-- -------------------------------------------------------------------------
CREATE TABLE public.ai_usage_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  request_count integer NOT NULL DEFAULT 0,
  tokens_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, usage_date)
);
CREATE INDEX idx_ai_usage_user_date ON public.ai_usage_limits(user_id, usage_date DESC);
CREATE INDEX idx_ai_usage_empresa_date ON public.ai_usage_limits(empresa_id, usage_date DESC);

GRANT SELECT, INSERT, UPDATE ON public.ai_usage_limits TO authenticated;
GRANT ALL ON public.ai_usage_limits TO service_role;
ALTER TABLE public.ai_usage_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_own_select" ON public.ai_usage_limits
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ai_usage_admin_select" ON public.ai_usage_limits
  FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid())
         AND private.is_admin_or_master(auth.uid()));
CREATE POLICY "ai_usage_own_write" ON public.ai_usage_limits
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_ai_usage_updated_at BEFORE UPDATE ON public.ai_usage_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------------------
-- 3) lgpd_requests
-- -------------------------------------------------------------------------
CREATE TYPE public.lgpd_request_type AS ENUM ('acesso','correcao','exclusao','portabilidade','anonimizacao','revogacao');
CREATE TYPE public.lgpd_request_status AS ENUM ('recebido','em_analise','em_execucao','concluido','recusado','cancelado');

CREATE TABLE public.lgpd_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text NOT NULL UNIQUE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  requester_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_email text NOT NULL,
  requester_nome text NOT NULL,
  request_type public.lgpd_request_type NOT NULL,
  descricao text,
  status public.lgpd_request_status NOT NULL DEFAULT 'recebido',
  resposta text,
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at timestamptz NOT NULL DEFAULT (now() + interval '15 days'),
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lgpd_empresa ON public.lgpd_requests(empresa_id, status, created_at DESC);
CREATE INDEX idx_lgpd_requester ON public.lgpd_requests(requester_user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.lgpd_requests TO authenticated;
GRANT INSERT ON public.lgpd_requests TO anon;
GRANT ALL ON public.lgpd_requests TO service_role;
ALTER TABLE public.lgpd_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lgpd_public_insert" ON public.lgpd_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "lgpd_own_select" ON public.lgpd_requests
  FOR SELECT TO authenticated USING (requester_user_id = auth.uid());
CREATE POLICY "lgpd_admin_select" ON public.lgpd_requests
  FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid())
         AND private.is_admin_or_master(auth.uid()));
CREATE POLICY "lgpd_admin_update" ON public.lgpd_requests
  FOR UPDATE TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid())
         AND private.is_admin_or_master(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid())
              AND private.is_admin_or_master(auth.uid()));

CREATE TRIGGER trg_lgpd_updated_at BEFORE UPDATE ON public.lgpd_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.generate_lgpd_protocol()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.protocolo IS NULL OR NEW.protocolo = '' THEN
    NEW.protocolo := 'LGPD-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_lgpd_protocol BEFORE INSERT ON public.lgpd_requests
  FOR EACH ROW EXECUTE FUNCTION public.generate_lgpd_protocol();

-- -------------------------------------------------------------------------
-- 4) backup_restore_tests
-- -------------------------------------------------------------------------
CREATE TABLE public.backup_restore_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  executed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  resultado text NOT NULL,
  observacoes text,
  evidencia_url text,
  executed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_backup_tests_empresa ON public.backup_restore_tests(empresa_id, executed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_restore_tests TO authenticated;
GRANT ALL ON public.backup_restore_tests TO service_role;
ALTER TABLE public.backup_restore_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backup_tests_admin_all" ON public.backup_restore_tests
  FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid())
         AND private.is_admin_or_master(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid())
              AND private.is_admin_or_master(auth.uid()));

CREATE TRIGGER trg_backup_tests_updated_at BEFORE UPDATE ON public.backup_restore_tests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------------------
-- 5) security_alerts
-- -------------------------------------------------------------------------
CREATE TYPE public.security_alert_severity AS ENUM ('info','baixa','media','alta','critica');
CREATE TYPE public.security_alert_status AS ENUM ('aberto','em_analise','resolvido','falso_positivo');

CREATE TABLE public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  severidade public.security_alert_severity NOT NULL DEFAULT 'media',
  status public.security_alert_status NOT NULL DEFAULT 'aberto',
  titulo text NOT NULL,
  descricao text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_security_alerts_empresa ON public.security_alerts(empresa_id, status, created_at DESC);
CREATE INDEX idx_security_alerts_severity ON public.security_alerts(severidade, status);

GRANT SELECT, INSERT, UPDATE ON public.security_alerts TO authenticated;
GRANT ALL ON public.security_alerts TO service_role;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_alerts_admin_select" ON public.security_alerts
  FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid())
         AND private.is_admin_or_master(auth.uid()));
CREATE POLICY "security_alerts_admin_update" ON public.security_alerts
  FOR UPDATE TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid())
         AND private.is_admin_or_master(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid())
              AND private.is_admin_or_master(auth.uid()));
CREATE POLICY "security_alerts_authenticated_insert" ON public.security_alerts
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()) OR empresa_id IS NULL);

CREATE TRIGGER trg_security_alerts_updated_at BEFORE UPDATE ON public.security_alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------------------
-- 6) export_jobs
-- -------------------------------------------------------------------------
CREATE TYPE public.export_job_status AS ENUM ('pendente','processando','concluido','erro','cancelado');
CREATE TYPE public.export_job_format AS ENUM ('csv','xlsx','pdf','json');

CREATE TABLE public.export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recurso text NOT NULL,
  formato public.export_job_format NOT NULL,
  status public.export_job_status NOT NULL DEFAULT 'pendente',
  filtros jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_linhas integer,
  arquivo_url text,
  erro text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_export_jobs_user ON public.export_jobs(user_id, created_at DESC);
CREATE INDEX idx_export_jobs_empresa ON public.export_jobs(empresa_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.export_jobs TO authenticated;
GRANT ALL ON public.export_jobs TO service_role;
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "export_jobs_own_select" ON public.export_jobs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "export_jobs_admin_select" ON public.export_jobs
  FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid())
         AND private.is_admin_or_master(auth.uid()));
CREATE POLICY "export_jobs_own_write" ON public.export_jobs
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_export_jobs_updated_at BEFORE UPDATE ON public.export_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------------------
-- 7) log_retention_policies
-- -------------------------------------------------------------------------
CREATE TABLE public.log_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo_log text NOT NULL,
  retencao_dias integer NOT NULL CHECK (retencao_dias > 0),
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, tipo_log)
);
CREATE INDEX idx_log_retention_empresa ON public.log_retention_policies(empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.log_retention_policies TO authenticated;
GRANT ALL ON public.log_retention_policies TO service_role;
ALTER TABLE public.log_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "log_retention_admin_all" ON public.log_retention_policies
  FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid())
         AND private.is_admin_or_master(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid())
              AND private.is_admin_or_master(auth.uid()));

CREATE TRIGGER trg_log_retention_updated_at BEFORE UPDATE ON public.log_retention_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------------------
-- 8) user_security_settings
-- -------------------------------------------------------------------------
CREATE TABLE public.user_security_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  mfa_enabled boolean NOT NULL DEFAULT false,
  mfa_enrolled_at timestamptz,
  notify_new_login boolean NOT NULL DEFAULT true,
  notify_password_change boolean NOT NULL DEFAULT true,
  last_password_change_at timestamptz,
  last_login_ip text,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_security_settings TO authenticated;
GRANT ALL ON public.user_security_settings TO service_role;
ALTER TABLE public.user_security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_sec_own_all" ON public.user_security_settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_sec_admin_select" ON public.user_security_settings
  FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid())
         AND private.is_admin_or_master(auth.uid()));

CREATE TRIGGER trg_user_sec_updated_at BEFORE UPDATE ON public.user_security_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- Funções auxiliares: check_rate_limit e check_ai_quota
-- =========================================================================

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _route text,
  _max_requests integer DEFAULT 60,
  _window_seconds integer DEFAULT 60
)
RETURNS TABLE(allowed boolean, current_count integer, limit_value integer, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_window_start timestamptz;
  v_count integer;
  v_empresa uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE='28000';
  END IF;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds);
  SELECT empresa_id INTO v_empresa FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.rate_limits (user_id, empresa_id, route, window_start, request_count)
  VALUES (v_uid, v_empresa, _route, v_window_start, 1)
  ON CONFLICT (user_id, route, window_start)
    DO UPDATE SET request_count = public.rate_limits.request_count + 1,
                  updated_at = now()
  RETURNING request_count INTO v_count;

  RETURN QUERY SELECT
    (v_count <= _max_requests),
    v_count,
    _max_requests,
    v_window_start + make_interval(secs => _window_seconds);
END $$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_ai_quota(_tokens integer DEFAULT 0)
RETURNS TABLE(allowed boolean, used integer, limit_value integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_empresa uuid;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_limit integer;
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE='28000';
  END IF;

  SELECT empresa_id INTO v_empresa FROM public.profiles WHERE id = v_uid;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada' USING ERRCODE='P0002';
  END IF;

  -- limites por perfil: admin/master=200, planejador=100, demais=50
  IF private.is_admin_or_master(v_uid) THEN
    v_limit := 200;
  ELSIF private.has_role(v_uid, 'planejador'::app_role) THEN
    v_limit := 100;
  ELSE
    v_limit := 50;
  END IF;

  INSERT INTO public.ai_usage_limits (user_id, empresa_id, usage_date, request_count, tokens_used)
  VALUES (v_uid, v_empresa, v_today, 1, GREATEST(_tokens,0))
  ON CONFLICT (user_id, usage_date)
    DO UPDATE SET request_count = public.ai_usage_limits.request_count + 1,
                  tokens_used = public.ai_usage_limits.tokens_used + GREATEST(_tokens,0),
                  updated_at = now()
  RETURNING request_count INTO v_count;

  RETURN QUERY SELECT
    (v_count <= v_limit),
    v_count,
    v_limit,
    GREATEST(v_limit - v_count, 0);
END $$;

GRANT EXECUTE ON FUNCTION public.check_ai_quota(integer) TO authenticated;
