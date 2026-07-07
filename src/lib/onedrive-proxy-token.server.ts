import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_VERSION = "v1";
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSecret() {
  return process.env.LOVABLE_API_KEY ?? "";
}

function toBase64Url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function payloadFor(itemId: string, expiresAt: number, mimeType: string) {
  return `${TOKEN_VERSION}.${itemId}.${expiresAt}.${mimeType || "application/octet-stream"}`;
}

export function signOneDriveProxyUrl(input: { itemId: string; mimeType?: string | null; expiresAt?: number }) {
  const secret = getSecret();
  if (!secret || !input.itemId) return null;

  const expiresAt = input.expiresAt ?? Math.floor(Date.now() / 1000) + DEFAULT_TTL_SECONDS;
  const mimeType = input.mimeType || "application/octet-stream";
  const sig = toBase64Url(createHmac("sha256", secret).update(payloadFor(input.itemId, expiresAt, mimeType)).digest());
  return { expiresAt, sig, mimeType };
}

export function verifyOneDriveProxyUrl(input: { itemId: string; expiresAt: number; mimeType: string; sig: string }) {
  const signed = signOneDriveProxyUrl({ itemId: input.itemId, expiresAt: input.expiresAt, mimeType: input.mimeType });
  if (!signed?.sig || !input.sig) return false;
  if (input.expiresAt < Math.floor(Date.now() / 1000)) return false;

  const a = Buffer.from(signed.sig);
  const b = Buffer.from(input.sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createOneDriveProxyUrl(input: { itemId?: string | null; mimeType?: string | null; name?: string | null }) {
  if (!input.itemId) return null;
  const signed = signOneDriveProxyUrl({ itemId: input.itemId, mimeType: input.mimeType });
  if (!signed) return null;

  const params = new URLSearchParams({
    exp: String(signed.expiresAt),
    mime: signed.mimeType,
    sig: signed.sig,
  });
  if (input.name) params.set("name", input.name);

  return `/api/public/onedrive-file/${encodeURIComponent(input.itemId)}?${params.toString()}`;
}