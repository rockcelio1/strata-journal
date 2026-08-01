CREATE TABLE IF NOT EXISTS public.onedrive_admin_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  client_id text NOT NULL,
  client_secret_ciphertext text NOT NULL,
  target_user_id text NOT NULL,
  target_user_email text NOT NULL,
  drive_id text,
  web_url text,
  status text NOT NULL DEFAULT 'configurado',
  last_test_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onedrive_admin_config TO authenticated;
GRANT ALL ON public.onedrive_admin_config TO service_role;

ALTER TABLE public.onedrive_admin_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam config onedrive"
ON public.onedrive_admin_config FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'master'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER trg_onedrive_admin_config_updated_at
BEFORE UPDATE ON public.onedrive_admin_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.onedrive_config_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  acao text NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.onedrive_config_audit TO authenticated;
GRANT ALL ON public.onedrive_config_audit TO service_role;

ALTER TABLE public.onedrive_config_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem auditoria onedrive"
ON public.onedrive_config_audit FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Admins inserem auditoria onedrive"
ON public.onedrive_config_audit FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'master'::app_role));

CREATE INDEX IF NOT EXISTS idx_onedrive_config_audit_created_at ON public.onedrive_config_audit (created_at DESC);