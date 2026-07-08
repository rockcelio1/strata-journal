
-- 1) Endurecer INSERT em help_search_logs para exigir empresa e usuário coerentes
DROP POLICY IF EXISTS "search_logs_insert_self" ON public.help_search_logs;
CREATE POLICY "search_logs_insert_self" ON public.help_search_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (empresa_id IS NULL OR empresa_id = private.get_user_empresa(auth.uid()))
  );

-- Permitir UPDATE de clicked_article_id pelo próprio autor do log
DROP POLICY IF EXISTS "search_logs_update_own" ON public.help_search_logs;
CREATE POLICY "search_logs_update_own" ON public.help_search_logs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_help_search_logs_empresa_created
  ON public.help_search_logs (empresa_id, created_at DESC);

-- 2) Categoria FAQ
INSERT INTO public.help_categories (empresa_id, slug, name, description, icon, sort_order, active)
SELECT NULL, 'faq', 'Perguntas Frequentes', 'Respostas rápidas para dúvidas comuns do dia a dia.', 'LifeBuoy', 200, true
WHERE NOT EXISTS (SELECT 1 FROM public.help_categories WHERE slug = 'faq');

-- 3) Seed FAQ (15 artigos publicados)
WITH cat AS (SELECT id FROM public.help_categories WHERE slug='faq' LIMIT 1)
INSERT INTO public.help_articles
  (empresa_id, category_id, slug, module_key, title, summary, content, tags, status, is_featured, sort_order, published_at)
SELECT NULL, cat.id, x.slug, 'faq', x.title, x.summary, x.content, ARRAY['faq'], 'publicado', false, x.ord, now()
FROM cat, (VALUES
  (1,'faq-esqueci-senha','Esqueci minha senha, e agora?','Passo a passo para redefinir sua senha.',
   E'1. Na tela de login, clique em **Esqueci minha senha**.\n2. Informe seu e-mail cadastrado.\n3. Abra o link enviado no e-mail e defina uma nova senha.\n\nSe não receber o e-mail, confira a caixa de spam ou peça ao administrador para reenviar o convite.'),
  (2,'faq-cadastrar-obra','Como cadastrar uma nova obra?','Fluxo de criação de obra.',
   E'Acesse **Obras > Nova obra**, preencha nome, endereço e responsáveis, salve. A obra passa a aparecer em RDO e Cadastros.'),
  (3,'faq-criar-rdo','Como criar um RDO?','Fluxo de criação de um Relatório Diário de Obras.',
   E'1. Vá em **RDO > Novo RDO**.\n2. Escolha a **obra** e a **data**.\n3. Preencha clima, mão de obra, equipamentos, atividades, ocorrências e anexos.\n4. Salve como rascunho ou envie para aprovação.'),
  (4,'faq-editar-rdo-enviado','Posso editar um RDO já enviado?','Regras de edição por status.',
   E'RDO em **rascunho** pode ser editado livremente pelo autor. Após **enviado**, apenas administradores ou usuários master podem editar (função "Editar (admin)").'),
  (5,'faq-excluir-rdo','Como excluir um RDO?','Quem pode excluir e quando.',
   E'O autor pode excluir apenas RDOs em rascunho. Administradores/master podem soft-deletar qualquer RDO. A exclusão é reversível pelo master via auditoria.'),
  (6,'faq-anexar-fotos','Como anexar fotos ao RDO?','Upload direto ou por câmera.',
   E'No RDO, seção **Anexos**, arraste imagens ou use o botão **Câmera** no tablet. Cada foto é comprimida automaticamente antes do envio.'),
  (7,'faq-assinar-rdo','Como assinar um RDO?','Fluxo de assinatura eletrônica.',
   E'Abra o RDO, role até **Assinaturas**, desenhe sua assinatura no campo e confirme. Signatários pendentes recebem notificação.'),
  (8,'faq-notificacoes','Não estou recebendo notificações','Como habilitar alertas.',
   E'Verifique **Configurações > Aplicativo** e permita notificações do navegador. Em tablets, instale o app como PWA para receber alertas.'),
  (9,'faq-permissoes','Não consigo acessar um módulo','Verifique suas permissões.',
   E'Peça ao administrador para ajustar seu perfil em **Configurações > Permissões**. Cada função tem acesso a módulos específicos.'),
  (10,'faq-onedrive','Como conectar o OneDrive?','Integração para armazenamento externo.',
   E'Em **Configurações > OneDrive**, clique em **Conectar** e autentique-se na sua conta Microsoft. Novos anexos passam a ir para lá automaticamente.'),
  (11,'faq-exportar-pdf','Como exportar o RDO em PDF?','Gerar documento final.',
   E'Abra o RDO e clique em **Exportar > PDF**. O arquivo é gerado com layout oficial, pronto para envio.'),
  (12,'faq-galeria','Não vejo as imagens na Galeria','Possíveis causas.',
   E'Verifique se a obra está selecionada corretamente. Se as imagens estão no OneDrive, o sistema busca via proxy — aguarde alguns segundos ou clique em atualizar.'),
  (13,'faq-clima','O clima não aparece no RDO','Como corrigir.',
   E'O clima é obtido pela **localização da obra**. Cadastre o endereço em Obras. Você também pode clicar em **Atualizar clima** dentro do RDO.'),
  (14,'faq-convidar-usuario','Como convidar um novo usuário?','Fluxo de convites.',
   E'Em **Configurações > Usuários**, clique em **Convidar**. Informe o e-mail e a função. O convidado recebe um link para criar a senha.'),
  (15,'faq-instalar-app','Como instalar o app no tablet?','Instalação PWA.',
   E'Abra o sistema no Chrome/Edge do tablet e toque em **Instalar aplicativo** no menu do navegador. O ícone aparece na tela inicial.')
) AS x(ord, slug, title, summary, content)
WHERE NOT EXISTS (SELECT 1 FROM public.help_articles a WHERE a.slug = x.slug);

