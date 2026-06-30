
CREATE TABLE public.skeleton_loading_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_key text NOT NULL UNIQUE,
  screen_name text NOT NULL,
  effect_type text NOT NULL CHECK (effect_type IN ('shimmer','gradient','staggered','typewriter','layered','elastic','pulse','cascade','outline')),
  layout_type text NOT NULL DEFAULT 'default',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skeleton_loading_settings TO authenticated;
GRANT ALL ON public.skeleton_loading_settings TO service_role;

ALTER TABLE public.skeleton_loading_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read active skeleton settings"
  ON public.skeleton_loading_settings
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "admin insert skeleton settings"
  ON public.skeleton_loading_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "admin update skeleton settings"
  ON public.skeleton_loading_settings
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "admin delete skeleton settings"
  ON public.skeleton_loading_settings
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER trg_skeleton_settings_updated
  BEFORE UPDATE ON public.skeleton_loading_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
