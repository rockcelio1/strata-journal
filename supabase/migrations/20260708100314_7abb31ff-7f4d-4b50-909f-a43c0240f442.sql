-- 1) media_load_events: cache HIT/MISS + tempo + status
CREATE TABLE public.media_load_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  onedrive_item_id text,
  thumb_size text,
  cache_status text NOT NULL CHECK (cache_status IN ('HIT','MISS','BYPASS','ERROR')),
  http_status integer,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mle_empresa_created ON public.media_load_events(empresa_id, created_at DESC);
CREATE INDEX idx_mle_item ON public.media_load_events(onedrive_item_id);

GRANT SELECT ON public.media_load_events TO authenticated;
GRANT ALL ON public.media_load_events TO service_role;
ALTER TABLE public.media_load_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_events_read_own_empresa" ON public.media_load_events
  FOR SELECT TO authenticated
  USING (empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

-- 2) onedrive_cache_settings: TTL/max-age por thumb_size
CREATE TABLE public.onedrive_cache_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  thumb_size text NOT NULL CHECK (thumb_size IN ('small','medium','large','full')),
  max_age_seconds integer NOT NULL DEFAULT 86400 CHECK (max_age_seconds >= 0),
  swr_seconds integer NOT NULL DEFAULT 604800 CHECK (swr_seconds >= 0),
  ttl_seconds integer NOT NULL DEFAULT 604800 CHECK (ttl_seconds >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, thumb_size)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onedrive_cache_settings TO authenticated;
GRANT ALL ON public.onedrive_cache_settings TO service_role;
GRANT SELECT ON public.onedrive_cache_settings TO anon;
ALTER TABLE public.onedrive_cache_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ocs_read_all" ON public.onedrive_cache_settings
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "ocs_admin_insert" ON public.onedrive_cache_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "ocs_admin_update" ON public.onedrive_cache_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "ocs_admin_delete" ON public.onedrive_cache_settings
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER trg_ocs_set_updated_at BEFORE UPDATE ON public.onedrive_cache_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Defaults globais (empresa_id = NULL)
INSERT INTO public.onedrive_cache_settings (empresa_id, thumb_size, max_age_seconds, swr_seconds, ttl_seconds) VALUES
  (NULL, 'small',  86400,  604800, 604800),
  (NULL, 'medium', 86400,  604800, 604800),
  (NULL, 'large',  86400,  604800, 604800),
  (NULL, 'full',   3600,   86400,  86400);