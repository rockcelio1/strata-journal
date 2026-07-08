
-- Endurecer RLS em help_search_logs por empresa (INSERT/UPDATE/SELECT)
DROP POLICY IF EXISTS search_logs_insert_self ON public.help_search_logs;
DROP POLICY IF EXISTS search_logs_update_own ON public.help_search_logs;
DROP POLICY IF EXISTS search_logs_select_own ON public.help_search_logs;

CREATE POLICY search_logs_insert_self ON public.help_search_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND empresa_id IS NOT NULL
    AND empresa_id = private.get_user_empresa(auth.uid())
  );

CREATE POLICY search_logs_update_own ON public.help_search_logs
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND empresa_id = private.get_user_empresa(auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND empresa_id = private.get_user_empresa(auth.uid())
  );

CREATE POLICY search_logs_select_own ON public.help_search_logs
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND empresa_id = private.get_user_empresa(auth.uid())
  );
