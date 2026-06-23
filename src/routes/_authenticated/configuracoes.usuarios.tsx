import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listMembros,
  listConvites,
  criarConvite,
  reenviarConvite,
  revogarConvite,
  atualizarPapelMembro,
  adminCreateUser,
  adminUpdateProfile,
  adminSetUserPassword,
  adminSendPasswordReset,
  adminDeleteUser,
  adminToggleUserDisabled,
  aprovarUsuario,
  listAuditLogs,
  exportAuditLogsCsv,
} from "@/lib/core.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Pencil, KeyRound, Mail, Trash2, Ban, UserPlus, ShieldCheck, RefreshCw, Check, X, History, Download, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes/usuarios")({
  component: UsuariosPage,
});

const ROLES = [
  { value: "master", label: "Master" },
  { value: "admin", label: "Admin" },
  { value: "engenheiro", label: "Engenheiro" },
  { value: "mestre", label: "Encarregado" },
  { value: "visualizador", label: "Visualizador" },
] as const;

const roleLabel = (r?: string) => ROLES.find((x) => x.value === r)?.label ?? r ?? "—";

function UsuariosPage() {
  const qc = useQueryClient();
  const membrosFn = useServerFn(listMembros);
  const convitesFn = useServerFn(listConvites);
  const criarConviteFn = useServerFn(criarConvite);
  const revogarConviteFn = useServerFn(revogarConvite);
  const atualizarPapelFn = useServerFn(atualizarPapelMembro);
  const adminCreateFn = useServerFn(adminCreateUser);
  const adminUpdateFn = useServerFn(adminUpdateProfile);
  const adminSetPwdFn = useServerFn(adminSetUserPassword);
  const adminResetFn = useServerFn(adminSendPasswordReset);
  const adminDeleteFn = useServerFn(adminDeleteUser);
  const adminToggleFn = useServerFn(adminToggleUserDisabled);

  const reenviarFn = useServerFn(reenviarConvite);
  const aprovarFn = useServerFn(aprovarUsuario);
  const auditFn = useServerFn(listAuditLogs);

  const exportCsvFn = useServerFn(exportAuditLogsCsv);

  const membros = useQuery({ queryKey: ["membros"], queryFn: () => membrosFn() });
  const convites = useQuery({ queryKey: ["convites"], queryFn: () => convitesFn() });

  // Audit filters + pagination
  const [auditFilters, setAuditFilters] = useState({ user_id: "", acao: "", from: "", to: "" });
  const [auditPage, setAuditPage] = useState(1);
  const pageSize = 20;
  const auditPayload = useMemo(() => ({
    user_id: auditFilters.user_id || null,
    acao: auditFilters.acao || null,
    from: auditFilters.from ? new Date(auditFilters.from).toISOString() : null,
    to: auditFilters.to ? new Date(auditFilters.to + "T23:59:59").toISOString() : null,
    page: auditPage,
    pageSize,
  }), [auditFilters, auditPage]);
  const audit = useQuery({
    queryKey: ["audit-logs", auditPayload],
    queryFn: () => auditFn({ data: auditPayload }),
  });
  const auditItems = audit.data?.items ?? [];
  const auditTotal = audit.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(auditTotal / pageSize));

  const membrosById = new Map<string, any>((membros.data ?? []).map((m: any) => [m.id, m]));
  const pendentes = (membros.data ?? []).filter((m: any) => m.aprovado === false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["membros"] });
    qc.invalidateQueries({ queryKey: ["convites"] });
    qc.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  const mUpdatePapel = useMutation({
    mutationFn: (v: { user_id: string; role: string }) => atualizarPapelFn({ data: v }),
    onSuccess: () => { toast.success("Papel atualizado"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (user_id: string) => adminDeleteFn({ data: { user_id } }),
    onSuccess: () => { toast.success("Usuário excluído"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const mToggle = useMutation({
    mutationFn: (v: { user_id: string; disabled: boolean }) => adminToggleFn({ data: v }),
    onSuccess: (_, v) => { toast.success(v.disabled ? "Usuário desabilitado" : "Usuário habilitado"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const mReset = useMutation({
    mutationFn: (email: string) => adminResetFn({ data: { email } }),
    onSuccess: () => toast.success("E-mail de redefinição enviado"),
    onError: (e: any) => toast.error(e.message),
  });
  const mReenviar = useMutation({
    mutationFn: (id: string) => reenviarFn({ data: { id } }),
    onSuccess: () => { toast.success("Convite reenviado"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const mAprovar = useMutation({
    mutationFn: (v: { user_id: string; aprovado: boolean }) => aprovarFn({ data: v }),
    onSuccess: (_, v) => { toast.success(v.aprovado ? "Usuário aprovado" : "Aprovação removida"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const mRevogarConv = useMutation({
    mutationFn: (id: string) => revogarConviteFn({ data: { id } }),
    onSuccess: () => { toast.success("Convite revogado"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl">Usuários e permissões</h2>
          <p className="text-sm text-muted-foreground">Adicione, edite, desabilite e gerencie senhas dos usuários da empresa.</p>
        </div>
        <div className="flex gap-2">
          <NovoUsuarioDialog
            onCreate={async (v) => { await adminCreateFn({ data: v }); invalidate(); }}
          />
          <NovoConviteDialog
            onCreate={async (v) => { await criarConviteFn({ data: v }); invalidate(); }}
          />
        </div>
      </div>

      {/* APROVAÇÕES PENDENTES */}
      {pendentes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium uppercase tracking-wider text-amber-600 dark:text-amber-500">
            Aprovações pendentes ({pendentes.length})
          </h3>
          <Card className="p-4 border-amber-300/40 bg-amber-50/40 dark:bg-amber-950/10">
            <p className="text-xs text-muted-foreground mb-3">
              Usuários que se cadastraram e aguardam liberação do administrador ou master.
            </p>
            <ul className="divide-y">
              {pendentes.map((m: any) => (
                <li key={m.id} className="py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="font-medium">{m.nome}</div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </div>
                  <div className="flex gap-2">
                    <ConfirmAction
                      title="Aprovar cadastro"
                      description={`Liberar acesso para ${m.nome} (${m.email})?`}
                      confirmLabel="Aprovar"
                      onConfirm={() => mAprovar.mutate({ user_id: m.id, aprovado: true })}
                      trigger={
                        <Button
                          size="sm"
                          disabled={mAprovar.isPending && mAprovar.variables?.user_id === m.id}
                          className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {mAprovar.isPending && mAprovar.variables?.user_id === m.id
                            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            : <Check className="h-4 w-4 mr-1" />}
                          Aprovar
                        </Button>
                      }
                    />
                    <ConfirmAction
                      title="Recusar cadastro"
                      description={`${m.nome} (${m.email}) será excluído permanentemente.`}
                      confirmLabel="Recusar"
                      destructive
                      onConfirm={() => mDelete.mutate(m.id)}
                      trigger={
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={mDelete.isPending && mDelete.variables === m.id}
                          className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {mDelete.isPending && mDelete.variables === m.id
                            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            : <X className="h-4 w-4 mr-1" />}
                          Recusar
                        </Button>
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* MEMBROS */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Membros</h3>

        {/* Mobile cards */}
        <div className="grid gap-3 md:hidden">
          {(membros.data ?? []).map((m: any) => (
            <Card key={m.id} className="p-4 space-y-3">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {m.nome}
                  {m.aprovado === false && <Badge variant="outline" className="text-amber-600 border-amber-400">Pendente</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">{m.email}</div>
                {m.cargo && <div className="text-xs text-muted-foreground">{m.cargo}</div>}
              </div>
              <div className="flex flex-wrap gap-1">
                {(m.user_roles ?? []).map((r: any) => (
                  <Badge key={r.role} variant="secondary">{roleLabel(r.role)}</Badge>
                ))}
              </div>
              <MembroActions
                m={m}
                onChangePapel={(role) => mUpdatePapel.mutate({ user_id: m.id, role })}
                onEdit={async (v) => { await adminUpdateFn({ data: { user_id: m.id, ...v } }); invalidate(); }}
                onSetPwd={async (password) => { await adminSetPwdFn({ data: { user_id: m.id, password } }); }}
                onReset={() => mReset.mutate(m.email)}
                onToggle={(disabled) => mToggle.mutate({ user_id: m.id, disabled })}
                onDelete={() => mDelete.mutate(m.id)}
              />
            </Card>
          ))}
          {membros.data?.length === 0 && (
            <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-6 text-center">Nenhum membro.</div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">E-mail</th>
                <th className="px-3 py-2">Papel</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(membros.data ?? []).map((m: any) => (
                <tr key={m.id} className="border-t">
                  <td className="px-3 py-2">{m.nome}{m.cargo && <div className="text-xs text-muted-foreground">{m.cargo}</div>}</td>
                  <td className="px-3 py-2">{m.email}</td>
                  <td className="px-3 py-2">
                    {(m.user_roles ?? []).map((r: any) => (
                      <Badge key={r.role} variant="secondary" className="mr-1">{roleLabel(r.role)}</Badge>
                    ))}
                  </td>
                  <td className="px-3 py-2">
                    {m.aprovado === false
                      ? <Badge variant="outline" className="text-amber-600 border-amber-400">Aguardando aprovação</Badge>
                      : <Badge variant="outline" className="text-emerald-600 border-emerald-400">Ativo</Badge>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <MembroActions
                      m={m}
                      onChangePapel={(role) => mUpdatePapel.mutate({ user_id: m.id, role })}
                      onEdit={async (v) => { await adminUpdateFn({ data: { user_id: m.id, ...v } }); invalidate(); }}
                      onSetPwd={async (password) => { await adminSetPwdFn({ data: { user_id: m.id, password } }); }}
                      onReset={() => mReset.mutate(m.email)}
                      onToggle={(disabled) => mToggle.mutate({ user_id: m.id, disabled })}
                      onDelete={() => mDelete.mutate(m.id)}
                    />
                  </td>
                </tr>
              ))}
              {membros.data?.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Nenhum membro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONVITES */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Convites</h3>
        <div className="border rounded-lg divide-y">
          {(convites.data ?? []).map((c: any) => {
            const now = Date.now();
            const expirado = !c.aceito && new Date(c.expires_at).getTime() < now;
            const status = c.aceito ? "aceito" : expirado ? "expirado" : "pendente";
            return (
              <div key={c.id} className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    {c.email}
                    {status === "aceito" && <Badge variant="outline" className="text-emerald-600 border-emerald-400">Aceito</Badge>}
                    {status === "pendente" && <Badge variant="outline" className="text-amber-600 border-amber-400">Pendente</Badge>}
                    {status === "expirado" && <Badge variant="outline" className="text-destructive border-destructive">Expirado</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {roleLabel(c.role)} · {status === "aceito" ? `aceito` : `expira ${new Date(c.expires_at).toLocaleDateString()}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!c.aceito && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => mReenviar.mutate(c.id)}
                      className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" /> Reenviar
                    </Button>
                  )}
                  {!c.aceito && (
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => mRevogarConv.mutate(c.id)}
                      className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Revogar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {(convites.data ?? []).length === 0 && (
            <div className="p-6 text-sm text-center text-muted-foreground">Nenhum convite.</div>
          )}
        </div>
      </div>

      {/* AUDITORIA */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <History className="h-4 w-4" /> Histórico de auditoria
        </h3>
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y max-h-96 overflow-y-auto text-sm">
            {(audit.data ?? []).map((log: any) => {
              const autor = log.autor_id ? membrosById.get(log.autor_id) : null;
              const alvo = log.alvo_user_id ? membrosById.get(log.alvo_user_id) : null;
              return (
                <li key={log.id} className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div>
                    <div className="font-medium">{acaoLabel(log.acao)}</div>
                    <div className="text-xs text-muted-foreground">
                      por {autor?.nome ?? "—"} {alvo || log.alvo_email ? `· alvo: ${alvo?.nome ?? log.alvo_email}` : ""}
                      {log.detalhes ? ` · ${JSON.stringify(log.detalhes)}` : ""}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </li>
              );
            })}
            {(audit.data ?? []).length === 0 && (
              <li className="p-6 text-center text-muted-foreground">Sem registros de auditoria.</li>
            )}
          </ul>
        </Card>
      </div>
    </section>
  );
}

const ACAO_LABELS: Record<string, string> = {
  convite_criado: "Convite criado",
  convite_reenviado: "Convite reenviado",
  convite_revogado: "Convite revogado",
  usuario_criado: "Usuário criado",
  usuario_editado: "Usuário editado",
  usuario_excluido: "Usuário excluído",
  usuario_desabilitado: "Usuário desabilitado",
  usuario_habilitado: "Usuário habilitado",
  usuario_aprovado: "Usuário aprovado",
  usuario_reprovado: "Aprovação removida",
  senha_definida: "Senha redefinida",
  senha_reset_enviado: "E-mail de reset enviado",
  papel_alterado: "Papel alterado",
};
const acaoLabel = (a: string) => ACAO_LABELS[a] ?? a;

function MembroActions({
  m, onChangePapel, onEdit, onSetPwd, onReset, onToggle, onDelete,
}: {
  m: any;
  onChangePapel: (role: string) => void;
  onEdit: (v: { nome: string; cargo?: string | null }) => Promise<void>;
  onSetPwd: (password: string) => Promise<void>;
  onReset: () => void;
  onToggle: (disabled: boolean) => void;
  onDelete: () => void;
}) {
  const currentRole = m.user_roles?.[0]?.role ?? "visualizador";
  return (
    <div className="flex flex-wrap items-center gap-2 justify-end">
      <Select defaultValue={currentRole} onValueChange={onChangePapel}>
        <SelectTrigger className="h-10 w-[150px] focus-visible:ring-2 focus-visible:ring-ring" aria-label="Alterar papel">
          <ShieldCheck className="h-4 w-4 mr-1" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
        </SelectContent>
      </Select>

      <EditMembroDialog m={m} onSave={onEdit} />
      <SetPasswordDialog onSave={onSetPwd} />

      <Button size="sm" variant="ghost" onClick={onReset} aria-label="Enviar e-mail de redefinição" className="min-h-11 min-w-11 focus-visible:ring-2 focus-visible:ring-ring">
        <Mail className="h-4 w-4" />
      </Button>

      <ConfirmAction
        title="Desabilitar usuário"
        description="O usuário não conseguirá acessar o sistema até ser reabilitado."
        confirmLabel="Desabilitar"
        onConfirm={() => onToggle(true)}
        trigger={
          <Button size="sm" variant="ghost" aria-label="Desabilitar usuário" className="min-h-11 min-w-11 focus-visible:ring-2 focus-visible:ring-ring">
            <Ban className="h-4 w-4" />
          </Button>
        }
      />

      <ConfirmAction
        title="Excluir usuário"
        description="Esta ação é permanente e remove o usuário e seus papéis."
        confirmLabel="Excluir"
        destructive
        onConfirm={onDelete}
        trigger={
          <Button size="sm" variant="ghost" aria-label="Excluir usuário" className="min-h-11 min-w-11 focus-visible:ring-2 focus-visible:ring-ring text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        }
      />
    </div>
  );
}

function NovoUsuarioDialog({ onCreate }: { onCreate: (v: { email: string; password: string; nome: string; role: string }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", password: "", role: "visualizador" });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring"><UserPlus className="h-4 w-4 mr-2" />Adicionar usuário</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Senha inicial</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div>
            <Label>Papel</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={async () => {
            try { await onCreate(form); toast.success("Usuário criado"); setOpen(false); setForm({ nome: "", email: "", password: "", role: "visualizador" }); }
            catch (e: any) { toast.error(e.message); }
          }}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovoConviteDialog({ onCreate }: { onCreate: (v: { email: string; role: string }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", role: "visualizador" });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring"><Mail className="h-4 w-4 mr-2" />Convidar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo convite</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div>
            <Label>Papel</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={async () => {
            try { await onCreate(form); toast.success("Convite enviado"); setOpen(false); setForm({ email: "", role: "visualizador" }); }
            catch (e: any) { toast.error(e.message); }
          }}>Enviar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditMembroDialog({ m, onSave }: { m: any; onSave: (v: { nome: string; cargo?: string | null }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: m.nome ?? "", cargo: m.cargo ?? "" });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label="Editar usuário" className="min-h-11 min-w-11 focus-visible:ring-2 focus-visible:ring-ring">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar {m.nome}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div><Label>Cargo</Label><Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={async () => {
            try { await onSave({ nome: form.nome, cargo: form.cargo || null }); toast.success("Atualizado"); setOpen(false); }
            catch (e: any) { toast.error(e.message); }
          }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SetPasswordDialog({ onSave }: { onSave: (password: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPassword(""); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label="Definir nova senha" className="min-h-11 min-w-11 focus-visible:ring-2 focus-visible:ring-ring">
          <KeyRound className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Cadastrar nova senha</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Label>Senha (mín. 8 caracteres)</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={async () => {
            if (password.length < 8) { toast.error("Senha muito curta"); return; }
            try { await onSave(password); toast.success("Senha atualizada"); setOpen(false); setPassword(""); }
            catch (e: any) { toast.error(e.message); }
          }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmAction({
  trigger, title, description, confirmLabel, destructive, onConfirm,
}: {
  trigger: React.ReactNode; title: string; description: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
