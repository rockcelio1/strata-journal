ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS logo_url text;

DROP POLICY IF EXISTS "admin pode editar empresa" ON public.empresas;
CREATE POLICY "admin ou master pode editar empresa" ON public.empresas
  FOR UPDATE TO authenticated
  USING (id = public.get_user_empresa(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master')))
  WITH CHECK (id = public.get_user_empresa(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master')));