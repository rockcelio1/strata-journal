DROP POLICY IF EXISTS "ver logs da empresa" ON public.rdo_audit_logs;
CREATE POLICY "ver logs da empresa - admin/master"
  ON public.rdo_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    empresa_id = private.get_user_empresa(auth.uid())
    AND private.has_admin_access(auth.uid())
  );