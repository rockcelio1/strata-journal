import { statusIntegracao, obterToken, obterDriveId, chamarGraph } from "./onedrive-app.server";

export async function checkOrgStatus() {
  return statusIntegracao();
}

/** Compatibilidade: token da conta do sistema. */
export async function tokenOrganizacao(): Promise<string> {
  return obterToken();
}

/** Compatibilidade: situação resumida da conta do sistema. */
export async function statusOrganizacao() {
  const st = await statusIntegracao();
  return { ...st, conectado: st.ok, conta: st.account };
}

/** Compatibilidade: chamada autenticada ao Microsoft Graph. */
export async function graphOrganizacao(path: string, init?: RequestInit) {
  return chamarGraph(path, init);
}

export { obterDriveId };
