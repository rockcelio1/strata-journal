import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Link2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { notify } from "@/lib/toast";
import { listOneDriveConexoes, vincularOneDriveConexao } from "@/lib/onedrive.functions";
import { ESCOPOS_ONEDRIVE } from "@/lib/onedrive-conexoes";

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
  const listarFn = useServerFn(listOneDriveConexoes);
  const vincularFn = useServerFn(vincularOneDriveConexao);

  const conexoes = useQuery({
    queryKey: ["onedrive", "conexoes"],
    queryFn: () => listarFn({ data: undefined as any }),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const vincular = useMutation({
    mutationFn: () => vincularFn({ data: undefined as any }),
    onSuccess: (r) => {
      if (r.ok) {
        notify.success("Conta definida", { description: r.conexao.conta ?? "Conta do sistema" });
        conexoes.refetch();
      } else {
        notify.error("Não foi possível definir a conta", { description: r.erro });
      }
    },
    onError: (e: any) => notify.error("Não foi possível definir a conta", { description: e?.message }),
  });

  const lista = conexoes.data?.conexoes ?? [];
  const atual = lista[0];

  return (
    <div className="space-y-6" data-testid="onedrive-vinculo">
      <header className="flex items-center gap-3">
        <Link
          to="/configuracoes/onedrive"
          className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
        <h1 className="text-lg font-semibold">Conta OneDrive do sistema</h1>
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
                Entre com a conta corporativa da Microsoft em Configurações → OneDrive e depois clique no botão abaixo
                para usá-la como conta do sistema. Permissões necessárias: {ESCOPOS_ONEDRIVE.join(", ")}.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm inline-flex items-center gap-2" data-testid="onedrive-lista-conexoes">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{atual.rotulo}</span>
          </p>
        )}

        <button
          onClick={() => vincular.mutate()}
          disabled={vincular.isPending}
          className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded bg-brand text-brand-foreground disabled:opacity-50"
        >
          {vincular.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
          Usar minha conta Microsoft como conta do sistema
        </button>

        <p className="text-xs text-muted-foreground">
          A conexão é feita direto com a Microsoft pelo próprio RDO. Os tokens ficam guardados criptografados no banco
          deste sistema.
        </p>
      </section>
    </div>
  );
}
