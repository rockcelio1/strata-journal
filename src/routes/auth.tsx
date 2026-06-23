import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { checkEmailRegistered } from "@/lib/core.functions";
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

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard" });
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          nome: String(fd.get("nome")),
          empresa_nome: String(fd.get("empresa")),
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Verifique o email se necessário.");
    navigate({ to: "/dashboard" });
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
                    <Input id="email2" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div>
                    <Label htmlFor="password2">Senha</Label>
                    <Input id="password2" name="password" type="password" required minLength={6} autoComplete="new-password" />
                  </div>
                  <Button type="submit" className="w-full bg-brand text-brand-foreground hover:bg-brand/90" disabled={loading}>
                    Criar empresa
                  </Button>
                </form>
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
        </div>
      </div>
    </div>
  );
}
