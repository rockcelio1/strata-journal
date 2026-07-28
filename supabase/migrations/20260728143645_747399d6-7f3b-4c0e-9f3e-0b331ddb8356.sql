
CREATE POLICY "system_backups_select_admin_master"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'system-backups'
    AND private.is_admin_or_master(auth.uid())
    AND (storage.foldername(name))[1] = private.get_user_empresa(auth.uid())::text
  );

CREATE POLICY "system_backups_insert_admin_master"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'system-backups'
    AND private.is_admin_or_master(auth.uid())
    AND (storage.foldername(name))[1] = private.get_user_empresa(auth.uid())::text
  );

CREATE POLICY "system_backups_delete_admin_master"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'system-backups'
    AND private.is_admin_or_master(auth.uid())
    AND (storage.foldername(name))[1] = private.get_user_empresa(auth.uid())::text
  );
