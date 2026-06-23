
-- Enums
DO $$ BEGIN
  CREATE TYPE public.grupo_tipo AS ENUM ('global', 'equipe_obra');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rdo_acesso_nivel AS ENUM ('ver', 'editar', 'aprovar');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rdo_acesso_sujeito AS ENUM ('user', 'grupo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) GRUPOS
CREATE TABLE IF NOT EXISTS public.grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  tipo public.grupo_tipo NOT NULL,
  obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grupos_obra_quando_equipe CHECK (
    (tipo = 'equipe_obra' AND obra_id IS NOT NULL) OR
    (tipo = 'global' AND obra_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_grupos_empresa ON public.grupos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_grupos_obra ON public.grupos(obra_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grupos TO authenticated;
GRANT ALL ON public.grupos TO service_role;
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver grupos da empresa" ON public.grupos
  FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()));

CREATE POLICY "gerenciar grupos" ON public.grupos
  FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid())
         AND (private.has_admin_access(auth.uid()) OR public.has_permission(auth.uid(), 'permissoes', 'editar')))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid())
         AND (private.has_admin_access(auth.uid()) OR public.has_permission(auth.uid(), 'permissoes', 'editar')));

CREATE TRIGGER grupos_set_updated_at BEFORE UPDATE ON public.grupos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) GRUPO_MEMBROS
CREATE TABLE IF NOT EXISTS public.grupo_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grupo_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_grupo_membros_user ON public.grupo_membros(user_id);

GRANT SELECT, INSERT, DELETE ON public.grupo_membros TO authenticated;
GRANT ALL ON public.grupo_membros TO service_role;
ALTER TABLE public.grupo_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver membros da empresa" ON public.grupo_membros
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.grupos g
    WHERE g.id = grupo_membros.grupo_id
      AND g.empresa_id = private.get_user_empresa(auth.uid())
  ));

CREATE POLICY "gerenciar membros" ON public.grupo_membros
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.grupos g
    WHERE g.id = grupo_membros.grupo_id
      AND g.empresa_id = private.get_user_empresa(auth.uid())
      AND (private.has_admin_access(auth.uid()) OR public.has_permission(auth.uid(), 'permissoes', 'editar'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.grupos g
    WHERE g.id = grupo_membros.grupo_id
      AND g.empresa_id = private.get_user_empresa(auth.uid())
      AND (private.has_admin_access(auth.uid()) OR public.has_permission(auth.uid(), 'permissoes', 'editar'))
  ));

-- 3) RDO_ACESSOS
CREATE TABLE IF NOT EXISTS public.rdo_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id uuid NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  sujeito_tipo public.rdo_acesso_sujeito NOT NULL,
  sujeito_id uuid NOT NULL,
  nivel public.rdo_acesso_nivel NOT NULL DEFAULT 'ver',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (rdo_id, sujeito_tipo, sujeito_id)
);
CREATE INDEX IF NOT EXISTS idx_rdo_acessos_rdo ON public.rdo_acessos(rdo_id);
CREATE INDEX IF NOT EXISTS idx_rdo_acessos_sujeito ON public.rdo_acessos(sujeito_tipo, sujeito_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdo_acessos TO authenticated;
GRANT ALL ON public.rdo_acessos TO service_role;
ALTER TABLE public.rdo_acessos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver acessos rdo da empresa" ON public.rdo_acessos
  FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid())
         AND (private.has_admin_access(auth.uid()) OR public.has_permission(auth.uid(), 'rdos', 'ver')));

CREATE POLICY "gerenciar acessos rdo" ON public.rdo_acessos
  FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid())
         AND (private.has_admin_access(auth.uid()) OR public.has_permission(auth.uid(), 'permissoes', 'editar')))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid())
         AND (private.has_admin_access(auth.uid()) OR public.has_permission(auth.uid(), 'permissoes', 'editar')));

-- 4) Função can_access_rdo
CREATE OR REPLACE FUNCTION private.can_access_rdo(_user uuid, _rdo uuid, _nivel public.rdo_acesso_nivel)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  WITH rdo AS (SELECT empresa_id, autor_id FROM public.rdos WHERE id = _rdo),
  niveis AS (
    SELECT _nivel::text AS req,
           CASE _nivel WHEN 'ver' THEN 1 WHEN 'editar' THEN 2 WHEN 'aprovar' THEN 3 END AS req_rank
  )
  SELECT
    -- master/admin da empresa
    EXISTS (SELECT 1 FROM rdo r WHERE r.empresa_id = private.get_user_empresa(_user))
    AND (
      private.has_admin_access(_user)
      -- autor implícito editor
      OR EXISTS (SELECT 1 FROM rdo r WHERE r.autor_id = _user AND (SELECT req_rank FROM niveis) <= 2)
      -- acesso direto por usuário
      OR EXISTS (
        SELECT 1 FROM public.rdo_acessos a, niveis n
        WHERE a.rdo_id = _rdo
          AND a.sujeito_tipo = 'user' AND a.sujeito_id = _user
          AND (CASE a.nivel WHEN 'ver' THEN 1 WHEN 'editar' THEN 2 WHEN 'aprovar' THEN 3 END) >= n.req_rank
      )
      -- acesso via grupo
      OR EXISTS (
        SELECT 1 FROM public.rdo_acessos a
        JOIN public.grupo_membros gm ON gm.grupo_id = a.sujeito_id
        , niveis n
        WHERE a.rdo_id = _rdo
          AND a.sujeito_tipo = 'grupo'
          AND gm.user_id = _user
          AND (CASE a.nivel WHEN 'ver' THEN 1 WHEN 'editar' THEN 2 WHEN 'aprovar' THEN 3 END) >= n.req_rank
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_rdo(_user uuid, _rdo uuid, _nivel public.rdo_acesso_nivel)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT private.can_access_rdo(_user, _rdo, _nivel) $$;

REVOKE EXECUTE ON FUNCTION public.can_access_rdo(uuid, uuid, public.rdo_acesso_nivel) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_rdo(uuid, uuid, public.rdo_acesso_nivel) TO authenticated, service_role;

-- 5) Auditoria de concessão/revogação
CREATE OR REPLACE FUNCTION public.tg_audit_rdo_acessos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_emp uuid; v_det jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_emp := OLD.empresa_id;
    v_det := jsonb_build_object('op','DELETE','old', to_jsonb(OLD));
  ELSE
    v_emp := NEW.empresa_id;
    v_det := jsonb_build_object('op', TG_OP, 'new', to_jsonb(NEW),
                                'old', CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END);
  END IF;
  INSERT INTO public.audit_logs_usuarios (empresa_id, autor_id, acao, detalhes, alvo_user_id)
  VALUES (v_emp, auth.uid(), 'rdo_acesso_' || lower(TG_OP),
          v_det,
          CASE WHEN COALESCE(NEW.sujeito_tipo, OLD.sujeito_tipo) = 'user'
               THEN COALESCE(NEW.sujeito_id, OLD.sujeito_id) ELSE NULL END);
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS audit_rdo_acessos ON public.rdo_acessos;
CREATE TRIGGER audit_rdo_acessos
AFTER INSERT OR UPDATE OR DELETE ON public.rdo_acessos
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_rdo_acessos();
