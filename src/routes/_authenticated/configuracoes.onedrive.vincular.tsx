import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Link2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { notify } from "@/lib/toast";
import { listOneDriveConexoes, vincularOneDriveConexao } from "@/lib/onedrive.functions";
import { ESCOPOS_ONEDRIVE, type Diagnostico } from "@/lib/onedrive-conexoes";

export const Route = createFileRoute("/_authenticated/configuracoes/onedrive/vincular")({
  component: VincularOneDrive,
  head: () => ({
    meta: [
      { title: "Vincular conexão OneDrive | Diário de Obra FACOM" },
      {
        name: "description",
        content: "Selecione a conexão OneDrive do workspace e vincule ao projeto para habilitar anexos.",
      },
      { property: "og:title", content: "Vincular conexão OneDrive" },
      { property: "og:description", content: "Vincule a conexão OneDrive do workspace a este projeto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function VincularOneDrive() {
  const listarFn = useServerFn(listOneDriveConexoes);
  const vincularFn = useServerFn(vincularOneDriveConexao);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);

  const conexoes = useQuery({
    queryKey: ["onedrive", "conexoes"],
    queryFn: () => listarFn({ data: undefined as any }),
    // Reverifica sozinho: se o admin liberar a conexão no workspace, a tela
    // muda de "Desconectado" para "Conectado" sem recarregar a página.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const vincular = useMutation({
    mutationFn: (envName: string) => vincularFn({ data: { envName } }),
    onSuccess: (r) => {
      if (r.ok) {
        setDiagnostico(null);
        notify.success("Conexão vinculada", { description: r.conexao.conta ?? r.conexao.rotulo });
        conexoes.refetch();
      } else {
        setDiagnostico(r.diagnostico);
        notify.error("Falha ao vincular", { description: r.erro });
      }
    },
    onError: (e: any) => notify.error("Falha ao vincular", { description: e?.message }),
  });

  const lista = conexoes.data?.conexoes ?? [];
  const vinculado = vincular.data?.ok === true;

  return (
    <div className="space-y-6" data-testid="onedrive-vinculo">
      <header className="flex items-center gap-3">
        <Link
          to="/configuracoes/onedrive"
          className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
        <h1 className="text-lg font-semibold">Vincular conexão OneDrive</h1>
      </header>

      <section className="border border-border rounded-lg p-4 bg-card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium text-sm">Conexões disponíveis no workspace</h2>
          <button
            onClick={() => conexoes.refetch()}
            className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-accent"
          >
            {conexoes.isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Atualizar
          </button>
        </div>

        {conexoes.isLoading ? (
          <p className="text-sm text-muted-foreground">Procurando conexões…</p>
        ) : lista.length === 0 ? (
          <div className="flex items-start gap-3 text-sm" data-testid="onedrive-sem-conexoes">
            <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Nenhuma conexão OneDrive disponível para este projeto.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Peça ao responsável pelo workspace para abrir Conectores → OneDrive, liberar seu usuário e vincular a
                conexão a este projeto. Escopos necessários: {ESCOPOS_ONEDRIVE.join(", ")}.
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border" data-testid="onedrive-lista-conexoes">
            {lista.map((c) => (
              <li key={c.envName} className="flex items-center justify-between gap-3 py-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="conexao"
                    value={c.envName}
                    checked={(selecionada ?? lista.find((x) => x.padrao)?.envName) === c.envName}
                    onChange={() => setSelecionada(c.envName)}
                  />
                  <span>
                    {c.rotulo}
                    <span className="text-xs text-muted-foreground ml-2 font-mono">{c.id}</span>
                  </span>
                </label>
                {c.padrao && <span className="text-[11px] text-muted-foreground">padrão</span>}
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={() => {
            const alvo = selecionada ?? lista.find((c) => c.padrao)?.envName;
            if (alvo) vincular.mutate(alvo);
          }}
          disabled={lista.length === 0 || vincular.isPending}
          className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded bg-brand text-brand-foreground disabled:opacity-50"
        >
          {vincular.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
          Vincular ao projeto
        </button>

        {vinculado && (
          <p className="text-xs text-emerald-600 inline-flex items-center gap-1" data-testid="onedrive-vinculo-ok">
            <CheckCircle2 className="h-3 w-3" /> Conectado — a tela de configurações já reflete o novo status.
          </p>
        )}
      </section>

      {diagnostico && (
        <section
          className="border border-destructive/40 rounded-lg p-4 bg-destructive/5 space-y-2"
          data-testid="onedrive-diagnostico-vinculo"
        >
          <h2 className="font-medium text-sm text-destructive">Diagnóstico da falha de vinculação</h2>
          <dl className="text-xs grid gap-1 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">ID da conexão</dt>
              <dd className="font-mono break-all">{diagnostico.conexaoId}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Organização / conta detectada</dt>
              <dd className="break-all">{diagnostico.organizacao}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">request-id</dt>
              <dd className="font-mono break-all">{diagnostico.requestId}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status HTTP</dt>
              <dd className="font-mono">{diagnostico.status}</dd>
            </div>
          </dl>
          <div>
            <p className="text-xs font-medium mb-1">Checklist em Conectores → OneDrive:</p>
            <ul className="text-xs list-disc pl-5 space-y-1 text-muted-foreground">
              {diagnostico.checklist.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
