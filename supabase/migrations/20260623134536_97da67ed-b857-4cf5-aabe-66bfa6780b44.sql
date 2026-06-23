
-- 1) Private schema for SECURITY DEFINER helpers (not exposed to PostgREST)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;

-- 2) Move existing SECURITY DEFINER functions to private (preserves OIDs referenced by policies)
ALTER FUNCTION public.has_role(uuid, app_role)      SET SCHEMA private;
ALTER FUNCTION public.has_admin_access(uuid)        SET SCHEMA private;
ALTER FUNCTION public.can_approve_rdo(uuid)         SET SCHEMA private;
ALTER FUNCTION public.get_user_empresa(uuid)        SET SCHEMA private;
ALTER FUNCTION public.rdo_empresa(uuid)             SET SCHEMA private;
ALTER FUNCTION public.rdo_autor(uuid)               SET SCHEMA private;

-- 3) Redefine role-check helpers to scope by the caller/user's CURRENT empresa.
--    JOIN to profiles ensures a role only counts in the empresa the user actually belongs to,
--    preventing cross-tenant privilege use even if user_roles holds rows for other empresas.
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p
      ON p.id = ur.user_id AND p.empresa_id = ur.empresa_id
    WHERE ur.user_id = _user_id
      AND ur.role = _role
  )
$$;

CREATE OR REPLACE FUNCTION private.has_admin_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p
      ON p.id = ur.user_id AND p.empresa_id = ur.empresa_id
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin','master')
  )
$$;

CREATE OR REPLACE FUNCTION private.can_approve_rdo(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p
      ON p.id = ur.user_id AND p.empresa_id = ur.empresa_id
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin','engenheiro')
  )
$$;

-- 4) Lock down EXECUTE on the private helpers
REVOKE ALL ON FUNCTION private.has_role(uuid, app_role)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_admin_access(uuid)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_approve_rdo(uuid)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.get_user_empresa(uuid)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.rdo_empresa(uuid)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.rdo_autor(uuid)               FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role)      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_admin_access(uuid)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_approve_rdo(uuid)         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_user_empresa(uuid)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.rdo_empresa(uuid)             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.rdo_autor(uuid)               TO authenticated, service_role;

-- 5) Thin SECURITY INVOKER wrappers in public for existing app .rpc() calls
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT private.has_role(_user_id, _role)
$$;
CREATE OR REPLACE FUNCTION public.has_admin_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT private.has_admin_access(_user_id)
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_admin_access(uuid)   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_admin_access(uuid)   TO authenticated, service_role;

-- 6) rdo_audit_logs: prevent forging entries as another user
DROP POLICY IF EXISTS "inserir logs da empresa" ON public.rdo_audit_logs;
CREATE POLICY "inserir logs da empresa"
ON public.rdo_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id = private.get_user_empresa(auth.uid())
  AND autor_id = auth.uid()
);

-- 7) convites: hide raw invite tokens from the Data API even for admins.
--    Privileged server code uses service_role and is unaffected by column grants.
REVOKE SELECT ON public.convites FROM authenticated;
GRANT SELECT (id, empresa_id, email, role, aceito, expires_at, created_at)
  ON public.convites TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.convites TO authenticated;
GRANT ALL ON public.convites TO service_role;
