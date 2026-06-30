
CREATE TABLE IF NOT EXISTS public.button_effect_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  button_key text NOT NULL UNIQUE,
  button_label text NOT NULL,
  screen_key text NOT NULL,
  screen_name text NOT NULL,
  effect_type text NOT NULL DEFAULT 'none',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT button_effect_settings_effect_chk CHECK (effect_type IN (
    'none','typewriter','rocket','iconSwap','spark','circleExpand','shine','flip','expand','badgeArrow','warp'
  ))
);

GRANT SELECT ON public.button_effect_settings TO authenticated;
GRANT ALL ON public.button_effect_settings TO service_role;

ALTER TABLE public.button_effect_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read active button effects"
  ON public.button_effect_settings FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins manage button effects insert"
  ON public.button_effect_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Admins manage button effects update"
  ON public.button_effect_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Admins manage button effects delete"
  ON public.button_effect_settings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER trg_button_effect_settings_updated_at
  BEFORE UPDATE ON public.button_effect_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
