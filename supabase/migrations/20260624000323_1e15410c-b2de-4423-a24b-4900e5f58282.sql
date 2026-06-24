
ALTER TYPE public.rdo_status ADD VALUE IF NOT EXISTS 'assinado';

CREATE TABLE IF NOT EXISTS public.rdo_signatarios_requeridos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id uuid NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  sujeito_tipo text NOT NULL CHECK (sujeito_tipo IN ('user','grupo')),
  sujeito_id uuid NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rdo_id, sujeito_tipo, sujeito_id)
);
CREATE INDEX IF NOT EXISTS idx_rsr_rdo ON public.rdo_signatarios_requeridos(rdo_id);
CREATE INDEX IF NOT EXISTS idx_rsr_empresa ON public.rdo_signatarios_requeridos(empresa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdo_signatarios_requeridos TO authenticated;
GRANT ALL ON public.rdo_signatarios_requeridos TO service_role;
ALTER TABLE public.rdo_signatarios_requeridos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver signatarios da empresa" ON public.rdo_signatarios_requeridos
  FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()));

CREATE POLICY "gerenciar signatarios do rdo" ON public.rdo_signatarios_requeridos
  FOR ALL TO authenticated
  USING (
    empresa_id = private.get_user_empresa(auth.uid())
    AND EXISTS (SELECT 1 FROM public.rdos r WHERE r.id = rdo_signatarios_requeridos.rdo_id
      AND (r.autor_id = auth.uid() OR private.has_admin_access(auth.uid()) OR private.can_approve_rdo(auth.uid())))
  )
  WITH CHECK (
    empresa_id = private.get_user_empresa(auth.uid())
    AND EXISTS (SELECT 1 FROM public.rdos r WHERE r.id = rdo_signatarios_requeridos.rdo_id
      AND (r.autor_id = auth.uid() OR private.has_admin_access(auth.uid()) OR private.can_approve_rdo(auth.uid())))
  );

CREATE TABLE IF NOT EXISTS public.rdo_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id uuid NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  via_grupo_id uuid REFERENCES public.grupos(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  hash_sha256 text,
  ip text,
  user_agent text,
  geo jsonb,
  assinado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rdo_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ra_rdo ON public.rdo_assinaturas(rdo_id);
CREATE INDEX IF NOT EXISTS idx_ra_empresa ON public.rdo_assinaturas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ra_user ON public.rdo_assinaturas(user_id);
GRANT SELECT, INSERT, DELETE ON public.rdo_assinaturas TO authenticated;
GRANT ALL ON public.rdo_assinaturas TO service_role;
ALTER TABLE public.rdo_assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver assinaturas da empresa" ON public.rdo_assinaturas
  FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()));

CREATE POLICY "assinar como proprio usuario" ON public.rdo_assinaturas
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = private.get_user_empresa(auth.uid())
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.rdo_signatarios_requeridos s
      WHERE s.rdo_id = rdo_assinaturas.rdo_id
        AND ((s.sujeito_tipo = 'user' AND s.sujeito_id = auth.uid())
          OR (s.sujeito_tipo = 'grupo' AND EXISTS (
            SELECT 1 FROM public.grupo_membros gm WHERE gm.grupo_id = s.sujeito_id AND gm.user_id = auth.uid()
          )))
    )
  );

CREATE POLICY "remover propria assinatura" ON public.rdo_assinaturas
  FOR DELETE TO authenticated
  USING (
    empresa_id = private.get_user_empresa(auth.uid())
    AND (user_id = auth.uid() OR private.has_admin_access(auth.uid()))
  );

CREATE OR REPLACE FUNCTION public.rdo_signatarios_pendentes(_rdo_id uuid)
RETURNS TABLE (user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT u.user_id FROM (
    SELECT s.sujeito_id AS user_id
      FROM public.rdo_signatarios_requeridos s
     WHERE s.rdo_id = _rdo_id AND s.sujeito_tipo = 'user'
    UNION
    SELECT gm.user_id
      FROM public.rdo_signatarios_requeridos s
      JOIN public.grupo_membros gm ON gm.grupo_id = s.sujeito_id
     WHERE s.rdo_id = _rdo_id AND s.sujeito_tipo = 'grupo'
  ) u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.rdo_assinaturas a
     WHERE a.rdo_id = _rdo_id AND a.user_id = u.user_id
  );
$$;
GRANT EXECUTE ON FUNCTION public.rdo_signatarios_pendentes(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.tg_check_rdo_assinado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pend int; v_req int;
BEGIN
  SELECT count(*) INTO v_req FROM public.rdo_signatarios_requeridos WHERE rdo_id = NEW.rdo_id;
  IF v_req = 0 THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_pend FROM public.rdo_signatarios_pendentes(NEW.rdo_id);
  IF v_pend = 0 THEN
    UPDATE public.rdos SET status = 'assinado'::rdo_status, updated_at = now()
      WHERE id = NEW.rdo_id AND status NOT IN ('aprovado','reprovado');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_check_rdo_assinado ON public.rdo_assinaturas;
CREATE TRIGGER trg_check_rdo_assinado
AFTER INSERT ON public.rdo_assinaturas
FOR EACH ROW EXECUTE FUNCTION public.tg_check_rdo_assinado();
