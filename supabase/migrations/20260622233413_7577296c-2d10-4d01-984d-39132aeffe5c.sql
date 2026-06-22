
ALTER TABLE public.rdo_anexos
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS onedrive_item_id text,
  ADD COLUMN IF NOT EXISTS onedrive_web_url text,
  ADD COLUMN IF NOT EXISTS onedrive_download_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

ALTER TABLE public.rdo_anexos
  ADD CONSTRAINT rdo_anexos_storage_provider_chk
  CHECK (storage_provider IN ('supabase','onedrive'));
