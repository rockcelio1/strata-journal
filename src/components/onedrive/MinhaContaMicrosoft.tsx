import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Folder,
  FileText,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { notify } from "@/lib/toast";
import {
  onedriveDesconectarPessoal,
  onedriveEnviarPessoal,
  onedriveIniciarLogin,
  onedriveLinkDownloadPessoal,
  onedriveListarPessoal,
  onedriveStatusPessoal,
} from "@/lib/onedrive-appuser.functions";

const CONNECTOR_ID = "microsoft_onedrive";

function esperarConclusao(popup: Window) {
  return new Promise<void>((resolve, reject) => {
    let poll: number | undefined;
    const limpar = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== CONNECTOR_ID ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      )
        return;
      limpar();
      if (type === "appUserConnectorOAuthComplete") return resolve();
      popup.close();
      reject(new Error(event.data?.erro ?? "A autorização da Microsoft falhou."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      limpar();
      reject(new Error("A janela de login foi fechada antes de concluir."));
    }, 500);
  });
}

function fmt(bytes: number) {
  if (!bytes) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

export function MinhaContaMicrosoft() {
  const qc = useQueryClient();
  const statusFn = useServerFn(onedriveStatusPessoal);
  const iniciarFn = useServerFn(onedriveIniciarLogin);
  const sairFn = useServerFn(onedriveDesconectarPessoal);
  const listarFn = useServerFn(onedriveListarPessoal);
  const enviarFn = useServerFn(onedriveEnviarPessoal);
  const baixarFn = useServerFn(onedriveLinkDownloadPessoal);

  const [pasta, setPasta] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const status = useQuery({
    queryKey: ["onedrive", "pessoal", "status"],
    queryFn: () => statusFn({ data: undefined as never }),
    retry: 0,
    refetchOnWindowFocus: true,
  });

  const conectado = status.data?.conectado === true;

  const arquivos = useQuery({
    queryKey: ["onedrive", "pessoal", "arquivos", pasta],
    queryFn: () => listarFn({ data: { pasta } }),
    enabled: conectado,
    retry: 0,
  });

  const login = useMutation({
    mutationFn: async () => {
      const popup = window.open("", "onedrive-oauth", "width=620,height=740");
      if (!popup) throw new Error("O navegador bloqueou a janela. Libere pop-ups e tente de novo.");
      try {
        const { authorizationUrl } = await iniciarFn({ data: undefined as never });
        const conclusao = esperarConclusao(popup);
        popup.location.href = authorizationUrl;
        await conclusao;
      } catch (e) {
        popup.close();
        throw e;
      }
    },
    onSuccess: async () => {
      notify.success("Conta Microsoft conectada");
      await qc.invalidateQueries({ queryKey: ["onedrive", "pessoal"] });
    },
    onError: (e: Error) => notify.error("Não foi possível conectar", { description: e.message }),
  });

  const sair = useMutation({
    mutationFn: () => sairFn({ data: undefined as never }),
    onSuccess: async () => {
      notify.success("Conta Microsoft desconectada");
      await qc.invalidateQueries({ queryKey: ["onedrive", "pessoal"] });
    },
    onError: (e: Error) => notify.error("Falha ao desconectar", { description: e.message }),
  });

  const enviar = useMutation({
    mutationFn: async (file: File) => {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      return enviarFn({
        data: { pasta, nome: file.name, conteudoBase64: btoa(bin), contentType: file.type },
      });
    },
    onSuccess: async (r) => {
      notify.success("Arquivo enviado", { description: r.nome });
      await qc.invalidateQueries({ queryKey: ["onedrive", "pessoal", "arquivos"] });
    },
    onError: (e: Error) => notify.error("Falha no envio", { description: e.message }),
  });

  const baixar = useMutation({
    mutationFn: (itemId: string) => baixarFn({ data: { itemId } }),
    onSuccess: (r) => window.open(r.url, "_blank", "noopener,noreferrer"),
    onError: (e: Error) => notify.error("Falha ao baixar", { description: e.message }),
  });

  const estado = status.isLoading ? "verificando" : conectado ? "conectado" : "desconectado";

  return (
    <section
      data-testid="onedrive-conta-pessoal"
      data-estado={estado}
      className="border border-border rounded-lg p-4 bg-card space-y-4"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-medium text-sm flex items-center gap-2">
            {conectado ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            )}
            Minha conta Microsoft (login pessoal)
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {conectado
              ? <>Conectado como <strong>{status.data?.conta ?? status.data?.nome ?? "sua conta"}</strong>. O RDO usa o seu OneDrive com as permissões que você autorizou.</>
              : "Entre com sua conta Microsoft para o RDO ler e gravar arquivos no seu OneDrive. A autorização acontece na própria tela da Microsoft."}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Permissões solicitadas: {(status.data?.escopos ?? []).join(", ")}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => status.refetch()}
            disabled={status.isFetching}
            className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-accent"
          >
            {status.isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Atualizar
          </button>
          {conectado ? (
            <button
              onClick={() => sair.mutate()}
              disabled={sair.isPending}
              className="text-xs inline-flex items-center gap-1 px-3 py-2 rounded border border-border hover:bg-accent"
            >
              <LogOut className="h-3 w-3" /> Sair da conta
            </button>
          ) : (
            <button
              data-testid="onedrive-login-microsoft"
              onClick={() => login.mutate()}
              disabled={login.isPending || status.data?.configurado === false}
              className="text-xs inline-flex items-center gap-2 px-3 py-2 rounded bg-brand text-brand-foreground disabled:opacity-60"
            >
              {login.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogIn className="h-3 w-3" />}
              Entrar com a Microsoft
            </button>
          )}
        </div>
      </div>

      {status.data?.configurado === false && (
        <div className="text-xs text-destructive space-y-1">
          <p>
            O aplicativo ainda não foi registrado na Microsoft. Um administrador precisa cadastrar o app no Entra ID e
            informar o Client ID e o Client Secret nas configurações do servidor do RDO.
          </p>
          <p className="text-muted-foreground">
            URL de redirecionamento a cadastrar no Entra ID:{" "}
            <code className="break-all">
              {typeof window !== "undefined" ? `${window.location.origin}/oauth/onedrive/return` : "/oauth/onedrive/return"}
            </code>
          </p>
        </div>
      )}


      {status.data?.erro && (
        <p className="text-xs text-destructive">Diagnóstico: {status.data.erro}</p>
      )}

      {conectado && (
        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
              {pasta && (
                <button
                  onClick={() => setPasta(pasta.split("/").slice(0, -1).join("/"))}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <ArrowLeft className="h-3 w-3" /> Voltar
                </button>
              )}
              <span className="truncate">/{pasta}</span>
            </div>
            <div>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                data-testid="onedrive-pessoal-upload"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) enviar.mutate(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => inputRef.current?.click()}
                disabled={enviar.isPending}
                className="text-xs inline-flex items-center gap-1 px-3 py-2 rounded border border-border hover:bg-accent"
              >
                {enviar.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                Enviar arquivo
              </button>
            </div>
          </div>

          {arquivos.isLoading ? (
            <p className="text-xs text-muted-foreground">Carregando arquivos…</p>
          ) : arquivos.error ? (
            <p className="text-xs text-destructive">{(arquivos.error as Error).message}</p>
          ) : (
            <ul className="divide-y divide-border text-sm" data-testid="onedrive-pessoal-lista">
              {(arquivos.data?.itens ?? []).map((i) => (
                <li key={i.id} className="flex items-center gap-2 py-2">
                  {i.pasta ? (
                    <Folder className="h-4 w-4 text-brand shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  {i.pasta ? (
                    <button
                      className="truncate hover:underline text-left"
                      onClick={() => setPasta([pasta, i.nome].filter(Boolean).join("/"))}
                    >
                      {i.nome}
                    </button>
                  ) : (
                    <span className="truncate">{i.nome}</span>
                  )}
                  <span className="ml-auto text-[11px] text-muted-foreground">{i.pasta ? "" : fmt(i.tamanho)}</span>
                  {!i.pasta && (
                    <button
                      onClick={() => baixar.mutate(i.id)}
                      className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-accent"
                    >
                      <Download className="h-3 w-3" /> Baixar
                    </button>
                  )}
                </li>
              ))}
              {(arquivos.data?.itens?.length ?? 0) === 0 && (
                <li className="py-3 text-xs text-muted-foreground">Nenhum arquivo nesta pasta.</li>
              )}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
