import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  File as FileIcon,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Upload,
} from "lucide-react";
import {
  getOneDriveDownloadUrl,
  listOneDriveItems,
  uploadOneDriveFile,
} from "@/lib/onedrive.functions";
import { notify } from "@/lib/toast";
import { fmtBytes } from "@/components/onedrive/QuotaChart3D";

const MAX_MB = 15;

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < buf.length; i += CH) {
    bin += String.fromCharCode(...buf.subarray(i, i + CH));
  }
  return btoa(bin);
}

/** Explorador de arquivos do OneDrive corporativo: listar, enviar e baixar. */
export function OneDriveFileExplorer({ initialPath = "" }: { initialPath?: string }) {
  const listFn = useServerFn(listOneDriveItems);
  const uploadFn = useServerFn(uploadOneDriveFile);
  const downloadFn = useServerFn(getOneDriveDownloadUrl);
  const qc = useQueryClient();

  const [path, setPath] = useState(initialPath);
  const [cursor, setCursor] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const listing = useQuery({
    queryKey: ["onedrive", "items", path, cursor],
    queryFn: () => listFn({ data: { path, cursor } }),
    retry: 1,
    staleTime: 30_000,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_MB * 1024 * 1024) {
        throw new Error(`Arquivo acima de ${MAX_MB} MB.`);
      }
      return uploadFn({
        data: {
          path,
          nome: file.name,
          mime_type: file.type || "application/octet-stream",
          base64: await fileToBase64(file),
        },
      });
    },
    onSuccess: (r) => {
      notify.success("Arquivo enviado", { description: `${r.name} (${fmtBytes(r.size)})` });
      qc.invalidateQueries({ queryKey: ["onedrive", "items"] });
      qc.invalidateQueries({ queryKey: ["onedrive", "quota"] });
    },
    onError: (e: any) => notify.error("Falha no upload", { description: e?.message }),
  });

  const download = useMutation({
    mutationFn: (itemId: string) => downloadFn({ data: { itemId } }),
    onSuccess: (r) => {
      if (!r.ok) {
        notify.error("Não foi possível baixar", { description: r.error });
        return;
      }
      window.open(r.url, "_blank", "noopener,noreferrer");
    },
    onError: (e: any) => notify.error("Falha ao gerar link", { description: e?.message }),
  });

  function navegar(next: string) {
    setCursor(null);
    setPath(next);
  }

  const items = listing.data?.items ?? [];

  return (
    <section className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3 className="font-medium text-sm">Arquivos no OneDrive</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => listing.refetch()}
            disabled={listing.isFetching}
            className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-50"
          >
            {listing.isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Atualizar
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
            className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded bg-brand text-brand-foreground disabled:opacity-50"
          >
            {upload.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Enviar arquivo
          </button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) upload.mutate(f);
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        {path && (
          <button
            className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => navegar(path.split("/").slice(0, -1).join("/"))}
          >
            <ArrowLeft className="h-3 w-3" /> Voltar
          </button>
        )}
        <span className="text-xs text-muted-foreground break-all">/ {path || "(raiz)"}</span>
      </div>

      {listing.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando conteúdo…</p>
      ) : listing.error ? (
        <p className="text-xs text-destructive break-all">{(listing.error as Error).message}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta pasta está vazia.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-2 py-2">
              {it.isFolder ? (
                <button
                  className="flex items-center gap-2 text-sm hover:text-brand min-w-0"
                  onClick={() => navegar(path ? `${path}/${it.name}` : it.name)}
                >
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span className="truncate">{it.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">({it.childCount})</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{it.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{fmtBytes(it.size)}</span>
                </div>
              )}

              <div className="flex items-center gap-1 shrink-0">
                {!it.isFolder && (
                  <button
                    onClick={() => download.mutate(it.id)}
                    disabled={download.isPending}
                    className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-50"
                    title="Baixar / visualizar"
                  >
                    {download.isPending && download.variables === it.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    Baixar
                  </button>
                )}
                {it.webUrl && (
                  <a
                    href={it.webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-accent"
                    title="Abrir no OneDrive"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {listing.data?.cursor && (
        <button
          onClick={() => setCursor(listing.data!.cursor)}
          className="mt-3 text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-accent"
        >
          <MoreHorizontal className="h-3 w-3" /> Carregar mais
        </button>
      )}

      <p className="text-[11px] text-muted-foreground mt-3">
        Envio direto até {MAX_MB} MB por arquivo. Os links de download são temporários e gerados sob demanda,
        sem expor credenciais da conta.
      </p>
    </section>
  );
}
