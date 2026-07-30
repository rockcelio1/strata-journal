/**
 * Camada servidor do login pessoal do OneDrive (OAuth 2.0 por usuário).
 * Somente servidor — nunca importar no navegador.
 */
import {
  authorizeAppUserOAuth,
  callAsAppUser,
  disconnectAppUser,
  exchangeAppUserOAuthCode,
} from "@/integrations/lovable/appUserConnector";
import {
  atualizarConta,
  deleteConnectionForUser,
  getConnectionKeyForUser,
  getConnectionRowForUser,
  saveConnectionKeyForUser,
} from "@/server/appUserConnections.server";

export const CONNECTOR_ID = "microsoft_onedrive";
export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
export const CLIENT_KEY_ENV = "MICROSOFT_ONEDRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY";

/** Escopos do Microsoft Graph pedidos na tela de consentimento da Microsoft. */
export const ESCOPOS_MICROSOFT = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Files.ReadWrite",
];

export function clientApiKey(): string | null {
  const v = process.env[CLIENT_KEY_ENV];
  return v && v.trim() ? v : null;
}

export async function iniciarLogin(userId: string, origin: string) {
  const chaveCliente = clientApiKey();
  if (!chaveCliente) {
    throw new Error(
      "O aplicativo OneDrive ainda não foi registrado. Um administrador precisa configurar o cliente OAuth (App User Connector) do Microsoft OneDrive neste projeto.",
    );
  }
  const anterior = await getConnectionKeyForUser(userId, CONNECTOR_ID);
  const { authorizationUrl } = await authorizeAppUserOAuth({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectorId: CONNECTOR_ID,
    appUserId: userId,
    clientAPIKey: chaveCliente,
    returnUrl: new URL("/oauth/onedrive/return", origin).toString(),
    connectionAPIKey: anterior ?? undefined,
    credentialsConfiguration: { scopes: ESCOPOS_MICROSOFT },
  });
  return { authorizationUrl };
}

export async function concluirLogin(userId: string, code: string) {
  const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, code);
  if (connectorId !== CONNECTOR_ID) {
    throw new Error("O login retornou um conector diferente do OneDrive.");
  }
  await saveConnectionKeyForUser(userId, connectorId, connectionAPIKey);
  const perfil = await buscarPerfil(connectionAPIKey).catch(() => null);
  if (perfil?.conta) await atualizarConta(userId, CONNECTOR_ID, perfil.conta);
  return { ok: true as const, conta: perfil?.conta ?? null };
}

async function buscarPerfil(connectionAPIKey: string) {
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: CONNECTOR_ID,
    path: "/me",
  });
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
    configurado: !!clientApiKey(),
    conectado: false,
    conta: null,
    nome: null,
    desde: null,
    erro: null,
    escopos: ESCOPOS_MICROSOFT,
  };
  const chave = await getConnectionKeyForUser(userId, CONNECTOR_ID).catch(() => null);
  if (!chave) return base;
  const linha = await getConnectionRowForUser(userId, CONNECTOR_ID).catch(() => null);
  try {
    const perfil = await buscarPerfil(chave);
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
  const chave = await getConnectionKeyForUser(userId, CONNECTOR_ID).catch(() => null);
  if (chave) {
    await disconnectAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey: chave,
      connectorId: CONNECTOR_ID,
    }).catch(() => undefined);
  }
  await deleteConnectionForUser(userId, CONNECTOR_ID);
  return { ok: true as const };
}

export type ItemPessoal = {
  id: string;
  nome: string;
  pasta: boolean;
  tamanho: number;
  modificadoEm: string | null;
};

async function chaveObrigatoria(userId: string) {
  const chave = await getConnectionKeyForUser(userId, CONNECTOR_ID);
  if (!chave) throw new Error("Sua conta Microsoft ainda não está conectada. Clique em “Entrar com a Microsoft”.");
  return chave;
}

export async function listarArquivos(userId: string, pasta: string) {
  const chave = await chaveObrigatoria(userId);
  const limpo = pasta.replace(/^\/+|\/+$/g, "");
  const path = limpo
    ? `/me/drive/root:/${limpo.split("/").map(encodeURIComponent).join("/")}:/children`
    : "/me/drive/root/children";
  const res = await callAsAppUser({ gatewayBaseUrl: GATEWAY_BASE_URL, connectionAPIKey: chave, connectorId: CONNECTOR_ID, path });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Não foi possível listar os arquivos [${res.status}]: ${body.slice(0, 300)}`);
  }
  const j = (await res.json()) as { value?: any[] };
  const itens: ItemPessoal[] = (j.value ?? []).map((i) => ({
    id: String(i.id),
    nome: String(i.name),
    pasta: !!i.folder,
    tamanho: Number(i.size ?? 0),
    modificadoEm: i.lastModifiedDateTime ?? null,
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
  const chave = await chaveObrigatoria(userId);
  const limpo = pasta.replace(/^\/+|\/+$/g, "");
  const destino = [limpo, nome].filter(Boolean).join("/");
  const path = `/me/drive/root:/${destino.split("/").map(encodeURIComponent).join("/")}:/content`;
  const bytes = Buffer.from(conteudoBase64, "base64");
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey: chave,
    connectorId: CONNECTOR_ID,
    path,
    init: { method: "PUT", body: bytes, headers: { "Content-Type": contentType || "application/octet-stream" } },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao enviar “${nome}” [${res.status}]: ${body.slice(0, 300)}`);
  }
  const j = (await res.json()) as { id?: string; name?: string };
  return { ok: true as const, id: j.id ?? null, nome: j.name ?? nome };
}

export async function linkDownload(userId: string, itemId: string) {
  const chave = await chaveObrigatoria(userId);
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey: chave,
    connectorId: CONNECTOR_ID,
    path: `/me/drive/items/${encodeURIComponent(itemId)}?select=id,name,@microsoft.graph.downloadUrl`,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao gerar o link de download [${res.status}]: ${body.slice(0, 300)}`);
  }
  const j = (await res.json()) as Record<string, unknown>;
  const url = j["@microsoft.graph.downloadUrl"] as string | undefined;
  if (!url) throw new Error("O OneDrive não retornou um link de download para este arquivo.");
  return { url };
}
