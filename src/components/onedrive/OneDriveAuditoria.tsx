import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Loader2, RefreshCw } from "lucide-react";
import { onedriveHistorico } from "@/lib/onedrive-admin.functions";

/** Histórico de auditoria da conexão OneDrive (somente administradores). */
export function OneDriveAuditoria() {
  const fn = useServerFn(onedriveHistorico);
  const hist = useQuery({
    queryKey: ["onedrive", "historico"],
    queryFn: () => fn({ data: undefined as never }),
    retry: 0,
  });

  if (hist.error) return null;

  return (
    <section className="border border-border rounded-lg p-4 bg-card" data-testid="onedrive-auditoria">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <History className="h-4 w-4" /> Histórico da conexão
        </h3>
        <button
          onClick={() => hist.refetch()}
          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-accent"
        >
          {hist.isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Atualizar
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Quem vinculou, quem reautorizou, qual conta foi usada e quando as credenciais mudaram.
      </p>

      {hist.isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando histórico…</p>
      ) : hist.data?.eventos.length ? (
        <ul className="divide-y divide-border text-sm max-h-80 overflow-auto">
          {hist.data.eventos.map((e) => (
            <li key={e.id} className="py-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{e.rotulo}</span>
                <span className="text-xs text-muted-foreground">por {e.usuario}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(e.criadoEm).toLocaleString("pt-BR")}
                </span>
              </div>
              {e.conta && <div className="text-xs text-muted-foreground">Conta: {e.conta}</div>}
              {e.detalhe && <div className="text-xs text-amber-600 break-all">{e.detalhe}</div>}
              {e.escopos.length > 0 && (
                <div className="text-[11px] text-muted-foreground break-all">Permissões: {e.escopos.join(", ")}</div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum evento registrado ainda.</p>
      )}
    </section>
  );
}
