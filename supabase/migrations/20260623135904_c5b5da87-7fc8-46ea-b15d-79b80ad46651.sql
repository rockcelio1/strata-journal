
-- =========================================================
-- ENUMS de recursos e ações
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.app_resource AS ENUM (
    'obras','rdos','usuarios','relatorios','equipamentos',
    'mao_de_obra','ocorrencias','convites','empresa','permissoes'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.app_action AS ENUM (
    'ver','criar','editar','excluir','aprovar','exportar'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- TABELA: role_permissions (padrão por papel, por empresa)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  resource public.app_resource NOT NULL,
  action public.app_action NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, role, resource, action)
);

CREATE INDEX IF NOT EXISTS idx_role_perm_lookup
  ON public.role_permissions (empresa_id, role, resource, action);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_role_perm_updated ON public.role_permissions;
CREATE TRIGGER trg_role_perm_updated BEFORE UPDATE ON public.role_permissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- TABELA: user_permission_overrides (override por usuário)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource public.app_resource NOT NULL,
  action public.app_action NOT NULL,
  allowed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, user_id, resource, action)
);

CREATE INDEX IF NOT EXISTS idx_user_override_lookup
  ON public.user_permission_overrides (empresa_id, user_id, resource, action);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permission_overrides TO authenticated;
GRANT ALL ON public.user_permission_overrides TO service_role;

ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_user_override_updated ON public.user_permission_overrides;
CREATE TRIGGER trg_user_override_updated BEFORE UPDATE ON public.user_permission_overrides
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- FUNÇÃO: private.has_permission
-- Resolve override -> default por papel, escopo da empresa ativa
-- =========================================================
CREATE OR REPLACE FUNCTION private.has_permission(
  _user_id uuid,
  _resource public.app_resource,
  _action public.app_action
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_empresa uuid;
  v_allowed boolean;
BEGIN
  SELECT empresa_id INTO v_empresa
    FROM public.profiles WHERE id = _user_id;
  IF v_empresa IS NULL THEN RETURN false; END IF;

  -- override do usuário?
  SELECT allowed INTO v_allowed
    FROM public.user_permission_overrides
   WHERE user_id = _user_id
     AND empresa_id = v_empresa
     AND resource = _resource
     AND action = _action
   LIMIT 1;
  IF FOUND THEN RETURN v_allowed; END IF;

  -- default por papel
  SELECT bool_or(rp.allowed) INTO v_allowed
    FROM public.user_roles ur
    JOIN public.role_permissions rp
      ON rp.role = ur.role
     AND rp.empresa_id = ur.empresa_id
     AND rp.resource = _resource
     AND rp.action = _action
   WHERE ur.user_id = _user_id
     AND ur.empresa_id = v_empresa;

  RETURN COALESCE(v_allowed, false);
END
$$;

REVOKE EXECUTE ON FUNCTION private.has_permission(uuid, public.app_resource, public.app_action) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_permission(uuid, public.app_resource, public.app_action) TO authenticated, service_role;

-- Wrapper público SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id uuid,
  _resource public.app_resource,
  _action public.app_action
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$ SELECT private.has_permission(_user_id, _resource, _action) $$;

REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, public.app_resource, public.app_action) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, public.app_resource, public.app_action) TO authenticated, service_role;

-- =========================================================
-- POLICIES
-- =========================================================
DROP POLICY IF EXISTS "ver permissoes da empresa" ON public.role_permissions;
CREATE POLICY "ver permissoes da empresa" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()));

DROP POLICY IF EXISTS "gerenciar permissoes papel" ON public.role_permissions;
CREATE POLICY "gerenciar permissoes papel" ON public.role_permissions
  FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid())
         AND public.has_permission(auth.uid(), 'permissoes', 'editar'))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid())
              AND public.has_permission(auth.uid(), 'permissoes', 'editar'));

DROP POLICY IF EXISTS "ver overrides da empresa" ON public.user_permission_overrides;
CREATE POLICY "ver overrides da empresa" ON public.user_permission_overrides
  FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()));

DROP POLICY IF EXISTS "gerenciar overrides" ON public.user_permission_overrides;
CREATE POLICY "gerenciar overrides" ON public.user_permission_overrides
  FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid())
         AND public.has_permission(auth.uid(), 'permissoes', 'editar'))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid())
              AND public.has_permission(auth.uid(), 'permissoes', 'editar'));

