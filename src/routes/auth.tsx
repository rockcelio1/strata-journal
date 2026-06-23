import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { checkEmailRegistered, registerUser, resendVerification, validatePasswordStrength } from "@/lib/core.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Verificação de e-mail em tempo real no cadastro
  const [signupEmail, setSignupEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [signupPassword, setSignupPassword] = useState("");
  const passwordErrors = signupPassword ? validatePasswordStrength(signupPassword).errors : [];
  const passwordOk = signupPassword.length > 0 && passwordErrors.length === 0;
  const [resendLoading, setResendLoading] = useState(false);
  const [resendEmail, setResendEmail] = useState("");

  useEffect(() => {
    const value = signupEmail.trim().toLowerCase();
    if (!value) { setEmailStatus("idle"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setEmailStatus("invalid"); return; }
    setEmailStatus("checking");
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await checkEmailRegistered({ data: { email: value }, signal: ctrl.signal } as any);
        setEmailStatus(res.exists ? "taken" : "available");
      } catch { /* ignore */ }
    }, 500);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [signupEmail]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email")).trim().toLowerCase();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: String(fd.get("password")),
    });
    setLoading(false);
    if (error) {
      if (/confirm/i.test(error.message) || /not confirmed/i.test(error.message)) {
        setResendEmail(email);
        return toast.error("Confirme seu e-mail antes de entrar. Use o botão para reenviar a verificação.");
      }
      return toast.error(error.message);
    }
    navigate({ to: "/dashboard" });
  }

  async function handleResend() {
    const email = (resendEmail || signupEmail).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return toast.error("Informe um e-mail válido para reenviar a verificação.");
    }
    setResendLoading(true);
    try {
      const res = await resendVerification({ data: { email } });
      if (res.alreadyConfirmed) toast.success("Este e-mail já está confirmado. Faça login.");
      else toast.success("E-mail de verificação reenviado. Confira sua caixa de entrada.");
    } catch (err: any) {
      if (err?.message === "EMAIL_NOT_FOUND") toast.error("E-mail não cadastrado.");
      else toast.error(err?.message ?? "Não foi possível reenviar agora.");
    } finally {
      setResendLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email")).trim().toLowerCase();
    const password = String(fd.get("password"));
    const nome = String(fd.get("nome"));
    const empresa_nome = String(fd.get("empresa"));

    // Anti race-condition: bloqueia envio enquanto a verificação está pendente/inválida
    if (emailStatus === "checking") { toast.error("Aguarde a verificação do e-mail."); return; }
    if (emailStatus === "invalid") { toast.error("E-mail inválido."); return; }
    if (emailStatus === "taken") { toast.error("Este e-mail já está cadastrado."); return; }
    const pwCheck = validatePasswordStrength(password);
    if (!pwCheck.ok) { toast.error(pwCheck.errors[0] ?? "Senha fraca."); return; }

    setLoading(true);
    try {
      await registerUser({ data: { email, password, nome, empresa_nome } });
      setResendEmail(email);
      toast.success("Conta criada! Verifique seu e-mail para confirmar antes de entrar.");
    } catch (err: any) {
      if (err?.message === "EMAIL_TAKEN") {
        setEmailStatus("taken");
        toast.error("Este e-mail já está cadastrado. Faça login ou recupere sua senha.");
      } else {
        toast.error(err?.message ?? "Falha ao criar conta");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    setLoading(false);
    if (result.error) return toast.error(String(result.error));
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Lado esquerdo: branding */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-brand text-brand-foreground relative overflow-hidden">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-brand-foreground/15 grid place-items-center">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="font-serif text-xl">Diário de Obra</span>
        </div>
        <div className="max-w-md">
          <h1 className="font-serif text-4xl leading-tight">Gestão de canteiros.</h1>
          <p className="mt-4 text-brand-foreground/75 text-sm leading-relaxed">
            Centralize obras, equipes, equipamentos e RDOs com fluxo de aprovação. Cada empresa em seu próprio espaço seguro.
          </p>
        </div>
        <div className="text-xs text-brand-foreground/60">© {new Date().getFullYear()} Diário de Obra</div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-9 w-9 rounded-md bg-brand grid place-items-center">
              <Building2 className="h-5 w-5 text-brand-foreground" />
            </div>
            <span className="font-serif text-xl">Diário de Obra</span>
          </div>

          <Card className="p-6">
            <Tabs defaultValue="signin">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="pt-4">
                <form onSubmit={handleSignIn} className="space-y-3">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div>
                    <Label htmlFor="password">Senha</Label>
                    <Input id="password" name="password" type="password" required autoComplete="current-password" />
                  </div>
                  <Button type="submit" className="w-full bg-brand text-brand-foreground hover:bg-brand/90" disabled={loading}>
                    Entrar
                  </Button>
                </form>
                <div className="text-right mt-2">
                  <Link to="/reset-password" className="text-xs text-muted-foreground hover:underline">
                    Esqueci minha senha
                  </Link>
                </div>
              </TabsContent>

              <TabsContent value="signup" className="pt-4">
                <form onSubmit={handleSignUp} className="space-y-3">
                  <div>
                    <Label htmlFor="nome">Seu nome</Label>
                    <Input id="nome" name="nome" required />
                  </div>
                  <div>
                    <Label htmlFor="empresa">Nome da empresa</Label>
                    <Input id="empresa" name="empresa" required placeholder="Ex.: Construtora Aurora" />
                  </div>
                  <div>
                    <Label htmlFor="email2">Email</Label>
                    <Input
                      id="email2" name="email" type="email" required autoComplete="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      aria-invalid={emailStatus === "taken" || emailStatus === "invalid"}
                      aria-describedby="email2-feedback"
                      aria-busy={emailStatus === "checking"}
                      className={
                        emailStatus === "taken" || emailStatus === "invalid"
                          ? "border-destructive focus-visible:ring-destructive bg-destructive/5"
                          : emailStatus === "available"
                          ? "border-emerald-500 focus-visible:ring-emerald-500 bg-emerald-500/5"
                          : ""
                      }
                    />
                    <p
                      id="email2-feedback"
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                      className={
                        "text-xs mt-1 min-h-4 flex items-center gap-1 " +
                        (emailStatus === "taken" || emailStatus === "invalid"
                          ? "text-destructive"
                          : emailStatus === "available"
                          ? "text-emerald-600"
                          : "text-muted-foreground")
                      }
                    >
                      {emailStatus === "checking" && (
                        <>
                          <span className="inline-block h-3 w-3 rounded-full border-2 border-current border-r-transparent animate-spin" aria-hidden="true" />
                          Verificando e-mail...
                        </>
                      )}
                      {emailStatus === "invalid" && "E-mail inválido."}
                      {emailStatus === "taken" && "Este e-mail já está cadastrado. Faça login."}
                      {emailStatus === "available" && "E-mail disponível para cadastro."}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="password2">Senha</Label>
                    <Input
                      id="password2" name="password" type="password" required minLength={8} autoComplete="new-password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      aria-invalid={signupPassword.length > 0 && !passwordOk}
                      aria-describedby="password2-feedback"
                      className={
                        signupPassword.length === 0
                          ? ""
                          : passwordOk
                          ? "border-emerald-500 focus-visible:ring-emerald-500 bg-emerald-500/5"
                          : "border-destructive focus-visible:ring-destructive bg-destructive/5"
                      }
                    />
                    <ul
                      id="password2-feedback"
                      role="status"
                      aria-live="polite"
                      className="text-xs mt-1 space-y-0.5"
                    >
                      {signupPassword.length === 0 && (
                        <li className="text-muted-foreground">Mín. 8 caracteres, maiúscula, minúscula, número e símbolo.</li>
                      )}
                      {signupPassword.length > 0 && passwordOk && (
                        <li className="text-emerald-600">Senha forte.</li>
                      )}
                      {signupPassword.length > 0 && !passwordOk && passwordErrors.map((m) => (
                        <li key={m} className="text-destructive">• {m}</li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
                    disabled={loading || emailStatus === "taken" || emailStatus === "invalid" || emailStatus === "checking" || !passwordOk}
                  >
                    Criar empresa
                  </Button>
                </form>
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Não recebeu o e-mail de confirmação?</p>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      aria-label="E-mail para reenviar verificação"
                    />
                    <Button type="button" variant="outline" onClick={handleResend} disabled={resendLoading} aria-busy={resendLoading}>
                      {resendLoading ? "Enviando..." : "Reenviar"}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px bg-border flex-1" />
              <span className="text-xs text-muted-foreground">ou</span>
              <div className="h-px bg-border flex-1" />
            </div>

            <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
              Continuar com Google
            </Button>
          </Card>
          <a
            href="/instalar"
            className="mt-4 flex items-center justify-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm font-medium text-foreground/90 shadow-sm transition hover:border-brand/40 hover:bg-brand/5 hover:text-brand"
          >
            <span>Instalar o app no celular</span>
            <span className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-label="iOS">
                <path d="M16.365 1.43c0 1.14-.43 2.23-1.21 3.05-.84.88-2.2 1.56-3.32 1.47-.14-1.11.42-2.27 1.18-3.06.84-.87 2.27-1.52 3.35-1.46zM20.5 17.27c-.55 1.27-.81 1.84-1.52 2.96-.99 1.57-2.38 3.52-4.1 3.54-1.53.02-1.92-.99-4-1-2.07.01-2.51 1.02-4.04 1-1.72-.02-3.04-1.79-4.03-3.36-2.77-4.4-3.07-9.57-1.36-12.32 1.22-1.96 3.14-3.11 4.95-3.11 1.84 0 3 1.02 4.52 1.02 1.47 0 2.37-1.02 4.5-1.02 1.61 0 3.32.88 4.54 2.4-3.99 2.19-3.34 7.89-.46 9.89z"/>
              </svg>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-label="Android">
                <path d="M17.6 9.48l1.84-3.18a.4.4 0 10-.69-.4l-1.87 3.23a11.4 11.4 0 00-9.76 0L5.25 5.9a.4.4 0 10-.69.4l1.84 3.18A10.7 10.7 0 001 18.5h22a10.7 10.7 0 00-5.4-9.02zM7 15.25a1.1 1.1 0 110-2.2 1.1 1.1 0 010 2.2zm10 0a1.1 1.1 0 110-2.2 1.1 1.1 0 010 2.2z"/>
              </svg>
            </span>
          </a>

        </div>
      </div>
    </div>
  );
}
