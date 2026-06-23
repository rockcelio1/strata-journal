
-- 1) Aprovação em profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS aprovado boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;
-- Aprovar todos os existentes para não quebrar acessos atuais
UPDATE public.profiles SET aprovado = true, aprovado_em = now() WHERE aprovado = false;

-- 2) URLs de download do app
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS app_ios_url text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS app_android_url text;

-- 3) Função utilitária master|admin
CREATE OR REPLACE FUNCTION public.has_admin_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','master')
  )
$$;

-- 4) RLS: master também gerencia convites e papéis
DROP POLICY IF EXISTS "admin gerencia convites" ON public.convites;
CREATE POLICY "admin/master gerencia convites" ON public.convites
  AS PERMISSIVE FOR ALL TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) AND has_admin_access(auth.uid()))
  WITH CHECK (empresa_id = get_user_empresa(auth.uid()) AND has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "admin gerencia papeis" ON public.user_roles;
CREATE POLICY "admin/master gerencia papeis" ON public.user_roles
  AS PERMISSIVE FOR ALL TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) AND has_admin_access(auth.uid()))
  WITH CHECK (empresa_id = get_user_empresa(auth.uid()) AND has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "admin atualiza profiles" ON public.profiles;
CREATE POLICY "admin/master atualiza profiles" ON public.profiles
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) AND has_admin_access(auth.uid()))
  WITH CHECK (empresa_id = get_user_empresa(auth.uid()));

-- 5) Tabela de auditoria de usuários
CREATE TABLE IF NOT EXISTS public.audit_logs_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  alvo_user_id uuid,
  alvo_email text,
  acao text NOT NULL, -- convite_criado, convite_reenviado, convite_revogado, usuario_criado, usuario_editado, senha_definida, senha_reset_enviado, papel_alterado, usuario_desabilitado, usuario_habilitado, usuario_excluido, usuario_aprovado
  detalhes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs_usuarios TO authenticated;
GRANT ALL ON public.audit_logs_usuarios TO service_role;
ALTER TABLE public.audit_logs_usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver auditoria - admin/master" ON public.audit_logs_usuarios
  FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) AND has_admin_access(auth.uid()));

CREATE POLICY "inserir auditoria - admin/master" ON public.audit_logs_usuarios
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa(auth.uid()) AND has_admin_access(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_audit_logs_usuarios_empresa ON public.audit_logs_usuarios(empresa_id, created_at DESC);

-- 6) handle_new_user: convidados entram aprovados; cadastro espontâneo fica pendente
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  new_empresa_id uuid;
  user_nome text;
  empresa_nome text;
  v_convite record;
BEGIN
  user_nome := COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  SELECT * INTO v_convite
  FROM public.convites
  WHERE lower(email) = lower(NEW.email) AND aceito = false AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1;

  IF v_convite.id IS NOT NULL THEN
    new_empresa_id := v_convite.empresa_id;
    INSERT INTO public.profiles (id, empresa_id, nome, email, aprovado, aprovado_em)
      VALUES (NEW.id, new_empresa_id, user_nome, NEW.email, true, now());
    INSERT INTO public.user_roles (user_id, empresa_id, role) VALUES (NEW.id, new_empresa_id, v_convite.role);
    UPDATE public.convites SET aceito = true WHERE id = v_convite.id;
  ELSE
    empresa_nome := COALESCE(NEW.raw_user_meta_data->>'empresa_nome', 'Minha Empresa');
    INSERT INTO public.empresas (nome) VALUES (empresa_nome) RETURNING id INTO new_empresa_id;
    -- Criador da empresa é admin e já aprovado
    INSERT INTO public.profiles (id, empresa_id, nome, email, aprovado, aprovado_em)
      VALUES (NEW.id, new_empresa_id, user_nome, NEW.email, true, now());
    INSERT INTO public.user_roles (user_id, empresa_id, role) VALUES (NEW.id, new_empresa_id, 'admin');
  END IF;
  RETURN NEW;
END $function$;
