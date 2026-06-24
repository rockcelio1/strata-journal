REVOKE EXECUTE ON FUNCTION public.admin_soft_delete_rdo(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_disable_rdo(UUID, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_rdo_basico(UUID, UUID, DATE, TEXT, clima, clima, clima) FROM PUBLIC;