import { AlertCircle, CheckCircle2, ExternalLink, Loader2, LogOut, RefreshCw, ShieldCheck, UserCog } from "lucide-react";

export type ConexaoEstado = "verificando" | "conectado" | "sem_acesso" | "desconectado";

/** Classifica a mensagem de erro do servidor no estado exibido na tela. */
export function classificarEstadoConexao(args: {
  carregando: boolean;
  ok: boolean;
  erro?: string | null;
}): ConexaoEstado {
  if (args.carregando) return "verificando";
  if (args.ok) return "conectado";
  const e = (args.erro ?? "").toLowerCase();
  if (e.includes("não tem acesso") || e.includes("nao tem acesso") || e.includes("permissão")) {
    return "sem_acesso";
  }
  return "desconectado";
}

const PASSOS = [
  "Autorizar a conta corporativa da FACOM no OneDrive (OAuth 2.0 — nenhuma senha é guardada pelo sistema).",
  "Liberar os escopos Files.ReadWrite e offline_access para que o sistema leia, envie e renove o acesso sozinho.",
  "Vincular a conexão do workspace a este projeto para que o status mude para Conectado.",
];

/**
 * Fluxo guiado de conexão do OneDrive: autorização, troca de conta e saída.
 * Mostra sempre o próximo passo concreto — inclusive quando a conta atual
 * simplesmente não tem acesso à conexão do workspace.
 */
export function OneDriveConnectPanel({
  estado,
  conta,
  erro,
  verificando,
  onVerificar,
  onTrocarConta,
  onDesconectar,
}: {
  estado: ConexaoEstado;
  conta?: string | null;
  erro?: string | null;
  verificando?: boolean;
  onVerificar: () => void;
  onTrocarConta: () => void;
  onDesconectar: () => void;
}) {
  const visual = {
    verificando: {
      Icon: Loader2,
      cls: "text-muted-foreground",
      titulo: "Verificando a conexão…",
      texto: "Consultando o OneDrive com as credenciais configuradas.",
    },
    conectado: {
      Icon: CheckCircle2,
      cls: "text-emerald-600",
      titulo: "Conectado",
      texto: conta ? `Conta autorizada: ${conta}` : "Conta corporativa autorizada.",
    },
    sem_acesso: {
      Icon: ShieldCheck,
      cls: "text-amber-600",
      titulo: "Sem acesso à conexão",
      texto:
        "A conexão do OneDrive existe no workspace, mas esta conta não tem permissão de uso. Peça ao responsável para liberar seu usuário em Conectores → OneDrive e vincular a conexão a este projeto.",
    },
    desconectado: {
      Icon: AlertCircle,
      cls: "text-destructive",
      titulo: "Desconectado",
      texto: "Conclua a autorização abaixo para habilitar listagem, envio e download de arquivos.",
    },
  }[estado];

  const { Icon } = visual;

  return (
    <section
      className="border border-border rounded-lg p-4 bg-card space-y-3"
      data-testid="onedrive-conexao"
      data-estado={estado}
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${visual.cls} ${estado === "verificando" ? "animate-spin" : ""}`} />
        <div className="min-w-0">
          <h3 className="font-medium text-sm">{visual.titulo}</h3>
          <p className="text-xs text-muted-foreground mt-1">{visual.texto}</p>
          {erro && estado !== "conectado" && (
            <p className="text-[11px] text-destructive mt-2 break-all" data-testid="onedrive-erro">
              {erro}
            </p>
          )}
        </div>
      </div>

      {estado !== "conectado" && (
        <ol className="text-xs text-muted-foreground list-decimal pl-5 space-y-1">
          {PASSOS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={onVerificar}
          disabled={verificando}
          className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded bg-brand text-brand-foreground disabled:opacity-50"
        >
          {verificando ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {estado === "conectado" ? "Revalidar conexão" : "Autorizar / verificar agora"}
        </button>
        <button
          onClick={onTrocarConta}
          className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded border border-border hover:bg-accent"
        >
          <UserCog className="h-3 w-3" /> Trocar de conta
        </button>
        <button
          onClick={onDesconectar}
          className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded border border-border hover:bg-accent"
        >
          <LogOut className="h-3 w-3" /> Sair / desconectar
        </button>
        <a
          href="https://portal.office.com/account#installs"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" /> Sessões da conta Microsoft
        </a>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Falhou? Confira o bloco de diagnóstico no fim desta página: ele traz status HTTP e request-id de cada
        chamada, que é o dado que o suporte da Microsoft e o responsável pelo workspace precisam.
      </p>
    </section>
  );
}
