import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.RDO_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("RDO_ENCRYPTION_KEY não configurada no servidor.");
  }
  // Garante que a chave tenha 32 bytes (SHA-256)
  return createHash("sha256").update(key).digest();
}

/**
 * Criptografa um texto usando AES-256-GCM.
 * Retorna uma string no formato iv:authTag:ciphertext (hex).
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag().toString("hex");
  
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Descriptografa um texto no formato iv:authTag:ciphertext (hex).
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encryptedText] = encryptedData.split(":");
  
  if (!ivHex || !authTagHex || !encryptedText) {
    throw new Error("Formato de dados criptografados inválido.");
  }
  
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Mascara um segredo para exibição parcial no frontend.
 */
export function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 8) return "********";
  return `${secret.slice(0, 4)}****${secret.slice(-4)}`;
}
