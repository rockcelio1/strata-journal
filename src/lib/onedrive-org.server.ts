/**
 * Compatibilidade: a "conta da organização" do RDO agora é a conta técnica
 * configurada no servidor (MICROSOFT_ONEDRIVE_USER), acessada por Client
 * Credentials. Não existe login interativo nem tokens no banco.
 *
 * Somente servidor.
 */
import {
  chamarGraph,
  exigirConfig,
  lerConfig,
  obterDriveId,
  obterToken,
  statusIntegracao,
  GRAPH_BASE,
} from "@/lib/onedrive-app.server";

export { GRAPH_BASE };

export class OneDriveOrgNaoConectado extends Error {
  constructor() {
    super(
      "A integração com o OneDrive não está configurada no servidor. Um administrador precisa definir as credenciais do aplicativo Microsoft (Client Credentials).",
    );
    this.name = "OneDriveOrgNaoConectado";
  }
}

/** Situação da integração, sem revelar segredos. */
export async function statusOrganizacao() {
  const st = await statusIntegracao();
  return {
    conectado: st.configured && st.token === "ok" && st.drive === "ok",
    conta: st.targetUser,
    desde: null as string | null,
    detalhe: st,
  };
}

/** Access token do aplicativo (memória, nunca persistido). */
export async function tokenOrganizacao(): Promise<string> {
  if (!lerConfig()) throw new OneDriveOrgNaoConectado();
  return obterToken();
}

/** Chamada ao Graph com a identidade do aplicativo. */
export async function graphOrganizacao(path: string, init?: RequestInit) {
  exigirConfig();
  return chamarGraph(path, init, "graph");
}

export { obterDriveId };
