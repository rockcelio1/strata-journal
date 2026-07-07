CREATE INDEX IF NOT EXISTS idx_rdos_empresa_deleted_data_desc
  ON public.rdos (empresa_id, deleted_at, data DESC);

CREATE INDEX IF NOT EXISTS idx_rdos_autor_status_deleted
  ON public.rdos (autor_id, status, deleted_at);

CREATE INDEX IF NOT EXISTS idx_rdo_assinaturas_rdo_user
  ON public.rdo_assinaturas (rdo_id, user_id);

CREATE INDEX IF NOT EXISTS idx_rdo_anexos_rdo_ordem_created
  ON public.rdo_anexos (rdo_id, ordem, created_at);