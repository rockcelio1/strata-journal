
-- 1) coluna de capa
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS foto_capa_path text,
  ADD COLUMN IF NOT EXISTS foto_capa_blur text;

-- 2) tabela de fotos
CREATE TABLE IF NOT EXISTS public.obra_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  nome text,
  mime_type text,
  largura int,
  altura int,
  tamanho_bytes bigint,
  blur_data_url text,
  ordem int NOT NULL DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS obra_fotos_obra_idx ON public.obra_fotos(obra_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_fotos TO authenticated;
GRANT ALL ON public.obra_fotos TO service_role;

ALTER TABLE public.obra_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obra_fotos_select_same_empresa" ON public.obra_fotos
  FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()));

CREATE POLICY "obra_fotos_insert_same_empresa" ON public.obra_fotos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()) AND uploaded_by = auth.uid());

CREATE POLICY "obra_fotos_update_same_empresa" ON public.obra_fotos
  FOR UPDATE TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid()));

CREATE POLICY "obra_fotos_delete_owner_or_admin" ON public.obra_fotos
  FOR DELETE TO authenticated
  USING (
    empresa_id = private.get_user_empresa(auth.uid())
    AND (uploaded_by = auth.uid() OR private.is_admin_or_master(auth.uid()))
  );

CREATE TRIGGER obra_fotos_updated
  BEFORE UPDATE ON public.obra_fotos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) storage policies para o bucket obra-fotos
-- path: <empresa_id>/<obra_id>/<file>
CREATE POLICY "obra_fotos_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'obra-fotos'
    AND (storage.foldername(name))[1]::uuid = private.get_user_empresa(auth.uid())
  );

CREATE POLICY "obra_fotos_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'obra-fotos'
    AND (storage.foldername(name))[1]::uuid = private.get_user_empresa(auth.uid())
    AND owner = auth.uid()
  );

CREATE POLICY "obra_fotos_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'obra-fotos'
    AND (storage.foldername(name))[1]::uuid = private.get_user_empresa(auth.uid())
    AND (owner = auth.uid() OR private.is_admin_or_master(auth.uid()))
  );
