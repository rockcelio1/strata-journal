
-- =================================================================
-- MÓDULO AJUDA / MANUAL DO SISTEMA
-- =================================================================

-- ---------- ENUMS ----------
DO $$ BEGIN
  CREATE TYPE public.help_article_status AS ENUM ('rascunho','publicado','arquivado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.help_progress_status AS ENUM ('nao_iniciado','em_andamento','concluido','dispensado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.changelog_type AS ENUM ('novo','correcao','melhoria','seguranca','integracao','visual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- HELP_CATEGORIES ----------
CREATE TABLE IF NOT EXISTS public.help_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_categories TO authenticated;
GRANT ALL ON public.help_categories TO service_role;
ALTER TABLE public.help_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "help_categories_select_global_or_empresa" ON public.help_categories FOR SELECT TO authenticated
  USING (empresa_id IS NULL OR empresa_id = private.get_user_empresa(auth.uid()));
CREATE POLICY "help_categories_admin_write" ON public.help_categories FOR ALL TO authenticated
  USING (private.is_admin_or_master(auth.uid()) AND (empresa_id IS NULL OR empresa_id = private.get_user_empresa(auth.uid())))
  WITH CHECK (private.is_admin_or_master(auth.uid()) AND (empresa_id IS NULL OR empresa_id = private.get_user_empresa(auth.uid())));

-- ---------- HELP_ARTICLES ----------
CREATE TABLE IF NOT EXISTS public.help_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.help_categories(id) ON DELETE SET NULL,
  slug text NOT NULL,
  module_key text,
  route_path text,
  title text NOT NULL,
  summary text,
  content text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  target_roles app_role[] NOT NULL DEFAULT '{}',
  status help_article_status NOT NULL DEFAULT 'rascunho',
  is_featured boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  version text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_help_articles_status ON public.help_articles(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_help_articles_category ON public.help_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_help_articles_module ON public.help_articles(module_key);
CREATE INDEX IF NOT EXISTS idx_help_articles_tsv ON public.help_articles USING gin (to_tsvector('portuguese', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(content,'')));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_articles TO authenticated;
GRANT ALL ON public.help_articles TO service_role;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "help_articles_select_published" ON public.help_articles FOR SELECT TO authenticated
  USING (
    (empresa_id IS NULL OR empresa_id = private.get_user_empresa(auth.uid()))
    AND (
      status = 'publicado'::help_article_status
      OR private.is_admin_or_master(auth.uid())
    )
  );

CREATE POLICY "help_articles_admin_write" ON public.help_articles FOR ALL TO authenticated
  USING (
    private.is_admin_or_master(auth.uid())
    AND (empresa_id IS NULL OR empresa_id = private.get_user_empresa(auth.uid()))
  )
  WITH CHECK (
    private.is_admin_or_master(auth.uid())
    AND (empresa_id IS NULL OR empresa_id = private.get_user_empresa(auth.uid()))
  );

-- ---------- HELP_ARTICLE_MEDIA ----------
CREATE TABLE IF NOT EXISTS public.help_article_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.help_articles(id) ON DELETE CASCADE,
  file_name text,
  file_type text,
  file_url text NOT NULL,
  caption text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_article_media TO authenticated;
GRANT ALL ON public.help_article_media TO service_role;
ALTER TABLE public.help_article_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_media_read_via_article" ON public.help_article_media FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.help_articles a WHERE a.id = article_id));
CREATE POLICY "help_media_admin_write" ON public.help_article_media FOR ALL TO authenticated
  USING (private.is_admin_or_master(auth.uid())) WITH CHECK (private.is_admin_or_master(auth.uid()));

-- ---------- HELP_TUTORIALS ----------
CREATE TABLE IF NOT EXISTS public.help_tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  slug text NOT NULL,
  module_key text,
  route_path text,
  title text NOT NULL,
  description text,
  target_roles app_role[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_tutorials TO authenticated;
GRANT ALL ON public.help_tutorials TO service_role;
ALTER TABLE public.help_tutorials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_tutorials_read" ON public.help_tutorials FOR SELECT TO authenticated
  USING ((empresa_id IS NULL OR empresa_id = private.get_user_empresa(auth.uid())) AND active);
CREATE POLICY "help_tutorials_admin_write" ON public.help_tutorials FOR ALL TO authenticated
  USING (private.is_admin_or_master(auth.uid())) WITH CHECK (private.is_admin_or_master(auth.uid()));

-- ---------- HELP_TUTORIAL_STEPS ----------
CREATE TABLE IF NOT EXISTS public.help_tutorial_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id uuid NOT NULL REFERENCES public.help_tutorials(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  selector text,
  title text NOT NULL,
  description text NOT NULL,
  position text NOT NULL DEFAULT 'bottom',
  action_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutorial_id, step_order)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_tutorial_steps TO authenticated;
GRANT ALL ON public.help_tutorial_steps TO service_role;
ALTER TABLE public.help_tutorial_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_tutorial_steps_read" ON public.help_tutorial_steps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.help_tutorials t WHERE t.id = tutorial_id));
CREATE POLICY "help_tutorial_steps_admin_write" ON public.help_tutorial_steps FOR ALL TO authenticated
  USING (private.is_admin_or_master(auth.uid())) WITH CHECK (private.is_admin_or_master(auth.uid()));

-- ---------- HELP_USER_PROGRESS ----------
CREATE TABLE IF NOT EXISTS public.help_user_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutorial_id uuid REFERENCES public.help_tutorials(id) ON DELETE CASCADE,
  article_id uuid REFERENCES public.help_articles(id) ON DELETE CASCADE,
  status help_progress_status NOT NULL DEFAULT 'em_andamento',
  completed_at timestamptz,
  dismissed_at timestamptz,
  do_not_show_again boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tutorial_id),
  UNIQUE (user_id, article_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_user_progress TO authenticated;
GRANT ALL ON public.help_user_progress TO service_role;
ALTER TABLE public.help_user_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_progress_own" ON public.help_user_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "help_progress_admin_read" ON public.help_user_progress FOR SELECT TO authenticated
  USING (private.is_admin_or_master(auth.uid()) AND empresa_id = private.get_user_empresa(auth.uid()));

-- ---------- SYSTEM_CHANGELOG ----------
CREATE TABLE IF NOT EXISTS public.system_changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  version text,
  change_type changelog_type NOT NULL DEFAULT 'melhoria',
  title text NOT NULL,
  description text,
  how_to_use text,
  module_key text,
  route_path text,
  target_roles app_role[] NOT NULL DEFAULT '{}',
  help_article_id uuid REFERENCES public.help_articles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_changelog_created ON public.system_changelog(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_changelog TO authenticated;
GRANT ALL ON public.system_changelog TO service_role;
ALTER TABLE public.system_changelog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "changelog_read" ON public.system_changelog FOR SELECT TO authenticated
  USING (empresa_id IS NULL OR empresa_id = private.get_user_empresa(auth.uid()));
CREATE POLICY "changelog_admin_write" ON public.system_changelog FOR ALL TO authenticated
  USING (private.is_admin_or_master(auth.uid())) WITH CHECK (private.is_admin_or_master(auth.uid()));

-- ---------- HELP_SEARCH_LOGS ----------
CREATE TABLE IF NOT EXISTS public.help_search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  search_term text NOT NULL,
  results_count int NOT NULL DEFAULT 0,
  clicked_article_id uuid REFERENCES public.help_articles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.help_search_logs TO authenticated;
GRANT ALL ON public.help_search_logs TO service_role;
ALTER TABLE public.help_search_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "search_logs_insert_self" ON public.help_search_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "search_logs_admin_read" ON public.help_search_logs FOR SELECT TO authenticated
  USING (private.is_admin_or_master(auth.uid()) AND (empresa_id IS NULL OR empresa_id = private.get_user_empresa(auth.uid())));

-- ---------- HELP_ARTICLE_FEEDBACK ----------
CREATE TABLE IF NOT EXISTS public.help_article_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.help_articles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  helpful boolean NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.help_article_feedback TO authenticated;
GRANT ALL ON public.help_article_feedback TO service_role;
ALTER TABLE public.help_article_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback_insert_self" ON public.help_article_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "feedback_admin_read" ON public.help_article_feedback FOR SELECT TO authenticated
  USING (private.is_admin_or_master(auth.uid()) AND (empresa_id IS NULL OR empresa_id = private.get_user_empresa(auth.uid())));

-- ---------- TRIGGERS updated_at ----------
CREATE TRIGGER trg_help_categories_upd BEFORE UPDATE ON public.help_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_help_articles_upd BEFORE UPDATE ON public.help_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_help_tutorials_upd BEFORE UPDATE ON public.help_tutorials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_help_tutorial_steps_upd BEFORE UPDATE ON public.help_tutorial_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_help_progress_upd BEFORE UPDATE ON public.help_user_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =================================================================
-- SEED: categorias globais (empresa_id NULL = visível para todos)
-- =================================================================
INSERT INTO public.help_categories (empresa_id, slug, name, description, icon, sort_order) VALUES
  (NULL, 'primeiros-passos', 'Primeiros passos', 'Como acessar e começar a usar o sistema', 'Rocket', 1),
  (NULL, 'obras', 'Obras', 'Cadastro, edição e acompanhamento de obras', 'Building2', 2),
  (NULL, 'rdo', 'Relatório Diário (RDO)', 'Como criar, preencher, enviar e aprovar RDOs', 'FileText', 3),
  (NULL, 'cadastros', 'Cadastros', 'Mão de obra, equipamentos, ocorrências e templates', 'Database', 4),
  (NULL, 'aprovacao', 'Aprovação e revisão', 'Fluxo de aprovação, revisão e assinatura', 'CheckCircle2', 5),
  (NULL, 'fotos', 'Fotos e anexos', 'Upload, sincronização e galeria', 'Images', 6),
  (NULL, 'exportacoes', 'Exportações', 'Exportar em PDF e Excel', 'Download', 7),
  (NULL, 'permissoes', 'Usuários e permissões', 'Perfis, grupos, permissões e convites', 'Shield', 8),
  (NULL, 'configuracoes', 'Configurações', 'Empresa, integrações e preferências', 'Settings', 9),
  (NULL, 'problemas', 'Problemas comuns', 'Erros frequentes e como resolver', 'AlertTriangle', 10),
  (NULL, 'glossario', 'Glossário', 'Termos e siglas do sistema', 'Book', 11);

-- =================================================================
-- SEED: artigos (empresa_id NULL, status publicado)
-- =================================================================
WITH cats AS (SELECT id, slug FROM public.help_categories WHERE empresa_id IS NULL)
INSERT INTO public.help_articles (empresa_id, category_id, slug, module_key, route_path, title, summary, content, tags, status, is_featured, sort_order, published_at)
SELECT NULL, c.id, a.slug, a.module_key, a.route_path, a.title, a.summary, a.content, a.tags, 'publicado'::help_article_status, a.is_featured, a.sort_order, now()
FROM (VALUES
  -- Primeiros passos
  ('primeiros-passos','como-acessar-o-sistema', NULL, '/auth', 'Como acessar o sistema',
    'Login por e-mail/senha ou Google e recuperação de senha.',
    E'## O que é\nA tela de acesso permite entrar no sistema com seu usuário.\n\n## Como acessar\n1. Vá para a página inicial.\n2. Informe seu e-mail e senha, ou clique em **Entrar com Google**.\n3. Se esqueceu a senha, clique em **Esqueci minha senha** para receber um e-mail de recuperação.\n\n## Problemas comuns\n- **Cadastro aguardando aprovação**: um administrador precisa liberar seu acesso.\n- **E-mail não confirmado**: verifique sua caixa de entrada e spam.',
    ARRAY['login','senha','acesso','google'], true, 1),
  ('primeiros-passos','como-alterar-meu-perfil', NULL, '/empresa', 'Como alterar meu perfil',
    'Atualize nome, telefone e senha.',
    E'## Como acessar\nMenu **Empresa** > seu nome no topo.\n\n## Passo a passo\n1. Altere os campos desejados.\n2. Clique em **Salvar**.\n\n## Atenção\nAlteração de e-mail pode exigir nova confirmação.',
    ARRAY['perfil','senha'], false, 2),
  ('primeiros-passos','como-usar-o-sistema-offline', NULL, NULL, 'Como usar o sistema offline',
    'O RDO pode ser preenchido sem internet e sincroniza depois.',
    E'## O que é\nO aplicativo salva o rascunho localmente quando você está sem internet.\n\n## Como funciona\n1. Preencha normalmente o RDO.\n2. As informações ficam guardadas no aparelho.\n3. Quando a conexão voltar, os dados sincronizam automaticamente.\n\n## Atenção\nFotos grandes podem levar alguns minutos para enviar.',
    ARRAY['offline','sincronizacao'], false, 3),

  -- Obras
  ('obras','como-cadastrar-obras','obras','/obras', 'Como cadastrar e acompanhar obras',
    'Criar nova obra, editar dados e acompanhar avanço.',
    E'## O que é\nA tela **Obras** concentra todas as obras da empresa.\n\n## Como acessar\nMenu > **Obras**.\n\n## Como cadastrar\n1. Clique em **Nova obra**.\n2. Preencha nome, código, cliente, endereço e datas.\n3. Escolha o status (planejamento, em andamento, pausada, concluída).\n4. Clique em **Salvar**.\n\n## Campos importantes\n- **Endereço**: usado para calcular o clima automaticamente no RDO.\n- **Avanço %**: pode ser ajustado manualmente ou refletir avanço das tarefas.\n\n## Problemas comuns\n- Se o clima não carrega, o endereço da obra precisa incluir cidade e estado.',
    ARRAY['obras','cadastro','avanco'], true, 1),
  ('obras','como-editar-obras','obras','/obras', 'Como editar uma obra',
    'Alterar dados, foto de capa e status.',
    E'## Passo a passo\n1. Abra a obra na lista.\n2. Clique em **Editar**.\n3. Ajuste os campos e salve.\n\n## Foto de capa\nUse **Trocar foto** para enviar uma imagem quadrada; ela aparece na grade e nos relatórios.',
    ARRAY['obras','editar'], false, 2),

  -- Cadastros
  ('cadastros','cadastrar-mao-de-obra','mao_de_obra','/cadastros/mao-de-obra', 'Como cadastrar mão de obra',
    'Funções por disciplina que aparecem nos RDOs.',
    E'## Como acessar\nMenu > **Cadastros** > **Mão de obra**.\n\n## Passo a passo\n1. Clique em **Nova função**.\n2. Preencha nome, função e disciplina (Civil, Elétrica, etc).\n3. Salve.\n\n## Dica\nUse **Carregar padrões** para inserir funções pré-configuradas.',
    ARRAY['mao de obra','funcoes'], false, 1),
  ('cadastros','cadastrar-equipamentos','equipamentos','/cadastros/equipamentos', 'Como cadastrar equipamentos',
    'Equipamentos disponíveis para uso nos RDOs.',
    E'## Passo a passo\n1. Menu > **Cadastros** > **Equipamentos**.\n2. Clique em **Novo equipamento**.\n3. Informe nome, tipo, controle de horas/quantidade.\n4. Salve.\n\n## Status\nDisponível, em uso ou manutenção — controlável na lista.',
    ARRAY['equipamentos'], false, 2),
  ('cadastros','tipos-ocorrencia','tipos_ocorrencia','/cadastros/ocorrencias', 'Como cadastrar tipos de ocorrência',
    'Motivos padronizados de paralisação ou desvio.',
    E'## Passo a passo\n1. Menu > **Cadastros** > **Tipos de ocorrência**.\n2. Clique em **Novo tipo**.\n3. Defina severidade (baixa/média/alta/crítica).\n4. Salve.',
    ARRAY['ocorrencias'], false, 3),
  ('cadastros','lista-tarefas','lista_tarefas','/cadastros/lista-tarefas', 'Como usar a lista de tarefas',
    'Planejamento por porcentagem ou produtividade.',
    E'## O que é\nDefine as tarefas da obra que geram avanço nos RDOs.\n\n## Como usar\n1. Cadastre um template ou importe do Excel.\n2. Vincule à obra em **Cadastros > Templates**.\n3. No RDO, registre o percentual executado por tarefa.',
    ARRAY['tarefas','planejamento','avanco'], false, 4),
  ('cadastros','templates-tarefas','templates_tarefas','/cadastros/templates-tarefas', 'Como usar templates de tarefas',
    'Reaproveitar listas de tarefas entre obras.',
    E'## Passo a passo\n1. Cadastre o template com os itens padrão.\n2. Vincule o template a uma obra.\n3. As tarefas do template ficam disponíveis no RDO.',
    ARRAY['templates','tarefas'], false, 5),
  ('cadastros','importar-tarefas-excel','lista_tarefas','/cadastros/templates-tarefas', 'Como importar lista de tarefas por Excel',
    'Importar planilha com tarefas em massa.',
    E'## Passo a passo\n1. Baixe o modelo em **Templates de tarefas > Importar**.\n2. Preencha as colunas obrigatórias.\n3. Faça upload; erros são mostrados linha a linha.',
    ARRAY['excel','importar','tarefas'], false, 6),

  -- RDO
  ('rdo','como-criar-rdo','rdo','/rdo/novo', 'Como criar um relatório diário (RDO)',
    'Novo RDO com clima, atividades, mão de obra e fotos.',
    E'## Como acessar\nMenu > **RDO** > **Novo relatório**.\n\n## Passo a passo\n1. Selecione a obra.\n2. Confirme a data.\n3. Registre condição climática (manhã, tarde, noite) — o clima é sugerido automaticamente.\n4. Adicione mão de obra, equipamentos, atividades e ocorrências.\n5. Envie fotos e vídeos.\n6. Salve como rascunho ou envie para aprovação.',
    ARRAY['rdo','criar','diario'], true, 1),
  ('rdo','clima-automatico','rdo','/rdo', 'Como registrar condição climática',
    'Clima automático via localização da obra.',
    E'## Como funciona\nO sistema usa o endereço da obra para consultar a previsão real do dia.\n\n## Botão Atualizar clima\nDentro do RDO, clique em **Atualizar clima** para recalcular usando a localização atual da obra. As coordenadas ficam em cache para acelerar a próxima visita.\n\n## Problemas comuns\n- **Endereço não localizado**: atualize o endereço da obra em **Cadastros > Obras** incluindo cidade e estado.',
    ARRAY['clima','tempo','previsao'], true, 2),
  ('rdo','registrar-mao-de-obra','rdo','/rdo', 'Como registrar mão de obra no RDO',
    'Informar quantidade de profissionais por função.',
    E'## Passo a passo\n1. Na seção **Mão de obra**, clique em **Adicionar**.\n2. Escolha a função.\n3. Informe a quantidade.\n4. Repita para as demais funções presentes.',
    ARRAY['mao de obra','rdo'], false, 3),
  ('rdo','registrar-equipamentos','rdo','/rdo', 'Como registrar equipamentos no RDO',
    'Horas trabalhadas e quantidade de equipamentos.',
    E'## Passo a passo\n1. Vá em **Equipamentos**.\n2. Adicione o equipamento.\n3. Informe horas ou quantidade conforme o cadastro.',
    ARRAY['equipamentos','rdo'], false, 4),
  ('rdo','registrar-atividades','rdo','/rdo', 'Como registrar atividades',
    'Descreva o que foi executado no dia.',
    E'## Passo a passo\n1. Na seção **Atividades**, clique em **Adicionar**.\n2. Descreva a atividade.\n3. Informe o percentual executado.',
    ARRAY['atividades','rdo'], false, 5),
  ('rdo','registrar-ocorrencias','rdo','/rdo', 'Como registrar ocorrências',
    'Paralisações, chuvas e desvios.',
    E'## Passo a passo\n1. Na seção **Ocorrências**, clique em **Adicionar**.\n2. Escolha o tipo cadastrado.\n3. Descreva a ocorrência.',
    ARRAY['ocorrencias','rdo'], false, 6),
  ('rdo','inserir-fotos','rdo','/rdo', 'Como inserir fotos no RDO',
    'Upload de fotos com legendas.',
    E'## Passo a passo\n1. Abra o RDO.\n2. Clique em **Anexar foto** e escolha ou tire uma foto.\n3. Adicione legenda opcional.\n\n## Dica\nAs fotos são guardadas no OneDrive da empresa e ficam disponíveis também na **Galeria**.',
    ARRAY['fotos','anexos','onedrive'], true, 7),
  ('rdo','inserir-videos','rdo','/rdo', 'Como inserir vídeos no RDO',
    'Anexar vídeos curtos ao relatório.',
    E'## Passo a passo\n1. Clique em **Anexar** e escolha um vídeo.\n2. Vídeos grandes podem levar alguns minutos para enviar.',
    ARRAY['videos','anexos'], false, 8),
  ('rdo','anexar-documentos','rdo','/rdo', 'Como anexar documentos ao RDO',
    'PDF, planilhas e outros arquivos.',
    E'## Passo a passo\n1. Clique em **Anexar arquivo**.\n2. Escolha o documento.\n3. Adicione descrição.',
    ARRAY['documentos','anexos','pdf'], false, 9),
  ('rdo','coletar-assinatura','rdo','/rdo', 'Como coletar assinatura no RDO',
    'Assinatura eletrônica dos responsáveis.',
    E'## Passo a passo\n1. Abra o RDO.\n2. Vá em **Assinaturas**.\n3. Passe o dedo ou o mouse para assinar.\n4. Salve.',
    ARRAY['assinatura','rdo'], false, 10),
  ('rdo','enviar-para-aprovacao','rdo','/rdo', 'Como enviar RDO para aprovação',
    'Finalizar rascunho e enviar ao aprovador.',
    E'## Passo a passo\n1. Revise os dados.\n2. Clique em **Enviar para aprovação**.\n3. O status muda para "Enviado" e o aprovador é notificado.',
    ARRAY['aprovacao','rdo'], true, 11),
  ('rdo','consultar-relatorios','rdo','/rdo', 'Como consultar relatórios',
    'Listar, filtrar e buscar RDOs.',
    E'## Como acessar\nMenu > **RDO**.\n\n## Filtros\n- Obra\n- Data\n- Status\n\n## Dica\nClique em uma linha para ver o relatório completo. O sistema pré-carrega detalhes e miniaturas para abrir mais rápido.',
    ARRAY['listar','filtrar','rdo'], false, 12),

  -- Aprovação
  ('aprovacao','como-aprovar-rdo','rdo','/rdo', 'Como aprovar um RDO',
    'Aprovar ou reprovar um RDO enviado.',
    E'## Quem pode\nAdministradores, gestores e mestres/engenheiros conforme permissão.\n\n## Passo a passo\n1. Abra o RDO com status **Enviado**.\n2. Clique em **Aprovar** ou **Reprovar**.\n3. Se reprovar, informe o motivo.\n\n## O que acontece depois\nO autor é notificado. RDO aprovado pode ser exportado em PDF.',
    ARRAY['aprovar','rdo'], true, 1),
  ('aprovacao','solicitar-revisao','rdo','/rdo', 'Como solicitar revisão',
    'Devolver o RDO ao autor para ajustes.',
    E'## Passo a passo\n1. Abra o RDO.\n2. Clique em **Solicitar revisão**.\n3. Descreva o que precisa ser ajustado.',
    ARRAY['revisao','rdo'], false, 2),
  ('aprovacao','reabrir-relatorio','rdo','/rdo', 'Como reabrir um relatório aprovado',
    'Apenas administradores podem reabrir.',
    E'## Passo a passo\n1. Abra o RDO aprovado.\n2. Clique em **Reabrir**.\n3. Confirme a ação — fica registrada em auditoria.',
    ARRAY['reabrir','aprovacao'], false, 3),

  -- Exportações
  ('exportacoes','gerar-pdf','rdo','/rdo', 'Como gerar PDF do RDO',
    'Exportação em PDF com fotos e assinaturas.',
    E'## Passo a passo\n1. Abra o RDO.\n2. Clique em **PDF**.\n3. O arquivo é baixado com layout de relatório oficial.',
    ARRAY['pdf','exportar','rdo'], false, 1),
  ('exportacoes','exportar-excel','rdo','/rdo', 'Como exportar em Excel',
    'Planilha com dados do RDO.',
    E'## Passo a passo\n1. Abra o RDO.\n2. Clique em **Excel**.\n3. O arquivo `.xlsx` é baixado.',
    ARRAY['excel','exportar'], false, 2),

  -- Fotos
  ('fotos','galeria','galeria','/galeria', 'Como visualizar fotos e vídeos da obra',
    'Galeria consolidada por obra.',
    E'## Como acessar\nMenu > **Galeria**.\n\n## Recursos\n- Filtro por obra e data.\n- Zoom nas fotos.\n- Download.',
    ARRAY['galeria','fotos'], false, 1),
  ('fotos','sincronizacao','onedrive',NULL, 'Como funciona a sincronização de fotos',
    'Fotos são enviadas ao OneDrive da empresa.',
    E'## Como funciona\n- Ao anexar, a foto é enviada ao OneDrive.\n- Um link seguro é gerado para o app exibir.\n- Se estiver offline, a foto fica na fila e sincroniza depois.',
    ARRAY['sincronizacao','onedrive'], false, 2),
  ('fotos','erro-sincronizacao','onedrive',NULL, 'Como resolver erro de sincronização',
    'O que fazer quando uma foto não sobe.',
    E'## Passos\n1. Verifique a conexão.\n2. Abra o RDO — o app tenta novamente automaticamente.\n3. Se persistir, remova o anexo e reenvie.\n4. Peça ao administrador para verificar a integração OneDrive em **Configurações > OneDrive**.',
    ARRAY['erro','sincronizacao'], false, 3),

  -- Permissões
  ('permissoes','cadastrar-usuarios','usuarios','/configuracoes/usuarios', 'Como cadastrar usuários',
    'Convidar novos usuários por e-mail.',
    E'## Quem pode\nAdministradores e gestor de acessos.\n\n## Passo a passo\n1. Menu > **Configurações** > **Usuários**.\n2. Clique em **Convidar**.\n3. Informe e-mail e perfil.\n4. O usuário recebe convite por e-mail.',
    ARRAY['usuarios','convite'], true, 1),
  ('permissoes','definir-permissoes','permissoes','/configuracoes/permissoes', 'Como definir permissões',
    'Perfis e permissões granulares.',
    E'## Perfis padrão\n- **Admin**: acesso total.\n- **Master**: acesso total, incluindo empresa.\n- **Gestor de acessos**: gerencia usuários e permissões.\n- **Engenheiro**: cria e aprova RDOs.\n- **Mestre**: cria RDOs.\n- **Visualizador**: apenas leitura.\n\n## Overrides\nEm **Configurações > Permissões** é possível ajustar por usuário.',
    ARRAY['permissoes','perfis','roles'], true, 2),
  ('permissoes','grupos','grupos','/configuracoes/grupos', 'Como usar grupos',
    'Agrupar usuários para atribuições.',
    E'## Como usar\n1. Crie um grupo.\n2. Adicione membros.\n3. Use o grupo em regras de acesso a RDOs.',
    ARRAY['grupos'], false, 3),

  -- Configurações
  ('configuracoes','empresa','empresa','/empresa', 'Como cadastrar dados da empresa',
    'Nome, logo e informações fiscais.',
    E'## Como acessar\nMenu > **Empresa**.\n\n## Passo a passo\n1. Ajuste nome, CNPJ e logo.\n2. Salve.\n\n## Dica\nO logo aparece nos PDFs exportados.',
    ARRAY['empresa','logo'], false, 1),
  ('configuracoes','onedrive','onedrive','/configuracoes/onedrive', 'Como configurar o OneDrive',
    'Integração para armazenamento de anexos.',
    E'## Passo a passo\n1. Menu > **Configurações** > **OneDrive**.\n2. Clique em **Conectar**.\n3. Autorize com a conta Microsoft da empresa.',
    ARRAY['onedrive','integracao'], false, 2),

  -- Problemas comuns
  ('problemas','endereco-nao-localizado','rdo','/rdo', 'Erro: endereço não localizado',
    'Clima não carrega no RDO.',
    E'## Causa\nO endereço da obra não permite localização.\n\n## Solução\n1. Vá em **Cadastros > Obras**.\n2. Edite a obra.\n3. Inclua cidade e estado no endereço.\n4. Salve e volte ao RDO — clique em **Atualizar clima**.',
    ARRAY['erro','clima','endereco'], false, 1),
  ('problemas','fotos-nao-carregam','fotos','/rdo', 'Fotos do RDO não aparecem',
    'O que fazer quando o anexo fica em branco.',
    E'## Solução\n1. Aguarde alguns segundos (o app tenta duas vezes automaticamente).\n2. Toque na foto para recarregar.\n3. Se persistir, peça ao administrador para verificar a integração OneDrive.',
    ARRAY['fotos','erro'], false, 2),
  ('problemas','rdo-preso-em-carregando','rdo','/rdo', 'RDO travado em "Carregando…"',
    'Como recuperar quando não abre.',
    E'## Solução\n1. Puxe a tela para atualizar.\n2. Clique em **Tentar novamente** se aparecer mensagem de erro.\n3. Volte à lista e abra novamente.',
    ARRAY['erro','carregamento'], false, 3),
  ('problemas','recuperar-senha','auth','/auth', 'Como recuperar senha',
    'Enviar link de redefinição.',
    E'## Passo a passo\n1. Na tela de acesso, clique em **Esqueci minha senha**.\n2. Informe o e-mail.\n3. Abra o link recebido e escolha nova senha.',
    ARRAY['senha','login'], false, 4),

  -- Glossário
  ('glossario','termos','glossario',NULL, 'Glossário de termos',
    'Principais siglas e termos.',
    E'- **RDO**: Relatório Diário de Obra.\n- **Obra**: empreendimento em execução.\n- **Contrato**: vínculo comercial da obra com o cliente.\n- **Cliente**: contratante da obra.\n- **Responsável técnico**: engenheiro responsável.\n- **Ocorrência**: evento fora do planejado.\n- **Mão de obra**: profissionais alocados na obra.\n- **Equipamento**: máquina ou ferramenta usada.\n- **Atividade**: tarefa executada no dia.\n- **Lista de tarefas**: planejamento detalhado.\n- **Produtividade**: relação entre executado e planejado.\n- **Percentual realizado**: avanço da tarefa.\n- **Aprovação**: liberação formal do RDO.\n- **Revisão**: devolução para ajustes.\n- **Sincronização**: envio dos dados/arquivos ao servidor.\n- **OneDrive**: armazenamento em nuvem da Microsoft usado para anexos.\n- **PDF**: relatório em formato oficial para impressão.\n- **Exportação Excel**: dados em planilha.',
    ARRAY['glossario','termos'], false, 1)
) AS a(cat_slug, slug, module_key, route_path, title, summary, content, tags, is_featured, sort_order)
JOIN cats c ON c.slug = a.cat_slug;

-- =================================================================
-- SEED: Changelog inicial + tutorial guiado do RDO
-- =================================================================
INSERT INTO public.system_changelog (empresa_id, version, change_type, title, description, how_to_use, module_key, route_path)
VALUES
  (NULL, '1.0.0', 'novo', 'Módulo de Ajuda / Manual do Sistema',
   'Novo manual interativo com busca, artigos por módulo, tutoriais guiados, FAQ, glossário, changelog e ajuda contextual.',
   'Acesse pelo menu Ajuda para começar. Cada tela também traz um botão "?" para ajuda rápida.',
   'ajuda', '/ajuda'),
  (NULL, '1.0.0', 'melhoria', 'Cache de coordenadas da obra',
   'As coordenadas (lat/lng) da obra ficam em cache para acelerar o carregamento do clima no RDO.',
   'Nada precisa ser feito. Use o botão "Atualizar clima" no RDO para forçar novo cálculo.',
   'rdo', '/rdo');

-- Tutorial guiado: novo RDO
DO $$
DECLARE v_tut uuid;
BEGIN
  INSERT INTO public.help_tutorials (empresa_id, slug, module_key, route_path, title, description, active)
  VALUES (NULL, 'novo-rdo', 'rdo', '/rdo/novo', 'Como criar seu primeiro RDO',
          'Passo a passo guiado para criar um relatório diário de obra.', true)
  RETURNING id INTO v_tut;

  INSERT INTO public.help_tutorial_steps (tutorial_id, step_order, selector, title, description, position, action_required) VALUES
    (v_tut, 1, '[data-help="rdo-select-obra"]',  'Selecione a obra',      'Escolha a obra do relatório.', 'bottom', true),
    (v_tut, 2, '[data-help="rdo-data"]',         'Confirme a data',       'A data padrão é hoje. Ajuste se precisar.', 'bottom', false),
    (v_tut, 3, '[data-help="rdo-clima"]',        'Condição climática',    'O clima é sugerido automaticamente pela localização da obra.', 'top', false),
    (v_tut, 4, '[data-help="rdo-mao-de-obra"]',  'Mão de obra',           'Adicione as funções e quantidades presentes hoje.', 'top', false),
    (v_tut, 5, '[data-help="rdo-atividades"]',   'Atividades',            'Descreva as atividades executadas e o percentual.', 'top', false),
    (v_tut, 6, '[data-help="rdo-anexos"]',       'Fotos e anexos',        'Envie fotos, vídeos e documentos do dia.', 'top', false),
    (v_tut, 7, '[data-help="rdo-enviar"]',       'Enviar para aprovação', 'Salve como rascunho ou envie para o aprovador.', 'top', true);
END $$;
