import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listarGrupos, criarGrupo, excluirGrupo,
  adicionarMembro, removerMembro, listarUsuariosDaEmpresa,
} from "@/lib/grupos.functions";
import { listObras } from "@/lib/obras.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/configuracoes/grupos")({
  component: GruposPage,
});

function GruposPage() {
  return (
    <Tabs defaultValue="globais">
      <TabsList>
        <TabsTrigger value="globais">Grupos globais</TabsTrigger>
        <TabsTrigger value="equipes">Equipes por obra</TabsTrigger>
      </TabsList>
      <TabsContent value="globais"><GruposLista tipo="global" /></TabsContent>
      <TabsContent value="equipes"><GruposLista tipo="equipe_obra" /></TabsContent>
    </Tabs>
  );
}

function GruposLista({ tipo }: { tipo: "global" | "equipe_obra" }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listarGrupos);
  const usersFn = useServerFn(listarUsuariosDaEmpresa);
  const obrasFn = useServerFn(listObras);
  const criarFn = useServerFn(criarGrupo);
  const excluirFn = useServerFn(excluirGrupo);
  const addFn = useServerFn(adicionarMembro);
  const remFn = useServerFn(removerMembro);

  const { data: grupos = [] } = useQuery({ queryKey: ["grupos", tipo], queryFn: () => listFn({ data: { tipo } }) });
  const { data: users = [] } = useQuery({ queryKey: ["empresa-users"], queryFn: () => usersFn() });
  const { data: obras = [] } = useQuery({ queryKey: ["obras-min"], queryFn: () => obrasFn() });

  const [nome, setNome] = useState("");
  const [obraId, setObraId] = useState("");

  const criar = useMutation({
    mutationFn: () => criarFn({ data: { nome, tipo, obra_id: tipo === "equipe_obra" ? obraId : null } }),
    onSuccess: () => { setNome(""); setObraId(""); toast.success("Grupo criado"); qc.invalidateQueries({ queryKey: ["grupos", tipo] }); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao criar"),
  });
  const excluir = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: () => { toast.success("Grupo excluído"); qc.invalidateQueries({ queryKey: ["grupos", tipo] }); },
  });

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4">
        <h3 className="font-medium mb-3">Novo {tipo === "global" ? "grupo global" : "equipe de obra"}</h3>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground block">Nome</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Engenharia" />
          </div>
          {tipo === "equipe_obra" && (
            <div className="min-w-[200px]">
              <label className="text-xs text-muted-foreground block">Obra</label>
              <select className="w-full text-sm border border-border rounded-md px-2 py-2 bg-background"
                value={obraId} onChange={(e) => setObraId(e.target.value)}>
                <option value="">Selecione…</option>
                {(obras as any[]).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
          )}
          <Button onClick={() => criar.mutate()} disabled={!nome || (tipo === "equipe_obra" && !obraId) || criar.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Criar
          </Button>
        </div>
      </Card>

      {grupos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum grupo cadastrado.</p>
      ) : (
        (grupos as any[]).map((g) => (
          <Card key={g.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-medium">{g.nome}</div>
                {tipo === "equipe_obra" && (
                  <div className="text-xs text-muted-foreground">Obra: {(obras as any[]).find((o) => o.id === g.obra_id)?.nome ?? "—"}</div>
                )}
              </div>
              <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir grupo?")) excluir.mutate(g.id); }} aria-label="Excluir grupo">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <MembrosEditor
              grupoId={g.id}
              membros={g.membros ?? []}
              users={users as any[]}
              onAdd={(uid) => addFn({ data: { grupo_id: g.id, user_id: uid } }).then(() => qc.invalidateQueries({ queryKey: ["grupos", tipo] }))}
              onRemove={(uid) => remFn({ data: { grupo_id: g.id, user_id: uid } }).then(() => qc.invalidateQueries({ queryKey: ["grupos", tipo] }))}
            />
          </Card>
        ))
      )}
    </div>
  );
}

function MembrosEditor({
  membros, users, onAdd, onRemove,
}: { grupoId: string; membros: string[]; users: any[]; onAdd: (uid: string) => Promise<any>; onRemove: (uid: string) => Promise<any> }) {
  const [sel, setSel] = useState("");
  const disponiveis = users.filter((u) => !membros.includes(u.id));
  return (
    <div>
      <div className="flex items-end gap-2 mb-2">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground block">Adicionar membro</label>
          <select className="w-full text-sm border border-border rounded-md px-2 py-2 bg-background"
            value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="">Selecione…</option>
            {disponiveis.map((u) => <option key={u.id} value={u.id}>{u.nome ?? u.email}</option>)}
          </select>
        </div>
        <Button size="sm" disabled={!sel} onClick={() => { onAdd(sel).then(() => setSel("")); }}>
          <UserPlus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>
      {membros.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum membro.</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {membros.map((uid) => {
            const u = users.find((x) => x.id === uid);
            return (
              <span key={uid} className="inline-flex items-center gap-1 bg-muted text-xs rounded-full pl-2 pr-1 py-0.5">
                {u?.nome ?? u?.email ?? uid.slice(0, 8)}
                <button onClick={() => onRemove(uid)} className="hover:text-destructive" aria-label="Remover">
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
