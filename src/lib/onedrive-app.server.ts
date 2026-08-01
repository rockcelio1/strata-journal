/**
 * MicrosoftGraphService — integração OneDrive somente de servidor (app-only).
 *
 * Autenticação exclusivamente por OAuth 2.0 Client Credentials com permissões
 * de aplicativo (Files.ReadWrite.All + consentimento do administrador).
 */

export const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const LOGIN_BASE = "https://login.microsoftonline.com";
const RENOVAR_ANTES_MS = 5 * 60_000;
const TIMEOUT_MS = 30_000;

export type ConfigGraph = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  targetUser: string;
  scope: string;
};

export class OneDriveConfigError extends Error {
  readonly faltando: string[];
  constructor(faltando: string[]) {
    super(
      "A integração com o OneDrive ainda não foi configurada no servidor. Um administrador precisa definir as variáveis " +
        faltando.join(", ") +
        " no ambiente da aplicação.",
    );
    this.name = "OneDriveConfigError";
    this.faltando = faltando;
  }
}

export class OneDriveGraphError extends Error {
  readonly status: number;
  readonly step: string;
  readonly requestId: string | null;
  readonly codigo: string;
  constructor(args: { status: number; step: string; requestId?: string | null; codigo?: string; message: string }) {
    super(args.message);
    this.name = "OneDriveGraphError";
    this.status = args.status;
    this.step = args.step;
    this.requestId = args.requestId ?? null;
    this.codigo = args.codigo ?? "";
  }
}

/** Lê a configuração do ambiente ou do banco de dados (somente servidor). */
export async function lerConfig(): Promise<ConfigGraph | null> {
  const envTenantId = process.env.MICROSOFT_TENANT_ID?.trim();
  const envClientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const envClientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  const envTargetUser = process.env.MICROSOFT_ONEDRIVE_USER?.trim();
  const scope = process.env.MICROSOFT_GRAPH_SCOPE?.trim() || "https://graph.microsoft.com/.default";

  if (envTenantId && envClientId && envClientSecret && envTargetUser) {
    return { tenantId: envTenantId, clientId: envClientId, clientSecret: envClientSecret, targetUser: envTargetUser, scope };
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("onedrive_admin_config" as any)
      .select("*")
      .maybeSingle();

    if (data && (data as any).client_secret_ciphertext) {
      const d = data as any;
      const { decrypt } = await import("./crypto.server");
      return {
        tenantId: d.tenant_id,
        clientId: d.client_id,
        clientSecret: decrypt(d.client_secret_ciphertext),
        targetUser: d.target_user_email,
        scope
      };
    }
  } catch (e) {
    console.error("[onedrive] erro ao ler config do banco:", e);
  }
  return null;
}

export async function variaveisFaltando(): Promise<string[]> {
  const config = await lerConfig();
  if (config) return [];
  return ["MICROSOFT_TENANT_ID", "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_ONEDRIVE_USER"];
}

export async function exigirConfig(): Promise<ConfigGraph> {
  const c = await lerConfig();
  if (!c) throw new OneDriveConfigError(await variaveisFaltando());
  return c;
}

type TokenCache = { token: string; expiresAt: number; chave: string };
let cacheToken: TokenCache | null = null;
let emVoo: Promise<string> | null = null;

export function limparCacheGraph() {
  cacheToken = null;
  emVoo = null;
  cacheDriveId = null;
}

function chaveConfig(c: ConfigGraph) {
  return `${c.tenantId}:${c.clientId}:${c.targetUser}:${c.scope}`;
}

