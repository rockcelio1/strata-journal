ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS logo_wallpaper_opacity smallint NOT NULL DEFAULT 0
    CHECK (logo_wallpaper_opacity BETWEEN 0 AND 100);