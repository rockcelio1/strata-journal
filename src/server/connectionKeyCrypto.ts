// Somente servidor — nunca importe no navegador.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Chave de cifra dos tokens da Microsoft, mantida apenas no servidor.
// Usa ONEDRIVE_TOKEN_SECRET (própria do RDO). Mantém compatibilidade com o
// segredo antigo APP_USER_CONNECTION_KEY_SECRET, se ainda existir.
export function segredoBruto(): string {
  const raw = process.env.ONEDRIVE_TOKEN_SECRET || process.env.APP_USER_CONNECTION_KEY_SECRET;
  if (!raw) throw new Error("ONEDRIVE_TOKEN_SECRET não está configurada no servidor.");
  return raw;
}

function key(): Buffer {
  // Deriva sempre 32 bytes, aceitando segredo em base64 ou texto.
  return createHash("sha256").update(segredoBruto()).digest();
}


export function encryptConnectionKey(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptConnectionKey(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
