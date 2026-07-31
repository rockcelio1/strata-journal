/**
 * Núcleo puro da integração OneDrive (Microsoft Graph via gateway).
 *
 * Tudo aqui é independente de runtime: recebe um `fetcher` injetável, o que
 * permite testes de integração determinísticos (listar, upload, download,
 * paginação, 401/403, 429, rede fora do ar) sem tocar na conta real.
 */

export type OneDriveItem = {
  id: string;
  name: string;
  isFolder: boolean;
  size: number;
  childCount: number;
  modifiedAt: string | null;
  webUrl: string | null;
  mimeType: string | null;
};

export type OneDriveFailure = {
  /** Código curto e estável, usado pela UI e pelos testes. */
  kind:
    | "nao_conectado"
    | "sem_acesso"
    | "token_expirado"
    | "nao_encontrado"
    | "limite_taxa"
    | "arquivo_grande"
    | "rota_invalida"
    | "indisponivel"
    | "desconhecido";
  /** Mensagem curta para o usuário. */
  message: string;
  /** O que fazer, em linguagem direta. */
  action: string;
  status: number;
  step: string;
  requestId?: string | null;
  url?: string;
};

export class OneDriveError extends Error {
  readonly detalhe: OneDriveFailure;
  constructor(detalhe: OneDriveFailure) {
    super(`${detalhe.message} ${detalhe.action}`.trim());
    this.name = "OneDriveError";
    this.detalhe = detalhe;
  }
}

/** Classifica a falha do Graph/gateway em algo acionável. */
export function describeOneDriveError(input: {
  status: number;
  body?: string;
  step: string;
  url?: string;
  requestId?: string | null;
}): OneDriveFailure {
  const { status, step, url, requestId } = input;
  const body = input.body ?? "";
  let code = "";
  let graphMsg = body.slice(0, 200);
  try {
    const j = JSON.parse(body);
    code = j?.error?.code ?? j?.type ?? "";
    graphMsg = j?.error?.message ?? j?.message ?? graphMsg;
  } catch {
    /* corpo em texto puro */
  }

  const base = { status, step, requestId: requestId ?? null, url };
  const lower = `${code} ${graphMsg}`.toLowerCase();

  if (status === 0) {
    return {
      ...base,
      kind: "indisponivel",
      message: "Não foi possível falar com o serviço do OneDrive.",
      action: "Verifique a conexão de rede e tente novamente em alguns instantes.",
    };
  }
  if (status === 401) {
    if (lower.includes("connection") || lower.includes("credential")) {
      return {
        ...base,
        kind: "sem_acesso",
        message: "Esta conta não tem acesso à conexão OneDrive do workspace.",
        action:
          "Peça ao responsável pela conexão para liberar seu usuário em Configurações do workspace → Conectores → OneDrive, e confira o request-id nos logs de diagnóstico desta tela.",
      };
    }
    return {
      ...base,
      kind: "token_expirado",
      message: "A autorização do OneDrive expirou.",
      action: "Reconecte a conta em Configurações → OneDrive (botão Reconectar) para renovar o acesso.",
    };
  }
  if (status === 403) {
    return {
      ...base,
      kind: "sem_acesso",
      message: "A conta conectada não tem permissão para esta operação.",
      action:
        "Reconecte concedendo os escopos Files.ReadWrite e offline_access, ou peça acesso à pasta ao administrador do OneDrive. O request-id abaixo ajuda no suporte.",
    };
  }
  if (status === 404 || code === "itemNotFound") {
    return {
      ...base,
      kind: "nao_encontrado",
      message: "Pasta ou arquivo não existe mais no OneDrive.",
      action: "Atualize a listagem; o item pode ter sido movido ou excluído.",
    };
  }
  if (status === 429) {
    return {
      ...base,
      kind: "limite_taxa",
      message: "A Microsoft limitou temporariamente as requisições.",
      action: "Aguarde alguns segundos e repita a operação.",
    };
  }
  if (status === 413) {
    return {
      ...base,
      kind: "arquivo_grande",
      message: "Arquivo maior que o limite aceito pelo envio direto.",
      action: "Envie um arquivo menor ou divida o conteúdo.",
    };
  }
  if (code === "BadRequest" && /segment 'v\d/i.test(graphMsg)) {
    return {
      ...base,
      kind: "rota_invalida",
      message: "Rota do gateway configurada incorretamente.",
      action: "A URL base não deve conter /v1.0. Ajuste a configuração da integração.",
    };
  }
  if (status >= 500) {
    return {
      ...base,
      kind: "indisponivel",
      message: "O OneDrive está instável no momento.",
      action: "Tente novamente em alguns minutos; o sistema já refaz a chamada automaticamente.",
    };
  }
  return {
    ...base,
    kind: "desconhecido",
    message: graphMsg || "Falha inesperada no OneDrive.",
    action: "Reveja o diagnóstico desta tela e informe o request-id ao suporte.",
  };
}

/** Falha usada quando as credenciais do conector não estão no ambiente. */
export function naoConectado(step = "config"): OneDriveError {
  return new OneDriveError({
    kind: "nao_conectado",
    message: "O OneDrive ainda não está conectado a este projeto.",
    action:
      "Abra Configurações → OneDrive e conclua a autorização; se o botão indicar falta de acesso, vincule a conexão do workspace ao projeto.",
    status: 0,
    step,
  });
}

