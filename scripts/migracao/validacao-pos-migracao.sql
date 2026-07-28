-- =====================================================================
-- VALIDAÇÃO PÓS-MIGRAÇÃO — Lovable Cloud → Supabase Externo
-- Executar no SQL Editor do NOVO projeto Supabase, depois do restore.
-- Cada bloco imprime um relatório; qualquer linha marcada "FALHA" exige ação.
-- =====================================================================

-- --------------------------------------------------------------------
-- 1) Contagem de linhas por tabela pública (comparar com o projeto antigo)
-- --------------------------------------------------------------------
-- No projeto ANTIGO rode a mesma query e compare os totais linha a linha.
SELECT schemaname, relname AS tabela, n_live_tup AS linhas
  FROM pg_stat_user_tables
 WHERE schemaname = 'public'
 ORDER BY relname;

-- --------------------------------------------------------------------
-- 2) Tabelas públicas sem RLS habilitado  (deve retornar 0 linhas)
-- --------------------------------------------------------------------
SELECT n.nspname AS schema, c.relname AS tabela,
       'FALHA: RLS DESABILITADO' AS status
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND c.relrowsecurity = false
 ORDER BY c.relname;

-- --------------------------------------------------------------------
-- 3) Tabelas públicas SEM policies  (potencial bloqueio total)
-- --------------------------------------------------------------------
SELECT c.relname AS tabela,
       (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname='public' AND p.tablename=c.relname) AS n_policies
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r'
 HAVING (SELECT count(*) FROM pg_policies p
          WHERE p.schemaname='public' AND p.tablename=c.relname) = 0
 ORDER BY c.relname;

-- --------------------------------------------------------------------
-- 4) GRANTs faltando para authenticated/anon/service_role
--    (PostgREST 401/permission denied costuma vir daqui)
-- --------------------------------------------------------------------
WITH tabs AS (
  SELECT c.relname AS tabela
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r'
)
SELECT t.tabela,
       has_table_privilege('authenticated', 'public.'||t.tabela, 'SELECT') AS auth_select,
       has_table_privilege('authenticated', 'public.'||t.tabela, 'INSERT') AS auth_insert,
       has_table_privilege('service_role',  'public.'||t.tabela, 'SELECT') AS svc_select
  FROM tabs t
 ORDER BY t.tabela;

-- --------------------------------------------------------------------
-- 5) Enums presentes  (todos os app_* devem existir)
-- --------------------------------------------------------------------
SELECT t.typname AS enum_name, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  JOIN pg_namespace n ON n.oid = t.typnamespace
 WHERE n.nspname = 'public'
 GROUP BY t.typname
 ORDER BY t.typname;

-- --------------------------------------------------------------------
-- 6) Funções críticas presentes e SECURITY DEFINER onde é esperado
-- --------------------------------------------------------------------
SELECT p.proname,
       CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END AS security
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
   AND p.proname IN (
     'has_role','has_permission','has_admin_access','handle_new_user',
     'check_rate_limit','check_ai_quota','check_ip_rate_limit',
     'soft_delete_rdo','admin_soft_delete_rdo','admin_disable_rdo',
     'admin_update_rdo_basico','can_access_rdo','rdo_signatarios_pendentes',
     'seed_equipamentos_padrao','seed_mao_de_obra_padrao','seed_tipos_ocorrencia_padrao'
   )
 ORDER BY p.proname;

-- --------------------------------------------------------------------
-- 7) Trigger handle_new_user ligado em auth.users
-- --------------------------------------------------------------------
SELECT tgname, tgrelid::regclass AS tabela, tgenabled
  FROM pg_trigger
 WHERE tgname = 'on_auth_user_created';
-- Se não retornar, recrie:
--   CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------------------
-- 8) Integridade referencial — órfãos em tabelas-chave
-- --------------------------------------------------------------------
SELECT 'rdos sem empresa' AS check_name, count(*) AS n
  FROM public.rdos r LEFT JOIN public.empresas e ON e.id=r.empresa_id
 WHERE e.id IS NULL
UNION ALL SELECT 'rdos sem obra',       count(*) FROM public.rdos r LEFT JOIN public.obras o ON o.id=r.obra_id WHERE o.id IS NULL
UNION ALL SELECT 'profiles sem empresa',count(*) FROM public.profiles p LEFT JOIN public.empresas e ON e.id=p.empresa_id WHERE e.id IS NULL
UNION ALL SELECT 'user_roles sem user', count(*) FROM public.user_roles ur LEFT JOIN auth.users u ON u.id=ur.user_id WHERE u.id IS NULL
UNION ALL SELECT 'rdo_anexos sem rdo',  count(*) FROM public.rdo_anexos a LEFT JOIN public.rdos r ON r.id=a.rdo_id WHERE r.id IS NULL;

-- --------------------------------------------------------------------
-- 9) Storage — buckets e contagem de objetos
-- --------------------------------------------------------------------
SELECT b.id AS bucket, b.public,
       (SELECT count(*) FROM storage.objects o WHERE o.bucket_id = b.id) AS n_objetos
  FROM storage.buckets b
 WHERE b.id IN ('rdo-anexos','empresa-logos','obra-fotos')
 ORDER BY b.id;

-- --------------------------------------------------------------------
-- 10) Anexos com storage_path que NÃO existem em storage.objects
--     (arquivos perdidos na cópia entre projetos)
-- --------------------------------------------------------------------
SELECT 'rdo_anexos' AS tabela, count(*) AS orfaos
  FROM public.rdo_anexos a
 WHERE a.storage_provider = 'supabase'
   AND NOT EXISTS (
     SELECT 1 FROM storage.objects o
      WHERE o.bucket_id='rdo-anexos' AND o.name = a.storage_path
   )
UNION ALL
SELECT 'obra_fotos', count(*)
  FROM public.obra_fotos f
 WHERE NOT EXISTS (
   SELECT 1 FROM storage.objects o
    WHERE o.bucket_id='obra-fotos' AND o.name = f.storage_path
 )
UNION ALL
SELECT 'empresas.logo', count(*)
  FROM public.empresas e
 WHERE e.logo_url IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM storage.objects o WHERE o.bucket_id='empresa-logos'
   );

-- --------------------------------------------------------------------
-- 11) Teste de leitura como usuário autenticado (simular RLS)
--     Substitua <UUID> pelo id de um usuário real de teste.
-- --------------------------------------------------------------------
-- SET LOCAL role authenticated;
-- SET LOCAL "request.jwt.claims" = '{"sub":"<UUID>","role":"authenticated"}';
-- SELECT count(*) AS rdos_visiveis FROM public.rdos;
-- SELECT count(*) AS obras_visiveis FROM public.obras;
-- RESET role;

-- --------------------------------------------------------------------
-- 12) URL assinada para anexo (visualização end-to-end)
--     No app, abra um RDO com anexos e confirme que a miniatura carrega.
--     Se falhar: verificar bucket privado + policies em storage.objects.
-- --------------------------------------------------------------------
SELECT 'ok — validacao concluida' AS status;
