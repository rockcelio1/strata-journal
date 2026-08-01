/**
 * MicrosoftGraphService — integração OneDrive somente de servidor (app-only).
 *
 * Autenticação exclusivamente por OAuth 2.0 Client Credentials com permissões
 * de aplicativo (Files.ReadWrite.All + consentimento do administrador).
 *
 * Não existe usuário Microsoft conectado: nada de /authorize, redirect_uri,
 * popup, MSAL ou /me/drive. O drive é resolvido por
 * /users/{MICROSOFT_ONEDRIVE_USER}/drive e reutilizado por ID.
 *
 * O access token vive apenas em memória do processo, nunca no banco, nunca no
 * navegador e nunca em log.
 */

export const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const LOGIN_BASE = "https://login.microsoftonline.com";

/** Margem de segurança para renovar o token antes de expirar. */
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
  // 1. Prioridade para variáveis de ambiente (legado/infra)
  const envTenantId = process.env.MICROSOFT_TENANT_ID?.trim();
  const envClientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const envClientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  const envTargetUser = process.env.MICROSOFT_ONEDRIVE_USER?.trim();
  const scope = process.env.MICROSOFT_GRAPH_SCOPE?.trim() || "https://graph.microsoft.com/.default";

  if (envTenantId && envClientId && envClientSecret && envTargetUser) {
    return { tenantId: envTenantId, clientId: envClientId, clientSecret: envClientSecret, targetUser: envTargetUser, scope };
  }

  // 2. Fallback para banco de dados (nova arquitetura)
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("onedrive_admin_config")
      .select("*")
      .maybeSingle();

    if (data && data.client_secret_ciphertext) {
      const { decrypt } = await import("./crypto.server");
      return {
        tenantId: data.tenant_id,
        clientId: data.client_id,
        clientSecret: decrypt(data.client_secret_ciphertext),
        targetUser: data.target_user_email,
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
  
  return [
    "MICROSOFT_TENANT_ID",
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_CLIENT_SECRET",
    "MICROSOFT_ONEDRIVE_USER"
  ];
}

export async function exigirConfig(): Promise<ConfigGraph> {
  const c = await lerConfig();
  if (!c) throw new OneDriveConfigError(await variaveisFaltando());
  return c;
}

/* ------------------------------------------------------------------ *
 * Token em memória, com renovação antecipada e sem chamadas duplicadas
 * ------------------------------------------------------------------ */

type TokenCache = { token: string; expiresAt: number; chave: string };

let cacheToken: TokenCache | null = null;
let emVoo: Promise<string> | null = null;

/** Limpa os caches (usado em testes e após erro de credencial). */
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
  const texto = await res.text();
  if (!res.ok) {
    let codigo = "";
    let descricao = "";
    try {
      const j = JSON.parse(texto) as { error?: string; error_description?: string };
      codigo = j.error ?? "";
      descricao = j.error_description ?? "";
    } catch {
      /* corpo em texto puro — não registramos, pode conter dados sensíveis */
    }
    const segredoInvalido = /AADSTS7000215|AADSTS7000222|invalid_client/i.test(`${codigo} ${descricao}`);
    const semConsentimento = /AADSTS65001|AADSTS500011/i.test(descricao);
    console.error(`[onedrive] falha ao obter token app-only: status=${res.status} code=${codigo}`);
    if (segredoInvalido) {
      throw new OneDriveGraphError({
        status: res.status,
        step: "token",
        codigo,
        message:
          "O segredo do aplicativo Microsoft está inválido ou expirado. Um administrador precisa gerar um novo Client Secret no Entra ID e atualizar MICROSOFT_CLIENT_SECRET no servidor.",
      });
    }
    if (semConsentimento) {
      throw new OneDriveGraphError({
        status: res.status,
        step: "token",
        codigo,
        message:
          "O aplicativo não possui consentimento administrativo para a permissão Files.ReadWrite.All. Conceda o consentimento no Entra ID.",
      });
    }
    throw new OneDriveGraphError({
      status: res.status,
      step: "token",
      codigo,
      message: "Não foi possível autenticar no Microsoft Graph. Verifique as credenciais do aplicativo no servidor.",
    });
  }
  const j = JSON.parse(texto) as { access_token: string; expires_in?: number };
  cacheToken = {
    token: j.access_token,
    expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000 - RENOVAR_ANTES_MS,
    chave: chaveConfig(c),
  };
  return j.access_token;
}

