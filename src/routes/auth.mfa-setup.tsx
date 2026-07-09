import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth/mfa-setup")({
  head: () => ({
    meta: [
      { title: "Ativar autenticação em 2 fatores — Diário de Obra" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MfaSetupPage,
});

function MfaSetupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate({ to: "/auth" });
        return;
      }
      setSession(data.session);
      // limpa fatores TOTP não verificados de tentativas anteriores
      try {
        const { data: list } = await supabase.auth.mfa.listFactors();
        for (const f of list?.totp ?? []) {
          if (f.status !== "verified") {
            await supabase.auth.mfa.unenroll({ factorId: f.id });
          }
        }
      } catch { /* noop */ }
      setLoading(false);
    })();
  }, [navigate]);

  async function startEnroll() {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `RDO ${new Date().toISOString().slice(0, 10)}`,
      });
      if (error) throw error;
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (err: any) {
      console.error("[mfa] enroll failed", err);
      toast.error("Não foi possível iniciar o cadastro MFA. Tente novamente.");
    } finally {
      setEnrolling(false);
    }
  }

  async function verifyCode() {
    if (!factorId) return;
    setEnrolling(true);
    try {
      const { data: chal, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: chal.id,
        code: code.trim(),
      });
      if (vErr) throw vErr;

      // marca preferência no user_security_settings
      const uid = session?.user?.id;
      if (uid) {
        await supabase
          .from("user_security_settings")
          .upsert({ user_id: uid, mfa_enabled: true, mfa_enrolled_at: new Date().toISOString() });
      }
      toast.success("MFA ativado com sucesso!");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      console.error("[mfa] verify failed", err);
      toast.error(err?.message?.includes("Invalid") ? "Código inválido. Verifique e tente novamente." : "Falha ao validar o código.");
    } finally {
      setEnrolling(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-md bg-brand/10 text-brand grid place-items-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-serif text-xl">Autenticação em 2 fatores</h1>
            <p className="text-xs text-muted-foreground">Obrigatória para administradores</p>
          </div>
        </div>

        {!qr ? (
          <>
            <p className="text-sm mb-4">
              Como administrador, você precisa ativar a autenticação em dois fatores (TOTP) para proteger
              sua conta. Você vai precisar de um aplicativo autenticador (Google Authenticator, Microsoft
              Authenticator, 1Password, Authy, etc.).
            </p>
            <Button onClick={startEnroll} disabled={enrolling} className="w-full">
              {enrolling ? "Gerando..." : "Começar"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm mb-3">
              <b>1.</b> Abra seu aplicativo autenticador e leia o QR Code abaixo:
            </p>
            <div className="rounded-lg border border-border bg-white p-4 flex justify-center mb-3">
              {qr.startsWith("data:") ? (
                <img src={qr} alt="QR Code MFA" className="h-48 w-48" />
              ) : (
                <div className="h-48 w-48 grid place-items-center [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
              )}
            </div>
            {secret && (
              <details className="mb-4">
                <summary className="text-xs text-muted-foreground cursor-pointer">Não consegue escanear? Digite o segredo</summary>
                <code className="block mt-2 p-2 bg-muted rounded text-xs font-mono break-all">{secret}</code>
              </details>
            )}

            <p className="text-sm mb-2">
              <b>2.</b> Digite o código de 6 dígitos gerado pelo aplicativo:
            </p>
            <Label htmlFor="code" className="sr-only">Código MFA</Label>
            <Input
              id="code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="text-center text-2xl tracking-widest font-mono mb-4"
              autoFocus
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  if (factorId) await supabase.auth.mfa.unenroll({ factorId });
                  setFactorId(null); setQr(null); setSecret(null); setCode("");
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button onClick={verifyCode} disabled={enrolling || code.length !== 6} className="flex-1">
                {enrolling ? "Validando..." : "Ativar MFA"}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
