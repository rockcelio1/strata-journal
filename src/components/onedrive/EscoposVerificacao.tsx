import { CheckCircle2, XCircle } from "lucide-react";

export type VerificacaoEscoposUI = {
  ok: boolean;
  concedidos: string[];
  faltando: string[];
  obrigatorios: string[];
};

/**
 * Tela de verificação dos escopos OAuth: mostra, item a item, o que a
 * Microsoft autorizou e o que ainda falta.
 */
export function EscoposVerificacao({
  verificacao,
  compacto = false,
}: {
  verificacao: VerificacaoEscoposUI | null | undefined;
  compacto?: boolean;
}) {
  if (!verificacao) return null;
  const faltando = new Set(verificacao.faltando.map((e) => e.toLowerCase()));

  return (
    <div
      data-testid="onedrive-escopos"
      data-ok={verificacao.ok ? "sim" : "nao"}
      className={`rounded-md border p-3 ${
        verificacao.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"
      }`}
    >
      <p className="text-xs font-medium mb-2">
        {verificacao.ok
          ? "Todas as permissões necessárias foram concedidas."
          : "Faltam permissões — refaça a autorização na Microsoft."}
      </p>
      <ul className={`grid gap-1 ${compacto ? "" : "sm:grid-cols-3"}`}>
        {verificacao.obrigatorios.map((escopo) => {
          const ok = !faltando.has(escopo.toLowerCase());
          return (
            <li key={escopo} className="flex items-center gap-1.5 text-[11px]">
              {ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              )}
              <code className="break-all">{escopo}</code>
              <span className="text-muted-foreground">{ok ? "concedida" : "faltando"}</span>
            </li>
          );
        })}
      </ul>
      {verificacao.concedidos.length > 0 && (
        <p className="text-[11px] text-muted-foreground mt-2 break-all">
          Autorizadas pela Microsoft: {verificacao.concedidos.join(", ")}
        </p>
      )}
    </div>
  );
}
