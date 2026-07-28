// Criptografia de backups (browser). AES-256-GCM + PBKDF2-SHA256 (200k).
// Formato do arquivo: "FCB1" | salt(16) | iv(12) | ciphertext.

const MAGIC = new TextEncoder().encode("FCB1");
const ITER = 200_000;

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptBlob(plain: ArrayBuffer, password: string): Promise<Blob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
  return new Blob([MAGIC, salt, iv, cipher], { type: "application/octet-stream" });
}

export function isEncryptedBuffer(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 4) return false;
  const head = new Uint8Array(buf, 0, 4);
  return head[0] === 0x46 && head[1] === 0x43 && head[2] === 0x42 && head[3] === 0x31;
}

export async function decryptBuffer(buf: ArrayBuffer, password: string): Promise<ArrayBuffer> {
  if (!isEncryptedBuffer(buf)) throw new Error("Arquivo não está criptografado no formato esperado.");
  const salt = new Uint8Array(buf, 4, 16);
  const iv = new Uint8Array(buf, 20, 12);
  const ct = new Uint8Array(buf, 32);
  const key = await deriveKey(password, salt);
  try {
    return await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  } catch {
    throw new Error("Senha incorreta ou arquivo corrompido.");
  }
}
