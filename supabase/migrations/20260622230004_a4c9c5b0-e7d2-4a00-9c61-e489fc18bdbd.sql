
-- 1) AUDIT LOGS
CREATE TABLE public.rdo_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id uuid NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acao text NOT NULL,
  status_anterior public.rdo_status,
  status_novo public.rdo_status,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rdo_audit_rdo ON public.rdo_audit_logs(rdo_id, created_at DESC);

GRANT SELECT, INSERT ON public.rdo_audit_logs TO authenticated;
GRANT ALL ON public.rdo_audit_logs TO service_role;
ALTER TABLE public.rdo_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver logs da empresa" ON public.rdo_audit_logs
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()));

CREATE POLICY "inserir logs da empresa" ON public.rdo_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_rdo_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.rdo_audit_logs (rdo_id, empresa_id, autor_id, acao, status_novo)
    VALUES (NEW.id, NEW.empresa_id, COALESCE(NEW.autor_id, auth.uid()), 'criado', NEW.status);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.rdo_audit_logs (rdo_id, empresa_id, autor_id, acao, status_anterior, status_novo, motivo)
    VALUES (
      NEW.id, NEW.empresa_id, auth.uid(),
      CASE NEW.status
        WHEN 'enviado' THEN 'enviado_para_aprovacao'
        WHEN 'aprovado' THEN 'aprovado'
        WHEN 'reprovado' THEN 'reprovado'
        ELSE 'status_alterado'
      END,
      OLD.status, NEW.status,
      CASE WHEN NEW.status = 'reprovado' THEN NEW.motivo_reprovacao ELSE NULL END
    );
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_rdos_audit_status
AFTER INSERT OR UPDATE OF status ON public.rdos
FOR EACH ROW EXECUTE FUNCTION public.log_rdo_status();

-- 2) ANEXOS
CREATE TABLE public.rdo_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id uuid NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rdo_anexos_rdo ON public.rdo_anexos(rdo_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.rdo_anexos TO authenticated;
GRANT ALL ON public.rdo_anexos TO service_role;
ALTER TABLE public.rdo_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver anexos da empresa" ON public.rdo_anexos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()));

CREATE POLICY "criar anexos da empresa" ON public.rdo_anexos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa(auth.uid()) AND autor_id = auth.uid());

CREATE POLICY "remover proprios anexos ou admin" ON public.rdo_anexos
  FOR DELETE TO authenticated
  USING (
    empresa_id = public.get_user_empresa(auth.uid())
    AND (autor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  );

-- 3) STORAGE policies — caminho: {empresa_id}/{rdo_id}/{arquivo}
CREATE POLICY "ver anexos rdo do storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rdo-anexos'
    AND (storage.foldername(name))[1]::uuid = public.get_user_empresa(auth.uid())
  );

CREATE POLICY "upload anexos rdo do storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rdo-anexos'
    AND (storage.foldername(name))[1]::uuid = public.get_user_empresa(auth.uid())
  );

CREATE POLICY "remover anexos rdo do storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'rdo-anexos'
    AND (storage.foldername(name))[1]::uuid = public.get_user_empresa(auth.uid())
  );

-- 4) GESTÃO DE MEMBROS
CREATE POLICY "admin gerencia papeis" ON public.user_roles
  FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (empresa_id = public.get_user_empresa(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin atualiza profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (empresa_id = public.get_user_empresa(auth.uid()));

-- 5) SIGNUP COM CONVITE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    INSERT INTO public.profiles (id, empresa_id, nome, email) VALUES (NEW.id, new_empresa_id, user_nome, NEW.email);
    INSERT INTO public.user_roles (user_id, empresa_id, role) VALUES (NEW.id, new_empresa_id, v_convite.role);
    UPDATE public.convites SET aceito = true WHERE id = v_convite.id;
  ELSE
    empresa_nome := COALESCE(NEW.raw_user_meta_data->>'empresa_nome', 'Minha Empresa');
    INSERT INTO public.empresas (nome) VALUES (empresa_nome) RETURNING id INTO new_empresa_id;
    INSERT INTO public.profiles (id, empresa_id, nome, email) VALUES (NEW.id, new_empresa_id, user_nome, NEW.email);
    INSERT INTO public.user_roles (user_id, empresa_id, role) VALUES (NEW.id, new_empresa_id, 'admin');
  END IF;
  RETURN NEW;
END $$;
