CREATE TABLE public.onedrive_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  acao text NOT NULL,
  conta text,
  escopos text[] NOT NULL DEFAULT '{}',
  detalhe text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX onedrive_auditoria_criado_em_idx ON public.onedrive_auditoria (criado_em DESC);
GRANT SELECT ON public.onedrive_auditoria TO authenticated;
GRANT ALL ON public.onedrive_auditoria TO service_role;
ALTER TABLE public.onedrive_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "onedrive_auditoria_select" ON public.onedrive_auditoria
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_admin_access(auth.uid()));

CREATE TABLE public.onedrive_permissoes (
  user_id uuid PRIMARY KEY,
  pode_ler boolean NOT NULL DEFAULT true,
  pode_escrever boolean NOT NULL DEFAULT false,
  concedido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onedrive_permissoes TO authenticated;
GRANT ALL ON public.onedrive_permissoes TO service_role;
ALTER TABLE public.onedrive_permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "onedrive_permissoes_select" ON public.onedrive_permissoes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_admin_access(auth.uid()));
CREATE POLICY "onedrive_permissoes_admin" ON public.onedrive_permissoes
  FOR ALL TO authenticated
  USING (public.has_admin_access(auth.uid()))
  WITH CHECK (public.has_admin_access(auth.uid()));
CREATE TRIGGER onedrive_permissoes_updated_at BEFORE UPDATE ON public.onedrive_permissoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();