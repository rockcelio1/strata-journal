ALTER TABLE public.rdo_anexos
  ADD COLUMN IF NOT EXISTS onedrive_drive_id text,
  ADD COLUMN IF NOT EXISTS onedrive_path text,
  ADD COLUMN IF NOT EXISTS sha256 text,
  ADD COLUMN IF NOT EXISTS upload_status text NOT NULL DEFAULT 'concluido',
  ADD COLUMN IF NOT EXISTS upload_erro text;

CREATE INDEX IF NOT EXISTS rdo_anexos_sha256_idx ON public.rdo_anexos (rdo_id, sha256);