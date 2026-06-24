
-- 1) Tabela de notificações in-app
CREATE TABLE public.notificacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  rdo_id UUID REFERENCES public.rdos(id) ON DELETE CASCADE,
  lida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user_unread ON public.notificacoes (user_id, lida_em, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário lê próprias notificações"
  ON public.notificacoes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Usuário marca/apaga próprias notificações"
  ON public.notificacoes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuário apaga próprias notificações"
  ON public.notificacoes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 2) Trigger: ao exigir signatário(s), notifica cada usuário-alvo
CREATE OR REPLACE FUNCTION public.tg_notify_signatario_requerido()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp UUID;
  v_obra TEXT;
  v_data DATE;
  r RECORD;
BEGIN
  SELECT r.empresa_id, o.nome, r.data INTO v_emp, v_obra, v_data
    FROM public.rdos r LEFT JOIN public.obras o ON o.id = r.obra_id
    WHERE r.id = NEW.rdo_id;

  IF NEW.sujeito_tipo = 'user' THEN
    INSERT INTO public.notificacoes (empresa_id, user_id, tipo, titulo, mensagem, rdo_id)
    VALUES (v_emp, NEW.sujeito_id, 'rdo_pendente_assinatura',
            'RDO pendente para sua assinatura',
            COALESCE('Obra: '||v_obra,'RDO')||' — '||COALESCE(v_data::text,''), NEW.rdo_id);
  ELSIF NEW.sujeito_tipo = 'grupo' THEN
    FOR r IN SELECT user_id FROM public.grupo_membros WHERE grupo_id = NEW.sujeito_id LOOP
      INSERT INTO public.notificacoes (empresa_id, user_id, tipo, titulo, mensagem, rdo_id)
      VALUES (v_emp, r.user_id, 'rdo_pendente_assinatura',
              'RDO pendente para sua assinatura',
              COALESCE('Obra: '||v_obra,'RDO')||' — '||COALESCE(v_data::text,''), NEW.rdo_id);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_notify_signatario_requerido
AFTER INSERT ON public.rdo_signatarios_requeridos
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_signatario_requerido();

-- 3) Trigger: ao assinar, notifica o autor do RDO
CREATE OR REPLACE FUNCTION public.tg_notify_rdo_assinado()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_autor UUID; v_emp UUID; v_obra TEXT; v_pend INT;
BEGIN
  SELECT r.autor_id, r.empresa_id, o.nome INTO v_autor, v_emp, v_obra
    FROM public.rdos r LEFT JOIN public.obras o ON o.id = r.obra_id
    WHERE r.id = NEW.rdo_id;

  IF v_autor IS NOT NULL AND v_autor <> NEW.user_id THEN
    INSERT INTO public.notificacoes (empresa_id, user_id, tipo, titulo, mensagem, rdo_id)
    VALUES (v_emp, v_autor, 'rdo_nova_assinatura',
            'Nova assinatura coletada',
            COALESCE('Obra: '||v_obra,'RDO')||' recebeu uma nova assinatura.', NEW.rdo_id);
  END IF;

  SELECT count(*) INTO v_pend FROM public.rdo_signatarios_pendentes(NEW.rdo_id);
  IF v_pend = 0 AND v_autor IS NOT NULL THEN
    INSERT INTO public.notificacoes (empresa_id, user_id, tipo, titulo, mensagem, rdo_id)
    VALUES (v_emp, v_autor, 'rdo_totalmente_assinado',
            'RDO totalmente assinado',
            COALESCE('Obra: '||v_obra,'RDO')||' teve todas as assinaturas coletadas.', NEW.rdo_id);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_notify_rdo_assinado
AFTER INSERT ON public.rdo_assinaturas
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_rdo_assinado();
