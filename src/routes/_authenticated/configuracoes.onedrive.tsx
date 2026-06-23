import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Cloud, CheckCircle2, AlertCircle, RefreshCw, FolderOpen, ChevronRight, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { verifyOneDrive, listOneDriveFolders, testOneDrivePermissions, ensureOneDriveFolder } from "@/lib/onedrive.functions";

export const Route = createFileRoute("/_authenticated/configuracoes/onedrive")({
  component: OneDriveSettings,
});

const ROOT_KEY = "onedrive.root_folder";

function OneDriveSettings() {
  const verifyFn = useServerFn(verifyOneDrive);
  const listFn = useServerFn(listOneDriveFolders);
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

  function saveRoot(name: string) {
    const clean = name.trim().replace(/^\/+|\/+$/g, "") || "DiarioDeObra";
    setRootFolder(clean);
    localStorage.setItem(ROOT_KEY, clean);
    toast.success("Pasta raiz salva", { description: clean });
  }

  const ok = verify.data?.ok === true;
  const acc = ok ? verify.data!.account : null;

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
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="font-medium text-sm">Status da conexão</h3>
          <button
            onClick={() => verify.refetch()}
            className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-accent"
            disabled={verify.isFetching}
          >
            {verify.isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Verificar
          </button>
        </div>
        {verify.isLoading ? (
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
              <p className="text-xs text-muted-foreground mt-2">
                Para reconectar, abra <strong>Configurações do projeto → Conectores → Microsoft OneDrive</strong> e
                desconecte/reconecte a conta.
              </p>
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

      <section className="border border-border rounded-lg p-4 bg-card">
        <h3 className="font-medium text-sm mb-2">Desconectar / reconectar</h3>
        <p className="text-xs text-muted-foreground">
          A conta do OneDrive é gerenciada no nível do projeto. Para trocar de conta ou revogar o acesso, abra
          <strong> Configurações do projeto → Conectores → Microsoft OneDrive</strong>.
        </p>
      </section>
    </div>
  );
}
