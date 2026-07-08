import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ShieldCheck, Users, History, Search, RotateCcw } from "lucide-react";
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
import { toast } from "sonner";

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
  };

  // Toast rápido, centralizado, para feedback instantâneo do usuário.
  const fastToast = { position: "top-center" as const, duration: 1200 };

  const mutRole = useMutation({
    mutationFn: (v: { role: AppRole; resource: AppResource; action: AppAction; allowed: boolean }) =>
      upRoleFn({ data: v }),
    onSuccess: () => {
      toast.success("Permissão atualizada", fastToast);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar", fastToast),
  });

  const mutOv = useMutation({
    mutationFn: (v: { user_id: string; resource: AppResource; action: AppAction; allowed: boolean | null }) =>
      upOvFn({ data: v }),
    onSuccess: () => {
      toast.success("Permissão atualizada", fastToast);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar", fastToast),
  });

  const mutReset = useMutation({
    mutationFn: (user_id: string) => resetFn({ data: { user_id } }),
    onSuccess: () => {
      toast.success("Permissões restauradas", fastToast);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao resetar", fastToast),
  });

  const [papelSelecionado, setPapelSelecionado] = useState<AppRole>("engenheiro");
  const [busca, setBusca] = useState("");
  const [usuarioId, setUsuarioId] = useState<string>("");

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
          <div>
            <h2 className="font-serif text-xl leading-none">Permissões detalhadas</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Defina, por papel e por usuário, exatamente o que cada um pode fazer no sistema.
            </p>
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
              defaultsMap={defaultsMap}
              onToggle={(resource, action, allowed) =>
                mutRole.mutate({ role: papelSelecionado, resource, action, allowed })
              }
              onBulk={async (resource, allowed) => {
                // Atualização otimista: reflete na UI antes de qualquer request.
                qc.setQueryData(["matriz-permissoes"], (prev: any) => {
                  if (!prev) return prev;
                  const defaults = [...(prev.defaults ?? [])];
                  for (const action of ACTIONS) {
                    const idx = defaults.findIndex(
                      (d: any) => d.role === papelSelecionado && d.resource === resource && d.action === action,
                    );
                    if (idx >= 0) defaults[idx] = { ...defaults[idx], allowed };
                    else defaults.push({ role: papelSelecionado, resource, action, allowed });
                  }
                  return { ...prev, defaults };
                });
                try {
                  await Promise.all(
                    ACTIONS.map((action) =>
                      upRoleFn({ data: { role: papelSelecionado, resource, action, allowed } }),
                    ),
                  );
                  toast.success("Permissões do recurso atualizadas", fastToast);
                } catch (e: any) {
                  toast.error(e?.message ?? "Falha ao atualizar", fastToast);
                } finally {
                  invalidate();
                }
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
                      onClick={() => mutReset.mutate(usuarioSel.id)}
                      disabled={mutReset.isPending}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" /> Resetar para o papel
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Remove todas as exceções e restaura as permissões do papel.</TooltipContent>
                </Tooltip>
              )}
            </div>

            {usuarioSel ? (
              <MatrizUsuario
                user={usuarioSel}
                defaultsMap={defaultsMap}
                overridesMap={overridesMap}
                onChange={(resource, action, allowed) =>
                  mutOv.mutate({ user_id: usuarioSel.id, resource, action, allowed })
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
                Selecione um usuário para editar exceções de permissão.
              </p>
            )}
          </TabsContent>

          {/* ABA 3: auditoria */}
          <TabsContent value="audit" className="space-y-2">
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-2">Quando</th>
                    <th className="p-2">Ação</th>
                    <th className="p-2">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {(audit ?? []).map((a: any) => (
                    <tr key={a.id} className="border-t align-top">
                      <td className="p-2 whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </td>
                      <td className="p-2 font-mono">{a.acao}</td>
                      <td className="p-2">
                        <pre className="text-[10px] whitespace-pre-wrap break-all">
                          {JSON.stringify(a.detalhes, null, 0)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                  {(audit ?? []).length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-muted-foreground">
                        Sem registros ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

function MatrizPapel({
  role,
  defaultsMap,
  onToggle,
  onBulk,
  isLoading,
}: {
  role: AppRole;
  defaultsMap: Map<string, boolean>;
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
            const marcados = ACTIONS.filter((act) => defaultsMap.get(`${role}.${res}.${act}`) ?? false).length;
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
                  const allowed = defaultsMap.get(`${role}.${res}.${act}`) ?? false;
                  return (
                    <td key={act} className="p-2 text-center">
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
  overridesMap,
  onChange,
}: {
  user: { id: string; nome: string; email: string; roles: AppRole[] };
  defaultsMap: Map<string, boolean>;
  overridesMap: Map<string, boolean>;
  onChange: (r: AppResource, a: AppAction, allowed: boolean | null) => void;
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
                      const novo = v === "herdar" ? null : v === "permitir";
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
                  const overrideKey = `${user.id}.${res}.${act}`;
                  const ov = overridesMap.has(overrideKey) ? overridesMap.get(overrideKey)! : null;
                  const inherited = inheritedFor(res, act);
                  const value: "herdar" | "permitir" | "negar" =
                    ov === null ? "herdar" : ov ? "permitir" : "negar";
                  return (
                    <td key={act} className="p-2 text-center">
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
