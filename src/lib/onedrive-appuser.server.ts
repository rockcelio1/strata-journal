/**
 * OneDrive / Microsoft Graph — OAuth 2.0 direto com a Microsoft (Entra ID).
 *
 * Sem intermediários: o RDO é o próprio cliente OAuth registrado no Entra ID,
 * guarda os tokens cifrados no banco do projeto e fala direto com o Graph.
 *
 * Somente servidor — nunca importar no navegador.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { segredoBruto } from "@/server/connectionKeyCrypto";
import {
  atualizarConta,
  deleteConnectionForUser,
  getConnectionKeyForUser,
  getConnectionRowForUser,
  saveConnectionKeyForUser,
} from "@/server/appUserConnections.server";

export const CONNECTOR_ID = "microsoft_onedrive";
export const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
export const CALLBACK_PATH = "/oauth/onedrive/return";

/** Escopos pedidos na tela de consentimento da Microsoft. */
export const ESCOPOS_MICROSOFT = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Files.ReadWrite",
];

type Credenciais = { clientId: string; clientSecret: string; tenant: string };

export function credenciais(): Credenciais | null {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, tenant: process.env.MICROSOFT_TENANT_ID?.trim() || "common" };
}

function exigirCredenciais(): Credenciais {
  const c = credenciais();
  if (!c) {
    throw new Error(
      "O aplicativo ainda não foi registrado na Microsoft. Um administrador precisa informar o Client ID e o Client Secret do Entra ID nas configurações do RDO.",
    );
  }
  return c;
}

const authBase = (tenant: string) => `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0`;

// ---------------------------------------------------------------- state (CSRF)

function assinar(valor: string) {
  return createHmac("sha256", segredoBruto()).update(valor).digest("base64url");
}

function criarState(userId: string) {
  const corpo = `${userId}.${Date.now()}`;
  return `${Buffer.from(corpo).toString("base64url")}.${assinar(corpo)}`;
}

export function validarState(state: string, userId: string) {
  const [b64, sig] = state.split(".");
  if (!b64 || !sig) return false;
  const corpo = Buffer.from(b64, "base64url").toString("utf8");
  const esperada = Buffer.from(assinar(corpo));
  const recebida = Buffer.from(sig);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return false;
  const [dono, ts] = corpo.split(".");
  if (dono !== userId) return false;
  return Date.now() - Number(ts) < 15 * 60_000;
}

// ---------------------------------------------------------------- tokens

type Tokens = { access_token: string; refresh_token?: string; expires_at: number; scope?: string };

function redirectUri(origin: string) {
  return new URL(CALLBACK_PATH, origin).toString();
}

async function pedirToken(body: Record<string, string>) {
  const { clientId, clientSecret, tenant } = exigirCredenciais();
  const res = await fetch(`${authBase(tenant)}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }),
  });
  const texto = await res.text();
  if (!res.ok) {
    let detalhe = texto.slice(0, 400);
    try {
      const j = JSON.parse(texto) as { error_description?: string; error?: string };
      detalhe = j.error_description ?? j.error ?? detalhe;
    } catch {
      /* mantém o texto bruto */
    }
    throw new Error(`A Microsoft recusou a autenticação [${res.status}]: ${detalhe}`);
  }
  const j = JSON.parse(texto) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  return {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: Date.now() + (j.expires_in ?? 3600) * 1000 - 60_000,
    scope: j.scope,
  } satisfies Tokens;
}

async function lerTokens(userId: string): Promise<Tokens | null> {
  const bruto = await getConnectionKeyForUser(userId, CONNECTOR_ID).catch(() => null);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto) as Tokens;
  } catch {
    return null;
  }
}

async function gravarTokens(userId: string, tokens: Tokens, conta?: string | null) {
  await saveConnectionKeyForUser(userId, CONNECTOR_ID, JSON.stringify(tokens), conta ?? undefined);
}

/** Token de acesso válido, renovando automaticamente pelo refresh_token. */
async function tokenValido(userId: string) {
  const atual = await lerTokens(userId);
  if (!atual) {
    throw new Error("Sua conta Microsoft ainda não está conectada. Clique em “Entrar com a Microsoft”.");
  }
  if (atual.expires_at > Date.now()) return atual.access_token;
  if (!atual.refresh_token) {
    throw new Error("A sessão da Microsoft expirou. Entre novamente com a sua conta.");
  }
  const novo = await pedirToken({
    grant_type: "refresh_token",
    refresh_token: atual.refresh_token,
    scope: ESCOPOS_MICROSOFT.join(" "),
  });
  const mesclado: Tokens = { ...novo, refresh_token: novo.refresh_token ?? atual.refresh_token };
  await gravarTokens(userId, mesclado);
  return mesclado.access_token;
}

async function graph(userId: string, path: string, init?: RequestInit) {
  const token = await tokenValido(userId);
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${GRAPH_BASE}${path}`, { ...init, headers });
}

// ---------------------------------------------------------------- login

