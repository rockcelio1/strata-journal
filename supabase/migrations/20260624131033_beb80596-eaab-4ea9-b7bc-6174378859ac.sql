-- 1) Colunas de desabilitação
ALTER TABLE public.rdos
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disabled_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS rdos_disabled_at_idx ON public.rdos (disabled_at);

-- 2) Helper interno: é admin OU master?
CREATE OR REPLACE FUNCTION private.is_admin_or_master(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.has_role(_user_id, 'admin'::app_role)
      OR private.has_role(_user_id, 'master'::app_role)
$$;

-- 3) Admin: soft-delete em qualquer status
CREATE OR REPLACE FUNCTION public.admin_soft_delete_rdo(_rdo_id UUID)
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

  SELECT id, empresa_id, status, deleted_at INTO v_rdo
    FROM public.rdos WHERE id = _rdo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RDO não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_rdo.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'RDO já excluído' USING ERRCODE = 'P0001';
  END IF;

  IF v_rdo.empresa_id <> private.get_user_empresa(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para excluir este RDO' USING ERRCODE = '42501';
  END IF;

  IF NOT private.is_admin_or_master(v_uid) THEN
    RAISE EXCEPTION 'Apenas administrador ou master podem excluir qualquer RDO' USING ERRCODE = '42501';
  END IF;

  UPDATE public.rdos
     SET deleted_at = now(), deleted_by = v_uid, updated_at = now()
   WHERE id = _rdo_id;

  INSERT INTO public.rdo_audit_logs (rdo_id, empresa_id, autor_id, acao, status_anterior, status_novo, motivo)
  VALUES (_rdo_id, v_rdo.empresa_id, v_uid, 'excluido_admin', v_rdo.status, v_rdo.status,
          'soft delete por administrador/master (qualquer status)');
END;
$$;

-- 4) Admin: desabilitar / reabilitar
CREATE OR REPLACE FUNCTION public.admin_disable_rdo(_rdo_id UUID, _disable BOOLEAN)
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

  SELECT id, empresa_id, status, disabled_at INTO v_rdo
    FROM public.rdos WHERE id = _rdo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RDO não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_rdo.empresa_id <> private.get_user_empresa(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para alterar este RDO' USING ERRCODE = '42501';
  END IF;

  IF NOT private.is_admin_or_master(v_uid) THEN
    RAISE EXCEPTION 'Apenas administrador ou master podem desabilitar RDO' USING ERRCODE = '42501';
  END IF;

  IF _disable THEN
    UPDATE public.rdos
       SET disabled_at = now(), disabled_by = v_uid, updated_at = now()
     WHERE id = _rdo_id;
  ELSE
    UPDATE public.rdos
       SET disabled_at = NULL, disabled_by = NULL, updated_at = now()
     WHERE id = _rdo_id;
  END IF;

  INSERT INTO public.rdo_audit_logs (rdo_id, empresa_id, autor_id, acao, status_anterior, status_novo, motivo)
  VALUES (_rdo_id, v_rdo.empresa_id, v_uid,
          CASE WHEN _disable THEN 'desabilitado_admin' ELSE 'reabilitado_admin' END,
          v_rdo.status, v_rdo.status,
          CASE WHEN _disable THEN 'desabilitado por administrador/master' ELSE 'reabilitado por administrador/master' END);
END;
$$;

-- 5) Admin: edição de campos básicos em qualquer status
CREATE OR REPLACE FUNCTION public.admin_update_rdo_basico(
  _rdo_id UUID,
  _obra_id UUID,
  _data DATE,
  _observacoes TEXT,
  _clima_manha clima,
  _clima_tarde clima,
  _clima_noite clima
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rdo RECORD;
  v_uid UUID := auth.uid();
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT id, empresa_id, status, obra_id, data, observacoes, clima_manha, clima_tarde, clima_noite
    INTO v_rdo FROM public.rdos WHERE id = _rdo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RDO não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_rdo.empresa_id <> private.get_user_empresa(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para editar este RDO' USING ERRCODE = '42501';
  END IF;

  IF NOT private.is_admin_or_master(v_uid) THEN
    RAISE EXCEPTION 'Apenas administrador ou master podem editar qualquer RDO' USING ERRCODE = '42501';
  END IF;

  v_old := jsonb_build_object(
    'obra_id', v_rdo.obra_id, 'data', v_rdo.data, 'observacoes', v_rdo.observacoes,
    'clima_manha', v_rdo.clima_manha, 'clima_tarde', v_rdo.clima_tarde, 'clima_noite', v_rdo.clima_noite
  );
  v_new := jsonb_build_object(
    'obra_id', _obra_id, 'data', _data, 'observacoes', _observacoes,
    'clima_manha', _clima_manha, 'clima_tarde', _clima_tarde, 'clima_noite', _clima_noite
  );

  UPDATE public.rdos
     SET obra_id = COALESCE(_obra_id, obra_id),
         data = COALESCE(_data, data),
         observacoes = _observacoes,
         clima_manha = _clima_manha,
         clima_tarde = _clima_tarde,
         clima_noite = _clima_noite,
         updated_at = now()
   WHERE id = _rdo_id;

  INSERT INTO public.rdo_audit_logs (rdo_id, empresa_id, autor_id, acao, status_anterior, status_novo, motivo)
  VALUES (_rdo_id, v_rdo.empresa_id, v_uid, 'editado_admin', v_rdo.status, v_rdo.status,
          'edição por administrador/master — antes: ' || v_old::text || ' | depois: ' || v_new::text);
END;
$$;

-- 6) Permissões de execução
GRANT EXECUTE ON FUNCTION public.admin_soft_delete_rdo(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_disable_rdo(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_rdo_basico(UUID, UUID, DATE, TEXT, clima, clima, clima) TO authenticated;