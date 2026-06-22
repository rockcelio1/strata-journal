
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'engenheiro', 'mestre', 'visualizador');
CREATE TYPE public.obra_status AS ENUM ('planejamento', 'em_andamento', 'pausada', 'concluida');
CREATE TYPE public.equipamento_status AS ENUM ('disponivel', 'em_uso', 'manutencao');
CREATE TYPE public.rdo_status AS ENUM ('rascunho', 'enviado', 'aprovado', 'reprovado');
CREATE TYPE public.severidade AS ENUM ('baixa', 'media', 'alta', 'critica');
CREATE TYPE public.clima AS ENUM ('ensolarado', 'nublado', 'chuvoso', 'chuva_forte', 'impraticavel');

-- =========================================================
-- TIMESTAMP TRIGGER FUNCTION
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========================================================
-- EMPRESAS
-- =========================================================
CREATE TABLE public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_empresas_updated BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- PROFILES (1:1 com auth.users)
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  cargo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_profiles_empresa ON public.profiles(empresa_id);

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- USER ROLES (separada de profiles por segurança)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, empresa_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- =========================================================
-- SECURITY DEFINER HELPERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_user_empresa(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT empresa_id FROM public.profiles WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.can_approve_rdo(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'engenheiro')
  )
$$;

-- =========================================================
-- POLICIES: empresas / profiles / user_roles
-- =========================================================
CREATE POLICY "empresa visivel a membros" ON public.empresas FOR SELECT
  TO authenticated USING (id = public.get_user_empresa(auth.uid()));
CREATE POLICY "admin pode editar empresa" ON public.empresas FOR UPDATE
  TO authenticated USING (id = public.get_user_empresa(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ver perfis da empresa" ON public.profiles FOR SELECT
  TO authenticated USING (empresa_id = public.get_user_empresa(auth.uid()));
CREATE POLICY "editar proprio perfil" ON public.profiles FOR UPDATE
  TO authenticated USING (id = auth.uid());

CREATE POLICY "ver papeis da empresa" ON public.user_roles FOR SELECT
  TO authenticated USING (empresa_id = public.get_user_empresa(auth.uid()));

-- =========================================================
-- TRIGGER signup: cria empresa + profile + role admin
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_empresa_id UUID;
  user_nome TEXT;
  empresa_nome TEXT;
BEGIN
  user_nome := COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  empresa_nome := COALESCE(NEW.raw_user_meta_data->>'empresa_nome', 'Minha Empresa');

  INSERT INTO public.empresas (nome) VALUES (empresa_nome) RETURNING id INTO new_empresa_id;
  INSERT INTO public.profiles (id, empresa_id, nome, email) VALUES (NEW.id, new_empresa_id, user_nome, NEW.email);
  INSERT INTO public.user_roles (user_id, empresa_id, role) VALUES (NEW.id, new_empresa_id, 'admin');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- CONVITES
-- =========================================================
CREATE TABLE public.convites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'visualizador',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  aceito BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convites TO authenticated;
GRANT ALL ON public.convites TO service_role;
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin gerencia convites" ON public.convites FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (empresa_id = public.get_user_empresa(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- OBRAS
-- =========================================================
CREATE TABLE public.obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  codigo TEXT,
  cliente TEXT,
  endereco TEXT,
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data_inicio DATE,
  data_previsao_fim DATE,
  status public.obra_status NOT NULL DEFAULT 'planejamento',
  avanco_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO authenticated;
GRANT ALL ON public.obras TO service_role;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_obras_empresa ON public.obras(empresa_id);
CREATE TRIGGER trg_obras_updated BEFORE UPDATE ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "ver obras da empresa" ON public.obras FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()));
CREATE POLICY "gerenciar obras" ON public.obras FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) AND NOT public.has_role(auth.uid(), 'visualizador'))
  WITH CHECK (empresa_id = public.get_user_empresa(auth.uid()) AND NOT public.has_role(auth.uid(), 'visualizador'));

-- =========================================================
-- MAO DE OBRA
-- =========================================================
CREATE TABLE public.mao_de_obra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  funcao TEXT NOT NULL,
  empresa_terceira TEXT,
  contato TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mao_de_obra TO authenticated;
GRANT ALL ON public.mao_de_obra TO service_role;
ALTER TABLE public.mao_de_obra ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_mao_empresa ON public.mao_de_obra(empresa_id);
CREATE TRIGGER trg_mao_updated BEFORE UPDATE ON public.mao_de_obra
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "ver mao de obra" ON public.mao_de_obra FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()));
CREATE POLICY "gerenciar mao de obra" ON public.mao_de_obra FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) AND NOT public.has_role(auth.uid(), 'visualizador'))
  WITH CHECK (empresa_id = public.get_user_empresa(auth.uid()) AND NOT public.has_role(auth.uid(), 'visualizador'));

-- =========================================================
-- EQUIPAMENTOS
-- =========================================================
CREATE TABLE public.equipamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT,
  identificacao TEXT,
  status public.equipamento_status NOT NULL DEFAULT 'disponivel',
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipamentos TO authenticated;
GRANT ALL ON public.equipamentos TO service_role;
ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_equip_empresa ON public.equipamentos(empresa_id);
CREATE TRIGGER trg_equip_updated BEFORE UPDATE ON public.equipamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "ver equipamentos" ON public.equipamentos FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()));
CREATE POLICY "gerenciar equipamentos" ON public.equipamentos FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) AND NOT public.has_role(auth.uid(), 'visualizador'))
  WITH CHECK (empresa_id = public.get_user_empresa(auth.uid()) AND NOT public.has_role(auth.uid(), 'visualizador'));

