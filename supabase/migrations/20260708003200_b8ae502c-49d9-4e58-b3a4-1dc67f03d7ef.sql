ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS geo_lat double precision,
  ADD COLUMN IF NOT EXISTS geo_lng double precision,
  ADD COLUMN IF NOT EXISTS geo_endereco text,
  ADD COLUMN IF NOT EXISTS geo_at timestamptz;