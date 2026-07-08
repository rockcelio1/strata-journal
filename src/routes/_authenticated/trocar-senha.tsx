import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { marcarSenhaTrocada, validatePasswordStrength } from "@/lib/core.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/trocar-senha")({
  component: TrocarSenhaPage,
});

function TrocarSenhaPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const marcarFn = useServerFn(marcarSenhaTrocada);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const check = validatePasswordStrength(pwd);
      if (!check.ok) throw new Error(check.errors.join(" "));
      if (pwd !== pwd2) throw new Error("As senhas não conferem.");
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      await marcarFn();
    },
    onSuccess: async () => {
      toast.success("Senha atualizada");
      await qc.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: "/dashboard" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao trocar senha"),
  });

  return (
    <div className="max-w-md mx-auto py-10 px-4">
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-brand/10 text-brand grid place-items-center">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-serif text-xl leading-none">Definir nova senha</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Por segurança, o administrador exigiu que você troque sua senha antes de continuar.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Nova senha</Label>
            <Input type="password" autoFocus value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </div>
          <div>
            <Label>Confirmar nova senha</Label>
            <Input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.
          </p>
        </div>
        <Button className="w-full" disabled={mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </Card>
    </div>
  );
}
