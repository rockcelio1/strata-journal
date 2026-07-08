CREATE OR REPLACE FUNCTION public.tg_audit_permissoes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_empresa uuid;
  v_detalhes jsonb;
  v_alvo uuid;
  v_new jsonb;
  v_old jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_empresa := OLD.empresa_id;
    v_old := to_jsonb(OLD);
    v_detalhes := jsonb_build_object('op','DELETE','old', v_old);
  ELSIF TG_OP = 'UPDATE' THEN
    v_empresa := NEW.empresa_id;
    v_new := to_jsonb(NEW);
    v_old := to_jsonb(OLD);
    v_detalhes := jsonb_build_object('op','UPDATE','old', v_old, 'new', v_new);
  ELSE
    v_empresa := NEW.empresa_id;
    v_new := to_jsonb(NEW);
    v_detalhes := jsonb_build_object('op','INSERT','new', v_new);
  END IF;

  IF TG_TABLE_NAME = 'user_permission_overrides' THEN
    v_alvo := COALESCE((v_new->>'user_id')::uuid, (v_old->>'user_id')::uuid);
  ELSE
    v_alvo := NULL;
  END IF;

  INSERT INTO public.audit_logs_usuarios (empresa_id, autor_id, acao, detalhes, alvo_user_id)
  VALUES (
    v_empresa,
    auth.uid(),
    'permissao_' || lower(TG_OP) || '_' || TG_TABLE_NAME,
    v_detalhes,
    v_alvo
  );
  RETURN COALESCE(NEW, OLD);
END
$function$;