CREATE POLICY "logos publicos para leitura" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'empresa-logos');

CREATE POLICY "admin/master envia logo da empresa" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'empresa-logos'
    AND (storage.foldername(name))[1] = public.get_user_empresa(auth.uid())::text
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'))
  );

CREATE POLICY "admin/master atualiza logo da empresa" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'empresa-logos'
    AND (storage.foldername(name))[1] = public.get_user_empresa(auth.uid())::text
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'))
  );

CREATE POLICY "admin/master remove logo da empresa" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'empresa-logos'
    AND (storage.foldername(name))[1] = public.get_user_empresa(auth.uid())::text
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'))
  );