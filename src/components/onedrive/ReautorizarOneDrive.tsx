import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, KeyRound, Loader2 } from "lucide-react";
import { notify } from "@/lib/toast";
import { onedriveIniciarLogin, onedriveStatusPessoal } from "@/lib/onedrive-appuser.functions";
import { vincularOneDriveConexao } from "@/lib/onedrive.functions";
import { rodarLoginMicrosoft } from "@/components/onedrive/oauth-popup";
import { EscoposVerificacao } from "@/components/onedrive/EscoposVerificacao";

const CONTA_SISTEMA = "sistemas@facom.com.br";

/**
 * Botão "Reautorizar OneDrive".
 * Aparece quando o token está expirado/inválido ou faltam permissões, e
 * refaz o fluxo OAuth já sugerindo a conta corporativa do sistema.
 */
export function ReautorizarOneDrive({
  conta = CONTA_SISTEMA,
  sempreVisivel = false,
  definirComoSistema = false,
}: {
  conta?: string;
  sempreVisivel?: boolean;
  definirComoSistema?: boolean;
}) {
  const qc = useQueryClient();
  const statusFn = useServerFn(onedriveStatusPessoal);
  const iniciarFn = useServerFn(onedriveIniciarLogin);
  const vincularFn = useServerFn(vincularOneDriveConexao);

  const status = useQuery({
    queryKey: ["onedrive", "pessoal", "status"],
    queryFn: () => statusFn({ data: undefined as never }),
    retry: 0,
  });

  const precisa = status.data?.precisaReautorizar === true || !!status.data?.erro;

  const reautorizar = useMutation({
    mutationFn: async () => {
      await rodarLoginMicrosoft(() => iniciarFn({ data: { loginHint: conta, reautorizar: true } }));
      if (definirComoSistema) {
        const r = await vincularFn({ data: undefined as never });
        if (!r.ok) throw new Error(r.erro);
      }
    },
    onSuccess: async () => {
      notify.success("OneDrive reautorizado");
      await qc.invalidateQueries({ queryKey: ["onedrive"] });
    },
    onError: (e: Error) => notify.error("Não foi possível reautorizar", { description: e.message }),
  });

  if (status.isLoading) return null;
  if (!precisa && !sempreVisivel) return null;

  return (
    <div
      data-testid="onedrive-reautorizar"
      data-precisa={precisa ? "sim" : "nao"}
      className="border border-amber-500/40 bg-amber-500/5 rounded-lg p-3 space-y-2"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-xs">
          <p className="font-medium">
            {precisa ? "O acesso ao OneDrive precisa ser renovado" : "Renovar o acesso ao OneDrive"}
          </p>
          <p className="text-muted-foreground mt-0.5">
            {status.data?.erro
              ? status.data.erro
              : `Refaça o login da Microsoft com a conta ${conta} para continuar enviando anexos.`}
          </p>
        </div>
      </div>

      <EscoposVerificacao verificacao={status.data?.verificacao} compacto />

      <button
        onClick={() => reautorizar.mutate()}
        disabled={reautorizar.isPending}
        className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded bg-brand text-brand-foreground disabled:opacity-50"
      >
        {reautorizar.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <KeyRound className="h-3 w-3" />}
        Reautorizar OneDrive
      </button>
    </div>
  );
}
