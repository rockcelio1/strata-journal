
ALTER TABLE public.lista_tarefas_itens
  ADD COLUMN IF NOT EXISTS obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS lista_tarefas_itens_obra_idx ON public.lista_tarefas_itens(obra_id, ordem);

CREATE TABLE IF NOT EXISTS public.lista_tarefas_progresso_hist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.lista_tarefas_itens(id) ON DELETE CASCADE,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  percentual_anterior numeric,
  percentual_novo numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.lista_tarefas_progresso_hist TO authenticated;
GRANT ALL ON public.lista_tarefas_progresso_hist TO service_role;

ALTER TABLE public.lista_tarefas_progresso_hist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa members can select hist" ON public.lista_tarefas_progresso_hist
FOR SELECT TO authenticated
USING (empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS lista_tarefas_hist_item_idx ON public.lista_tarefas_progresso_hist(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lista_tarefas_hist_empresa_idx ON public.lista_tarefas_progresso_hist(empresa_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.tg_lista_tarefas_log_progresso()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.percentual IS NOT NULL AND NEW.percentual <> 0 THEN
    INSERT INTO public.lista_tarefas_progresso_hist(empresa_id, item_id, obra_id, autor_id, percentual_anterior, percentual_novo)
    VALUES (NEW.empresa_id, NEW.id, NEW.obra_id, auth.uid(), NULL, NEW.percentual);
  ELSIF TG_OP = 'UPDATE' AND NEW.percentual IS DISTINCT FROM OLD.percentual THEN
    INSERT INTO public.lista_tarefas_progresso_hist(empresa_id, item_id, obra_id, autor_id, percentual_anterior, percentual_novo)
    VALUES (NEW.empresa_id, NEW.id, NEW.obra_id, auth.uid(), OLD.percentual, NEW.percentual);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS lista_tarefas_log_progresso ON public.lista_tarefas_itens;
CREATE TRIGGER lista_tarefas_log_progresso
AFTER INSERT OR UPDATE OF percentual ON public.lista_tarefas_itens
FOR EACH ROW EXECUTE FUNCTION public.tg_lista_tarefas_log_progresso();
