-- ============ ENUM DE ESCOPO ============
DO $$ BEGIN
  CREATE TYPE public.perm_scope AS ENUM ('proprio','equipe','empresa','global');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ CATÁLOGO: MÓDULOS ============
CREATE TABLE IF NOT EXISTS public.app_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  icone text,
  rota text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_modulos TO authenticated;
GRANT ALL ON public.app_modulos TO service_role;
ALTER TABLE public.app_modulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modulos_select_auth" ON public.app_modulos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "modulos_write_admin" ON public.app_modulos
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'permissoes'::app_resource, 'editar'::app_action))
  WITH CHECK (public.has_permission(auth.uid(), 'permissoes'::app_resource, 'editar'::app_action));

-- ============ CATÁLOGO: RECURSOS ============
CREATE TABLE IF NOT EXISTS public.app_recursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_key text NOT NULL REFERENCES public.app_modulos(key) ON UPDATE CASCADE ON DELETE CASCADE,
  key text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  rota text,
  acoes text[] NOT NULL DEFAULT ARRAY['ver','criar','editar','excluir']::text[],
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_recursos TO authenticated;
GRANT ALL ON public.app_recursos TO service_role;
ALTER TABLE public.app_recursos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recursos_select_auth" ON public.app_recursos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "recursos_write_admin" ON public.app_recursos
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'permissoes'::app_resource, 'editar'::app_action))
  WITH CHECK (public.has_permission(auth.uid(), 'permissoes'::app_resource, 'editar'::app_action));

-- ============ CONCESSÕES POR PAPEL ============
CREATE TABLE IF NOT EXISTS public.perm_role_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  recurso_key text NOT NULL,
  acao text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  scope public.perm_scope NOT NULL DEFAULT 'empresa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, role, recurso_key, acao)
);
CREATE INDEX IF NOT EXISTS idx_perm_role_grants_empresa ON public.perm_role_grants(empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perm_role_grants TO authenticated;
GRANT ALL ON public.perm_role_grants TO service_role;
ALTER TABLE public.perm_role_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_grants_select_empresa" ON public.perm_role_grants
  FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid()));
CREATE POLICY "role_grants_write_admin" ON public.perm_role_grants
  FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid())
         AND public.has_permission(auth.uid(), 'permissoes'::app_resource, 'editar'::app_action))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid())
         AND public.has_permission(auth.uid(), 'permissoes'::app_resource, 'editar'::app_action));

-- ============ EXCEÇÕES POR USUÁRIO ============
CREATE TABLE IF NOT EXISTS public.perm_user_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  recurso_key text NOT NULL,
  acao text NOT NULL,
  allowed boolean NOT NULL,
  scope public.perm_scope,
  motivo text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, user_id, recurso_key, acao)
);
CREATE INDEX IF NOT EXISTS idx_perm_user_grants_user ON public.perm_user_grants(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perm_user_grants TO authenticated;
GRANT ALL ON public.perm_user_grants TO service_role;
ALTER TABLE public.perm_user_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_grants_select" ON public.perm_user_grants
  FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid())
         AND (user_id = auth.uid()
              OR public.has_permission(auth.uid(), 'permissoes'::app_resource, 'ver'::app_action)));
CREATE POLICY "user_grants_write_admin" ON public.perm_user_grants
  FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid())
         AND public.has_permission(auth.uid(), 'permissoes'::app_resource, 'editar'::app_action))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid())
         AND public.has_permission(auth.uid(), 'permissoes'::app_resource, 'editar'::app_action));

-- ============ ESCOPOS (DE QUEM / DE QUÊ) ============
CREATE TABLE IF NOT EXISTS public.perm_user_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  escopo_tipo text NOT NULL CHECK (escopo_tipo IN ('obra','grupo','modulo')),
  escopo_id uuid,
  escopo_key text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, user_id, escopo_tipo, escopo_id, escopo_key)
);
CREATE INDEX IF NOT EXISTS idx_perm_user_scopes_user ON public.perm_user_scopes(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perm_user_scopes TO authenticated;
GRANT ALL ON public.perm_user_scopes TO service_role;
ALTER TABLE public.perm_user_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_scopes_select" ON public.perm_user_scopes
  FOR SELECT TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid())
         AND (user_id = auth.uid()
              OR public.has_permission(auth.uid(), 'permissoes'::app_resource, 'ver'::app_action)));
CREATE POLICY "user_scopes_write_admin" ON public.perm_user_scopes
  FOR ALL TO authenticated
  USING (empresa_id = private.get_user_empresa(auth.uid())
         AND public.has_permission(auth.uid(), 'permissoes'::app_resource, 'editar'::app_action))
  WITH CHECK (empresa_id = private.get_user_empresa(auth.uid())
         AND public.has_permission(auth.uid(), 'permissoes'::app_resource, 'editar'::app_action));