-- =========================================================
-- SEED de defaults por papel
-- =========================================================
CREATE OR REPLACE FUNCTION private.seed_role_permissions(_empresa uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  r record;
BEGIN
  -- ADMIN e MASTER: tudo
  FOR r IN
    SELECT res::public.app_resource AS res, act::public.app_action AS act
      FROM unnest(enum_range(NULL::public.app_resource)) res
     CROSS JOIN unnest(enum_range(NULL::public.app_action)) act
  LOOP
    INSERT INTO public.role_permissions (empresa_id, role, resource, action, allowed)
    VALUES (_empresa, 'admin', r.res, r.act, true)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.role_permissions (empresa_id, role, resource, action, allowed)
    VALUES (_empresa, 'master', r.res, r.act, true)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- GESTOR_ACESSOS: tudo em usuarios + permissoes + ver geral
  FOR r IN SELECT unnest(enum_range(NULL::public.app_action)) AS act LOOP
    INSERT INTO public.role_permissions (empresa_id, role, resource, action, allowed)
    VALUES (_empresa, 'gestor_acessos', 'usuarios', r.act, true)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.role_permissions (empresa_id, role, resource, action, allowed)
    VALUES (_empresa, 'gestor_acessos', 'permissoes', r.act, true)
    ON CONFLICT DO NOTHING;
  END LOOP;
  FOR r IN SELECT unnest(enum_range(NULL::public.app_resource)) AS res LOOP
    INSERT INTO public.role_permissions (empresa_id, role, resource, action, allowed)
    VALUES (_empresa, 'gestor_acessos', r.res, 'ver', true)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ENGENHEIRO: ver/criar/editar/exportar em obras, rdos, relatorios, equipamentos, mao_de_obra, ocorrencias; aprovar rdos
  FOR r IN
    SELECT res, act FROM (VALUES
      ('obras','ver'),('obras','criar'),('obras','editar'),('obras','exportar'),
      ('rdos','ver'),('rdos','criar'),('rdos','editar'),('rdos','exportar'),('rdos','aprovar'),
      ('relatorios','ver'),('relatorios','exportar'),
      ('equipamentos','ver'),('equipamentos','criar'),('equipamentos','editar'),
      ('mao_de_obra','ver'),('mao_de_obra','criar'),('mao_de_obra','editar'),
      ('ocorrencias','ver'),('ocorrencias','criar'),('ocorrencias','editar'),
      ('empresa','ver')
    ) AS t(res, act)
  LOOP
    INSERT INTO public.role_permissions (empresa_id, role, resource, action, allowed)
    VALUES (_empresa, 'engenheiro', r.res::public.app_resource, r.act::public.app_action, true)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- MESTRE: ver/criar/editar rdos, ver obras/equipamentos/mao_de_obra/ocorrencias
  FOR r IN
    SELECT res, act FROM (VALUES
      ('rdos','ver'),('rdos','criar'),('rdos','editar'),
      ('obras','ver'),('equipamentos','ver'),('mao_de_obra','ver'),
      ('ocorrencias','ver'),('ocorrencias','criar'),
      ('relatorios','ver')
    ) AS t(res, act)
  LOOP
    INSERT INTO public.role_permissions (empresa_id, role, resource, action, allowed)
    VALUES (_empresa, 'mestre', r.res::public.app_resource, r.act::public.app_action, true)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- VISUALIZADOR: apenas ver + exportar relatorios
  FOR r IN SELECT unnest(enum_range(NULL::public.app_resource)) AS res LOOP
    INSERT INTO public.role_permissions (empresa_id, role, resource, action, allowed)
    VALUES (_empresa, 'visualizador', r.res, 'ver', true)
    ON CONFLICT DO NOTHING;
  END LOOP;
  INSERT INTO public.role_permissions (empresa_id, role, resource, action, allowed)
  VALUES (_empresa, 'visualizador', 'relatorios', 'exportar', true)
  ON CONFLICT DO NOTHING;
END
$$;

REVOKE EXECUTE ON FUNCTION private.seed_role_permissions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.seed_role_permissions(uuid) TO service_role;

-- Seed para empresas existentes
DO $$
DECLARE e record;
BEGIN
  FOR e IN SELECT id FROM public.empresas LOOP
    PERFORM private.seed_role_permissions(e.id);
  END LOOP;
END $$;

-- Trigger para semear ao criar empresa
CREATE OR REPLACE FUNCTION public.tg_seed_empresa_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM private.seed_role_permissions(NEW.id);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_empresa_seed_permissions ON public.empresas;
CREATE TRIGGER trg_empresa_seed_permissions
AFTER INSERT ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.tg_seed_empresa_permissions();

-- =========================================================
-- Auditoria de alterações de permissões
-- =========================================================
CREATE OR REPLACE FUNCTION public.tg_audit_permissoes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE v_empresa uuid; v_detalhes jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_empresa := OLD.empresa_id;
    v_detalhes := jsonb_build_object('op','DELETE','old', to_jsonb(OLD));
  ELSIF TG_OP = 'UPDATE' THEN
    v_empresa := NEW.empresa_id;
    v_detalhes := jsonb_build_object('op','UPDATE','old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE
    v_empresa := NEW.empresa_id;
    v_detalhes := jsonb_build_object('op','INSERT','new', to_jsonb(NEW));
  END IF;

  INSERT INTO public.audit_logs_usuarios (empresa_id, autor_id, acao, detalhes, alvo_user_id)
  VALUES (
    v_empresa,
    auth.uid(),
    'permissao_' || lower(TG_OP) || '_' || TG_TABLE_NAME,
    v_detalhes,
    CASE WHEN TG_TABLE_NAME = 'user_permission_overrides' THEN COALESCE(NEW.user_id, OLD.user_id) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END
$$;

DROP TRIGGER IF EXISTS trg_audit_role_perm ON public.role_permissions;
CREATE TRIGGER trg_audit_role_perm
AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_permissoes();

DROP TRIGGER IF EXISTS trg_audit_user_override ON public.user_permission_overrides;
CREATE TRIGGER trg_audit_user_override
AFTER INSERT OR UPDATE OR DELETE ON public.user_permission_overrides
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_permissoes();
