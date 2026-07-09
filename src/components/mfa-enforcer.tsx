/**
 * Enforcement de MFA baseado em flag explícita.
 *
 * Fonte da verdade:
 *   - empresas.mfa_required           (obriga todos da empresa)
 *   - user_security_settings.mfa_required (obriga um usuário específico)
 *
 * Só redireciona para /auth/mfa-setup quando pelo menos uma das flags está
 * ativa E o usuário ainda não fez o enrolment TOTP (mfa_enabled = false).
 *
 * O motivo do redirecionamento (ou da ausência dele) é logado no console e
 * publicado em `window.__MFA_ENFORCEMENT_STATUS__` + evento
 * `mfa-enforcement-status` para diagnóstico e testes E2E.
 */
import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type MfaEnforcementReason =
  | "no-session"
  | "not-required"
  | "already-enrolled"
  | "on-setup-page"
  | "redirected-to-setup"
  | "error";

export interface MfaEnforcementStatus {
  reason: MfaEnforcementReason;
  requiredByEmpresa: boolean;
  requiredByUser: boolean;
  enrolled: boolean;
  at: string;
  message: string;
}

function publishStatus(status: MfaEnforcementStatus) {
  try {
    (window as any).__MFA_ENFORCEMENT_STATUS__ = status;
    window.dispatchEvent(new CustomEvent("mfa-enforcement-status", { detail: status }));
    // eslint-disable-next-line no-console
    console.info("[mfa-enforcer]", status.reason, status.message, status);
  } catch {
    /* noop */
  }
}

export function MfaEnforcer(_: { roles: string[] | undefined }) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) {
          publishStatus({
            reason: "no-session",
            requiredByEmpresa: false,
            requiredByUser: false,
            enrolled: false,
            at: new Date().toISOString(),
            message: "Sem sessão ativa — enforcement não aplicável.",
          });
          return;
        }

        // Já em /auth/mfa-setup: não redirecionar (evita loop).
        if (path?.startsWith("/auth/mfa-setup")) {
          publishStatus({
            reason: "on-setup-page",
            requiredByEmpresa: false,
            requiredByUser: false,
            enrolled: false,
            at: new Date().toISOString(),
            message: "Já está na página de setup MFA.",
          });
          return;
        }

        // Busca flags (empresa + usuário) e status de enrolment em paralelo.
        const [{ data: prof }, { data: settings }] = await Promise.all([
          supabase.from("profiles").select("empresa_id").eq("id", uid).maybeSingle(),
          supabase
            .from("user_security_settings")
            .select("mfa_required, mfa_enabled")
            .eq("user_id", uid)
            .maybeSingle(),
        ]);

        let requiredByEmpresa = false;
        if (prof?.empresa_id) {
          const { data: emp } = await supabase
            .from("empresas")
            .select("mfa_required")
            .eq("id", prof.empresa_id)
            .maybeSingle();
          requiredByEmpresa = Boolean((emp as any)?.mfa_required);
        }
        const requiredByUser = Boolean((settings as any)?.mfa_required);
        const enrolled = Boolean((settings as any)?.mfa_enabled);
        const required = requiredByEmpresa || requiredByUser;

        if (cancelled) return;

        if (!required) {
          publishStatus({
            reason: "not-required",
            requiredByEmpresa,
            requiredByUser,
            enrolled,
            at: new Date().toISOString(),
            message: "MFA não é obrigatório para este usuário/empresa.",
          });
          return;
        }
        if (enrolled) {
          publishStatus({
            reason: "already-enrolled",
            requiredByEmpresa,
            requiredByUser,
            enrolled,
            at: new Date().toISOString(),
            message: "MFA obrigatório e já ativado — nada a fazer.",
          });
          return;
        }

        publishStatus({
          reason: "redirected-to-setup",
          requiredByEmpresa,
          requiredByUser,
          enrolled,
          at: new Date().toISOString(),
          message: "MFA obrigatório e não ativado — redirecionando para /auth/mfa-setup.",
        });
        navigate({ to: "/auth/mfa-setup" });
      } catch (err) {
        publishStatus({
          reason: "error",
          requiredByEmpresa: false,
          requiredByUser: false,
          enrolled: false,
          at: new Date().toISOString(),
          message: `Falha ao avaliar enforcement MFA: ${(err as Error)?.message ?? String(err)}`,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, path]);

  return null;
}
