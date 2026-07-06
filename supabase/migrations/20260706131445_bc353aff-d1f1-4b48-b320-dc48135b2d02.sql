
ALTER TABLE public.rdo_anexos ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_rdo_anexos_rdo_ordem ON public.rdo_anexos(rdo_id, ordem);

CREATE TABLE IF NOT EXISTS public.rdo_anexos_hist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  rdo_id uuid NOT NULL,
  anexo_id uuid,
  autor_id uuid,
  acao text NOT NULL,
  detalhes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rdo_anexos_hist_rdo ON public.rdo_anexos_hist(rdo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rdo_anexos_hist_empresa ON public.rdo_anexos_hist(empresa_id, created_at DESC);

GRANT SELECT, INSERT ON public.rdo_anexos_hist TO authenticated;
GRANT ALL ON public.rdo_anexos_hist TO service_role;

ALTER TABLE public.rdo_anexos_hist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empresa_read_anexos_hist" ON public.rdo_anexos_hist;
CREATE POLICY "empresa_read_anexos_hist" ON public.rdo_anexos_hist
  FOR SELECT TO authenticated
  USING (empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_rdo_anexos_hist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_det jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.rdo_anexos_hist(empresa_id, rdo_id, anexo_id, autor_id, acao, detalhes)
    VALUES (NEW.empresa_id, NEW.rdo_id, NEW.id, auth.uid(), 'upload',
            jsonb_build_object('nome', NEW.nome, 'legenda', NEW.legenda, 'ordem', NEW.ordem));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_det := jsonb_build_object();
    IF NEW.legenda IS DISTINCT FROM OLD.legenda THEN
      v_det := v_det || jsonb_build_object('legenda_ant', OLD.legenda, 'legenda_novo', NEW.legenda);
    END IF;
    IF NEW.ordem IS DISTINCT FROM OLD.ordem THEN
      v_det := v_det || jsonb_build_object('ordem_ant', OLD.ordem, 'ordem_novo', NEW.ordem);
    END IF;
    IF v_det <> '{}'::jsonb THEN
      INSERT INTO public.rdo_anexos_hist(empresa_id, rdo_id, anexo_id, autor_id, acao, detalhes)
      VALUES (NEW.empresa_id, NEW.rdo_id, NEW.id, auth.uid(),
              CASE WHEN NEW.ordem IS DISTINCT FROM OLD.ordem AND NEW.legenda IS NOT DISTINCT FROM OLD.legenda
                   THEN 'reordenado' ELSE 'editado' END,
              v_det);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.rdo_anexos_hist(empresa_id, rdo_id, anexo_id, autor_id, acao, detalhes)
    VALUES (OLD.empresa_id, OLD.rdo_id, OLD.id, auth.uid(), 'removido',
            jsonb_build_object('nome', OLD.nome, 'legenda', OLD.legenda));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_rdo_anexos_hist ON public.rdo_anexos;
CREATE TRIGGER trg_rdo_anexos_hist
AFTER INSERT OR UPDATE OR DELETE ON public.rdo_anexos
FOR EACH ROW EXECUTE FUNCTION public.tg_rdo_anexos_hist();
