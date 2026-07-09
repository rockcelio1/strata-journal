import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PublicPageShell } from "@/components/public-page-shell";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "Status — Diário de Obra" },
      { name: "description", content: "Status operacional do sistema Diário de Obra em tempo real." },
      { property: "og:title", content: "Status — Diário de Obra" },
      { property: "og:description", content: "Status operacional do sistema Diário de Obra." },
    ],
  }),
  component: StatusPage,
});

type Health = { status?: string; timestamp?: string; version?: string; [k: string]: unknown };

function StatusPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<Health>({
    queryKey: ["public-health"],
    queryFn: async () => {
      const r = await fetch("/api/public/health", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const ok = !isError && data?.status === "ok";

  return (
    <PublicPageShell title="Status do sistema">
      <div className="not-prose">
        <div className={`rounded-lg border p-6 flex items-center gap-4 ${ok ? "border-emerald-300 bg-emerald-50" : "border-destructive/50 bg-destructive/5"}`}>
          {isLoading ? (
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : ok ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          ) : (
            <XCircle className="h-8 w-8 text-destructive" />
          )}
          <div>
            <h2 className="font-serif text-xl">
              {isLoading ? "Verificando..." : ok ? "Todos os sistemas operacionais" : "Sistema com problemas"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Última verificação: {data?.timestamp ? new Date(data.timestamp).toLocaleString("pt-BR") : "—"}
              {isFetching && " · atualizando..."}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="ml-auto text-xs rounded-md border border-border px-3 py-1.5 hover:bg-accent"
          >
            Atualizar
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <ComponentCard name="API / Backend" ok={ok} />
          <ComponentCard name="Banco de dados" ok={ok} />
          <ComponentCard name="Autenticação" ok={ok} />
          <ComponentCard name="Armazenamento" ok={ok} />
        </div>

        <div className="mt-8 text-sm text-muted-foreground">
          <p>
            Esta página é atualizada automaticamente a cada 30 segundos. Para incidentes históricos e
            manutenções programadas, entre em contato pelo canal oficial da sua Empresa Cliente.
          </p>
          <p className="mt-2">
            <Link to="/lgpd" className="text-brand underline">LGPD</Link> ·{" "}
            <Link to="/privacidade" className="text-brand underline">Privacidade</Link> ·{" "}
            <Link to="/termos" className="text-brand underline">Termos</Link>
          </p>
        </div>
      </div>
    </PublicPageShell>
  );
}

function ComponentCard({ name, ok }: { name: string; ok: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-amber-600" />
      )}
      <span className="text-sm">{name}</span>
      <span className={`ml-auto text-xs ${ok ? "text-emerald-700" : "text-amber-700"}`}>
        {ok ? "Operacional" : "Verificando"}
      </span>
    </div>
  );
}