-- ============ TRIGGERS updated_at ============
CREATE TRIGGER trg_app_modulos_updated BEFORE UPDATE ON public.app_modulos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_app_recursos_updated BEFORE UPDATE ON public.app_recursos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_perm_role_grants_updated BEFORE UPDATE ON public.perm_role_grants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_perm_user_grants_updated BEFORE UPDATE ON public.perm_user_grants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ AUDITORIA ============
CREATE OR REPLACE FUNCTION public.tg_audit_acessos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','private'
AS $$
DECLARE v_emp uuid; v_alvo uuid; v_det jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_emp := OLD.empresa_id; v_alvo := (to_jsonb(OLD)->>'user_id')::uuid;
    v_det := jsonb_build_object('op','DELETE','tabela',TG_TABLE_NAME,'old',to_jsonb(OLD));
  ELSE
    v_emp := NEW.empresa_id; v_alvo := (to_jsonb(NEW)->>'user_id')::uuid;
    v_det := jsonb_build_object('op',TG_OP,'tabela',TG_TABLE_NAME,'new',to_jsonb(NEW),
             'old', CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END);
  END IF;
  INSERT INTO public.audit_logs_usuarios (empresa_id, autor_id, acao, detalhes, alvo_user_id)
  VALUES (v_emp, auth.uid(), 'acesso_' || lower(TG_OP) || '_' || TG_TABLE_NAME, v_det, v_alvo);
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_audit_perm_role_grants
  AFTER INSERT OR UPDATE OR DELETE ON public.perm_role_grants
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_acessos();
CREATE TRIGGER trg_audit_perm_user_grants
  AFTER INSERT OR UPDATE OR DELETE ON public.perm_user_grants
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_acessos();
CREATE TRIGGER trg_audit_perm_user_scopes
  AFTER INSERT OR UPDATE OR DELETE ON public.perm_user_scopes
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_acessos();

-- ============ SEED DO CATÁLOGO ============
INSERT INTO public.app_modulos (key, nome, descricao, icone, rota, ordem) VALUES
  ('obras','Obras','Cadastro e acompanhamento de obras','HardHat','/obras',10),
  ('diario','Diário de Obra','RDOs, aprovações e assinaturas','ClipboardList','/rdo',20),
  ('cadastros','Cadastros','Equipamentos, mão de obra, ocorrências e tarefas','Database','/cadastros',30),
  ('relatorios','Relatórios','Análises e exportações','BarChart3','/relatorios',40),
  ('administracao','Administração','Usuários, permissões, empresa e segurança','Settings','/configuracoes',90),
  ('chamados','Chamados','Service desk e atendimentos','LifeBuoy','/chamados',50),
  ('patrimonio','Patrimônio','Bens, empréstimos e manutenção','Boxes','/patrimonio',60),
  ('protocolo','Protocolo','Rastreio e movimentação de documentos','FileStack','/protocolo',70)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_recursos (modulo_key, key, nome, rota, acoes, ordem) VALUES
  ('obras','obras.obras','Obras','/obras',ARRAY['ver','criar','editar','excluir','exportar'],10),
  ('obras','obras.fotos','Fotos e anexos da obra',NULL,ARRAY['ver','criar','excluir'],20),
  ('diario','diario.rdos','RDOs','/rdo',ARRAY['ver','criar','editar','excluir','aprovar','exportar','solicitar_revisao'],10),
  ('diario','diario.anexos','Anexos do RDO',NULL,ARRAY['ver','criar','excluir'],20),
  ('diario','diario.assinaturas','Assinaturas',NULL,ARRAY['ver','criar'],30),
  ('cadastros','cadastros.equipamentos','Equipamentos','/cadastros/equipamentos',ARRAY['ver','criar','editar','excluir','importar'],10),
  ('cadastros','cadastros.mao_de_obra','Mão de obra','/cadastros/mao-de-obra',ARRAY['ver','criar','editar','excluir','importar'],20),
  ('cadastros','cadastros.ocorrencias','Tipos de ocorrência','/cadastros/ocorrencias',ARRAY['ver','criar','editar','excluir'],30),
  ('cadastros','cadastros.tarefas','Templates e listas de tarefas','/cadastros/templates-tarefas',ARRAY['ver','criar','editar','excluir','importar'],40),
  ('relatorios','relatorios.dashboard','Painel','/dashboard',ARRAY['ver','exportar'],10),
  ('relatorios','relatorios.analises','Relatórios e análises','/relatorios',ARRAY['ver','exportar'],20),
  ('administracao','admin.usuarios','Usuários','/configuracoes/usuarios',ARRAY['ver','criar','editar','excluir'],10),
  ('administracao','admin.permissoes','Permissões e acessos','/configuracoes/acessos',ARRAY['ver','editar'],20),
  ('administracao','admin.convites','Convites','/configuracoes/usuarios',ARRAY['ver','criar','excluir'],30),
  ('administracao','admin.empresa','Empresa','/empresa',ARRAY['ver','editar'],40),
  ('administracao','admin.auditoria','Auditoria','/configuracoes/auditoria',ARRAY['ver','exportar'],50),
  ('administracao','admin.backup','Backup e restauração','/configuracoes/backup',ARRAY['ver','criar','editar'],60),
  ('administracao','admin.email','E-mail','/configuracoes/email',ARRAY['ver','editar'],70),
  ('administracao','admin.lgpd','LGPD','/configuracoes/lgpd',ARRAY['ver','editar'],80),
  ('chamados','chamados.tickets','Chamados','/chamados',ARRAY['ver','criar','editar','excluir','atribuir','comentar','encerrar','exportar'],10),
  ('chamados','chamados.base_conhecimento','Base de conhecimento',NULL,ARRAY['ver','criar','editar','excluir'],20),
  ('patrimonio','patrimonio.bens','Bens','/patrimonio',ARRAY['ver','criar','editar','excluir','exportar'],10),
  ('patrimonio','patrimonio.emprestimos','Empréstimos',NULL,ARRAY['ver','criar','editar','aprovar'],20),
  ('patrimonio','patrimonio.manutencao','Manutenção',NULL,ARRAY['ver','criar','editar','encerrar'],30),
  ('protocolo','protocolo.protocolos','Protocolos','/protocolo',ARRAY['ver','criar','editar','excluir','exportar'],10),
  ('protocolo','protocolo.movimentacoes','Movimentações',NULL,ARRAY['ver','criar','editar'],20)
