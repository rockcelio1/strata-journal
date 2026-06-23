
CREATE TABLE public.empresa_logo_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  logo_url TEXT NOT NULL,
  storage_path TEXT,
  mime_type TEXT,
  tamanho_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_empresa_logo_versions_empresa ON public.empresa_logo_versions(empresa_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.empresa_logo_versions TO authenticated;
GRANT ALL ON public.empresa_logo_versions TO service_role;
ALTER TABLE public.empresa_logo_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver versoes da empresa" ON public.empresa_logo_versions
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()));
CREATE POLICY "admin gerencia versoes" ON public.empresa_logo_versions
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa(auth.uid()) AND public.has_admin_access(auth.uid()));
CREATE POLICY "admin remove versoes" ON public.empresa_logo_versions
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) AND public.has_admin_access(auth.uid()));
