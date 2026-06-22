import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getMe, updateEmpresa, listMembros } from "@/lib/core.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/empresa")({
  component: EmpresaPage,
});

function EmpresaPage() {
  const meFn = useServerFn(getMe);
  const updFn = useServerFn(updateEmpresa);
  const memFn = useServerFn(listMembros);
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const { data: membros = [] } = useQuery({ queryKey: ["membros"], queryFn: () => memFn() });
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [consultando, setConsultando] = useState(false);

  const formatCnpj = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 14);
    return d
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  const consultarCnpj = async () => {
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) { toast.error("Informe um CNPJ com 14 dígitos"); return; }
    setConsultando(true);
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!r.ok) throw new Error("CNPJ não encontrado");
      const d = await r.json();
      setNome(d.razao_social || d.nome_fantasia || nome);
      toast.success(`Encontrado: ${d.razao_social ?? d.nome_fantasia}`);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao consultar CNPJ");
    } finally {
      setConsultando(false);
    }
  };

  useEffect(() => {
    if (me?.empresa) { setNome(me.empresa.nome ?? ""); setCnpj(me.empresa.cnpj ?? ""); }
  }, [me]);

  const isAdmin = (me?.roles ?? []).includes("admin");

  const save = useMutation({
    mutationFn: () => updFn({ data: { nome, cnpj: cnpj || null } }),
    onSuccess: () => { toast.success("Empresa atualizada"); qc.invalidateQueries({ queryKey: ["me"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="font-serif text-3xl">Empresa</h1>
        <p className="text-sm text-muted-foreground mt-1">Dados da sua organização e equipe.</p>
      </header>

      <Card className="p-6 mb-6">
        <h2 className="font-serif text-xl mb-4">Dados</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} disabled={!isAdmin} />
          </div>
          <div>
            <Label>CNPJ</Label>
            <div className="flex gap-2">
              <Input value={cnpj} onChange={(e) => setCnpj(formatCnpj(e.target.value))} disabled={!isAdmin} placeholder="00.000.000/0000-00" />
              <Button type="button" variant="outline" onClick={consultarCnpj} disabled={consultando || !isAdmin} title="Consultar CNPJ online">
                {consultando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
        {isAdmin && (
          <div className="mt-4 flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-brand text-brand-foreground">Salvar</Button>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="font-serif text-xl mb-4">Membros</h2>
        {(membros as any[]).length === 0 ? (
          <p className="text-sm text-muted-foreground">Apenas você por enquanto.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(membros as any[]).map((m) => (
              <li key={m.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{m.nome}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </div>
                <div className="flex gap-1">
                  {(m.user_roles ?? []).map((r: any, i: number) => (
                    <Badge key={i} variant="outline" className="capitalize">{r.role}</Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground mt-4">
          Para convidar novos membros, peça que se cadastrem com o mesmo email — em breve adicionamos convites por link.
        </p>
      </Card>
    </div>
  );
}
