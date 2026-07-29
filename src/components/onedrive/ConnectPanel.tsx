import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { montarPedidoLiberacao, montarDiagnosticoVinculo, ESCOPOS_ONEDRIVE } from "@/lib/onedrive-conexoes";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, LogOut, RefreshCw, ShieldCheck, UserCog, ClipboardCopy, Link2 } from "lucide-react";

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
  /** Contexto usado no pedido ao admin e no diagnóstico. */
  contexto?: {
    conexaoId?: string | null;
    organizacao?: string | null;
    requestId?: string | null;
    status?: number | null;
    projeto?: string | null;
    usuario?: string | null;
  };
}) {
  const [pedidoCopiado, setPedidoCopiado] = useState(false);
  const diagnostico = montarDiagnosticoVinculo({
    ...(contexto ?? {}),
    conta,
    erro,
  });

  async function copiarPedido() {
    const texto = montarPedidoLiberacao({ ...(contexto ?? {}), conta, erro });
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Navegadores sem permissão de clipboard: mostramos o texto para copiar à mão.
    }
    setPedidoCopiado(true);
  }
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
  const textoPedido = montarPedidoLiberacao({ ...(contexto ?? {}), conta, erro });

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
        <Link
          to="/configuracoes/onedrive/vincular"
          className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded border border-border hover:bg-accent"
        >
          <Link2 className="h-3 w-3" /> Vincular conexão do workspace
        </Link>
        {estado !== "conectado" && (
          <button
            onClick={copiarPedido}
            data-testid="onedrive-pedido-admin"
            className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded border border-amber-500/50 text-amber-700 hover:bg-amber-500/10"
          >
            <ClipboardCopy className="h-3 w-3" /> Solicitar liberação ao admin
          </button>
        )}
        <a
          href="https://portal.office.com/account#installs"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" /> Sessões da conta Microsoft
        </a>
      </div>

      {pedidoCopiado && estado !== "conectado" && (
        <div className="space-y-1" data-testid="onedrive-pedido-texto">
          <p className="text-[11px] text-muted-foreground">
            Texto copiado para a área de transferência — envie ao responsável pelo workspace:
          </p>
          <textarea
            readOnly
            value={textoPedido}
            rows={8}
            className="w-full text-[11px] font-mono rounded border border-border bg-muted/40 p-2"
          />
        </div>
      )}

      {estado !== "conectado" && (
        <div className="rounded border border-border/70 bg-muted/30 p-3 space-y-2" data-testid="onedrive-diagnostico">
          <p className="text-xs font-medium">Diagnóstico da vinculação</p>
          <dl className="text-[11px] grid gap-1 sm:grid-cols-2">
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
          <ul className="text-[11px] list-disc pl-5 space-y-1 text-muted-foreground">
            {diagnostico.checklist.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">Escopos esperados: {ESCOPOS_ONEDRIVE.join(", ")}.</p>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Falhou? Confira o bloco de diagnóstico no fim desta página: ele traz status HTTP e request-id de cada
        chamada, que é o dado que o suporte da Microsoft e o responsável pelo workspace precisam.
      </p>
    </section>
  );
}
