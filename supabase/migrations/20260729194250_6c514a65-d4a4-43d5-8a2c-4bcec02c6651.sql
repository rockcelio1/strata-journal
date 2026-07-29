-- 1) Config por empresa
CREATE TABLE public.email_config (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'resend' CHECK (provider IN ('resend','sendgrid','mailgun','ses')),
  modo text NOT NULL DEFAULT 'server_functions' CHECK (modo IN ('server_functions','edge_function')),
  edge_function_name text,
  from_name text NOT NULL DEFAULT 'Sistema',
  from_email text,
  reply_to text,
  mailgun_domain text,
  ses_region text,
  ativo boolean NOT NULL DEFAULT false,
  max_tentativas integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_config TO authenticated;
GRANT ALL ON public.email_config TO service_role;
ALTER TABLE public.email_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_config_admin_all ON public.email_config FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()));
CREATE TRIGGER email_config_updated BEFORE UPDATE ON public.email_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Credenciais (somente service_role)
CREATE TABLE public.email_credentials (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  provider text NOT NULL,
  api_key text,
  api_secret text,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_credentials TO service_role;
ALTER TABLE public.email_credentials ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER email_credentials_updated BEFORE UPDATE ON public.email_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Templates
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  chave text NOT NULL,
  nome text NOT NULL,
  assunto text NOT NULL,
  corpo_html text NOT NULL,
  corpo_texto text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, chave)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_templates_admin_all ON public.email_templates FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()));
CREATE TRIGGER email_templates_updated BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Fila
CREATE TABLE public.email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  template_chave text,
  destinatario text NOT NULL,
  assunto text NOT NULL,
  corpo_html text NOT NULL,
  corpo_texto text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviando','enviado','falha','cancelado')),
  tentativas integer NOT NULL DEFAULT 0,
  max_tentativas integer NOT NULL DEFAULT 5,
  proxima_tentativa_em timestamptz NOT NULL DEFAULT now(),
  ultimo_erro text,
  provider text,
  provider_message_id text,
  idempotency_key text,
  enviado_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, idempotency_key)
);
CREATE INDEX email_queue_pendentes_idx ON public.email_queue (status, proxima_tentativa_em);
GRANT SELECT ON public.email_queue TO authenticated;
GRANT ALL ON public.email_queue TO service_role;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_queue_admin_select ON public.email_queue FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()));
CREATE TRIGGER email_queue_updated BEFORE UPDATE ON public.email_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Logs
CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  queue_id uuid REFERENCES public.email_queue(id) ON DELETE SET NULL,
  evento text NOT NULL,
  provider text,
  status text,
  destinatario text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_logs_empresa_idx ON public.email_logs (empresa_id, created_at DESC);
GRANT SELECT ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_logs_admin_select ON public.email_logs FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()));