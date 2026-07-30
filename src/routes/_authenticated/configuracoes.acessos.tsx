import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  ShieldCheck,
  Search,
  Save,
  Loader2,
  Users,
  Layers,
  Plus,
  RotateCcw,
  Eye,
  Info,
  Building2,
} from "lucide-react";
import { getMe } from "@/lib/core.functions";
import {
  SCOPES,
  SCOPE_LABELS,
  SCOPE_HINTS,
  acaoLabel,
  limparGrantsUsuario,
  listarCatalogoAcessos,
  listarMatrizAcessos,
  meusAcessos,
  salvarEscoposUsuario,
  salvarGrantUsuario,
  salvarGrantsPapel,
  salvarModulo,
  salvarRecurso,
  type PermScope,
} from "@/lib/acessos.functions";
import { ROLES, ROLE_LABELS, type AppRole } from "@/lib/permissoes.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { notify } from "@/lib/toast";

export const Route = createFileRoute("/_authenticated/configuracoes/acessos")({
  beforeLoad: async () => {
    const me = await getMe();
    const roles = me.roles ?? [];
    if (!roles.includes("master") && !roles.includes("admin") && !roles.includes("gestor_acessos")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Controle de acessos — FACOM" },
      { name: "description", content: "Defina com precisão o que cada pessoa vê e faz em cada módulo do sistema." },
      { property: "og:title", content: "Controle de acessos" },
      { property: "og:description", content: "Permissões por papel, por pessoa e por escopo de obra/equipe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AcessosPage,
});

type Modulo = { key: string; nome: string; descricao: string | null; ordem: number; ativo: boolean };
type Recurso = { key: string; modulo_key: string; nome: string; acoes: string[]; ordem: number; ativo: boolean };

function AcessosPage() {
  const qc = useQueryClient();
  const catalogoFn = useServerFn(listarCatalogoAcessos);
  const matrizFn = useServerFn(listarMatrizAcessos);

  const catalogo = useQuery({ queryKey: ["acessos-catalogo"], queryFn: () => catalogoFn() });
  const matriz = useQuery({ queryKey: ["acessos-matriz"], queryFn: () => matrizFn() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["acessos-matriz"] });
    qc.invalidateQueries({ queryKey: ["acessos-catalogo"] });
    qc.invalidateQueries({ queryKey: ["meus-acessos"] });
  };

  const modulos = (catalogo.data?.modulos ?? []) as Modulo[];
  const recursos = (catalogo.data?.recursos ?? []) as Recurso[];

  const carregando = catalogo.isLoading || matriz.isLoading;

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-md bg-brand/10 text-brand grid place-items-center shrink-0">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-serif text-xl leading-none">Controle de acessos</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Aqui você decide, em linguagem simples, <strong>quem faz o quê</strong> em cada parte do sistema e{" "}
            <strong>de quem</strong> a pessoa enxerga as informações. Quem não tem permissão simplesmente não vê a tela.
          </p>
        </div>
      </header>

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando acessos...
        </div>
      ) : (
        <Tabs defaultValue="papeis">
          <TabsList>
            <TabsTrigger value="papeis" className="gap-1.5">
              <Users className="h-4 w-4" /> Por perfil
            </TabsTrigger>
            <TabsTrigger value="pessoas" className="gap-1.5">
              <Eye className="h-4 w-4" /> Por pessoa
            </TabsTrigger>
            <TabsTrigger value="catalogo" className="gap-1.5">
              <Layers className="h-4 w-4" /> Módulos e telas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="papeis" className="mt-4">
            <AbaPapeis modulos={modulos} recursos={recursos} matriz={matriz.data} onSaved={invalidate} />
          </TabsContent>
          <TabsContent value="pessoas" className="mt-4">
            <AbaPessoas modulos={modulos} recursos={recursos} matriz={matriz.data} onSaved={invalidate} />
          </TabsContent>
          <TabsContent value="catalogo" className="mt-4">
            <AbaCatalogo modulos={modulos} recursos={recursos} onSaved={invalidate} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/* ============================ ABA: POR PERFIL ============================ */

function AbaPapeis({
  modulos,
  recursos,
  matriz,
  onSaved,
}: {
  modulos: Modulo[];
  recursos: Recurso[];
  matriz: any;
  onSaved: () => void;
}) {
  const salvarFn = useServerFn(salvarGrantsPapel);
  const [papel, setPapel] = useState<AppRole>("engenheiro");
  const [busca, setBusca] = useState("");
  const [pend, setPend] = useState<Map<string, { allowed: boolean; scope: PermScope }>>(new Map());
  const [salvando, setSalvando] = useState(false);

  const atual = useMemo(() => {
    const m = new Map<string, { allowed: boolean; scope: PermScope }>();
    for (const g of matriz?.roleGrants ?? []) {
      if (g.role !== papel) continue;
      m.set(`${g.recurso_key}|${g.acao}`, { allowed: g.allowed, scope: g.scope });
    }
    return m;
  }, [matriz, papel]);

  const valor = (recurso: string, acao: string) =>
    pend.get(`${recurso}|${acao}`) ?? atual.get(`${recurso}|${acao}`) ?? { allowed: false, scope: "empresa" as PermScope };

  const setValor = (recurso: string, acao: string, v: { allowed: boolean; scope: PermScope }) => {
    setPend((p) => new Map(p).set(`${recurso}|${acao}`, v));
  };

  const recursosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return recursos;
    return recursos.filter(
      (r) => r.nome.toLowerCase().includes(q) || r.key.toLowerCase().includes(q) || r.modulo_key.includes(q),
    );
  }, [recursos, busca]);

  const totalPermitido = useMemo(() => {
    let n = 0;
    for (const r of recursos) for (const a of r.acoes) if (valor(r.key, a).allowed) n++;
    return n;
  }, [recursos, pend, atual]);

  async function salvar() {
    if (pend.size === 0) return;
    setSalvando(true);
    try {
      const itens = Array.from(pend.entries()).map(([k, v]) => {
        const [recurso_key, acao] = k.split("|");
        return { recurso_key, acao, allowed: v.allowed, scope: v.scope };
      });
      await salvarFn({ data: { role: papel, itens } });
      setPend(new Map());
      onSaved();
      notify.success(`Acessos do perfil ${ROLE_LABELS[papel]} atualizados`);
    } catch (e: any) {
      notify.error(e?.message ?? "Não foi possível salvar");
    } finally {
      setSalvando(false);
    }
  }

  function marcarModulo(moduloKey: string, allowed: boolean) {
    const next = new Map(pend);
    for (const r of recursos.filter((x) => x.modulo_key === moduloKey)) {
      for (const a of r.acoes) {
        const v = valor(r.key, a);
        next.set(`${r.key}|${a}`, { allowed, scope: v.scope });
      }
    }
    setPend(next);
  }

  const bloqueado = papel === "master";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="w-full sm:w-64">
          <Label className="text-xs text-muted-foreground">Perfil</Label>
          <Select value={papel} onValueChange={(v) => { setPapel(v as AppRole); setPend(new Map()); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">Buscar tela</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Ex.: RDO, obras, chamados..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
        <Button onClick={salvar} disabled={pend.size === 0 || salvando} className="gap-2">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Aplicar {pend.size > 0 ? `(${pend.size})` : ""}
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5" />
        <span>
          {bloqueado
            ? "O perfil Master tem acesso total e não deve ser reduzido."
            : `${totalPermitido} permissões liberadas para ${ROLE_LABELS[papel]}.`}
        </span>
      </div>

      <Accordion type="multiple" className="border border-border rounded-lg divide-y divide-border">
        {modulos.map((m) => {
          const recs = recursosFiltrados.filter((r) => r.modulo_key === m.key);
          if (recs.length === 0) return null;
          const liberadas = recs.reduce((acc, r) => acc + r.acoes.filter((a) => valor(r.key, a).allowed).length, 0);
          const total = recs.reduce((acc, r) => acc + r.acoes.length, 0);
          return (
            <AccordionItem key={m.key} value={m.key} className="border-0 px-3">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <span className="font-medium">{m.nome}</span>
                  <Badge variant={liberadas === 0 ? "outline" : "secondary"}>
                    {liberadas} de {total}
                  </Badge>
                  {!m.ativo && <Badge variant="outline">inativo</Badge>}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="flex gap-2 mb-3">
                  <Button size="sm" variant="outline" disabled={bloqueado} onClick={() => marcarModulo(m.key, true)}>
                    Liberar tudo
                  </Button>
                  <Button size="sm" variant="outline" disabled={bloqueado} onClick={() => marcarModulo(m.key, false)}>
                    Bloquear tudo
                  </Button>
                </div>
                <div className="space-y-4">
                  {recs.map((r) => (
                    <div key={r.key} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div>
                          <p className="text-sm font-medium">{r.nome}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{r.key}</p>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {r.acoes.map((a) => {
                          const v = valor(r.key, a);
                          return (
                            <div key={a} className="flex items-center justify-between gap-2 rounded border border-border/60 px-2.5 py-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Switch
                                  checked={v.allowed}
                                  disabled={bloqueado}
                                  onCheckedChange={(c) => setValor(r.key, a, { ...v, allowed: c })}
                                  aria-label={`${acaoLabel(a)} em ${r.nome}`}
                                />
                                <span className="text-sm truncate">{acaoLabel(a)}</span>
                              </div>
                              {v.allowed && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>
                                        <Select
                                          value={v.scope}
                                          disabled={bloqueado}
                                          onValueChange={(s) => setValor(r.key, a, { ...v, scope: s as PermScope })}
                                        >
                                          <SelectTrigger className="h-7 w-[150px] text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {SCOPES.map((s) => (
                                              <SelectItem key={s} value={s} className="text-xs">
                                                {SCOPE_LABELS[s]}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>{SCOPE_HINTS[v.scope]}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

/* ============================ ABA: POR PESSOA ============================ */

function AbaPessoas({
  modulos,
  recursos,
  matriz,
  onSaved,
}: {
  modulos: Modulo[];
  recursos: Recurso[];
  matriz: any;
  onSaved: () => void;
}) {
  const salvarGrant = useServerFn(salvarGrantUsuario);
  const limparFn = useServerFn(limparGrantsUsuario);
  const salvarEscopos = useServerFn(salvarEscoposUsuario);

  const usuarios = (matriz?.usuarios ?? []) as Array<{ id: string; nome: string; email: string; roles: string[] }>;
  const obras = (matriz?.obras ?? []) as Array<{ id: string; nome: string }>;
  const grupos = (matriz?.grupos ?? []) as Array<{ id: string; nome: string }>;

  const [userId, setUserId] = useState<string>(usuarios[0]?.id ?? "");
  const [busca, setBusca] = useState("");
  const [salvandoEscopo, setSalvandoEscopo] = useState(false);

  const usuario = usuarios.find((u) => u.id === userId);

  const grantsUsuario = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const g of matriz?.userGrants ?? []) if (g.user_id === userId) m.set(`${g.recurso_key}|${g.acao}`, g.allowed);
    return m;
  }, [matriz, userId]);

  const herdado = useMemo(() => {
    const m = new Map<string, PermScope>();
    const roles = new Set(usuario?.roles ?? []);
    for (const g of matriz?.roleGrants ?? []) {
      if (!g.allowed || !roles.has(g.role)) continue;
      m.set(`${g.recurso_key}|${g.acao}`, g.scope);
    }
    return m;
  }, [matriz, usuario]);

  const [obrasSel, setObrasSel] = useState<Set<string> | null>(null);
  const [gruposSel, setGruposSel] = useState<Set<string> | null>(null);

  const escoposAtuais = useMemo(() => {
    const o = new Set<string>();
    const g = new Set<string>();
    for (const s of matriz?.userScopes ?? []) {
      if (s.user_id !== userId || !s.escopo_id) continue;
      if (s.escopo_tipo === "obra") o.add(s.escopo_id);
      if (s.escopo_tipo === "grupo") g.add(s.escopo_id);
    }
    return { o, g };
  }, [matriz, userId]);

  const obrasMarcadas = obrasSel ?? escoposAtuais.o;
  const gruposMarcados = gruposSel ?? escoposAtuais.g;

  const recursosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return recursos;
    return recursos.filter((r) => r.nome.toLowerCase().includes(q) || r.key.toLowerCase().includes(q));
  }, [recursos, busca]);

  async function alterar(recurso: string, acao: string, estado: "herdado" | "liberado" | "bloqueado") {
    try {
      await salvarGrant({
        data: {
          user_id: userId,
          recurso_key: recurso,
          acao,
          allowed: estado === "herdado" ? null : estado === "liberado",
        },
      });
      onSaved();
      notify.success("Acesso atualizado");
    } catch (e: any) {
      notify.error(e?.message ?? "Não foi possível atualizar");
    }
  }

  async function gravarEscopos() {
    setSalvandoEscopo(true);
    try {
      await salvarEscopos({
        data: { user_id: userId, obras: Array.from(obrasMarcadas), grupos: Array.from(gruposMarcados) },
      });
      setObrasSel(null);
      setGruposSel(null);
      onSaved();
      notify.success("Obras e equipes atualizadas");
    } catch (e: any) {
      notify.error(e?.message ?? "Não foi possível salvar");
    } finally {
      setSalvandoEscopo(false);
    }
  }

  if (usuarios.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado nesta empresa.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="w-full sm:w-80">
          <Label className="text-xs text-muted-foreground">Pessoa</Label>
          <Select value={userId} onValueChange={(v) => { setUserId(v); setObrasSel(null); setGruposSel(null); }}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {usuarios.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nome} — {u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">Buscar tela</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Ex.: RDO, chamados..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={async () => {
            try {
              await limparFn({ data: { user_id: userId } });
              onSaved();
              notify.success("Exceções removidas — a pessoa voltou ao padrão do perfil");
            } catch (e: any) {
              notify.error(e?.message ?? "Falhou");
            }
          }}
        >
          <RotateCcw className="h-4 w-4" /> Voltar ao padrão
        </Button>
      </div>

      {usuario && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Perfis:</span>
          {usuario.roles.length === 0 ? (
            <Badge variant="outline">nenhum</Badge>
          ) : (
            usuario.roles.map((r) => <Badge key={r} variant="secondary">{ROLE_LABELS[r as AppRole] ?? r}</Badge>)
          )}
        </div>
      )}

      {/* Escopo: de quem ele vê */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-medium">De quem esta pessoa enxerga os dados</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Quando o alcance de uma permissão for <strong>“Da equipe / obras dele”</strong>, ela verá somente os registros das
          obras e grupos marcados abaixo. Sem nenhuma marcação, ela vê apenas o que participa diretamente.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium mb-2">Obras</p>
            <div className="max-h-48 overflow-auto space-y-1.5 pr-1">
              {obras.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma obra.</p>}
              {obras.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={obrasMarcadas.has(o.id)}
                    onCheckedChange={(c) => {
                      const s = new Set(obrasMarcadas);
                      c ? s.add(o.id) : s.delete(o.id);
                      setObrasSel(s);
                    }}
                  />
                  <span className="truncate">{o.nome}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">Grupos / equipes</p>
            <div className="max-h-48 overflow-auto space-y-1.5 pr-1">
              {grupos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum grupo.</p>}
              {grupos.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={gruposMarcados.has(g.id)}
                    onCheckedChange={(c) => {
                      const s = new Set(gruposMarcados);
                      c ? s.add(g.id) : s.delete(g.id);
                      setGruposSel(s);
                    }}
                  />
                  <span className="truncate">{g.nome}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <Button size="sm" className="gap-2" onClick={gravarEscopos} disabled={salvandoEscopo}>
          {salvandoEscopo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar abrangência
        </Button>
      </div>

      {/* Exceções */}
      <Accordion type="multiple" className="border border-border rounded-lg divide-y divide-border">
        {modulos.map((m) => {
          const recs = recursosFiltrados.filter((r) => r.modulo_key === m.key);
          if (recs.length === 0) return null;
          return (
            <AccordionItem key={m.key} value={m.key} className="border-0 px-3">
              <AccordionTrigger className="hover:no-underline">
                <span className="font-medium">{m.nome}</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-3">
                {recs.map((r) => (
                  <div key={r.key} className="rounded-md border border-border p-3">
                    <p className="text-sm font-medium mb-2">{r.nome}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {r.acoes.map((a) => {
                        const k = `${r.key}|${a}`;
                        const excecao = grantsUsuario.get(k);
                        const escopoHerdado = herdado.get(k);
                        const estado: "herdado" | "liberado" | "bloqueado" =
                          excecao === undefined ? "herdado" : excecao ? "liberado" : "bloqueado";
                        return (
                          <div key={a} className="flex items-center justify-between gap-2 rounded border border-border/60 px-2.5 py-2">
                            <div className="min-w-0">
                              <p className="text-sm truncate">{acaoLabel(a)}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {escopoHerdado ? `Perfil libera: ${SCOPE_LABELS[escopoHerdado]}` : "Perfil não libera"}
                              </p>
                            </div>
                            <Select value={estado} onValueChange={(v) => alterar(r.key, a, v as any)}>
                              <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="herdado" className="text-xs">Seguir o perfil</SelectItem>
                                <SelectItem value="liberado" className="text-xs">Liberar sempre</SelectItem>
                                <SelectItem value="bloqueado" className="text-xs">Bloquear sempre</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

/* ============================ ABA: CATÁLOGO ============================ */

const ACOES_DISPONIVEIS = [
  "ver",
  "criar",
  "editar",
  "excluir",
  "aprovar",
  "exportar",
  "importar",
  "atribuir",
  "comentar",
  "encerrar",
];

function AbaCatalogo({
  modulos,
  recursos,
  onSaved,
}: {
  modulos: Modulo[];
  recursos: Recurso[];
  onSaved: () => void;
}) {
  const modFn = useServerFn(salvarModulo);
  const recFn = useServerFn(salvarRecurso);
  const [openMod, setOpenMod] = useState(false);
  const [openRec, setOpenRec] = useState(false);

  const [mKey, setMKey] = useState("");
  const [mNome, setMNome] = useState("");
  const [mRota, setMRota] = useState("");

  const [rModulo, setRModulo] = useState(modulos[0]?.key ?? "");
  const [rKey, setRKey] = useState("");
  const [rNome, setRNome] = useState("");
  const [rRota, setRRota] = useState("");
  const [rAcoes, setRAcoes] = useState<string[]>(["ver", "criar", "editar", "excluir"]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-2xl">
          O sistema cresce por aqui: cadastre um novo módulo (por exemplo Chamados, Patrimônio, Protocolo) ou uma nova tela
          e ela passa a aparecer automaticamente na matriz de permissões.
        </p>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpenMod(true)}>
            <Plus className="h-4 w-4" /> Módulo
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setOpenRec(true)}>
            <Plus className="h-4 w-4" /> Tela
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {modulos.map((m) => (
          <div key={m.key} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm">{m.nome}</p>
              <Badge variant="outline" className="font-mono text-[10px]">{m.key}</Badge>
            </div>
            {m.descricao && <p className="text-xs text-muted-foreground mt-1">{m.descricao}</p>}
            <ul className="mt-2 space-y-1">
              {recursos.filter((r) => r.modulo_key === m.key).map((r) => (
                <li key={r.key} className="text-xs flex items-center justify-between gap-2">
                  <span className="truncate">{r.nome}</span>
                  <span className="text-muted-foreground shrink-0">{r.acoes.length} ações</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <Dialog open={openMod} onOpenChange={setOpenMod}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo módulo</DialogTitle>
            <DialogDescription>Um módulo é uma aplicação do ERP (ex.: Chamados).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Identificador</Label>
              <Input value={mKey} onChange={(e) => setMKey(e.target.value)} placeholder="chamados" />
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={mNome} onChange={(e) => setMNome(e.target.value)} placeholder="Chamados" />
            </div>
            <div>
              <Label>Rota (opcional)</Label>
              <Input value={mRota} onChange={(e) => setMRota(e.target.value)} placeholder="/chamados" />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                try {
                  await modFn({ data: { key: mKey.trim(), nome: mNome.trim(), rota: mRota.trim() || undefined, ordem: 100, ativo: true } });
                  setOpenMod(false);
                  setMKey(""); setMNome(""); setMRota("");
                  onSaved();
                  notify.success("Módulo cadastrado");
                } catch (e: any) {
                  notify.error(e?.message ?? "Falhou");
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openRec} onOpenChange={setOpenRec}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova tela / recurso</DialogTitle>
            <DialogDescription>Escolha o módulo e quais ações podem ser controladas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Módulo</Label>
              <Select value={rModulo} onValueChange={setRModulo}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {modulos.map((m) => <SelectItem key={m.key} value={m.key}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Identificador</Label>
              <Input value={rKey} onChange={(e) => setRKey(e.target.value)} placeholder="chamados.tickets" />
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={rNome} onChange={(e) => setRNome(e.target.value)} placeholder="Chamados" />
            </div>
            <div>
              <Label>Rota (opcional)</Label>
              <Input value={rRota} onChange={(e) => setRRota(e.target.value)} placeholder="/chamados" />
            </div>
            <div>
              <Label>Ações</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {ACOES_DISPONIVEIS.map((a) => (
                  <label key={a} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={rAcoes.includes(a)}
                      onCheckedChange={(c) => setRAcoes((prev) => (c ? [...prev, a] : prev.filter((x) => x !== a)))}
                    />
                    {acaoLabel(a)}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                try {
                  await recFn({
                    data: {
                      modulo_key: rModulo,
                      key: rKey.trim(),
                      nome: rNome.trim(),
                      rota: rRota.trim() || undefined,
                      acoes: rAcoes,
                      ordem: 100,
                      ativo: true,
                    },
                  });
                  setOpenRec(false);
                  setRKey(""); setRNome(""); setRRota("");
                  onSaved();
                  notify.success("Tela cadastrada — já aparece na matriz");
                } catch (e: any) {
                  notify.error(e?.message ?? "Falhou");
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
