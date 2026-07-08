import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes/lgpd")({
  component: LgpdAdminPage,
});

type LgpdRow = {
  id: string;
  protocolo: string;
  requester_nome: string;
  requester_email: string;
  request_type: string;
  descricao: string | null;
  status: string;
  resposta: string | null;
  due_at: string;
  handled_at: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  recebido: "Recebido",
  em_analise: "Em análise",
  em_execucao: "Em execução",
  concluido: "Concluído",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

const TIPO_LABEL: Record<string, string> = {
  acesso: "Acesso",
  correcao: "Correção",
  exclusao: "Exclusão",
  portabilidade: "Portabilidade",
  anonimizacao: "Anonimização",
  revogacao: "Revogação de consentimento",
};

function LgpdAdminPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resposta, setResposta] = useState("");
  const [novoStatus, setNovoStatus] = useState<string>("em_analise");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["lgpd_requests", filter],
    queryFn: async () => {
      let q = supabase.from("lgpd_requests").select("*").order("created_at", { ascending: false }).limit(200);
      if (filter !== "todos") q = q.eq("status", filter as any);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LgpdRow[];
    },
  });

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const patch: any = { status: novoStatus, resposta: resposta || null };
      if (novoStatus === "concluido" || novoStatus === "recusado") {
        patch.handled_at = new Date().toISOString();
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) patch.handled_by = userData.user.id;
      }
      const { error } = await supabase.from("lgpd_requests").update(patch).eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação atualizada");
      qc.invalidateQueries({ queryKey: ["lgpd_requests"] });
      setSelectedId(null);
      setResposta("");
    },
    onError: (err) => {
      console.error("[lgpd] update failed", err);
      toast.error("Não foi possível atualizar a solicitação.");
    },
  });

  const counts = useMemo(() => {
    const c = { total: rows.length, abertos: 0, atrasados: 0 };
    const now = Date.now();
    rows.forEach((r) => {
      if (r.status !== "concluido" && r.status !== "recusado" && r.status !== "cancelado") c.abertos++;
      if (r.status !== "concluido" && r.status !== "recusado" && r.status !== "cancelado" && new Date(r.due_at).getTime() < now) c.atrasados++;
    });
    return c;
  }, [rows]);

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-brand/10 text-brand grid place-items-center">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-serif text-xl leading-none">Solicitações LGPD</h2>
          <p className="text-xs text-muted-foreground mt-1">Pedidos DSAR recebidos pelo formulário público.</p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={<Clock className="h-4 w-4" />} label="Abertos" value={counts.abertos} />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Atrasados (>15d)" value={counts.atrasados} highlight={counts.atrasados > 0} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Total registrado" value={counts.total} />
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="f" className="text-xs">Filtro:</Label>
        <select
          id="f"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="todos">Todos</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhuma solicitação encontrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs">
              <tr>
                <th className="text-left p-2">Protocolo</th>
                <th className="text-left p-2">Titular</th>
                <th className="text-left p-2">Tipo</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Prazo</th>
                <th className="text-left p-2">Recebido em</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const atrasado = new Date(r.due_at).getTime() < Date.now() && !["concluido","recusado","cancelado"].includes(r.status);
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-accent/40">
                    <td className="p-2 font-mono text-xs">{r.protocolo}</td>
                    <td className="p-2">
                      <div>{r.requester_nome}</div>
                      <div className="text-xs text-muted-foreground">{r.requester_email}</div>
                    </td>
                    <td className="p-2">{TIPO_LABEL[r.request_type] ?? r.request_type}</td>
                    <td className="p-2"><StatusBadge status={r.status} /></td>
                    <td className={`p-2 text-xs ${atrasado ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {new Date(r.due_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedId(r.id);
                          setResposta(r.resposta ?? "");
                          setNovoStatus(r.status);
                        }}
                      >
                        Abrir
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelectedId(null)}>
          <div className="max-w-2xl w-full bg-background rounded-lg border border-border p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-serif text-lg">{selected.protocolo}</h3>
                <p className="text-xs text-muted-foreground">
                  {selected.requester_nome} · {selected.requester_email}
                </p>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="text-sm">
              <div className="text-xs text-muted-foreground">Tipo</div>
              <div>{TIPO_LABEL[selected.request_type] ?? selected.request_type}</div>
            </div>

            <div className="text-sm">
              <div className="text-xs text-muted-foreground">Descrição</div>
              <div className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 mt-1">{selected.descricao || "—"}</div>
            </div>

            <div>
              <Label htmlFor="ns" className="text-xs">Novo status</Label>
              <select
                id="ns"
                value={novoStatus}
                onChange={(e) => setNovoStatus(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm mt-1"
              >
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div>
              <Label htmlFor="rp" className="text-xs">Resposta ao titular</Label>
              <Textarea
                id="rp"
                rows={4}
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                maxLength={4000}
                placeholder="Registre a resposta enviada ao titular. Não copie dados sensíveis."
                className="mt-1"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedId(null)}>Cancelar</Button>
              <Button onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
                {updateMut.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-destructive/50 bg-destructive/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className={`text-2xl font-serif mt-1 ${highlight ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style: Record<string, string> = {
    recebido: "bg-blue-100 text-blue-800",
    em_analise: "bg-amber-100 text-amber-800",
    em_execucao: "bg-indigo-100 text-indigo-800",
    concluido: "bg-emerald-100 text-emerald-800",
    recusado: "bg-red-100 text-red-800",
    cancelado: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${style[status] ?? "bg-muted"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
