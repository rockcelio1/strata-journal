
REVOKE EXECUTE ON FUNCTION public.tg_audit_rdo_acessos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_audit_rdo_acessos() TO service_role;
