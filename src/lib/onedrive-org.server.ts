import { statusIntegracao } from "./onedrive-app.server";

export async function checkOrgStatus() {
  return statusIntegracao();
}
