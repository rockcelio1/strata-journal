// Somente servidor: helpers compartilhados das server functions do OneDrive.
// Ficam fora de `*.functions.ts` porque o split de server functions apaga
// declarações irmãs do módulo (causa ReferenceError em produção/preview).
import { naoConectado, OneDriveError, type Fetcher } from "@/lib/onedrive-graph";

export const GATEWAY_URL = "https://graph.microsoft.com/v1.0";

export type DiagEntry = {
  ts: string;
  method: string;
  url: string;
  status: number;
  ok: boolean;
  requestId?: string | null;
  step?: string | null;
  error?: string | null;
};

export const DIAG_MAX = 30;
const _diagBuf: DiagEntry[] = [];

/** Sanitiza a URL para remover informações sensíveis como IDs de itens ou drives. */
function sanitizarUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove IDs de recursos do path para evitar vazamento
    u.pathname = u.pathname.replace(/\/items\/[^\/]+/, "/items/[ID]");
    u.pathname = u.pathname.replace(/\/drives\/[^\/]+/, "/drives/[ID]");
    return u.toString();
  } catch {
    return url.replace(/\/items\/[^\/]+/, "/items/[ID]").replace(/\/drives\/[^\/]+/, "/drives/[ID]");
  }
}

export function pushDiag(e: DiagEntry) {
  const entry = { ...e, url: sanitizarUrl(e.url) };
  _diagBuf.unshift(entry);
  if (_diagBuf.length > DIAG_MAX) _diagBuf.length = DIAG_MAX;
}

export function getDiag() {
  return [..._diagBuf];
}

export function slugSegment(s: string): string {
  return (
    (s || "sem-nome")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.\-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "sem-nome"
  );
}

export function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export const MESES_PT = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Confere se a conta OneDrive da organização está conectada dentro do RDO. */
export async function getKeys() {
  const { statusOrganizacao } = await import("@/lib/onedrive-org.server");
  const st = await statusOrganizacao();
  if (!st.conectado) throw naoConectado("credenciais");
  return st;
}

export function parseGraphError(
  status: number,
  body: string,
  step: string,
  url: string,
  requestId?: string | null,
): string {
  let code = "",
    message = body.slice(0, 200);
  try {
    const j = JSON.parse(body);
    code = j?.error?.code ?? "";
    message = j?.error?.message ?? message;
  } catch {
    /* texto puro */
  }
  let hint = "";
  if (code === "BadRequest" && /segment 'v\d/i.test(message)) {
    hint = " — confira a rota do gateway (base URL não deve conter /v1.0).";
  } else if (status === 404 || code === "itemNotFound") {
    hint = " — recurso/pasta não existe no OneDrive.";
  } else if (status === 401 || status === 403) {
    hint = " — token expirado ou sem permissão; reconecte o OneDrive.";
  } else if (status === 429) {
    hint = " — limite de requisições da Microsoft (tente novamente).";
  }
  return `[${step}] ${status} ${code || ""} ${message}${hint} (URL: ${url}${
    requestId ? ` | request-id: ${requestId}` : ""
  })`.trim();
}

export async function gatewayFetch(
  path: string,
  init?: RequestInit,
  retries = 2,
  step = "graph",
): Promise<Response> {
  const url = `${GATEWAY_URL}${path}`;
  const method = init?.method ?? "GET";
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { graphOrganizacao } = await import("@/lib/onedrive-org.server");
      const res = await graphOrganizacao(path, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(15000),
      });

      const requestId = res.headers.get("request-id") ?? res.headers.get("client-request-id");
      if (res.status >= 500 || res.status === 429) {
        if (attempt < retries) {
          const wait = 300 * Math.pow(2, attempt);
          console.warn(`[onedrive:${step}] ${res.status} em ${path} — retry ${attempt + 1}/${retries} em ${wait}ms`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
      }
      pushDiag({ ts: new Date().toISOString(), method, url, status: res.status, ok: res.ok, requestId, step });
      return res;
    } catch (e: any) {
      lastErr = e;
      console.error(`[onedrive:${step}] erro de rede em ${path} (tentativa ${attempt + 1}):`, e);
      pushDiag({
        ts: new Date().toISOString(),
        method,
        url,
        status: 0,
        ok: false,
        step,
        error: e?.message ?? "network",
      });
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
        continue;
      }
    }
  }
  throw lastErr ?? new Error("OneDrive: falha de rede após retentativas");
}

export const fetcherGateway: Fetcher = (path, init, step) => gatewayFetch(path, init, 2, step ?? "graph");

export function falhaOneDrive(e: unknown): never {
  if (e instanceof OneDriveError) {
    pushDiag({
      ts: new Date().toISOString(),
      method: "GET",
      url: e.detalhe.url ?? GATEWAY_URL,
      status: e.detalhe.status,
      ok: false,
      requestId: e.detalhe.requestId ?? null,
      step: e.detalhe.step,
      error: `${e.detalhe.kind}: ${e.detalhe.message}`,
    });
    throw new Error(`${e.detalhe.message} ${e.detalhe.action}`);
  }
  throw e instanceof Error ? e : new Error("Falha inesperada no OneDrive.");
}

/** Retorna uma downloadUrl fresca (~1h de validade) para um item do OneDrive. */
export async function refreshOnedriveDownloadUrl(itemId: string): Promise<string | null> {
  if (!itemId) return null;
  try {
    const res = await gatewayFetch(`/drive/items/${encodeURIComponent(itemId)}`, undefined, 1, "refreshDownloadUrl");
    if (!res.ok) return null;
    const j: any = await res.json().catch(() => null);
    return j?.["@microsoft.graph.downloadUrl"] ?? j?.webUrl ?? null;
  } catch {
    return null;
  }
}
