/**
 * Conta OneDrive da organização (usada pelos anexos do RDO e pelo proxy público).
 *
 * O RDO é o próprio cliente OAuth (Entra ID). Um administrador conecta a conta
 * corporativa (ex.: sistemas@facom.com.br) em Configurações → OneDrive e marca
 * "usar como conta do sistema"; os tokens ficam cifrados no banco do projeto.
 *
 * Somente servidor.
 */
import {
  deleteConnectionForUser,
  getConnectionKeyForUser,
  getConnectionRowForUser,
  saveConnectionKeyForUser,
} from "@/server/appUserConnections.server";

/** Linha sentinela: a conta é da organização, não de uma pessoa. */
export const ORG_USER_ID = "00000000-0000-0000-0000-000000000001";
export const ORG_CONNECTOR_ID = "microsoft_onedrive_org";
export const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

type Tokens = { access_token: string; refresh_token?: string; expires_at: number };

export class OneDriveOrgNaoConectado extends Error {
  constructor() {
    super(
      "A conta OneDrive da organização não está conectada. Um administrador precisa entrar com a conta corporativa em Configurações → OneDrive e marcá-la como conta do sistema.",
    );
    this.name = "OneDriveOrgNaoConectado";
  }
}

async function lerTokens(): Promise<Tokens | null> {
  const bruto = await getConnectionKeyForUser(ORG_USER_ID, ORG_CONNECTOR_ID).catch(() => null);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto) as Tokens;
  } catch {
    return null;
  }
}

/** Copia os tokens pessoais do administrador para a conta da organização. */
export async function definirContaOrganizacao(userId: string) {
  const { CONNECTOR_ID } = await import("@/lib/onedrive-appuser.server");
  const bruto = await getConnectionKeyForUser(userId, CONNECTOR_ID);
  if (!bruto) throw new Error("Entre com a conta corporativa da Microsoft antes de defini-la como conta do sistema.");
  const linha = await getConnectionRowForUser(userId, CONNECTOR_ID).catch(() => null);
  await saveConnectionKeyForUser(ORG_USER_ID, ORG_CONNECTOR_ID, bruto, linha?.conta ?? undefined);
  return { ok: true as const, conta: linha?.conta ?? null };
}

export async function limparContaOrganizacao() {
  await deleteConnectionForUser(ORG_USER_ID, ORG_CONNECTOR_ID);
  return { ok: true as const };
}

export async function statusOrganizacao() {
  const tokens = await lerTokens();
  const linha = await getConnectionRowForUser(ORG_USER_ID, ORG_CONNECTOR_ID).catch(() => null);
  return {
    conectado: !!tokens,
    conta: linha?.conta ?? null,
    desde: linha?.created_at ?? null,
  };
}

/** Token de acesso válido da conta da organização (renova sozinho). */
export async function tokenOrganizacao(): Promise<string> {
  const atual = await lerTokens();
  if (!atual) throw new OneDriveOrgNaoConectado();
  if (atual.expires_at > Date.now()) return atual.access_token;

  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  const tenant = process.env.MICROSOFT_TENANT_ID?.trim() || "common";
  if (!clientId || !clientSecret || !atual.refresh_token) throw new OneDriveOrgNaoConectado();

  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: atual.refresh_token,
      scope: "openid profile email offline_access User.Read Files.ReadWrite",
    }),
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`Não foi possível renovar o acesso da conta do sistema [${res.status}]: ${texto.slice(0, 300)}`);
  const j = JSON.parse(texto) as { access_token: string; refresh_token?: string; expires_in?: number };
  const novo: Tokens = {
    access_token: j.access_token,
    refresh_token: j.refresh_token ?? atual.refresh_token,
    expires_at: Date.now() + (j.expires_in ?? 3600) * 1000 - 60_000,
  };
  await saveConnectionKeyForUser(ORG_USER_ID, ORG_CONNECTOR_ID, JSON.stringify(novo));
  return novo.access_token;
}

/** Chamada ao Microsoft Graph com a conta da organização. */
export async function graphOrganizacao(path: string, init?: RequestInit) {
  const token = await tokenOrganizacao();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${GRAPH_BASE}${path.startsWith("/") ? path : `/${path}`}`, { ...init, headers });
}
