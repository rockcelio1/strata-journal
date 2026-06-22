-- Coluna opcional de legenda para fotos/anexos
ALTER TABLE public.rdo_anexos ADD COLUMN IF NOT EXISTS legenda text;

-- Garantir payloads completos no Realtime (necessário para mostrar autor, RDO e obra)
ALTER TABLE public.rdos           REPLICA IDENTITY FULL;
ALTER TABLE public.rdo_anexos     REPLICA IDENTITY FULL;
ALTER TABLE public.rdo_ocorrencias REPLICA IDENTITY FULL;

-- Adicionar à publicação de Realtime (idempotente)
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.rdos;            EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.rdo_anexos;      EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.rdo_ocorrencias; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;