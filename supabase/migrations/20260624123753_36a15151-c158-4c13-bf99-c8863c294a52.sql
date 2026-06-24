DROP POLICY IF EXISTS "deletar rdo proprio" ON public.rdos;
CREATE POLICY "deletar rdo proprio ou admin/master"
ON public.rdos
FOR DELETE
USING (
  empresa_id = private.get_user_empresa(auth.uid())
  AND (
    autor_id = auth.uid()
    OR private.has_role(auth.uid(), 'admin'::app_role)
    OR private.has_role(auth.uid(), 'master'::app_role)
  )
);