/** Access token válido (cache em memória, renovação antecipada, single-flight). */
export async function obterToken(): Promise<string> {
  const c = exigirConfig();
  const chave = chaveConfig(c);
  if (cacheToken && cacheToken.chave === chave && cacheToken.expiresAt > Date.now()) {
    return cacheToken.token;
  }
  if (emVoo) return emVoo;
  emVoo = solicitarToken(c).finally(() => {
    emVoo = null;
  });
  return emVoo;
}

/* ------------------------------------------------------------------ *
 * Drive da conta alvo
 * ------------------------------------------------------------------ */

let cacheDriveId: { id: string; chave: string } | null = null;

export async function obterDriveId(): Promise<string> {
  const c = exigirConfig();
  const chave = chaveConfig(c);
  if (cacheDriveId && cacheDriveId.chave === chave) return cacheDriveId.id;
  const res = await chamarGraph(
    `/users/${encodeURIComponent(c.targetUser)}/drive?$select=id,webUrl`,
    undefined,
    "resolverDrive",
  );
  const j = (await res.json()) as { id?: string };
  if (!j.id) {
    throw new OneDriveGraphError({
      status: 404,
      step: "resolverDrive",
      message: `O OneDrive da conta ${c.targetUser} não está provisionado. Acesse o OneDrive dessa conta uma vez para criá-lo.`,
    });
  }
  cacheDriveId = { id: j.id, chave };
  return j.id;
}

/* ------------------------------------------------------------------ *
 * Chamada ao Graph com retry seguro
 * ------------------------------------------------------------------ */

const RETRYABLE = new Set([429, 502, 503, 504]);

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function mensagemErroGraph(status: number, codigo: string, alvo: string): string {
  if (status === 401) return "A autorização do aplicativo com a Microsoft foi recusada. Verifique as credenciais no servidor.";
  if (status === 403)
    return "O aplicativo não tem permissão para esta operação no OneDrive. Confirme a permissão Files.ReadWrite.All com consentimento do administrador.";
  if (status === 404 || codigo === "itemNotFound") return "Arquivo ou pasta não encontrada no OneDrive.";
  if (status === 413) return "Arquivo maior que o limite permitido.";
  if (status === 429) return "A Microsoft limitou temporariamente as requisições. Tente novamente em alguns instantes.";
  if (status >= 500) return "O serviço da Microsoft está indisponível no momento. Tente novamente em alguns minutos.";
  return `Falha na comunicação com o OneDrive (${alvo}).`;
}

/**
 * Chamada bruta ao Graph. Aceita caminho absoluto (`/users/...`, `/drives/...`)
 * ou o atalho `/drive/...`, que é resolvido para `/drives/{driveId}/...`.
 */