export async function iniciarLogin(userId: string, origin: string) {
  const { clientId, tenant } = exigirCredenciais();
  const url = new URL(`${authBase(tenant)}/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("redirect_uri", redirectUri(origin));
  url.searchParams.set("scope", ESCOPOS_MICROSOFT.join(" "));
  url.searchParams.set("state", criarState(userId));
  url.searchParams.set("prompt", "select_account");
  return { authorizationUrl: url.toString() };
}

export async function concluirLogin(userId: string, code: string, state: string, origin: string) {
  if (!validarState(state, userId)) {
    throw new Error("A autorização não pôde ser validada (state inválido ou expirado). Tente entrar novamente.");
  }
  const tokens = await pedirToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(origin),
    scope: ESCOPOS_MICROSOFT.join(" "),
  });
  await gravarTokens(userId, tokens);
  const perfil = await buscarPerfil(userId).catch(() => null);
  if (perfil?.conta) await atualizarConta(userId, CONNECTOR_ID, perfil.conta);
  return { ok: true as const, conta: perfil?.conta ?? null };
}

async function buscarPerfil(userId: string) {
  const res = await graph(userId, "/me");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Microsoft Graph /me falhou [${res.status}]: ${body.slice(0, 300)}`);
  }
  const j = (await res.json()) as { mail?: string; userPrincipalName?: string; displayName?: string };
  return { conta: j.mail ?? j.userPrincipalName ?? null, nome: j.displayName ?? null };
}

export type StatusPessoal = {
  configurado: boolean;
  conectado: boolean;
  conta: string | null;
  nome: string | null;
  desde: string | null;
  erro: string | null;
  escopos: string[];
};

export async function statusPessoal(userId: string): Promise<StatusPessoal> {
  const base: StatusPessoal = {
    configurado: !!credenciais(),
    conectado: false,
    conta: null,
    nome: null,
    desde: null,
    erro: null,
    escopos: ESCOPOS_MICROSOFT,
  };
  if (!base.configurado) return base;
  const tokens = await lerTokens(userId);
  if (!tokens) return base;
  const linha = await getConnectionRowForUser(userId, CONNECTOR_ID).catch(() => null);
  try {
    const perfil = await buscarPerfil(userId);
    return {
      ...base,
      conectado: true,
      conta: perfil.conta ?? linha?.conta ?? null,
      nome: perfil.nome,
      desde: linha?.created_at ?? null,
    };
  } catch (e) {
    return { ...base, conta: linha?.conta ?? null, erro: (e as Error).message };
  }
}

export async function desconectar(userId: string) {
  await deleteConnectionForUser(userId, CONNECTOR_ID);
  return { ok: true as const };
}

// ---------------------------------------------------------------- arquivos

export type ItemPessoal = {
  id: string;
  nome: string;
  pasta: boolean;
  tamanho: number;
  modificadoEm: string | null;
};

const caminho = (p: string) =>
  p
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");

export async function listarArquivos(userId: string, pasta: string) {
  const limpo = caminho(pasta);
  const path = limpo ? `/me/drive/root:/${limpo}:/children` : "/me/drive/root/children";
  const res = await graph(userId, path);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Não foi possível listar os arquivos [${res.status}]: ${body.slice(0, 300)}`);
  }
  const j = (await res.json()) as { value?: Array<Record<string, unknown>> };
  const itens: ItemPessoal[] = (j.value ?? []).map((i) => ({
    id: String(i.id),
    nome: String(i.name),
    pasta: !!i.folder,
    tamanho: Number(i.size ?? 0),
    modificadoEm: (i.lastModifiedDateTime as string) ?? null,
  }));
  return { itens };
}

export async function enviarArquivo(
  userId: string,
  pasta: string,
  nome: string,
  conteudoBase64: string,
  contentType: string,
) {
  const destino = [caminho(pasta), encodeURIComponent(nome)].filter(Boolean).join("/");
  const bytes = Buffer.from(conteudoBase64, "base64");
  const res = await graph(userId, `/me/drive/root:/${destino}:/content`, {
    method: "PUT",
    body: bytes,
    headers: { "Content-Type": contentType || "application/octet-stream" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao enviar “${nome}” [${res.status}]: ${body.slice(0, 300)}`);
  }
  const j = (await res.json()) as { id?: string; name?: string };
  return { ok: true as const, id: j.id ?? null, nome: j.name ?? nome };
}

export async function linkDownload(userId: string, itemId: string) {
  const res = await graph(
    userId,
    `/me/drive/items/${encodeURIComponent(itemId)}?select=id,name,@microsoft.graph.downloadUrl`,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao gerar o link de download [${res.status}]: ${body.slice(0, 300)}`);
  }
  const j = (await res.json()) as Record<string, unknown>;
  const url = j["@microsoft.graph.downloadUrl"] as string | undefined;
  if (!url) throw new Error("O OneDrive não retornou um link de download para este arquivo.");
  return { url };
}
