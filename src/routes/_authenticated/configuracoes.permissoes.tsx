import { createFileRoute, redirect, useBlocker } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Users, History, Search, RotateCcw, Save, ChevronLeft, ChevronRight, Loader2, ArrowUpDown, X } from "lucide-react";
import { getMe } from "@/lib/core.functions";
import {
  ACTIONS,
  ACTION_LABELS,
  RESOURCES,
  RESOURCE_LABELS,
  ROLES,
  ROLE_LABELS,
  atualizarOverrideUsuario,
  atualizarPermissaoPapel,
  listarAuditoriaPermissoes,
  listarMatrizPermissoes,
  resetarOverridesUsuario,
  type AppAction,
  type AppResource,
  type AppRole,
} from "@/lib/permissoes.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { notify } from "@/lib/toast";

export const Route = createFileRoute("/_authenticated/configuracoes/permissoes")({
  beforeLoad: async () => {
    const me = await getMe();
    const roles = me.roles ?? [];
    if (!roles.includes("master") && !roles.includes("admin") && !roles.includes("gestor_acessos")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: PermissoesPage,
});

const MSG_OK = "Permissão atualizada";

type OverrideVal = boolean | null;

function PermissoesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listarMatrizPermissoes);
  const auditFn = useServerFn(listarAuditoriaPermissoes);
  const upRoleFn = useServerFn(atualizarPermissaoPapel);
  const upOvFn = useServerFn(atualizarOverrideUsuario);
  const resetFn = useServerFn(resetarOverridesUsuario);

  const { data, isLoading } = useQuery({
    queryKey: ["matriz-permissoes"],
    queryFn: () => listFn(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["matriz-permissoes"] });
    qc.invalidateQueries({ queryKey: ["minhas-permissoes"] });
    qc.invalidateQueries({ queryKey: ["audit-permissoes"] });
  };

  const [papelSelecionado, setPapelSelecionado] = useState<AppRole>("engenheiro");
  const [busca, setBusca] = useState("");
  const [usuarioId, setUsuarioId] = useState<string>("");

  // Estado pendente (local) — só é enviado ao clicar em Aplicar.
  const [pendingRole, setPendingRole] = useState<Map<string, boolean>>(new Map());
  const [pendingOv, setPendingOv] = useState<Map<string, OverrideVal>>(new Map());
  const [saving, setSaving] = useState(false);

  const defaultsMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const d of data?.defaults ?? []) m.set(`${d.role}.${d.resource}.${d.action}`, d.allowed);
    return m;
  }, [data?.defaults]);

  const overridesMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const o of data?.overrides ?? []) m.set(`${o.user_id}.${o.resource}.${o.action}`, o.allowed);
    return m;
  }, [data?.overrides]);

  // Efetivo = base + pendente
  const effRole = (r: AppRole, res: AppResource, act: AppAction): boolean => {
    const k = `${r}.${res}.${act}`;
    if (pendingRole.has(k)) return pendingRole.get(k)!;
    return defaultsMap.get(k) ?? false;
  };
  const effOv = (u: string, res: AppResource, act: AppAction): OverrideVal => {
    const k = `${u}.${res}.${act}`;
    if (pendingOv.has(k)) return pendingOv.get(k)!;
    return overridesMap.has(k) ? overridesMap.get(k)! : null;
  };

  const setRole = (r: AppRole, res: AppResource, act: AppAction, allowed: boolean) => {
    const k = `${r}.${res}.${act}`;
    setPendingRole((prev) => {
      const m = new Map(prev);
      const base = defaultsMap.get(k) ?? false;
      if (base === allowed) m.delete(k);
      else m.set(k, allowed);
      return m;
    });
  };
  const setOv = (u: string, res: AppResource, act: AppAction, allowed: OverrideVal) => {
    const k = `${u}.${res}.${act}`;
    setPendingOv((prev) => {
      const m = new Map(prev);
      const base: OverrideVal = overridesMap.has(k) ? overridesMap.get(k)! : null;
      if (base === allowed) m.delete(k);
      else m.set(k, allowed);
      return m;
    });
  };

  const dirtyCount = pendingRole.size + pendingOv.size;
  const dirty = dirtyCount > 0;

  const usuariosFiltrados = useMemo(() => {
    const t = busca.toLowerCase().trim();
    const list = data?.usuarios ?? [];
    if (!t) return list;
    return list.filter((u: any) => u.nome.toLowerCase().includes(t) || u.email.toLowerCase().includes(t));
  }, [data?.usuarios, busca]);

  const usuarioSel = useMemo(
    () => (data?.usuarios ?? []).find((u: any) => u.id === usuarioId),
    [data?.usuarios, usuarioId],
  );

  // Bloquear navegação com alterações pendentes
  useBlocker({
    shouldBlockFn: () => {
      if (!dirty) return false;
      return !window.confirm("Você tem alterações não aplicadas. Sair sem aplicar?");
    },
    enableBeforeUnload: dirty,
  });
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const aplicar = async () => {
    setSaving(true);
    try {
      const jobs: Promise<any>[] = [];
      for (const [k, allowed] of pendingRole) {
        const [role, resource, action] = k.split(".") as [AppRole, AppResource, AppAction];
        jobs.push(upRoleFn({ data: { role, resource, action, allowed } }));
      }
      for (const [k, allowed] of pendingOv) {
        const [user_id, resource, action] = k.split(".") as [string, AppResource, AppAction];
        jobs.push(upOvFn({ data: { user_id, resource, action, allowed } }));
      }
      await Promise.all(jobs);
      setPendingRole(new Map());
      setPendingOv(new Map());
      notify.success(MSG_OK);
    } catch (e: any) {
      notify.error(e?.message ?? "Falha ao aplicar");
    } finally {
      setSaving(false);
      invalidate();
    }
  };

  const descartar = () => {
    if (!dirty) return;
    if (!window.confirm(`Descartar ${dirtyCount} alteração${dirtyCount > 1 ? "ões" : ""} pendente${dirtyCount > 1 ? "s" : ""}? Esta ação não pode ser desfeita.`)) return;
    setPendingRole(new Map());
    setPendingOv(new Map());
  };

  const { data: audit } = useQuery({
    queryKey: ["audit-permissoes"],
    queryFn: () => auditFn(),
  });

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        <header className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-brand/10 text-brand grid place-items-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-serif text-xl leading-none">Permissões detalhadas</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Marque/desmarque à vontade. Nada é gravado nem auditado até você clicar em <strong>Aplicar</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {dirty && (
              <span className="text-xs text-muted-foreground">
                {dirtyCount} alteração{dirtyCount > 1 ? "ões" : ""} pendente{dirtyCount > 1 ? "s" : ""}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={descartar} disabled={!dirty || saving}>
              Descartar
            </Button>
            <Button
              size="sm"
              onClick={aplicar}
              disabled={!dirty || saving}
              className={dirty && !saving ? "animate-pulse" : ""}
              aria-busy={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {saving ? "Aplicando…" : "Aplicar"}
            </Button>
          </div>
        </header>

        <Tabs defaultValue="papel" className="w-full">
          <TabsList>
            <TabsTrigger value="papel">
              <ShieldCheck className="h-4 w-4 mr-2" /> Por papel
            </TabsTrigger>
            <TabsTrigger value="usuario">
              <Users className="h-4 w-4 mr-2" /> Por usuário
            </TabsTrigger>
            <TabsTrigger value="audit">
              <History className="h-4 w-4 mr-2" /> Auditoria
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: papel */}
          <TabsContent value="papel" className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Papel:</span>
              <Select value={papelSelecionado} onValueChange={(v) => setPapelSelecionado(v as AppRole)}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(papelSelecionado === "admin" || papelSelecionado === "master") && (
                <span className="text-xs text-muted-foreground">
                  Os papéis admin/master sempre têm acesso total na empresa.
                </span>
              )}
            </div>

            <MatrizPapel
              isLoading={isLoading}
              role={papelSelecionado}
              effRole={effRole}
              pendingRole={pendingRole}
              onToggle={(resource, action, allowed) => setRole(papelSelecionado, resource, action, allowed)}
              onBulk={(resource, allowed) => {
                for (const action of ACTIONS) setRole(papelSelecionado, resource, action, allowed);
              }}
            />
          </TabsContent>

          {/* ABA 2: usuário */}
          <TabsContent value="usuario" className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8 w-[280px]"
                  placeholder="Buscar usuário…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <Select value={usuarioId} onValueChange={setUsuarioId}>
                <SelectTrigger className="w-[320px]">
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {usuariosFiltrados.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} — {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {usuarioSel && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!window.confirm("Resetar todas as exceções deste usuário?")) return;
                        try {
                          await resetFn({ data: { user_id: usuarioSel.id } });
                          notify.success(MSG_OK);
                          invalidate();
                        } catch (e: any) {
                          notify.error(e?.message ?? "Falha ao resetar");
                        }
                      }}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" /> Resetar para o papel
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Remove todas as exceções e restaura as permissões do papel. Aplicado imediatamente.</TooltipContent>
                </Tooltip>
              )}
            </div>

            {usuarioSel ? (
              <MatrizUsuario
                user={usuarioSel}
                defaultsMap={defaultsMap}
                effOv={effOv}
                pendingOv={pendingOv}
                onChange={(resource, action, allowed) => setOv(usuarioSel.id, resource, action, allowed)}
              />
            ) : (
              <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
                Selecione um usuário para editar exceções de permissão.
              </p>
            )}
          </TabsContent>

          {/* ABA 3: auditoria */}
          <TabsContent value="audit">
            <AuditoriaLista rows={audit ?? []} />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

