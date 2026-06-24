
-- Soft delete columns
ALTER TABLE public.rdos
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS rdos_deleted_at_idx ON public.rdos (deleted_at);

-- Soft delete RPC: only rascunho, only author or admin/master, writes audit log
CREATE OR REPLACE FUNCTION public.soft_delete_rdo(_rdo_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rdo RECORD;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT id, autor_id, empresa_id, status, deleted_at
    INTO v_rdo
    FROM public.rdos
   WHERE id = _rdo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RDO não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_rdo.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'RDO já excluído' USING ERRCODE = 'P0001';
  END IF;

  IF v_rdo.status <> 'rascunho' THEN
    RAISE EXCEPTION 'Apenas RDO em rascunho pode ser excluído' USING ERRCODE = 'P0001';
  END IF;

  IF v_rdo.empresa_id <> private.get_user_empresa(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para excluir este RDO' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    v_rdo.autor_id = v_uid
    OR private.has_role(v_uid, 'admin'::app_role)
    OR private.has_role(v_uid, 'master'::app_role)
  ) THEN
    RAISE EXCEPTION 'Apenas o autor, administrador ou master podem excluir o rascunho' USING ERRCODE = '42501';
  END IF;

  UPDATE public.rdos
     SET deleted_at = now(),
         deleted_by = v_uid,
         updated_at = now()
   WHERE id = _rdo_id;

  INSERT INTO public.rdo_audit_logs (rdo_id, empresa_id, autor_id, acao, status_anterior, status_novo, motivo)
  VALUES (_rdo_id, v_rdo.empresa_id, v_uid, 'rascunho_excluido', v_rdo.status, v_rdo.status, 'soft delete de rascunho');
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_rdo(UUID) TO authenticated;
