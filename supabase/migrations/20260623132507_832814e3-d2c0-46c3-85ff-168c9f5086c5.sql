ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS clima_cache jsonb,
  ADD COLUMN IF NOT EXISTS clima_cache_at timestamptz;