-- 4) Seed Glossário (20 termos publicados)
WITH cat AS (SELECT id FROM public.help_categories WHERE slug='glossario' LIMIT 1)
INSERT INTO public.help_articles
  (empresa_id, category_id, slug, module_key, title, summary, content, tags, status, is_featured, sort_order, published_at)
SELECT NULL, cat.id, x.slug, 'glossario', x.title, x.summary, x.content, ARRAY['glossario'], 'publicado', false, x.ord, now()
FROM cat, (VALUES
  (1,'glossario-rdo','RDO','Relatório Diário de Obras.',
   E'Documento oficial que registra tudo que aconteceu na obra em um dia: clima, efetivo, equipamentos, atividades, ocorrências e evidências.'),
  (2,'glossario-obra','Obra','Empreendimento cadastrado no sistema.',
   E'Unidade principal do sistema. Cada RDO, foto e tarefa está vinculada a uma obra.'),
  (3,'glossario-anexo','Anexo','Arquivo enviado junto ao RDO.',
   E'Imagens, vídeos, PDFs ou assinaturas armazenados no Supabase Storage ou no OneDrive.'),
  (4,'glossario-assinatura','Assinatura','Confirmação eletrônica do RDO.',
   E'Traço desenhado pelo signatário que fica registrado no PDF final e no histórico de auditoria.'),
  (5,'glossario-empresa','Empresa','Tenant do sistema.',
   E'Cada empresa tem seus próprios usuários, obras e dados isolados por RLS.'),
  (6,'glossario-mao-de-obra','Mão de obra','Efetivo lançado no RDO.',
   E'Lista de funções e quantidades de trabalhadores presentes no dia por disciplina.'),
  (7,'glossario-equipamento','Equipamento','Recurso mecânico ou elétrico usado na obra.',
   E'Ex.: escavadeira, gerador, munck. Pode controlar horas e/ou quantidade.'),
  (8,'glossario-ocorrencia','Ocorrência','Evento que impactou a produção.',
   E'Ex.: chuva, falta de material, greve. Classificada por tipo e descrita no RDO.'),
  (9,'glossario-atividade','Atividade','Tarefa executada no dia.',
   E'Descrição livre ou vinculada a itens da Lista de Tarefas, com percentual de avanço.'),
  (10,'glossario-lista-tarefas','Lista de Tarefas','Escopo planejado da obra.',
   E'Estrutura hierárquica de tarefas que serve de base para lançar avanços diários.'),
  (11,'glossario-template','Template de Tarefas','Modelo reutilizável.',
   E'Conjunto de itens que pode ser aplicado a várias obras semelhantes.'),
  (12,'glossario-grupo','Grupo','Coleção de usuários.',
   E'Usado para atribuir signatários e permissões em bloco.'),
  (13,'glossario-permissao','Permissão','Autorização por recurso e ação.',
   E'Combina papel (admin, master, user) e overrides individuais por recurso.'),
  (14,'glossario-master','Master','Perfil com acesso total.',
   E'Pode editar/excluir qualquer RDO, gerenciar permissões e ver auditoria.'),
  (15,'glossario-admin','Administrador','Perfil de gestão da empresa.',
   E'Gerencia usuários, obras e cadastros; edita RDOs além do próprio.'),
  (16,'glossario-rls','RLS','Row-Level Security.',
   E'Regras do banco que garantem que cada usuário só vê os dados da sua empresa.'),
  (17,'glossario-onedrive','OneDrive','Armazenamento externo Microsoft.',
   E'Alternativa ao storage nativo para guardar anexos, controlada por conector.'),
  (18,'glossario-pwa','PWA','Progressive Web App.',
   E'Permite instalar o sistema como aplicativo no tablet/celular, com atalho e notificações.'),
  (19,'glossario-changelog','Changelog','Histórico de novidades.',
   E'Lista de mudanças e novas funcionalidades publicadas em Ajuda > Novidades.'),
  (20,'glossario-tutorial','Tutorial','Guia interativo passo a passo.',
   E'Sequência de balões que destaca elementos da tela para ensinar um fluxo.')
) AS x(ord, slug, title, summary, content)
WHERE NOT EXISTS (SELECT 1 FROM public.help_articles a WHERE a.slug = x.slug);