export async function chamarGraph(path: string, init?: RequestInit, step = "graph", tentativas = 3): Promise<Response> {
  let alvo = path.startsWith("/") ? path : `/${path}`;
  if (alvo === "/drive" || alvo.startsWith("/drive/") || alvo.startsWith("/drive?") || alvo.startsWith("/drive:")) {
    const driveId = await obterDriveId();
    alvo = `/drives/${driveId}${alvo.slice("/drive".length)}`;
  }
  const url = `${GRAPH_BASE}${alvo}`;

  let ultima: Response | null = null;
  for (let tentativa = 0; tentativa < tentativas; tentativa++) {
    const token = await obterToken();
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    let res: Response;
    try {
      res = await fetch(url, { ...init, headers, signal: init?.signal ?? AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      if (tentativa < tentativas - 1) {
        await esperar(400 * 2 ** tentativa);
        continue;
      }
      throw new OneDriveGraphError({
        status: 0,
        step,
        message: "Não foi possível falar com o serviço da Microsoft. Verifique a conexão de rede do servidor.",
      });
    }

    if (res.ok) return res;

    if (res.status === 401 && tentativa === 0) {
      // Token pode ter sido revogado: descarta o cache e tenta uma vez mais.
      cacheToken = null;
      continue;
    }

    if (RETRYABLE.has(res.status) && tentativa < tentativas - 1) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const espera = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** tentativa;
      await esperar(Math.min(espera, 20_000));
      continue;
    }

    ultima = res;
    break;
  }

  const res = ultima!;
  const corpo = await res.text().catch(() => "");
  let codigo = "";
  try {
    codigo = (JSON.parse(corpo) as any)?.error?.code ?? "";
  } catch {
    /* ignorado */
  }
  const requestId = res.headers.get("request-id") ?? res.headers.get("client-request-id");
  console.error(`[onedrive] ${step} falhou: status=${res.status} code=${codigo} request-id=${requestId ?? "n/a"}`);
  throw new OneDriveGraphError({
    status: res.status,
    step,
    codigo,
    requestId,
    message: mensagemErroGraph(res.status, codigo, step),
  });
}

/* ------------------------------------------------------------------ *
 * Caminhos
 * ------------------------------------------------------------------ */

const INVALIDOS = /[\\:*?"<>|#%]/g;

/** Sanitiza um único segmento de caminho (sem barras, acentos ou controle). */
export function sanitizarSegmento(valor: string): string {
  const limpo = (valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[/\\]/g, "_")
    .replace(INVALIDOS, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+$/, "")
    .replace(/[. ]+$/, "")
    .slice(0, 100);
  return limpo || "sem-nome";
}

/** Sanitiza um caminho completo, rejeitando `..` e caracteres de controle. */
export function sanitizarCaminho(caminho: string): string {
  const partes = (caminho || "")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.some((p) => p === "." || p === "..")) {
    throw new OneDriveGraphError({ status: 400, step: "caminho", message: "Caminho de arquivo inválido." });
  }
  const seguro = partes.map(sanitizarSegmento);
  if (!seguro.length) {
    throw new OneDriveGraphError({ status: 400, step: "caminho", message: "Caminho de arquivo vazio." });
  }
  return seguro.join("/");
}

/** Nome físico único preservando a extensão original. */
export function nomeFisico(nomeOriginal: string): string {
  const ext = (nomeOriginal.match(/\.[A-Za-z0-9]{1,10}$/)?.[0] ?? "").toLowerCase();
  const base = sanitizarSegmento(nomeOriginal.slice(0, nomeOriginal.length - ext.length));
  const carimbo = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${base}-${carimbo}${ext}`;
}

/** Pasta canônica do RDO: /RDO/{ano}/{mes}/{obra}/{rdo}. */
export function pastaRdo(args: { data: Date | string; obra: string; rdo: string; raiz?: string }): string {
  const d = typeof args.data === "string" ? new Date(`${args.data.slice(0, 10)}T00:00:00`) : args.data;
  const base = Number.isNaN(d.getTime()) ? new Date() : d;
  const ano = String(base.getFullYear());
  const mes = String(base.getMonth() + 1).padStart(2, "0");
  return sanitizarCaminho(
    [args.raiz?.trim() || "RDO", ano, mes, args.obra || "OBRA", args.rdo || "RDO"].join("/"),
  );
}

export function encodeCaminho(caminho: string): string {
  return caminho.split("/").map(encodeURIComponent).join("/");
}

/* ------------------------------------------------------------------ *
 * Operações de arquivo
 * ------------------------------------------------------------------ */

export const LIMITE_UPLOAD_SIMPLES = 4 * 1024 * 1024;
export const LIMITE_UPLOAD_TOTAL = 250 * 1024 * 1024;

export type ItemEnviado = {
  driveId: string;
  itemId: string;
  nome: string;
  caminho: string;
  tamanho: number;
  webUrl: string | null;
};

/** Envio pequeno: PUT direto em /drives/{id}/root:/{caminho}:/content */
async function uploadSimples(caminho: string, bytes: Uint8Array, mimeType: string): Promise<any> {
  const res = await chamarGraph(
    `/drive/root:/${encodeCaminho(caminho)}:/content?@microsoft.graph.conflictBehavior=rename`,
    {
      method: "PUT",
      headers: { "Content-Type": mimeType || "application/octet-stream" },
      body: bytes as unknown as BodyInit,
    },
    "uploadSimples",
  );
  return res.json();
}

/** Envio grande: upload session em blocos de 5 MiB, com repetição segura. */
async function uploadSessao(caminho: string, bytes: Uint8Array, mimeType: string): Promise<any> {
  const criar = await chamarGraph(
    `/drive/root:/${encodeCaminho(caminho)}:/createUploadSession`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "rename" } }),
    },
    "criarUploadSession",
  );
  const { uploadUrl } = (await criar.json()) as { uploadUrl: string };
  const BLOCO = 5 * 1024 * 1024;
  const total = bytes.byteLength;
  let enviado = 0;
  let ultimo: any = null;

  while (enviado < total) {
    const fim = Math.min(enviado + BLOCO, total);
    const pedaco = bytes.subarray(enviado, fim);
    let ok = false;
    for (let tentativa = 0; tentativa < 3 && !ok; tentativa++) {
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": String(pedaco.byteLength),
          "Content-Range": `bytes ${enviado}-${fim - 1}/${total}`,
          "Content-Type": mimeType || "application/octet-stream",
        },
        body: pedaco as unknown as BodyInit,
        signal: AbortSignal.timeout(TIMEOUT_MS * 2),
      }).catch(() => null);

      if (res && (res.status === 202 || res.ok)) {
        ok = true;
        if (res.status !== 202) ultimo = await res.json().catch(() => null);
      } else if (res && RETRYABLE.has(res.status)) {
        const retryAfter = Number(res.headers.get("retry-after"));
        await esperar(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 800 * 2 ** tentativa);
      } else if (!res) {
        await esperar(800 * 2 ** tentativa);
      } else {
        console.error(`[onedrive] uploadSessao bloco falhou: status=${res.status}`);
        throw new OneDriveGraphError({
          status: res.status,
          step: "uploadSessao",
          message: mensagemErroGraph(res.status, "", "envio em blocos"),
        });
      }
    }
    if (!ok) {
      throw new OneDriveGraphError({
        status: 503,
        step: "uploadSessao",
        message: "O envio do arquivo foi interrompido. Tente novamente.",
      });
    }
    enviado = fim;
  }
  return ultimo;
}

export async function enviarArquivo(args: {
  caminho: string;
  bytes: Uint8Array;
  mimeType: string;
}): Promise<ItemEnviado> {
  const caminho = sanitizarCaminho(args.caminho);
  if (args.bytes.byteLength > LIMITE_UPLOAD_TOTAL) {
    throw new OneDriveGraphError({
      status: 413,
      step: "upload",
      message: `Arquivo acima do limite de ${Math.round(LIMITE_UPLOAD_TOTAL / (1024 * 1024))} MB.`,
    });
  }
  const item =
    args.bytes.byteLength <= LIMITE_UPLOAD_SIMPLES
      ? await uploadSimples(caminho, args.bytes, args.mimeType)
      : await uploadSessao(caminho, args.bytes, args.mimeType);

  return {
    driveId: await obterDriveId(),
    itemId: String(item?.id ?? ""),
    nome: String(item?.name ?? caminho.split("/").pop()),
    caminho,
    tamanho: Number(item?.size ?? args.bytes.byteLength),
    webUrl: item?.webUrl ?? null,
  };
}

export async function linkDownload(itemId: string): Promise<{ url: string; nome: string; tamanho: number }> {
  const res = await chamarGraph(
    `/drive/items/${encodeURIComponent(itemId)}?$select=id,name,size,webUrl,@microsoft.graph.downloadUrl`,
    undefined,
    "linkDownload",
  );
  const j = (await res.json()) as Record<string, any>;
  const url = j["@microsoft.graph.downloadUrl"] ?? j.webUrl;
  if (!url) {
    throw new OneDriveGraphError({
      status: 404,
      step: "linkDownload",
      message: "O OneDrive não devolveu um link de download para este arquivo.",
    });
  }
  return { url: String(url), nome: String(j.name ?? "arquivo"), tamanho: Number(j.size ?? 0) };
}

export async function excluirItem(itemId: string): Promise<void> {
  await chamarGraph(`/drive/items/${encodeURIComponent(itemId)}`, { method: "DELETE" }, "excluirItem");
}

/* ------------------------------------------------------------------ *
 * Diagnóstico
 * ------------------------------------------------------------------ */

export type StatusIntegracao = {
  configured: boolean;
  token: "ok" | "erro" | "nao_verificado";
  drive: "ok" | "erro" | "nao_verificado";
  targetUser: string | null;
  missing?: string[];
  message?: string;
};

export async function statusIntegracao(): Promise<StatusIntegracao> {
  const faltando = variaveisFaltando();
  const cfg = lerConfig();
  if (!cfg) {
    return {
      configured: false,
      token: "nao_verificado",
      drive: "nao_verificado",
      targetUser: process.env.MICROSOFT_ONEDRIVE_USER?.trim() ?? null,
      missing: faltando,
      message: "Variáveis de ambiente ausentes no servidor.",
    };
  }
  try {
    await obterToken();
  } catch (e) {
    return {
      configured: true,
      token: "erro",
      drive: "nao_verificado",
      targetUser: cfg.targetUser,
      message: (e as Error).message,
    };
  }
  try {
    await obterDriveId();
  } catch (e) {
    return { configured: true, token: "ok", drive: "erro", targetUser: cfg.targetUser, message: (e as Error).message };
  }
  return { configured: true, token: "ok", drive: "ok", targetUser: cfg.targetUser };
}
