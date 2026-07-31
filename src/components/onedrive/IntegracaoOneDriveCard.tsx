import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { notify } from "@/lib/toast";
import { statusIntegracaoOneDrive, recarregarIntegracaoOneDrive } from "@/lib/onedrive.functions";

function Linha({ rotulo, estado }: { rotulo: string; estado: "ok" | "erro" | "nao_verificado" | boolean }) {
  const ok = estado === "ok" || estado === true;
  const naoVerificado = estado === "nao_verificado";
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : naoVerificado ? (
        <Loader2 className="h-4 w-4 text-muted-foreground" />
      ) : (
        <AlertCircle className="h-4 w-4 text-destructive" />
      )}
      <span>{rotulo}</span>
      <span className="text-xs text-muted-foreground">
        {ok ? "ok" : naoVerificado ? "não verificado" : "falhou"}
      </span>
    </li>
  );
}

/**
 * Situação da integração técnica com o OneDrive (aplicativo Microsoft).
 * Não há login de usuário: o servidor autentica sozinho por Client Credentials.
 */
export function IntegracaoOneDriveCard() {
  const qc = useQueryClient();
  const statusFn = useServerFn(statusIntegracaoOneDrive);
  const recarregarFn = useServerFn(recarregarIntegracaoOneDrive);

  const status = useQuery({
    queryKey: ["onedrive", "integracao"],
    queryFn: () => statusFn({ data: undefined as any }),
    retry: 0,
  });

  const recarregar = useMutation({
    mutationFn: () => recarregarFn({ data: undefined as any }),
    onSuccess: (r: any) => {
      if (r?.ok) {
        notify.success("Integração recarregada");
        qc.invalidateQueries({ queryKey: ["onedrive"] });
      } else {
        notify.error(r?.erro ?? "Não foi possível recarregar");
      }
    },
    onError: (e: any) => notify.error("Falha ao recarregar", { description: e?.message }),
  });

  const d = status.data;

  return (
    <section className="border border-border rounded-lg p-4 bg-card space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-medium text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Integração técnica com o OneDrive
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            O servidor do RDO autentica sozinho no Microsoft Graph com as credenciais do aplicativo. Nenhum usuário
            precisa entrar na Microsoft.
          </p>
        </div>
        <button
          onClick={() => recarregar.mutate()}
          disabled={recarregar.isPending}
          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-50"
        >
          {recarregar.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Recarregar
        </button>
      </div>

      {status.isLoading ? (
        <p className="text-sm text-muted-foreground">Verificando…</p>
      ) : d ? (
        <>
          <ul className="space-y-1">
            <Linha rotulo="Credenciais no servidor" estado={d.configured} />
            <Linha rotulo="Token do aplicativo" estado={d.token} />
            <Linha rotulo="OneDrive da conta técnica" estado={d.drive} />
          </ul>
          <p className="text-xs text-muted-foreground">
            Conta de destino: <strong>{d.targetUser ?? "não configurada"}</strong>
          </p>
          {d.missing?.length ? (
            <p className="text-xs text-destructive break-all">
              Variáveis ausentes no servidor: {d.missing.join(", ")}
            </p>
          ) : null}
          {d.message ? <p className="text-xs text-destructive">{d.message}</p> : null}
        </>
      ) : (
        <p className="text-sm text-destructive">Não foi possível consultar a integração.</p>
      )}
    </section>
  );
}
