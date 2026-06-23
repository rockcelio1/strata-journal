import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listarAcessosRdo, concederAcessoRdo, revogarAcessoRdo,
  listarGrupos, listarUsuariosDaEmpresa,
} from "@/lib/grupos.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

type Nivel = "ver" | "editar" | "aprovar";
type Sujeito = "user" | "grupo";

const NIVEL_LABEL: Record<Nivel, string> = { ver: "Ver", editar: "Editar", aprovar: "Aprovar" };

export function RdoAcessoCard({ rdoId, obraId }: { rdoId: string; obraId?: string | null }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listarAcessosRdo);
  const usersFn = useServerFn(listarUsuariosDaEmpresa);
  const gruposFn = useServerFn(listarGrupos);
  const grantFn = useServerFn(concederAcessoRdo);
  const revokeFn = useServerFn(revogarAcessoRdo);

  const { data: acessos = [] } = useQuery({
    queryKey: ["rdo-acessos", rdoId],
    queryFn: () => listFn({ data: { rdo_id: rdoId } }),
  });
  const { data: users = [] } = useQuery({ queryKey: ["empresa-users"], queryFn: () => usersFn() });
  const { data: grupos = [] } = useQuery({
    queryKey: ["grupos", obraId ?? null],
    queryFn: () => gruposFn({ data: {} }),
  });

  const [tipo, setTipo] = useState<Sujeito>("user");
  const [alvo, setAlvo] = useState<string>("");
  const [nivel, setNivel] = useState<Nivel>("ver");

  const grant = useMutation({
    mutationFn: () => grantFn({ data: { rdo_id: rdoId, sujeito_tipo: tipo, sujeito_id: alvo, nivel } }),
    onSuccess: () => {
      toast.success("Acesso concedido");
      setAlvo("");
      qc.invalidateQueries({ queryKey: ["rdo-acessos", rdoId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao conceder"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Acesso revogado");
      qc.invalidateQueries({ queryKey: ["rdo-acessos", rdoId] });
    },
  });

  const opcoes = tipo === "user"
    ? (users as any[]).map((u) => ({ id: u.id, label: u.nome ?? u.email ?? u.id }))
    : (grupos as any[])
        .filter((g) => g.tipo === "global" || (obraId && g.obra_id === obraId))
        .map((g) => ({ id: g.id, label: `${g.nome}${g.tipo === "equipe_obra" ? " (equipe)" : ""}` }));

  return (
    <Card className="p-4 mb-4">
      <h3 className="font-serif text-lg flex items-center gap-2 mb-3">
        <ShieldCheck className="h-4 w-4" /> Acesso ao RDO
      </h3>

      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div>
          <label className="text-xs text-muted-foreground block">Tipo</label>
          <select className="text-sm border border-border rounded-md px-2 py-1 bg-background"
            value={tipo} onChange={(e) => { setTipo(e.target.value as Sujeito); setAlvo(""); }}>
            <option value="user">Usuário</option>
            <option value="grupo">Grupo / Equipe</option>
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="text-xs text-muted-foreground block">{tipo === "user" ? "Usuário" : "Grupo"}</label>
          <select className="w-full text-sm border border-border rounded-md px-2 py-1 bg-background"
            value={alvo} onChange={(e) => setAlvo(e.target.value)}>
            <option value="">Selecione…</option>
            {opcoes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block">Nível</label>
          <select className="text-sm border border-border rounded-md px-2 py-1 bg-background"
            value={nivel} onChange={(e) => setNivel(e.target.value as Nivel)}>
            <option value="ver">Ver</option>
            <option value="editar">Editar</option>
            <option value="aprovar">Aprovar</option>
          </select>
        </div>
        <Button size="sm" disabled={!alvo || grant.isPending} onClick={() => grant.mutate()}>
          <Plus className="h-4 w-4 mr-1" /> Conceder
        </Button>
      </div>

      {acessos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem acessos personalizados. Master/Admin e o autor têm acesso por padrão.</p>
      ) : (
        <div className="divide-y divide-border border border-border rounded-md">
          {(acessos as any[]).map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{a.label}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {a.sujeito_tipo === "user" ? "Usuário" : "Grupo"}{a.detalhe ? ` · ${a.detalhe}` : ""}
                </div>
              </div>
              <Badge variant="outline">{NIVEL_LABEL[a.nivel as Nivel]}</Badge>
              <Button size="icon" variant="ghost" onClick={() => revoke.mutate(a.id)} aria-label="Revogar">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
