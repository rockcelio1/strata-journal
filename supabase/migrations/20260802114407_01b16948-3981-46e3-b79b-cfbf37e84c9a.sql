-- 1) SECURITY DEFINER functions: revoke public/anon execute
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- Re-grant only the functions the app legitimately calls as a signed-in user
GRANT EXECUTE ON FUNCTION public.admin_disable_rdo(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_soft_delete_rdo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_rdo_basico(uuid, uuid, date, text, clima, clima, clima) TO authenticated;
GRANT EXECUTE ON FUNCTION public.backup_estimate(uuid, text[], timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_quota(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.meus_acessos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rdo_signatarios_pendentes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_equipamentos_padrao() TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_mao_de_obra_padrao() TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_tipos_ocorrencia_padrao() TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_rdo(uuid) TO authenticated;

-- 2) email_credentials: admin-only, empresa scoped
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_credentials TO authenticated;
GRANT ALL ON public.email_credentials TO service_role;
DROP POLICY IF EXISTS email_credentials_admin_all ON public.email_credentials;
CREATE POLICY email_credentials_admin_all ON public.email_credentials
  FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()));

-- 3) empresa-logos: no anonymous/global read
DROP POLICY IF EXISTS "logos publicos para leitura" ON storage.objects;
CREATE POLICY "logos da propria empresa para leitura" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'empresa-logos'
    AND (storage.foldername(name))[1] = (private.get_user_empresa(auth.uid()))::text
  );

-- 4) lgpd_requests: constrain the public insert
DROP POLICY IF EXISTS lgpd_public_insert ON public.lgpd_requests;
CREATE POLICY lgpd_public_insert ON public.lgpd_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'recebido'::lgpd_request_status
    AND handled_by IS NULL
    AND handled_at IS NULL
    AND resposta IS NULL
    AND (requester_user_id IS NULL OR requester_user_id = auth.uid())
    AND requester_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND length(requester_email) <= 200
    AND length(requester_nome) BETWEEN 2 AND 200
    AND (descricao IS NULL OR length(descricao) <= 5000)
    AND (empresa_id IS NULL OR EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = empresa_id))
  );

-- 5) empresa scoping for onedrive/admin settings tables
ALTER TABLE public.onedrive_admin_config ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.onedrive_config_audit ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.button_effect_settings ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.skeleton_loading_settings ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;

UPDATE public.onedrive_admin_config SET empresa_id = (SELECT id FROM public.empresas ORDER BY created_at LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.onedrive_config_audit SET empresa_id = (SELECT id FROM public.empresas ORDER BY created_at LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.button_effect_settings SET empresa_id = (SELECT id FROM public.empresas ORDER BY created_at LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.skeleton_loading_settings SET empresa_id = (SELECT id FROM public.empresas ORDER BY created_at LIMIT 1) WHERE empresa_id IS NULL;

ALTER TABLE public.onedrive_admin_config ALTER COLUMN empresa_id SET DEFAULT private.get_user_empresa(auth.uid());
ALTER TABLE public.onedrive_config_audit ALTER COLUMN empresa_id SET DEFAULT private.get_user_empresa(auth.uid());
ALTER TABLE public.button_effect_settings ALTER COLUMN empresa_id SET DEFAULT private.get_user_empresa(auth.uid());
ALTER TABLE public.skeleton_loading_settings ALTER COLUMN empresa_id SET DEFAULT private.get_user_empresa(auth.uid());

DROP POLICY IF EXISTS "Admins gerenciam config onedrive" ON public.onedrive_admin_config;
CREATE POLICY onedrive_admin_config_admin_all ON public.onedrive_admin_config
  FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins veem auditoria onedrive" ON public.onedrive_config_audit;
DROP POLICY IF EXISTS "Admins inserem auditoria onedrive" ON public.onedrive_config_audit;
CREATE POLICY onedrive_config_audit_admin_select ON public.onedrive_config_audit
  FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()));
CREATE POLICY onedrive_config_audit_admin_insert ON public.onedrive_config_audit
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()));

-- onedrive_cache_settings already has empresa_id; scope its policies
DROP POLICY IF EXISTS ocs_read_authenticated ON public.onedrive_cache_settings;
DROP POLICY IF EXISTS ocs_admin_insert ON public.onedrive_cache_settings;
DROP POLICY IF EXISTS ocs_admin_update ON public.onedrive_cache_settings;
DROP POLICY IF EXISTS ocs_admin_delete ON public.onedrive_cache_settings;
CREATE POLICY ocs_read_empresa ON public.onedrive_cache_settings
  FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()));
CREATE POLICY ocs_admin_insert ON public.onedrive_cache_settings
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()));
CREATE POLICY ocs_admin_update ON public.onedrive_cache_settings
  FOR UPDATE TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()));
CREATE POLICY ocs_admin_delete ON public.onedrive_cache_settings
  FOR DELETE TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read active button effects" ON public.button_effect_settings;
DROP POLICY IF EXISTS "Admins manage button effects insert" ON public.button_effect_settings;
DROP POLICY IF EXISTS "Admins manage button effects update" ON public.button_effect_settings;
DROP POLICY IF EXISTS "Admins manage button effects delete" ON public.button_effect_settings;
CREATE POLICY button_effects_read ON public.button_effect_settings
  FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()));
CREATE POLICY button_effects_insert ON public.button_effect_settings
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()));
CREATE POLICY button_effects_update ON public.button_effect_settings
  FOR UPDATE TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()));
CREATE POLICY button_effects_delete ON public.button_effect_settings
  FOR DELETE TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "auth read active skeleton settings" ON public.skeleton_loading_settings;
DROP POLICY IF EXISTS "admin insert skeleton settings" ON public.skeleton_loading_settings;
DROP POLICY IF EXISTS "admin update skeleton settings" ON public.skeleton_loading_settings;
DROP POLICY IF EXISTS "admin delete skeleton settings" ON public.skeleton_loading_settings;
CREATE POLICY skeleton_read ON public.skeleton_loading_settings
  FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()));
CREATE POLICY skeleton_insert ON public.skeleton_loading_settings
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()));
CREATE POLICY skeleton_update ON public.skeleton_loading_settings
  FOR UPDATE TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()));
CREATE POLICY skeleton_delete ON public.skeleton_loading_settings
  FOR DELETE TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()) AND private.is_admin_or_master(auth.uid()));