-- =========================================================
-- TIPOS DE OCORRENCIA
-- =========================================================
CREATE TABLE public.tipos_ocorrencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  severidade public.severidade NOT NULL DEFAULT 'media',
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_ocorrencia TO authenticated;
GRANT ALL ON public.tipos_ocorrencia TO service_role;
ALTER TABLE public.tipos_ocorrencia ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tipos_oc_empresa ON public.tipos_ocorrencia(empresa_id);
CREATE TRIGGER trg_tipos_oc_updated BEFORE UPDATE ON public.tipos_ocorrencia
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "ver tipos ocorrencia" ON public.tipos_ocorrencia FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()));
CREATE POLICY "gerenciar tipos ocorrencia" ON public.tipos_ocorrencia FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) AND NOT public.has_role(auth.uid(), 'visualizador'))
  WITH CHECK (empresa_id = public.get_user_empresa(auth.uid()) AND NOT public.has_role(auth.uid(), 'visualizador'));

-- =========================================================
-- RDOs
-- =========================================================
CREATE TABLE public.rdos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  numero SERIAL,
  data DATE NOT NULL,
  autor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  clima_manha public.clima,
  clima_tarde public.clima,
  clima_noite public.clima,
  observacoes TEXT,
  status public.rdo_status NOT NULL DEFAULT 'rascunho',
  enviado_em TIMESTAMPTZ,
  aprovado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_em TIMESTAMPTZ,
  motivo_reprovacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdos TO authenticated;
GRANT ALL ON public.rdos TO service_role;
ALTER TABLE public.rdos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rdos_empresa ON public.rdos(empresa_id);
CREATE INDEX idx_rdos_obra ON public.rdos(obra_id);
CREATE TRIGGER trg_rdos_updated BEFORE UPDATE ON public.rdos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "ver rdos da empresa" ON public.rdos FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()));
CREATE POLICY "criar rdo" ON public.rdos FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa(auth.uid()) AND NOT public.has_role(auth.uid(), 'visualizador') AND autor_id = auth.uid());
CREATE POLICY "editar rdo" ON public.rdos FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) AND (autor_id = auth.uid() OR public.can_approve_rdo(auth.uid())));
CREATE POLICY "deletar rdo proprio" ON public.rdos FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) AND (autor_id = auth.uid() OR public.has_role(auth.uid(), 'admin')));

-- =========================================================
-- RDO CHILDREN (atividades, mao de obra, equipamentos, ocorrencias)
-- =========================================================
CREATE TABLE public.rdo_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  pct_executado NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdo_atividades TO authenticated;
GRANT ALL ON public.rdo_atividades TO service_role;
ALTER TABLE public.rdo_atividades ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rdo_mao_de_obra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  mao_de_obra_id UUID NOT NULL REFERENCES public.mao_de_obra(id) ON DELETE RESTRICT,
  horas NUMERIC(5,2) NOT NULL DEFAULT 8,
  atividade TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdo_mao_de_obra TO authenticated;
GRANT ALL ON public.rdo_mao_de_obra TO service_role;
ALTER TABLE public.rdo_mao_de_obra ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rdo_equipamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  equipamento_id UUID NOT NULL REFERENCES public.equipamentos(id) ON DELETE RESTRICT,
  horas_uso NUMERIC(5,2) NOT NULL DEFAULT 0,
  status_uso TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdo_equipamentos TO authenticated;
GRANT ALL ON public.rdo_equipamentos TO service_role;
ALTER TABLE public.rdo_equipamentos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rdo_ocorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  tipo_ocorrencia_id UUID REFERENCES public.tipos_ocorrencia(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  foto_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdo_ocorrencias TO authenticated;
GRANT ALL ON public.rdo_ocorrencias TO service_role;
ALTER TABLE public.rdo_ocorrencias ENABLE ROW LEVEL SECURITY;

-- helper: empresa do rdo pai
CREATE OR REPLACE FUNCTION public.rdo_empresa(_rdo_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT empresa_id FROM public.rdos WHERE id = _rdo_id
$$;

CREATE OR REPLACE FUNCTION public.rdo_autor(_rdo_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT autor_id FROM public.rdos WHERE id = _rdo_id
$$;

-- policies para filhos
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['rdo_atividades','rdo_mao_de_obra','rdo_equipamentos','rdo_ocorrencias']) LOOP
    EXECUTE format('CREATE POLICY "ver %1$s" ON public.%1$s FOR SELECT TO authenticated USING (public.rdo_empresa(rdo_id) = public.get_user_empresa(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "gerenciar %1$s" ON public.%1$s FOR ALL TO authenticated USING (public.rdo_empresa(rdo_id) = public.get_user_empresa(auth.uid()) AND (public.rdo_autor(rdo_id) = auth.uid() OR public.can_approve_rdo(auth.uid()))) WITH CHECK (public.rdo_empresa(rdo_id) = public.get_user_empresa(auth.uid()))', t);
  END LOOP;
END $$;
