
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.lista_tarefas_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.lista_tarefas_itens(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  is_etapa boolean NOT NULL DEFAULT false,
  percentual numeric NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lista_tarefas_itens TO authenticated;
GRANT ALL ON public.lista_tarefas_itens TO service_role;

ALTER TABLE public.lista_tarefas_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa members can select" ON public.lista_tarefas_itens
FOR SELECT TO authenticated
USING (empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "empresa members can insert" ON public.lista_tarefas_itens
FOR INSERT TO authenticated
WITH CHECK (empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "empresa members can update" ON public.lista_tarefas_itens
FOR UPDATE TO authenticated
USING (empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()))
WITH CHECK (empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "empresa members can delete" ON public.lista_tarefas_itens
FOR DELETE TO authenticated
USING (empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX lista_tarefas_itens_empresa_ordem_idx ON public.lista_tarefas_itens(empresa_id, ordem);
CREATE INDEX lista_tarefas_itens_parent_idx ON public.lista_tarefas_itens(parent_id);

CREATE TRIGGER lista_tarefas_itens_updated_at
BEFORE UPDATE ON public.lista_tarefas_itens
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
