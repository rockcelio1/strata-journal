import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Link2, Loader2, LogIn, RefreshCw, ShieldAlert, Unplug } from "lucide-react";
import { notify } from "@/lib/toast";
import {
  desvincularOneDriveConexao,
  listOneDriveConexoes,
  vincularOneDriveConexao,
} from "@/lib/onedrive.functions";
import { onedriveIniciarLogin, onedriveStatusPessoal } from "@/lib/onedrive-appuser.functions";
import { ESCOPOS_ONEDRIVE } from "@/lib/onedrive-conexoes";
import { rodarLoginMicrosoft } from "@/components/onedrive/oauth-popup";
import { EscoposVerificacao } from "@/components/onedrive/EscoposVerificacao";
import { OneDriveAuditoria } from "@/components/onedrive/OneDriveAuditoria";

export const Route = createFileRoute("/_authenticated/configuracoes/onedrive/vincular")({
  component: VincularOneDrive,
  head: () => ({
    meta: [
      { title: "Conta OneDrive do sistema | Diário de Obra FACOM" },
      {
        name: "description",
        content: "Defina a conta corporativa Microsoft que o RDO usa para guardar fotos e anexos no OneDrive.",
      },
      { property: "og:title", content: "Conta OneDrive do sistema" },
      { property: "og:description", content: "Defina a conta corporativa usada pelos anexos do RDO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function VincularOneDrive() {
  const qc = useQueryClient();
  const listarFn = useServerFn(listOneDriveConexoes);
  const vincularFn = useServerFn(vincularOneDriveConexao);
  const desvincularFn = useServerFn(desvincularOneDriveConexao);
  const statusFn = useServerFn(onedriveStatusPessoal);
  const iniciarFn = useServerFn(onedriveIniciarLogin);

  const conexoes = useQuery({
    queryKey: ["onedrive", "conexoes"],
    queryFn: () => listarFn({ data: undefined as any }),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const status = useQuery({
    queryKey: ["onedrive", "pessoal", "status"],
    queryFn: () => statusFn({ data: undefined as never }),
    retry: 0,
  });

  const conectarNova = useMutation({
    mutationFn: () => rodarLoginMicrosoft(() => iniciarFn({ data: { reautorizar: true } })),
    onSuccess: async () => {
      notify.success("Conta Microsoft autorizada", { description: "Agora defina-a como conta do sistema." });
      await qc.invalidateQueries({ queryKey: ["onedrive"] });
    },
    onError: (e: Error) => notify.error("Não foi possível autorizar", { description: e.message }),
  });

  const vincular = useMutation({
    mutationFn: () => vincularFn({ data: undefined as any }),
    onSuccess: async (r) => {
      if (r.ok) {
        notify.success("Conta definida", { description: r.conexao.conta ?? "Conta do sistema" });
        await qc.invalidateQueries({ queryKey: ["onedrive"] });
      } else {
        notify.error("Não foi possível definir a conta", { description: r.erro });
      }
    },
    onError: (e: any) => notify.error("Não foi possível definir a conta", { description: e?.message }),
  });

  const desvincular = useMutation({
    mutationFn: () => desvincularFn({ data: undefined as any }),
    onSuccess: async (r) => {
      if (r.ok) {
        notify.success("Conta do sistema removida deste projeto");
        await qc.invalidateQueries({ queryKey: ["onedrive"] });
      } else {
        notify.error("Não foi possível remover", { description: r.erro });
      }
    },
    onError: (e: any) => notify.error("Não foi possível remover", { description: e?.message }),
  });

  const lista = conexoes.data?.conexoes ?? [];
  const atual = lista[0];
  const contaPessoal = status.data?.conta ?? status.data?.nome ?? null;

  return (
    <div className="space-y-6" data-testid="onedrive-vinculo">
      <header className="flex items-center gap-3">
        <Link
          to="/configuracoes/onedrive"
          className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
        <h1 className="text-lg font-semibold">Assistente de conexão OneDrive</h1>
      </header>

      <section className="border border-border rounded-lg p-4 bg-card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium text-sm">Conta usada pelos anexos do RDO</h2>
          <button
            onClick={() => conexoes.refetch()}
            className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-accent"
          >
            {conexoes.isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Atualizar
          </button>
        </div>

        {conexoes.isLoading ? (
          <p className="text-sm text-muted-foreground">Verificando…</p>
        ) : !atual ? (
          <div className="flex items-start gap-3 text-sm" data-testid="onedrive-sem-conexoes">
            <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Nenhuma conta corporativa definida ainda.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Passo 1: entre com a conta Microsoft. Passo 2: defina-a como conta do sistema. Permissões necessárias:{" "}
                {ESCOPOS_ONEDRIVE.join(", ")}.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm inline-flex items-center gap-2" data-testid="onedrive-lista-conexoes">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{atual.rotulo}</span>
          </p>
        )}
      </section>

      {/* Passo 1 — conectar uma conta */}
      <section className="border border-border rounded-lg p-4 bg-card space-y-3">
        <h2 className="font-medium text-sm">1. Conta Microsoft autorizada por você</h2>
        <p className="text-xs text-muted-foreground">
          {contaPessoal
            ? <>Você está autorizado como <strong>{contaPessoal}</strong>. Pode usar esta conta ou entrar com outra.</>
            : "Nenhuma conta Microsoft autorizada nesta sessão. Entre com a conta corporativa."}
        </p>
        <EscoposVerificacao verificacao={status.data?.verificacao} />
        <button
          onClick={() => conectarNova.mutate()}
          disabled={conectarNova.isPending || status.data?.configurado === false}
          className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded border border-border hover:bg-accent disabled:opacity-50"
        >
          {conectarNova.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogIn className="h-3 w-3" />}
          {contaPessoal ? "Entrar com outra conta Microsoft" : "Entrar com a Microsoft"}
        </button>
      </section>

      {/* Passo 2 — vincular ao projeto */}
      <section className="border border-border rounded-lg p-4 bg-card space-y-3">
        <h2 className="font-medium text-sm">2. Vincular a conta a este projeto</h2>
        <p className="text-xs text-muted-foreground">
          A vinculação vale apenas para o <strong>Diário de Obra FACOM</strong> e é guardada no banco deste sistema —
          não depende de nenhum workspace externo.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => vincular.mutate()}
            disabled={vincular.isPending || !contaPessoal}
            className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded bg-brand text-brand-foreground disabled:opacity-50"
          >
            {vincular.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
            Usar minha conta Microsoft como conta do sistema
          </button>
          {atual && (
            <button
              onClick={() => desvincular.mutate()}
              disabled={desvincular.isPending}
              className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded border border-destructive text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              {desvincular.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unplug className="h-3 w-3" />}
              Remover conta do sistema
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Os tokens ficam criptografados no banco deste sistema e são renovados automaticamente.
        </p>
      </section>

      <OneDriveAuditoria />
    </div>
  );
}
