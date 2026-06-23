ALTER TABLE public.rdos
  ADD CONSTRAINT rdos_autor_id_profiles_fkey
    FOREIGN KEY (autor_id) REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD CONSTRAINT rdos_aprovado_por_profiles_fkey
    FOREIGN KEY (aprovado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.rdo_anexos
  ADD CONSTRAINT rdo_anexos_autor_id_profiles_fkey
    FOREIGN KEY (autor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.rdo_audit_logs
  ADD CONSTRAINT rdo_audit_logs_autor_id_profiles_fkey
    FOREIGN KEY (autor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.empresa_logo_versions
  ADD CONSTRAINT empresa_logo_versions_autor_id_profiles_fkey
    FOREIGN KEY (autor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';