async function solicitarToken(c: ConfigGraph): Promise<string> {
  const res = await fetch(`${LOGIN_BASE}/${encodeURIComponent(c.tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      scope: c.scope,
      grant_type: "client_credentials",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const texto = await res.text();
    console.error(`[onedrive] falha ao obter token: ${res.status} ${texto}`);
    throw new Error("Falha na autenticação com Microsoft Graph.");
  }
  const j = await res.json() as { access_token: string; expires_in?: number };
  cacheToken = {
    token: j.access_token,
    expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000 - RENOVAR_ANTES_MS,
    chave: chaveConfig(c),
  };
  return j.access_token;
}

export async function obterToken(): Promise<string> {
  const c = await exigirConfig();
  const chave = chaveConfig(c);
  if (cacheToken && cacheToken.chave === chave && cacheToken.expiresAt > Date.now()) return cacheToken.token;
  if (emVoo) return emVoo;
  emVoo = solicitarToken(c).finally(() => { emVoo = null; });
  return emVoo;
}

let cacheDriveId: { id: string; chave: string } | null = null;

export async function obterDriveId(): Promise<string> {
  const c = await exigirConfig();
  const chave = chaveConfig(c);
  if (cacheDriveId && cacheDriveId.chave === chave) return cacheDriveId.id;
  const res = await chamarGraph(`/users/${encodeURIComponent(c.targetUser)}/drive?$select=id`, undefined, "resolverDrive");
  const j = await res.json() as { id?: string };
  if (!j.id) throw new Error("OneDrive não encontrado para o usuário.");
  cacheDriveId = { id: j.id, chave };
  return j.id;
}

const RETRYABLE = new Set([429, 502, 503, 504]);
function esperar(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export async function chamarGraph(path: string, init?: RequestInit, step = "graph", tentativas = 3): Promise<Response> {
  let alvo = path.startsWith("/") ? path : `/${path}`;
  if (alvo.startsWith("/drive")) {
    const driveId = await obterDriveId();
    alvo = `/drives/${driveId}${alvo.slice(6)}`;
  }
  const url = `${GRAPH_BASE}${alvo}`;
  let ultima: Response | null = null;
  for (let t = 0; t < tentativas; t++) {
    const token = await obterToken();
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    try {
      const res = await fetch(url, { ...init, headers, signal: init?.signal ?? AbortSignal.timeout(TIMEOUT_MS) });
      if (res.ok) return res;
      if (res.status === 401 && t === 0) { cacheToken = null; continue; }
      if (RETRYABLE.has(res.status) && t < tentativas - 1) { await esperar(500 * 2 ** t); continue; }
      ultima = res; break;
    } catch (e) {
      if (t < tentativas - 1) { await esperar(500 * 2 ** t); continue; }
      throw e;
    }
  }
  throw new Error(`Falha no Graph (${step}): ${ultima?.status}`);
}

// Re-implementando helpers básicos para manter o build estável
export function sanitizarSegmento(v: string) { return v.replace(/[/\\:*?"<>|#%]/g, "_").trim().slice(0, 100); }
export function sanitizarCaminho(c: string) { return c.split("/").filter(Boolean).map(sanitizarSegmento).join("/"); }
export function encodeCaminho(c: string) { return c.split("/").map(encodeURIComponent).join("/"); }

export async function enviarArquivo(args: { caminho: string; bytes: Uint8Array; mimeType: string }) {
  const caminho = sanitizarCaminho(args.caminho);
  const res = await chamarGraph(`/drive/root:/${encodeCaminho(caminho)}:/content`, {
    method: "PUT",
    headers: { "Content-Type": args.mimeType },
    body: args.bytes as any
  });
  return res.json();
}

export async function deletarArquivo(driveId: string, itemId: string) {
  return chamarGraph(`/drives/${driveId}/items/${itemId}`, { method: "DELETE" });
}

export function nomeFisico(nomeOriginal: string): string {
  const ext = (nomeOriginal.match(/\.[A-Za-z0-9]{1,10}$/)?.[0] ?? "").toLowerCase();
  const base = sanitizarSegmento(nomeOriginal.slice(0, nomeOriginal.length - ext.length));
  const carimbo = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${base}-${carimbo}${ext}`;
}

export function pastaRdo(args: { data: Date | string; obra: string; rdo: string; raiz?: string }): string {
  const d = typeof args.data === "string" ? new Date(`${args.data.slice(0, 10)}T00:00:00`) : args.data;
  const base = Number.isNaN(d.getTime()) ? new Date() : d;
  const ano = String(base.getFullYear());
  const mes = String(base.getMonth() + 1).padStart(2, "0");
  return sanitizarCaminho(
    [args.raiz?.trim() || "RDO", ano, mes, args.obra || "OBRA", args.rdo || "RDO"].join("/"),
  );
}

export async function statusIntegracao() {
  try {
    const config = await lerConfig();
    if (!config) return { ok: false, status: 'nao_configurado' };
    await obterToken();
    return { ok: true, status: 'operacional', account: config.targetUser };
  } catch (e) {
    return { ok: false, status: 'erro', error: (e as Error).message };
  }
}

export async function excluirItem(driveId: string, itemId: string) {
  return chamarGraph(`/drives/${driveId}/items/${itemId}`, { method: "DELETE" });
}

export async function linkDownload(driveId: string, itemId: string) {
  const res = await chamarGraph(`/drives/${driveId}/items/${itemId}?$select=id,@microsoft.graph.downloadUrl`);
  const j = await res.json();
  return j["@microsoft.graph.downloadUrl"] || null;
}
