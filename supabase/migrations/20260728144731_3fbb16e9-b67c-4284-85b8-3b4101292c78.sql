-- 1) Schedules: tipo e última execução
ALTER TABLE public.backup_schedules
  ADD COLUMN IF NOT EXISTS tipo_backup text NOT NULL DEFAULT 'incremental' CHECK (tipo_backup IN ('full','incremental')),
  ADD COLUMN IF NOT EXISTS ultima_execucao timestamptz,
  ADD COLUMN IF NOT EXISTS alerta_100mb boolean NOT NULL DEFAULT true;

-- 2) History: tipo e janela incremental
ALTER TABLE public.backup_history
  ADD COLUMN IF NOT EXISTS tipo_backup text CHECK (tipo_backup IN ('full','incremental')),
  ADD COLUMN IF NOT EXISTS since_iso timestamptz;

-- 3) Empresas: controle do alerta 100MB
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS alerta_backup_ultimo_envio timestamptz;

-- 4) Função de estimativa (rows + bytes) por tabela
CREATE OR REPLACE FUNCTION public.backup_estimate(
  _empresa uuid,
  _tables text[],
  _since timestamptz DEFAULT NULL
)
RETURNS TABLE(table_name text, row_count bigint, bytes bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t text;
  q text;
  filter_col text;
  where_clause text;
  r record;
BEGIN
  -- Somente admin/master da empresa
  IF NOT (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'master'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501';
  END IF;
  IF (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()) <> _empresa THEN
    RAISE EXCEPTION 'Empresa incorreta' USING ERRCODE='42501';
  END IF;

  FOREACH t IN ARRAY _tables LOOP
    -- Confere existência da tabela em public
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = t) THEN
      table_name := t; row_count := 0; bytes := 0; RETURN NEXT; CONTINUE;
    END IF;

    -- Coluna de janela incremental
    filter_col := NULL;
    IF _since IS NOT NULL THEN
      SELECT column_name INTO filter_col
        FROM information_schema.columns
       WHERE table_schema='public' AND table_name=t AND column_name IN ('updated_at','created_at')
       ORDER BY CASE column_name WHEN 'updated_at' THEN 1 ELSE 2 END
       LIMIT 1;
    END IF;

    where_clause := CASE
      WHEN t = 'empresas' THEN format('id = %L', _empresa)
      ELSE format('empresa_id = %L', _empresa)
    END;
    IF filter_col IS NOT NULL THEN
      where_clause := where_clause || format(' AND %I >= %L', filter_col, _since);
    END IF;

    q := format(
      'SELECT count(*)::bigint AS c, COALESCE(sum(pg_column_size(x.*))::bigint,0) AS b FROM public.%I x WHERE %s',
      t, where_clause
    );
    BEGIN
      EXECUTE q INTO r;
      table_name := t;
      row_count := r.c;
      bytes := r.b;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      table_name := t; row_count := 0; bytes := 0; RETURN NEXT;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.backup_estimate(uuid, text[], timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backup_estimate(uuid, text[], timestamptz) TO authenticated;

-- 5) Alerta de 100MB desde o último backup — dispara notificação para admins/master
CREATE OR REPLACE FUNCTION public.backup_size_alert(_threshold_bytes bigint DEFAULT 104857600)
RETURNS TABLE(empresa_id uuid, delta_bytes bigint, notified boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e record;
  last_bak record;
  since timestamptz;
  total_delta bigint;
  tables text[];
  est record;
  admin_row record;
BEGIN
  tables := ARRAY[
    'obras','obra_anexos','obra_fotos','obra_equipamentos_permitidos','obra_funcoes_permitidas',
    'obra_listas_tarefas','obra_tarefa_itens',
    'rdos','rdo_atividades','rdo_equipamentos','rdo_mao_de_obra','rdo_ocorrencias','rdo_anexos',
    'rdo_assinaturas','rdo_signatarios_requeridos','rdo_tarefa_avancos','rdo_acessos',
    'equipamentos','mao_de_obra','tipos_ocorrencia',
    'templates_tarefas','template_tarefa_itens','lista_tarefas_itens',
    'grupos','grupo_membros',
    'profiles','user_roles','user_permission_overrides','role_permissions','convites',
    'empresas','empresa_logo_versions',
    'help_categories','help_articles','help_article_media','help_tutorials','help_tutorial_steps',
    'skeleton_loading_settings','button_effect_settings'
  ];

  FOR e IN SELECT id, alerta_backup_ultimo_envio FROM public.empresas LOOP
    -- último backup bem-sucedido
    SELECT created_at INTO last_bak
      FROM public.backup_history
     WHERE empresa_id = e.id AND operacao = 'backup' AND resultado = 'sucesso'
     ORDER BY created_at DESC LIMIT 1;

    since := COALESCE(last_bak.created_at, now() - interval '30 days');
    total_delta := 0;

    -- soma bytes de todas as tabelas desde o último backup
    FOR est IN
      SELECT * FROM public.backup_estimate_admin(e.id, tables, since)
    LOOP
      total_delta := total_delta + COALESCE(est.bytes,0);
    END LOOP;

    empresa_id := e.id;
    delta_bytes := total_delta;
    notified := false;

    IF total_delta >= _threshold_bytes
       AND (e.alerta_backup_ultimo_envio IS NULL OR e.alerta_backup_ultimo_envio < now() - interval '24 hours') THEN
      FOR admin_row IN
        SELECT ur.user_id FROM public.user_roles ur
         WHERE ur.empresa_id = e.id AND ur.role IN ('admin','master')
      LOOP
        INSERT INTO public.notificacoes(empresa_id, user_id, tipo, titulo, mensagem)
        VALUES (e.id, admin_row.user_id, 'backup_alerta_tamanho',
                'Backup recomendado',
                format('Foram acumulados %s MB de mudanças desde o último backup. Faça um novo backup ou ative agendamento.',
                       round(total_delta::numeric / (1024*1024), 1)));
      END LOOP;
      UPDATE public.empresas SET alerta_backup_ultimo_envio = now() WHERE id = e.id;
      notified := true;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$;

-- Versão admin (sem checagem de auth) — usada apenas pela função acima
CREATE OR REPLACE FUNCTION public.backup_estimate_admin(
  _empresa uuid,
  _tables text[],
  _since timestamptz DEFAULT NULL
)
RETURNS TABLE(table_name text, row_count bigint, bytes bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t text;
  q text;
  filter_col text;
  where_clause text;
  r record;
BEGIN
  FOREACH t IN ARRAY _tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = t) THEN
      table_name := t; row_count := 0; bytes := 0; RETURN NEXT; CONTINUE;
    END IF;
    filter_col := NULL;
    IF _since IS NOT NULL THEN
      SELECT column_name INTO filter_col
        FROM information_schema.columns
       WHERE table_schema='public' AND table_name=t AND column_name IN ('updated_at','created_at')
       ORDER BY CASE column_name WHEN 'updated_at' THEN 1 ELSE 2 END LIMIT 1;
    END IF;
    where_clause := CASE WHEN t='empresas' THEN format('id = %L', _empresa) ELSE format('empresa_id = %L', _empresa) END;
    IF filter_col IS NOT NULL THEN
      where_clause := where_clause || format(' AND %I >= %L', filter_col, _since);
    END IF;
    q := format('SELECT count(*)::bigint AS c, COALESCE(sum(pg_column_size(x.*))::bigint,0) AS b FROM public.%I x WHERE %s', t, where_clause);
    BEGIN
      EXECUTE q INTO r;
      table_name := t; row_count := r.c; bytes := r.b; RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      table_name := t; row_count := 0; bytes := 0; RETURN NEXT;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.backup_estimate_admin(uuid, text[], timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backup_size_alert(bigint) FROM PUBLIC;