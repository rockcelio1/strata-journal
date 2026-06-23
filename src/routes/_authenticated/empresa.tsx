import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getMe, updateEmpresa, listMembros, seedDemoFacom,
  listConvites, criarConvite, revogarConvite,
  atualizarPapelMembro, removerMembro,
} from "@/lib/core.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Search, Copy, Trash2, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/empresa")({
  component: EmpresaPage,
});

const ROLES = ["admin", "engenheiro", "mestre", "visualizador"] as const;
type Role = (typeof ROLES)[number];

function EmpresaPage() {
  const qc = useQueryClient();
  const meFn = useServerFn(getMe);
  const updFn = useServerFn(updateEmpresa);
  const memFn = useServerFn(listMembros);
  const convFn = useServerFn(listConvites);
  const criarFn = useServerFn(criarConvite);
  const revogarFn = useServerFn(revogarConvite);
  const atualizarPapelFn = useServerFn(atualizarPapelMembro);
  const removerFn = useServerFn(removerMembro);
  const seedFacomFn = useServerFn(seedDemoFacom);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const { data: membros = [] } = useQuery({ queryKey: ["membros"], queryFn: () => memFn() });
  const { data: convites = [] } = useQuery({ queryKey: ["convites"], queryFn: () => convFn() });

  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("visualizador");

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

  const convidar = useMutation({
    mutationFn: () => criarFn({ data: { email: inviteEmail.trim(), role: inviteRole } }),
    onSuccess: () => {
      toast.success("Convite criado");
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["convites"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revogar = useMutation({
    mutationFn: (id: string) => revogarFn({ data: { id } }),
    onSuccess: () => { toast.success("Convite revogado"); qc.invalidateQueries({ queryKey: ["convites"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const trocarPapel = useMutation({
    mutationFn: (v: { user_id: string; role: Role }) => atualizarPapelFn({ data: v }),
    onSuccess: () => { toast.success("Papel atualizado"); qc.invalidateQueries({ queryKey: ["membros"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: (user_id: string) => removerFn({ data: { user_id } }),
    onSuccess: () => { toast.success("Membro removido"); qc.invalidateQueries({ queryKey: ["membros"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const copiarLink = (token: string) => {
    const url = `${window.location.origin}/auth?convite=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="font-serif text-2xl sm:text-3xl">Empresa</h1>
        <p className="text-sm text-muted-foreground mt-1">Dados da sua organização e equipe.</p>
      </header>

      <Card className="p-4 sm:p-6 mb-6">
        <h2 className="font-serif text-xl mb-4">Dados</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {isAdmin && (
        <Card className="p-6 mb-6 bg-muted/30">
          <h2 className="font-serif text-xl mb-1">Dados de demonstração — FACOM</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Popula a empresa atual com obras, mão de obra, equipamentos e tipos de ocorrência de exemplo.
          </p>
          <Button
            variant="outline"
            onClick={async () => { try { await seedDemoFacom(); toast.success("Dados FACOM inseridos"); qc.invalidateQueries(); } catch (e: any) { toast.error(e.message); } }}
          >
            Inserir dados de demonstração
          </Button>
        </Card>
      )}

      {isAdmin && (
        <Card className="p-6 mb-6">
          <h2 className="font-serif text-xl mb-4">Convidar novo membro</h2>
          <div className="grid grid-cols-[1fr_180px_auto] gap-2 items-end">
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="pessoa@empresa.com" />
            </div>
            <div>
              <Label>Papel</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => convidar.mutate()} disabled={!inviteEmail || convidar.isPending} className="bg-brand text-brand-foreground">
              <UserPlus className="h-4 w-4 mr-1" />Convidar
            </Button>
          </div>

          {(convites as any[]).filter((c) => !c.aceito).length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-2">Convites pendentes</h3>
              <ul className="divide-y divide-border">
                {(convites as any[]).filter((c) => !c.aceito).map((c) => (
                  <li key={c.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.email}</div>
                      <div className="text-xs text-muted-foreground">
                        <span className="capitalize">{c.role}</span> · expira em {new Date(c.expires_at).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => copiarLink(c.token)}>
                        <Copy className="h-3 w-3 mr-1" />Link
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => revogar.mutate(c.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <Card className="p-6">
        <h2 className="font-serif text-xl mb-4">Membros</h2>
        {(membros as any[]).length === 0 ? (
          <p className="text-sm text-muted-foreground">Apenas você por enquanto.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(membros as any[]).map((m) => {
              const role = (m.user_roles?.[0]?.role ?? "visualizador") as Role;
              const isSelf = m.id === me?.profile?.id;
              return (
                <li key={m.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{m.nome} {isSelf && <span className="text-xs text-muted-foreground">(você)</span>}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && !isSelf ? (
                      <Select value={role} onValueChange={(v) => trocarPapel.mutate({ user_id: m.id, role: v as Role })}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="capitalize">{role}</Badge>
                    )}
                    {isAdmin && !isSelf && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-3 w-3" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover {m.nome}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O membro perderá acesso à empresa. Pode ser convidado novamente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remover.mutate(m.id)} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
