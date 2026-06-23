import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [hasRecovery, setHasRecovery] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setHasRecovery(window.location.hash.includes("type=recovery"));
  }, []);

  async function sendReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(String(fd.get("email")), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Email de recuperação enviado.");
  }

  async function setNewPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: String(fd.get("password")) });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada.");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-4 sm:p-6">
      <Card className="w-full max-w-sm p-5 sm:p-6">
        <h1 className="font-serif text-2xl">Recuperar senha</h1>
        {hasRecovery ? (
          <form onSubmit={setNewPassword} className="space-y-3 mt-4">
            <div>
              <Label htmlFor="password">Nova senha</Label>
              <Input id="password" name="password" type="password" required minLength={6} />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-brand text-brand-foreground">Atualizar</Button>
          </form>
        ) : (
          <form onSubmit={sendReset} className="space-y-3 mt-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-brand text-brand-foreground">Enviar email</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
