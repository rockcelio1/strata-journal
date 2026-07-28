// Criptografia de backups (browser). AES-256-GCM + PBKDF2-SHA256 (200k).
// Formato: "FCB1" | salt(16) | iv(12) | ciphertext.

const ITER = 200_000;

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: ITER, hash: "SHA-256" },
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
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, plain),
  );
  const magic = new TextEncoder().encode("FCB1");
  const total = new Uint8Array(magic.byteLength + salt.byteLength + iv.byteLength + cipher.byteLength);
  let off = 0;
  for (const p of [magic, salt, iv, cipher]) { total.set(p, off); off += p.byteLength; }
  return new Blob([total.buffer as ArrayBuffer], { type: "application/octet-stream" });
}

export function isEncryptedBuffer(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 32) return false;
  const h = new Uint8Array(buf, 0, 4);
  return h[0] === 0x46 && h[1] === 0x43 && h[2] === 0x42 && h[3] === 0x31;
}

export async function decryptBuffer(buf: ArrayBuffer, password: string): Promise<ArrayBuffer> {
  if (!isEncryptedBuffer(buf)) throw new Error("Arquivo não está no formato criptografado esperado.");
  const salt = new Uint8Array(buf.slice(4, 20));
  const iv = new Uint8Array(buf.slice(20, 32));
  const ct = buf.slice(32);
  const key = await deriveKey(password, salt);
  try {
    return await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, ct);
  } catch {
    throw new Error("Senha incorreta ou arquivo corrompido.");
  }
}