function MatrizPapel({
  role,
  effRole,
  pendingRole,
  onToggle,
  onBulk,
  isLoading,
}: {
  role: AppRole;
  effRole: (r: AppRole, res: AppResource, act: AppAction) => boolean;
  pendingRole: Map<string, boolean>;
  onToggle: (r: AppResource, a: AppAction, allowed: boolean) => void;
  onBulk: (r: AppResource, allowed: boolean) => void;
  isLoading: boolean;
}) {
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  return (
    <div className="border rounded-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-2 text-left">Recurso</th>
            <th className="p-2 text-center">Todos</th>
            {ACTIONS.map((a) => (
              <th key={a} className="p-2 text-center">
                <Tooltip>
                  <TooltipTrigger className="cursor-help underline decoration-dotted">{ACTION_LABELS[a]}</TooltipTrigger>
                  <TooltipContent>{descAction(a)}</TooltipContent>
                </Tooltip>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RESOURCES.map((res) => {
            const marcados = ACTIONS.filter((act) => effRole(role, res, act)).length;
            const total = ACTIONS.length;
            const allChecked = marcados === total;
            const someChecked = marcados > 0 && marcados < total;
            return (
              <tr key={res} className="border-t">
                <td className="p-2 font-medium">
                  <Tooltip>
                    <TooltipTrigger className="cursor-help underline decoration-dotted">{RESOURCE_LABELS[res]}</TooltipTrigger>
                    <TooltipContent>{descResource(res)}</TooltipContent>
                  </Tooltip>
                </td>
                <td className="p-2 text-center">
                  <Checkbox
                    checked={allChecked ? true : someChecked ? "indeterminate" : false}
                    onCheckedChange={(v) => onBulk(res, Boolean(v))}
                    aria-label={`Selecionar todas as ações de ${RESOURCE_LABELS[res]}`}
                  />
                </td>
                {ACTIONS.map((act) => {
                  const allowed = effRole(role, res, act);
                  const isDirty = pendingRole.has(`${role}.${res}.${act}`);
                  return (
                    <td key={act} className={"p-2 text-center " + (isDirty ? "bg-amber-100/40 dark:bg-amber-900/20" : "")}>
                      <Checkbox
                        checked={allowed}
                        onCheckedChange={(v) => onToggle(res, act, Boolean(v))}
                        aria-label={`${RESOURCE_LABELS[res]} - ${ACTION_LABELS[act]}`}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MatrizUsuario({
  user,
  defaultsMap,
  effOv,
  pendingOv,
  onChange,
}: {
  user: { id: string; nome: string; email: string; roles: AppRole[] };
  defaultsMap: Map<string, boolean>;
  effOv: (u: string, res: AppResource, act: AppAction) => OverrideVal;
  pendingOv: Map<string, OverrideVal>;
  onChange: (r: AppResource, a: AppAction, allowed: OverrideVal) => void;
}) {
  const userRoles = user.roles ?? [];
  const inheritedFor = (res: AppResource, act: AppAction) =>
    userRoles.some((r) => defaultsMap.get(`${r}.${res}.${act}`) === true);

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        Papéis do usuário: <strong>{userRoles.map((r) => ROLE_LABELS[r] ?? r).join(", ") || "—"}</strong>
      </div>
      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Recurso</th>
              <th className="p-2 text-center">Todos</th>
              {ACTIONS.map((a) => (
                <th key={a} className="p-2 text-center">
                  {ACTION_LABELS[a]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RESOURCES.map((res) => (
              <tr key={res} className="border-t">
                <td className="p-2 font-medium">{RESOURCE_LABELS[res]}</td>
                <td className="p-2 text-center">
                  <Select
                    value=""
                    onValueChange={(v) => {
                      const novo: OverrideVal = v === "herdar" ? null : v === "permitir";
                      for (const act of ACTIONS) onChange(res, act, novo);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[120px] mx-auto text-xs">
                      <SelectValue placeholder="Aplicar…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="herdar">Herdar todos</SelectItem>
                      <SelectItem value="permitir">Permitir todos</SelectItem>
                      <SelectItem value="negar">Negar todos</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                {ACTIONS.map((act) => {
                  const ov = effOv(user.id, res, act);
                  const inherited = inheritedFor(res, act);
                  const value: "herdar" | "permitir" | "negar" =
                    ov === null ? "herdar" : ov ? "permitir" : "negar";
                  const isDirty = pendingOv.has(`${user.id}.${res}.${act}`);
                  return (
                    <td key={act} className={"p-2 text-center " + (isDirty ? "bg-amber-100/40 dark:bg-amber-900/20" : "")}>
                      <Select
                        value={value}
                        onValueChange={(v) =>
                          onChange(res, act, v === "herdar" ? null : v === "permitir")
                        }
                      >
                        <SelectTrigger className="h-8 w-[120px] mx-auto text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="herdar">
                            Herdar ({inherited ? "permitido" : "negado"})
                          </SelectItem>
                          <SelectItem value="permitir">Permitir</SelectItem>
                          <SelectItem value="negar">Negar</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =================== Auditoria: apresentação amigável ===================

const PAGE_SIZE = 100;

function AuditoriaLista({ rows }: { rows: any[] }) {
  const [page, setPage] = useState(1);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [q, setQ] = useState("");
  const [fRecurso, setFRecurso] = useState<string>("all");
  const [fAcao, setFAcao] = useState<string>("all");
  const [fTipo, setFTipo] = useState<string>("all"); // INSERT/UPDATE/DELETE
  const [fEscopo, setFEscopo] = useState<string>("all"); // role/override
  const [fPapel, setFPapel] = useState<string>("all");

  const filtered = useMemo(() => {
    const t = q.toLowerCase().trim();
    const arr = rows.filter((a: any) => {
      const det = a.detalhes ?? {};
      const rec = det.new ?? det.old ?? {};
      const acao: string = a.acao ?? "";
      const isRole = acao.includes("role_permissions");
      const isOverride = acao.includes("user_permission_overrides");
      const op: string = det.op ?? (acao.endsWith("_insert") ? "INSERT" : acao.endsWith("_update") ? "UPDATE" : acao.endsWith("_delete") ? "DELETE" : "");

      if (fRecurso !== "all" && rec.resource !== fRecurso) return false;
      if (fAcao !== "all" && rec.action !== fAcao) return false;
      if (fTipo !== "all" && op !== fTipo) return false;
      if (fEscopo === "role" && !isRole) return false;
      if (fEscopo === "override" && !isOverride) return false;
      if (fPapel !== "all" && rec.role !== fPapel) return false;

      if (t) {
        const hay = [
          a.autor?.nome, a.autor?.email, a.alvo?.nome, a.alvo?.email,
          rec.resource, rec.action, rec.role,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
    arr.sort((a: any, b: any) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortDir === "desc" ? db - da : da - db;
    });
    return arr;
  }, [rows, q, fRecurso, fAcao, fTipo, fEscopo, fPapel, sortDir]);

  useEffect(() => { setPage(1); }, [q, fRecurso, fAcao, fTipo, fEscopo, fPapel, sortDir]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const p = Math.min(page, pages);
  const start = (p - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  const limparFiltros = () => {
    setQ(""); setFRecurso("all"); setFAcao("all"); setFTipo("all"); setFEscopo("all"); setFPapel("all");
  };
  const hasFilters = q || fRecurso !== "all" || fAcao !== "all" || fTipo !== "all" || fEscopo !== "all" || fPapel !== "all";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 w-[240px] h-9" placeholder="Buscar usuário/autor…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={fRecurso} onValueChange={setFRecurso}>
          <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Recurso" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os recursos</SelectItem>
            {RESOURCES.map((r) => <SelectItem key={r} value={r}>{RESOURCE_LABELS[r]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fAcao} onValueChange={setFAcao}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {ACTIONS.map((a) => <SelectItem key={a} value={a}>{ACTION_LABELS[a]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fTipo} onValueChange={setFTipo}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda mudança</SelectItem>
            <SelectItem value="INSERT">Criada</SelectItem>
            <SelectItem value="UPDATE">Alterada</SelectItem>
            <SelectItem value="DELETE">Removida</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fEscopo} onValueChange={setFEscopo}>
          <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Escopo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Papel e usuário</SelectItem>
            <SelectItem value="role">Somente por papel</SelectItem>
            <SelectItem value="override">Somente por usuário</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fPapel} onValueChange={setFPapel}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Papel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os papéis</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={limparFiltros}>
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {total === 0
            ? "Nenhum registro"
            : `Mostrando ${start + 1}–${Math.min(start + PAGE_SIZE, total)} de ${total}`}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setPage((v) => Math.max(1, v - 1))} disabled={p <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2">Página {p} / {pages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((v) => Math.min(pages, v + 1))} disabled={p >= pages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-2 w-[180px]">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:underline"
                  onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                  title="Alternar ordenação"
                >
                  Quando <ArrowUpDown className="h-3 w-3" />
                  <span className="text-[10px] text-muted-foreground">({sortDir === "desc" ? "mais recente" : "mais antiga"})</span>
                </button>
              </th>
              <th className="p-2 w-[220px]">Ação</th>
              <th className="p-2">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((a) => {
              const f = formatAudit(a);
              return (
                <tr key={a.id} className="border-t align-top">
                  <td className="p-2 whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    <div className="text-[11px] text-muted-foreground">
                      por {a.autor?.nome ?? "—"}
                    </div>
                  </td>
                  <td className="p-2">
                    <span className={"inline-block px-2 py-0.5 rounded text-xs " + f.badgeClass}>{f.acao}</span>
                  </td>
                  <td className="p-2">
                    <div className="text-sm">{f.resumo}</div>
                    {f.linhas.length > 0 && (
                      <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {f.linhas.map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
            {slice.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-muted-foreground">
                  {hasFilters ? "Nenhum registro para os filtros aplicados." : "Sem registros ainda."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatAudit(a: any): {
  acao: string;
  badgeClass: string;
  resumo: string;
  linhas: string[];
} {
  const acao: string = a.acao ?? "";
  const det: any = a.detalhes ?? {};
  const rec = det.new ?? det.old ?? {};
  const isRole = acao.includes("role_permissions");
  const isOverride = acao.includes("user_permission_overrides");
  const op: string = det.op ?? (acao.endsWith("_insert") ? "INSERT" : acao.endsWith("_update") ? "UPDATE" : acao.endsWith("_delete") ? "DELETE" : "");

  const resource = rec.resource as AppResource | undefined;
  const action = rec.action as AppAction | undefined;
  const role = rec.role as AppRole | undefined;
  const allowedNew = det.new?.allowed;
  const allowedOld = det.old?.allowed;

  let tipo = "Permissão";
  if (isRole) tipo = "Permissão por papel";
  else if (isOverride) tipo = "Exceção de usuário";

  let verbo = op === "INSERT" ? "Criada" : op === "UPDATE" ? "Alterada" : op === "DELETE" ? "Removida" : "Alterada";
  let badgeClass =
    op === "INSERT"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
      : op === "DELETE"
        ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";

  const alvoNome = a.alvo?.nome ?? null;
  const partes: string[] = [];
  if (resource) partes.push(RESOURCE_LABELS[resource] ?? resource);
  if (action) partes.push(`→ ${ACTION_LABELS[action] ?? action}`);

  let resumo = `${verbo} ${tipo.toLowerCase()}`;
  if (partes.length) resumo += `: ${partes.join(" ")}`;
  if (isRole && role) resumo += ` (papel: ${ROLE_LABELS[role] ?? role})`;
  if (isOverride && alvoNome) resumo += ` (usuário: ${alvoNome})`;

  const linhas: string[] = [];
  if (op === "UPDATE" && allowedNew !== undefined && allowedOld !== undefined) {
    linhas.push(`De ${boolLabel(allowedOld)} para ${boolLabel(allowedNew)}`);
  } else if (op !== "UPDATE" && allowedNew !== undefined) {
    linhas.push(`Definido como ${boolLabel(allowedNew)}`);
  } else if (op === "DELETE" && allowedOld !== undefined) {
    linhas.push(`Era ${boolLabel(allowedOld)} — voltou a herdar do papel`);
  }

  return { acao: `${verbo} • ${tipo}`, badgeClass, resumo, linhas };
}

function boolLabel(v: any): string {
  if (v === true) return "Permitido";
  if (v === false) return "Negado";
  return "Herdar";
}

function descAction(a: AppAction) {
  return {
    ver: "Visualizar registros e telas relacionadas.",
    criar: "Criar novos registros.",
    editar: "Alterar registros existentes.",
    excluir: "Remover registros permanentemente.",
    aprovar: "Aprovar ou reprovar (ex.: RDOs enviados).",
    exportar: "Exportar dados (PDF, CSV, Excel).",
    importar: "Importar dados de arquivos externos (ex.: Excel).",
    solicitar_revisao: "Solicitar revisão de um registro enviado.",
  }[a];
}

function descResource(r: AppResource) {
  return {
    obras: "Cadastro de obras/canteiros.",
    rdos: "Diário de Obra (RDO) e seus anexos.",
    usuarios: "Usuários da empresa, papéis, convites e senhas.",
    relatorios: "Relatórios gerenciais e operacionais.",
    equipamentos: "Catálogo de equipamentos.",
    mao_de_obra: "Catálogo de mão de obra.",
    ocorrencias: "Tipos de ocorrência configuráveis.",
    convites: "Convites para novos usuários.",
    empresa: "Dados da empresa e configurações gerais.",
    permissoes: "Editar a matriz de permissões (esta tela).",
    templates_tarefas: "Modelos de lista de tarefas reutilizáveis.",
    listas_tarefas: "Listas de tarefas vinculadas a cada obra.",
  }[r];
}
