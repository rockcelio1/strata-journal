import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Onda 4: força MFA para administradores e master.
 * - Verifica se o usuário logado tem role admin/master.
 * - Consulta user_security_settings.mfa_enabled.
 * - Se não estiver habilitado, redireciona para /auth/mfa-setup
 *   (exceto se já estiver na página de setup).
 */
export function MfaEnforcer({ roles }: { roles: string[] | undefined }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPriv = !!roles && (roles.includes("admin") || roles.includes("master"));

  const { data } = useQuery({
    enabled: isPriv,
    queryKey: ["mfa-status"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return { enabled: true };
      const { data: settings } = await supabase
        .from("user_security_settings")
        .select("mfa_enabled")
        .eq("user_id", uid)
        .maybeSingle();
      return { enabled: !!settings?.mfa_enabled };
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!isPriv) return;
    if (data && !data.enabled && pathname !== "/auth/mfa-setup") {
      navigate({ to: "/auth/mfa-setup" });
    }
  }, [isPriv, data, pathname, navigate]);

  return null;
}