ON CONFLICT (key) DO NOTHING;

-- ============ SEED DE CONCESSÕES PADRÃO POR EMPRESA ============
CREATE OR REPLACE FUNCTION private.seed_perm_grants(_empresa uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','private'
AS $$
DECLARE r record; a text;
BEGIN
  FOR r IN SELECT key, modulo_key, acoes FROM public.app_recursos WHERE ativo LOOP
    FOREACH a IN ARRAY r.acoes LOOP
      -- master e admin: tudo, escopo empresa
      INSERT INTO public.perm_role_grants (empresa_id, role, recurso_key, acao, allowed, scope)
        VALUES (_empresa,'master',r.key,a,true,'empresa')
        ON CONFLICT (empresa_id, role, recurso_key, acao) DO NOTHING;
      INSERT INTO public.perm_role_grants (empresa_id, role, recurso_key, acao, allowed, scope)
        VALUES (_empresa,'admin',r.key,a,true,'empresa')
        ON CONFLICT (empresa_id, role, recurso_key, acao) DO NOTHING;

      -- gestor de acessos: administração + leitura geral
      INSERT INTO public.perm_role_grants (empresa_id, role, recurso_key, acao, allowed, scope)
        VALUES (_empresa,'gestor_acessos',r.key,a,
                (r.modulo_key = 'administracao') OR a = 'ver','empresa')
        ON CONFLICT (empresa_id, role, recurso_key, acao) DO NOTHING;

      -- engenheiro: operação completa, sem administração
      INSERT INTO public.perm_role_grants (empresa_id, role, recurso_key, acao, allowed, scope)
        VALUES (_empresa,'engenheiro',r.key,a,
                r.modulo_key <> 'administracao','empresa')
        ON CONFLICT (empresa_id, role, recurso_key, acao) DO NOTHING;

      -- mestre: operação de campo, sem excluir/aprovar, escopo equipe
      INSERT INTO public.perm_role_grants (empresa_id, role, recurso_key, acao, allowed, scope)
        VALUES (_empresa,'mestre',r.key,a,
                r.modulo_key IN ('obras','diario','cadastros','chamados','patrimonio','protocolo')
                  AND a NOT IN ('excluir','aprovar'),
                'equipe')
        ON CONFLICT (empresa_id, role, recurso_key, acao) DO NOTHING;

      -- visualizador: somente leitura
      INSERT INTO public.perm_role_grants (empresa_id, role, recurso_key, acao, allowed, scope)
        VALUES (_empresa,'visualizador',r.key,a, a = 'ver','empresa')
        ON CONFLICT (empresa_id, role, recurso_key, acao) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- aplica nas empresas existentes
DO $$ DECLARE e record; BEGIN
  FOR e IN SELECT id FROM public.empresas LOOP
    PERFORM private.seed_perm_grants(e.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.tg_seed_perm_grants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','private'
AS $$
BEGIN
  PERFORM private.seed_perm_grants(NEW.id);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_seed_perm_grants AFTER INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.tg_seed_perm_grants();

-- ============ FUNÇÕES DE CONSULTA ============
CREATE OR REPLACE FUNCTION private.perm_scope_of(_user uuid, _recurso text, _acao text)
RETURNS public.perm_scope
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','private'
AS $$
DECLARE v_emp uuid; v_ov record; v_best public.perm_scope; v_rank int := -1; r record;
BEGIN
  IF _user IS NULL THEN RETURN NULL; END IF;
  SELECT empresa_id INTO v_emp FROM public.profiles WHERE id = _user;
  IF v_emp IS NULL THEN RETURN NULL; END IF;

  SELECT allowed, scope INTO v_ov
    FROM public.perm_user_grants
   WHERE empresa_id = v_emp AND user_id = _user AND recurso_key = _recurso AND acao = _acao;
  IF FOUND THEN
    IF NOT v_ov.allowed THEN RETURN NULL; END IF;
    IF v_ov.scope IS NOT NULL THEN RETURN v_ov.scope; END IF;
  END IF;

  FOR r IN
    SELECT g.scope FROM public.perm_role_grants g
      JOIN public.user_roles ur ON ur.role = g.role AND ur.empresa_id = g.empresa_id
     WHERE g.empresa_id = v_emp AND ur.user_id = _user
       AND g.recurso_key = _recurso AND g.acao = _acao AND g.allowed
  LOOP
    IF (CASE r.scope WHEN 'proprio' THEN 0 WHEN 'equipe' THEN 1 WHEN 'empresa' THEN 2 ELSE 3 END) > v_rank THEN
      v_rank := CASE r.scope WHEN 'proprio' THEN 0 WHEN 'equipe' THEN 1 WHEN 'empresa' THEN 2 ELSE 3 END;
      v_best := r.scope;
    END IF;
  END LOOP;

  IF v_best IS NOT NULL THEN RETURN v_best; END IF;
  IF FOUND AND v_ov.allowed THEN RETURN 'empresa'; END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.escopo_de(_user uuid, _recurso text, _acao text)
RETURNS public.perm_scope
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$ SELECT private.perm_scope_of(_user, _recurso, _acao) $$;

CREATE OR REPLACE FUNCTION public.pode(_user uuid, _recurso text, _acao text)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$ SELECT private.perm_scope_of(_user, _recurso, _acao) IS NOT NULL $$;

CREATE OR REPLACE FUNCTION public.meus_acessos()
RETURNS TABLE(recurso_key text, acao text, scope public.perm_scope)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','private'
AS $$
DECLARE v_uid uuid := auth.uid(); v_emp uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT empresa_id INTO v_emp FROM public.profiles WHERE id = v_uid;
  IF v_emp IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT g.recurso_key, g.acao,
           max(CASE g.scope WHEN 'proprio' THEN 0 WHEN 'equipe' THEN 1 WHEN 'empresa' THEN 2 ELSE 3 END) AS rk
      FROM public.perm_role_grants g
      JOIN public.user_roles ur ON ur.role = g.role AND ur.empresa_id = g.empresa_id
     WHERE g.empresa_id = v_emp AND ur.user_id = v_uid AND g.allowed
     GROUP BY g.recurso_key, g.acao
  ), ov AS (
    SELECT o.recurso_key, o.acao, o.allowed,
           CASE o.scope WHEN 'proprio' THEN 0 WHEN 'equipe' THEN 1 WHEN 'empresa' THEN 2 WHEN 'global' THEN 3 END AS rk
      FROM public.perm_user_grants o
     WHERE o.empresa_id = v_emp AND o.user_id = v_uid
  ), merged AS (
    SELECT COALESCE(b.recurso_key, ov.recurso_key) AS recurso_key,
           COALESCE(b.acao, ov.acao) AS acao,
           COALESCE(ov.allowed, true) AS allowed,
           COALESCE(ov.rk, b.rk, 2) AS rk
      FROM base b
      FULL OUTER JOIN ov ON ov.recurso_key = b.recurso_key AND ov.acao = b.acao
  )
  SELECT m.recurso_key, m.acao,
         (CASE m.rk WHEN 0 THEN 'proprio' WHEN 1 THEN 'equipe' WHEN 2 THEN 'empresa' ELSE 'global' END)::public.perm_scope
    FROM merged m WHERE m.allowed;
END $$;

REVOKE ALL ON FUNCTION public.meus_acessos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meus_acessos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.escopo_de(uuid, text, text) TO authenticated;