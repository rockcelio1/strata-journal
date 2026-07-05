-- Vincula anexos do RDO a um item de tarefa (opcional)
ALTER TABLE public.rdo_anexos
  ADD COLUMN IF NOT EXISTS task_item_id uuid NULL
  REFERENCES public.obra_tarefa_itens(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rdo_anexos_task_item
  ON public.rdo_anexos(task_item_id);
