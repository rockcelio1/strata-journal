import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { validatePasswordStrength } from "@/lib/core.functions";
import { friendlyAuthError } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

type Phase = "request" | "validating" | "recovery" | "invalid" | "done";

function readHashParams(): URLSearchParams {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  return new URLSearchParams(hash);
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("request");
  const [problem, setProblem] = useState<{ message: string; action: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const passwordErrors = password ? validatePasswordStrength(password).errors : [];
  const passwordOk = password.length > 0 && passwordErrors.length === 0;

  // Validação do token do link de recuperação
  useEffect(() => {
    const params = readHashParams();
    const query = new URLSearchParams(window.location.search);
    const errorRaw = params.get("error_description") ?? params.get("error") ?? query.get("error_description");
    const isRecovery = params.get("type") === "recovery" || query.get("type") === "recovery";
    const code = query.get("code");

    if (errorRaw) {
      const f = friendlyAuthError(errorRaw);
      setProblem({ message: f.message, action: f.action });
      setPhase("invalid");
      return;
    }
    if (!isRecovery && !code) return; // fluxo normal: pedir e-mail

    setPhase("validating");

    let done = false;
    const finish = (ok: boolean, err?: unknown) => {
      if (done) return;
      done = true;
      if (ok) {
        setPhase("recovery");
      } else {
        const f = friendlyAuthError(err ?? "token_invalid");
        setProblem({ message: f.message, action: f.action });
        setPhase("invalid");
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) finish(true);
    });

    (async () => {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        return finish(!error, error);
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) finish(true);
      // fallback: aguarda o evento do SDK ao processar o hash
      setTimeout(() => finish(false, "token has expired or is invalid"), 4000);
    })();

    return () => sub.subscription.unsubscribe();
  }, []);

  async function sendReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(String(fd.get("email")).trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      const f = friendlyAuthError(error);
      return toast.error(f.message, { description: f.action });
    }
    toast.success("E-mail de recuperação enviado.", {
      description: "Abra o link em até 1 hora para definir a nova senha.",
    });
  }

  async function setNewPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const check = validatePasswordStrength(password);
    if (!check.ok) {
      return toast.error("Senha fraca.", { description: check.errors[0] });
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      const f = friendlyAuthError(error);
      if (f.code === "SESSION_EXPIRED" || f.code === "TOKEN_INVALID") {
        setProblem({ message: f.message, action: f.action });
        setPhase("invalid");
      }
      return toast.error(f.message, { description: f.action });
    }
    setPhase("done");
    toast.success("Senha atualizada com sucesso.");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-4 sm:p-6">
      <Card className="w-full max-w-sm p-5 sm:p-6">
        <h1 className="font-serif text-2xl">Recuperar senha</h1>

        {phase === "validating" && (
          <p className="mt-4 text-sm text-muted-foreground" role="status" data-testid="reset-validating">
            Validando seu link de recuperação...
          </p>
        )}

        {phase === "invalid" && (
          <div className="mt-4 space-y-3" data-testid="reset-invalid">
            <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              <strong className="block">{problem?.message}</strong>
              <span className="text-destructive/80">{problem?.action}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => { window.location.hash = ""; setProblem(null); setPhase("request"); }}
            >
              Solicitar novo link
            </Button>
          </div>
        )}

        {phase === "recovery" && (
          <form onSubmit={setNewPassword} className="space-y-3 mt-4" data-testid="reset-form">
            <div>
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password" name="password" type="password" required minLength={8} autoComplete="new-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                aria-invalid={password.length > 0 && !passwordOk}
              />
              <ul className="text-xs mt-1 space-y-0.5" aria-live="polite">
                {password.length === 0 && (
                  <li className="text-muted-foreground">Mín. 8 caracteres, maiúscula, minúscula, número e símbolo.</li>
                )}
                {passwordOk && <li className="text-emerald-600">Senha forte.</li>}
                {password.length > 0 && !passwordOk && passwordErrors.map((m) => (
                  <li key={m} className="text-destructive">• {m}</li>
                ))}
              </ul>
            </div>
            <Button type="submit" disabled={loading || !passwordOk} className="w-full bg-brand text-brand-foreground">
              Atualizar senha
            </Button>
          </form>
        )}

        {phase === "request" && (
          <form onSubmit={sendReset} className="space-y-3 mt-4" data-testid="request-form">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
              <p className="text-xs text-muted-foreground mt-1">
                Enviaremos um link seguro para você criar uma nova senha.
              </p>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-brand text-brand-foreground">
              Enviar e-mail
            </Button>
          </form>
        )}

        <div className="mt-4 text-center">
          <Link to="/auth" className="text-xs text-muted-foreground hover:underline">Voltar para o login</Link>
        </div>
      </Card>
    </div>
  );
}
