
-- ============ SEED: MÃO DE OBRA (disciplinas + funções) ============
CREATE OR REPLACE FUNCTION public.seed_mao_de_obra_padrao()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_empresa uuid;
  v_count integer := 0;
  r record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='28000'; END IF;
  SELECT empresa_id INTO v_empresa FROM public.profiles WHERE id = v_uid;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT (private.has_role(v_uid,'admin'::app_role) OR private.has_role(v_uid,'master'::app_role)) THEN
    RAISE EXCEPTION 'Apenas administrador ou master podem executar seed' USING ERRCODE='42501';
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('Civil','Armador'),('Civil','Auxiliar de Obras'),('Civil','Carpinteiro'),
      ('Civil','Encarregado'),('Civil','Marteleteiro'),('Civil','Oficial Polivalente'),
      ('Civil','Operador de Caminhão Munck'),('Civil','Operador de Retroescavadeira'),
      ('Civil','Operador de Caminhão Basculante / Bruck'),('Civil','Pedreiro'),('Civil','Sinaleiro'),
      ('Elétrica / Automação','Auxiliar de elétrica'),('Elétrica / Automação','Eletricista'),
      ('Elétrica / Automação','Instrumentista'),('Elétrica / Automação','Líder de elétrica'),
      ('Montagem Mecânica','Ajudante de montagem'),('Montagem Mecânica','Encanador'),
      ('Montagem Mecânica','Líder de montagem'),('Montagem Mecânica','Mecânico montador'),
      ('Montagem Mecânica','Serralheiro'),('Montagem Mecânica','Soldador / Maçariqueiro'),
      ('Equipe de Apoio','Auxiliar de andaime'),('Equipe de Apoio','Auxiliar de topógrafo'),
      ('Equipe de Apoio','Montador de andaime'),('Equipe de Apoio','Topógrafo'),
      ('Terceiros','Georadar'),('Terceiros','Operador de Perfuratriz')
    ) AS t(disciplina, funcao)
  LOOP
    INSERT INTO public.mao_de_obra (empresa_id, nome, funcao, disciplina, ativo)
    SELECT v_empresa, r.funcao, r.funcao, r.disciplina, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.mao_de_obra
       WHERE empresa_id = v_empresa AND lower(nome) = lower(r.funcao)
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END LOOP;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.seed_mao_de_obra_padrao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_mao_de_obra_padrao() TO authenticated;

-- ============ SEED: EQUIPAMENTOS ============
CREATE OR REPLACE FUNCTION public.seed_equipamentos_padrao()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_empresa uuid;
  v_ins integer := 0;
  r record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='28000'; END IF;
  SELECT empresa_id INTO v_empresa FROM public.profiles WHERE id = v_uid;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT (private.has_role(v_uid,'admin'::app_role) OR private.has_role(v_uid,'master'::app_role)) THEN
    RAISE EXCEPTION 'Apenas administrador ou master podem executar seed' USING ERRCODE='42501';
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('Caminhão Basculante / Bruck','Transporte','Civil',true,false),
      ('Caminhão Munck','Transporte','Civil',true,true),
      ('Compactador','Compactação','Civil',true,false),
      ('Escavadeira Hidráulica','Terraplanagem','Civil',true,false),
      ('Gerador','Energia','Elétrica / Automação',true,true),
      ('Máquina de Solda PEAD','Solda','Montagem Mecânica',true,false),
      ('Perfuratriz Elétrica','Perfuração','Civil',true,false),
      ('Perfuratriz Estaca','Fundação','Civil',true,false),
      ('Pá Carregadeira','Terraplanagem','Civil',true,false),
      ('Retroescavadeira','Terraplanagem','Civil',true,false),
      ('Rompedor elétrico/Pneumático','Demolição','Civil',true,true)
    ) AS t(nome, tipo, disciplina, controla_horas, controla_quantidade)
  LOOP
    INSERT INTO public.equipamentos (empresa_id, nome, tipo, disciplina, controla_horas, controla_quantidade, ativo)
    SELECT v_empresa, r.nome, r.tipo, r.disciplina, r.controla_horas, r.controla_quantidade, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.equipamentos
       WHERE empresa_id = v_empresa AND lower(nome) = lower(r.nome)
    );
    GET DIAGNOSTICS v_ins = ROW_COUNT;
  END LOOP;
  RETURN v_ins;
END $$;
REVOKE ALL ON FUNCTION public.seed_equipamentos_padrao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_equipamentos_padrao() TO authenticated;

-- ============ SEED: TIPOS DE OCORRÊNCIA ============
CREATE OR REPLACE FUNCTION public.seed_tipos_ocorrencia_padrao()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_empresa uuid;
  v_ins integer := 0;
  r record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='28000'; END IF;
  SELECT empresa_id INTO v_empresa FROM public.profiles WHERE id = v_uid;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT (private.has_role(v_uid,'admin'::app_role) OR private.has_role(v_uid,'master'::app_role)) THEN
    RAISE EXCEPTION 'Apenas administrador ou master podem executar seed' USING ERRCODE='42501';
  END IF;

  FOR r IN
    SELECT unnest(ARRAY[
      'Aguardando liberação da área','Área alagada','Atraso dos ônibus','Chuva',
      'Falta de equipamento','Falta de material','Falta de mão de obra','Greve',
      'PTS - Atraso na abertura','PTS - Sem abertura','Paradão da Segurança',
      'Solicitações fora do escopo','Solicitações do cliente'
    ]) AS nome
  LOOP
    INSERT INTO public.tipos_ocorrencia (empresa_id, nome, ativo)
    SELECT v_empresa, r.nome, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tipos_ocorrencia
       WHERE empresa_id = v_empresa AND lower(nome) = lower(r.nome)
    );
    GET DIAGNOSTICS v_ins = ROW_COUNT;
  END LOOP;
  RETURN v_ins;
END $$;
REVOKE ALL ON FUNCTION public.seed_tipos_ocorrencia_padrao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_tipos_ocorrencia_padrao() TO authenticated;
