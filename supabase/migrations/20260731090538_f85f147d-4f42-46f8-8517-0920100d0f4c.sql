-- 1. onedrive_cache_settings: remove anon read
DROP POLICY IF EXISTS "ocs_read_all" ON public.onedrive_cache_settings;
CREATE POLICY "ocs_read_authenticated" ON public.onedrive_cache_settings
FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.onedrive_cache_settings FROM anon;

-- 2. help_article_media: scope to visible articles
DROP POLICY IF EXISTS "help_media_read_via_article" ON public.help_article_media;
CREATE POLICY "help_media_read_via_article" ON public.help_article_media
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.help_articles a
    WHERE a.id = help_article_media.article_id
      AND (a.empresa_id IS NULL OR a.empresa_id = private.get_user_empresa(auth.uid()))
      AND (a.status = 'publicado'::help_article_status OR private.is_admin_or_master(auth.uid()))
  )
);

-- 3. help_tutorial_steps: scope to visible tutorials
DROP POLICY IF EXISTS "help_tutorial_steps_read" ON public.help_tutorial_steps;
CREATE POLICY "help_tutorial_steps_read" ON public.help_tutorial_steps
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.help_tutorials t
    WHERE t.id = help_tutorial_steps.tutorial_id
      AND (t.empresa_id IS NULL OR t.empresa_id = private.get_user_empresa(auth.uid()))
      AND (t.active OR private.is_admin_or_master(auth.uid()))
  )
);

-- 4. rdos delete policy: restrict role scope to authenticated
DROP POLICY IF EXISTS "deletar rdo proprio ou admin/master" ON public.rdos;
CREATE POLICY "deletar rdo proprio ou admin/master" ON public.rdos
FOR DELETE TO authenticated USING (
  empresa_id = private.get_user_empresa(auth.uid())
  AND (
    autor_id = auth.uid()
    OR private.has_role(auth.uid(), 'admin'::app_role)
    OR private.has_role(auth.uid(), 'master'::app_role)
  )
);