export function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function normalizePath(path?: string | null): string {
  return (path ?? "").replace(/^\/+|\/+$/g, "");
}

const SELECT_ITENS =
  "$select=id,name,size,folder,file,webUrl,lastModifiedDateTime&$top=100&$orderby=name";

/** Monta a rota de listagem (raiz ou subpasta), com cursor de paginação. */
export function buildChildrenUrl(path?: string | null, cursor?: string | null): string {
  const p = normalizePath(path);
  const base = p
    ? `/drive/root:/${encodePath(p)}:/children?${SELECT_ITENS}`
    : `/drive/root/children?${SELECT_ITENS}`;
  return cursor ? `${base}&$skiptoken=${encodeURIComponent(cursor)}` : base;
}

export function mapGraphItem(it: any): OneDriveItem {
  return {
    id: String(it?.id ?? ""),
    name: String(it?.name ?? ""),
    isFolder: Boolean(it?.folder),
    size: Number(it?.size ?? 0),
    childCount: Number(it?.folder?.childCount ?? 0),
    modifiedAt: it?.lastModifiedDateTime ?? null,
    webUrl: it?.webUrl ?? null,
    mimeType: it?.file?.mimeType ?? null,
  };
}

/** Pastas primeiro, depois arquivos — ordem estável em pt-BR. */
export function ordenarItens(items: OneDriveItem[]): OneDriveItem[] {
  return [...items].sort(
    (a, b) => Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name, "pt-BR"),
  );
}

/** Extrai o `$skiptoken` do `@odata.nextLink` (null quando é a última página). */
export function extractSkipToken(nextLink?: string | null): string | null {
  if (!nextLink) return null;
  try {
    return new URL(nextLink).searchParams.get("$skiptoken");
  } catch {
    return /[?&]\$skiptoken=([^&]+)/.exec(nextLink)?.[1] ?? null;
  }
}

export type Fetcher = (path: string, init?: RequestInit, step?: string) => Promise<Response>;

async function garantirOk(res: Response, step: string, url: string) {
  if (res.ok) return;
  const body = await res.text().catch(() => "");
  throw new OneDriveError(
    describeOneDriveError({
      status: res.status,
      body,
      step,
      url,
      requestId: res.headers?.get?.("request-id") ?? null,
    }),
  );
}

/** Lista pastas e arquivos de um caminho. */
export async function listChildren(
  fetcher: Fetcher,
  args: { path?: string | null; cursor?: string | null } = {},
) {
  const url = buildChildrenUrl(args.path, args.cursor);
  const res = await fetcher(url, undefined, "listItems");
  await garantirOk(res, "listItems", url);
  const json: any = await res.json();
  return {
    path: normalizePath(args.path),
    items: ordenarItens((json?.value ?? []).map(mapGraphItem)),
    cursor: extractSkipToken(json?.["@odata.nextLink"]),
  };
}

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** Envia bytes para `path/nome` (PUT simples do Graph, com rename em conflito). */
export async function uploadContent(
  fetcher: Fetcher,
  args: { path?: string | null; nome: string; mimeType?: string; bytes: Uint8Array },
) {
  if (args.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new OneDriveError({
      kind: "arquivo_grande",
      message: `Arquivo acima de ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`,
      action: "Envie um arquivo menor ou compacte o conteúdo antes.",
      status: 413,
      step: "uploadFile",
    });
  }
  const folder = normalizePath(args.path);
  const full = folder ? `${folder}/${args.nome}` : args.nome;
  const url = `/drive/root:/${encodePath(full)}:/content?@microsoft.graph.conflictBehavior=rename`;
  const res = await fetcher(
    url,
    {
      method: "PUT",
      headers: { "Content-Type": args.mimeType || "application/octet-stream" },
      body: args.bytes as unknown as BodyInit,
    },
    "uploadFile",
  );
  await garantirOk(res, "uploadFile", url);
  const item: any = await res.json();
  return {
    id: String(item?.id ?? ""),
    name: String(item?.name ?? args.nome),
    size: Number(item?.size ?? args.bytes.byteLength),
    webUrl: item?.webUrl ?? null,
    path: full,
  };
}

/** Link temporário de download de um item. */
export async function getDownloadUrl(fetcher: Fetcher, itemId: string) {
  const url = `/drive/items/${encodeURIComponent(itemId)}?$select=id,name,size,webUrl,@microsoft.graph.downloadUrl`;
  const res = await fetcher(url, undefined, "downloadUrl");
  await garantirOk(res, "downloadUrl", url);
  const j: any = await res.json();
  const link = j?.["@microsoft.graph.downloadUrl"] ?? j?.webUrl ?? null;
  if (!link) {
    throw new OneDriveError({
      kind: "desconhecido",
      message: "O OneDrive não devolveu link de download para este item.",
      action: "Abra o arquivo pelo botão de link externo ou tente novamente.",
      status: 200,
      step: "downloadUrl",
      url,
    });
  }
  return { url: String(link), name: String(j?.name ?? "arquivo"), size: Number(j?.size ?? 0) };
}
