import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Cloud, CheckCircle2, AlertCircle, RefreshCw, FolderOpen, ChevronRight, ArrowLeft, Loader2, Unplug, UserCog, Copy, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { verifyOneDrive, listOneDriveFolders, testOneDrivePermissions, ensureOneDriveFolder } from "@/lib/onedrive.functions";

export const Route = createFileRoute("/_authenticated/configuracoes/onedrive")({
  component: OneDriveSettings,
});

const ROOT_KEY = "onedrive.root_folder";

function OneDriveSettings() {
  const verifyFn = useServerFn(verifyOneDrive);
  const listFn = useServerFn(listOneDriveFolders);
  const testFn = useServerFn(testOneDrivePermissions);
  const ensureFn = useServerFn(ensureOneDriveFolder);

  const [path, setPath] = useState<string>("");
  const [rootFolder, setRootFolder] = useState<string>(() =>
    typeof window !== "undefined" ? localStorage.getItem(ROOT_KEY) ?? "DiarioDeObra" : "DiarioDeObra",
  );

  const verify = useQuery({
    queryKey: ["onedrive", "verify"],
    queryFn: () => verifyFn({ data: undefined as any }),
    retry: 1,
  });

  const folders = useQuery({
    queryKey: ["onedrive", "folders", path],
    queryFn: () => listFn({ data: { path } }),
    enabled: verify.data?.ok === true,
    retry: 1,
  });

  useEffect(() => {
    if (folders.error) {
      toast.error("Falha ao listar pastas do OneDrive", { description: (folders.error as Error).message });
    }
  }, [folders.error]);

  async function saveRoot(name: string) {
    const clean = name.trim().replace(/^\/+|\/+$/g, "") || "DiarioDeObra";
    try {
      const r = await ensureFn({ data: { path: clean } });
      if (!r.ok) {
        toast.error("Pasta raiz inválida", { description: r.error });
        return;
      }
    } catch (e: any) {
      toast.error("Falha ao validar pasta", { description: e?.message });
      return;
    }
    setRootFolder(clean);
    localStorage.setItem(ROOT_KEY, clean);
    toast.success("Pasta raiz salva e validada", { description: clean });
  }

  const test = useMutation({
    mutationFn: () => testFn({ data: { path: rootFolder } }),
    onError: (e: any) => toast.error("Falha no teste", { description: e?.message }),
  });

  const testConn = useMutation({
    mutationFn: () => listFn({ data: { path: "" } }),
    onSuccess: (r) => toast.success("Conexão OK", { description: `${r.folders.length} pasta(s) na raiz do OneDrive` }),
    onError: (e: any) => toast.error("Conexão falhou", { description: e?.message ?? "Sem resposta do OneDrive" }),
  });

  const [accountModal, setAccountModal] = useState<null | "switch" | "disconnect">(null);

  const ok = verify.data?.ok === true;
  const status: "loading" | "connected" | "error" = verify.isLoading
    ? "loading"
    : ok ? "connected" : "error";
  const acc = ok ? verify.data!.account : null;
  const statusBadge = {
    loading: { cls: "bg-muted text-muted-foreground border-border", label: "Verificando…" },
    connected: { cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", label: "Conectado" },
    error: { cls: "bg-destructive/10 text-destructive border-destructive/30", label: "Desconectado / erro" },
  }[status];

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-brand/10 text-brand grid place-items-center">
          <Cloud className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-serif text-xl leading-none">Microsoft OneDrive</h2>
          <p className="text-xs text-muted-foreground mt-1">Conta conectada, pasta de destino e validação</p>
        </div>
      </header>

      <section className="border border-border rounded-lg p-4 bg-card">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm">Status da conexão</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusBadge.cls}`}>{statusBadge.label}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => verify.refetch()}
              className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-accent"
              disabled={verify.isFetching}
            >
              {verify.isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Verificar
            </button>
            <button
              onClick={() => testConn.mutate()}
              disabled={testConn.isPending || !ok}
              className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded bg-brand text-brand-foreground disabled:opacity-50"
            >
              {testConn.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
              Testar conexão
            </button>
          </div>
        </div>
        {status === "loading" ? (
          <p className="text-sm text-muted-foreground">Verificando…</p>
        ) : ok ? (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium">{acc?.displayName ?? "Conta OneDrive"}</div>
              {acc?.email && <div className="text-muted-foreground text-xs">{acc.email}</div>}
              <div className="text-xs text-muted-foreground mt-1">Acesso autorizado via Lovable Connector.</div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="text-sm">
              <div className="font-medium">Não foi possível verificar a conexão</div>
              <div className="text-xs text-muted-foreground mt-1 break-all">
                {(verify.data as any)?.error ?? (verify.error as any)?.message ?? "Conector OneDrive não está disponível."}
              </div>
              <button
                onClick={() => setAccountModal("switch")}
                className="mt-2 text-xs inline-flex items-center gap-1 px-2 py-1 rounded bg-brand text-brand-foreground"
              >
                <UserCog className="h-3 w-3" /> Conectar conta
              </button>
            </div>
          </div>
        )}
      </section>


      <section className="border border-border rounded-lg p-4 bg-card">
        <h3 className="font-medium text-sm mb-2">Pasta raiz dos uploads</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Todos os anexos de RDO ficam dentro desta pasta (organizados por empresa, obra e data).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={rootFolder}
            onChange={(e) => setRootFolder(e.target.value)}
            className="flex-1 min-w-[180px] h-9 px-3 rounded border border-border bg-background text-sm"
            placeholder="DiarioDeObra"
          />
          <button
            onClick={() => saveRoot(rootFolder)}
            className="h-9 px-3 rounded bg-brand text-brand-foreground text-sm"
          >
            Salvar
          </button>
        </div>
      </section>

      {ok && (
        <section className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-medium text-sm">Explorar pastas</h3>
            {path && (
              <button
                className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => setPath(path.split("/").slice(0, -1).join("/"))}
              >
                <ArrowLeft className="h-3 w-3" /> Voltar
              </button>
            )}
          </div>
          <div className="text-xs text-muted-foreground mb-2 break-all">/ {path || "(raiz)"}</div>
          {folders.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando pastas…</p>
          ) : folders.data?.folders.length ? (
            <ul className="divide-y divide-border">
              {folders.data.folders.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 py-2">
                  <button
                    className="flex items-center gap-2 text-sm hover:text-brand"
                    onClick={() => setPath(path ? `${path}/${f.name}` : f.name)}
                  >
                    <FolderOpen className="h-4 w-4" />
                    <span>{f.name}</span>
                    <span className="text-xs text-muted-foreground">({f.childCount})</span>
                    <ChevronRight className="h-3 w-3 opacity-50" />
                  </button>
                  <button
                    className="text-xs px-2 py-1 rounded border border-border hover:bg-accent"
                    onClick={() => saveRoot(path ? `${path}/${f.name}` : f.name)}
                  >
                    Usar como raiz
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma subpasta nesta pasta.</p>
          )}
        </section>
      )}

      {ok && (
        <section className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="font-medium text-sm">Teste de permissões</h3>
            <button
              onClick={() => test.mutate()}
              disabled={test.isPending}
              className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded bg-brand text-brand-foreground disabled:opacity-50"
            >
              {test.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              Executar teste
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Verifica existência, listagem, escrita e remoção em <strong>/{rootFolder}</strong>.
          </p>
          {test.data && (
            <ul className="text-sm space-y-1">
              {test.data.log.map((l, i) => (
                <li key={i} className="flex items-start gap-2">
                  {l.ok
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                    : <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />}
                  <span className="flex-1">{l.step}</span>
                  {l.detail && <span className="text-xs text-muted-foreground break-all">{l.detail}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}



      <section className="border border-border rounded-lg p-4 bg-card">
        <h3 className="font-medium text-sm mb-2">Conta conectada</h3>
        <p className="text-xs text-muted-foreground mb-3">
          O OAuth oficial da Microsoft só pode ser aberto pelo assistente Lovable. Use os botões abaixo: copiamos
          o comando para o chat e o seletor de contas abre dentro do próprio sistema, sem sair desta tela.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAccountModal("switch")}
            className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded bg-brand text-brand-foreground"
          >
            <UserCog className="h-3 w-3" /> Trocar conta do OneDrive
          </button>
          <button
            onClick={() => setAccountModal("disconnect")}
            className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded border border-destructive text-destructive hover:bg-destructive/10"
          >
            <Unplug className="h-3 w-3" /> Desconectar OneDrive
          </button>
        </div>
      </section>

      {accountModal && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={() => setAccountModal(null)}>
          <div className="bg-card border border-border rounded-lg p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-medium text-sm mb-2">
              {accountModal === "switch" ? "Trocar conta do OneDrive" : "Desconectar OneDrive"}
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Envie a mensagem abaixo no chat do Lovable. O seletor de contas da Microsoft abrirá aqui no sistema
              para você escolher/desconectar.
            </p>
            <pre className="text-xs bg-muted rounded p-3 whitespace-pre-wrap break-all mb-3">
              {accountModal === "switch"
                ? "Trocar a conta do OneDrive conectada a este projeto"
                : "Desconectar a conta do OneDrive deste projeto"}
            </pre>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  const msg = accountModal === "switch"
                    ? "Trocar a conta do OneDrive conectada a este projeto"
                    : "Desconectar a conta do OneDrive deste projeto";
                  navigator.clipboard?.writeText(msg).then(
                    () => toast.success("Mensagem copiada — cole no chat"),
                    () => toast.error("Não foi possível copiar"),
                  );
                }}
                className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded border border-border hover:bg-accent"
              >
                <Copy className="h-3 w-3" /> Copiar mensagem
              </button>
              <button
                onClick={() => setAccountModal(null)}
                className="text-xs px-3 py-1.5 rounded bg-brand text-brand-foreground"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}
