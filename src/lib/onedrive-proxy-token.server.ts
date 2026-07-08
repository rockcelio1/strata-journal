import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_VERSION = "v1";
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSecret() {
  return process.env.LOVABLE_API_KEY ?? "";
}

function toBase64Url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

// Payload inclui empresa_id (opcional) para permitir contabilizar métricas por empresa no proxy.
function payloadFor(itemId: string, expiresAt: number, mimeType: string, empresaId: string | null) {
  return `${TOKEN_VERSION}.${itemId}.${expiresAt}.${mimeType || "application/octet-stream"}.${empresaId ?? ""}`;
}

export function signOneDriveProxyUrl(input: {
  itemId: string;
  mimeType?: string | null;
  expiresAt?: number;
  empresaId?: string | null;
}) {
  const secret = getSecret();
  if (!secret || !input.itemId) return null;

  const expiresAt = input.expiresAt ?? Math.floor(Date.now() / 1000) + DEFAULT_TTL_SECONDS;
  const mimeType = input.mimeType || "application/octet-stream";
  const empresaId = input.empresaId ?? null;
  const sig = toBase64Url(
    createHmac("sha256", secret).update(payloadFor(input.itemId, expiresAt, mimeType, empresaId)).digest(),
  );
  return { expiresAt, sig, mimeType, empresaId };
}

export function verifyOneDriveProxyUrl(input: {
  itemId: string;
  expiresAt: number;
  mimeType: string;
  sig: string;
  empresaId?: string | null;
}) {
  const signed = signOneDriveProxyUrl({
    itemId: input.itemId,
    expiresAt: input.expiresAt,
    mimeType: input.mimeType,
    empresaId: input.empresaId ?? null,
  });
  if (!signed?.sig || !input.sig) return false;
  if (input.expiresAt < Math.floor(Date.now() / 1000)) return false;

  const a = Buffer.from(signed.sig);
  const b = Buffer.from(input.sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createOneDriveProxyUrl(input: {
  itemId?: string | null;
  mimeType?: string | null;
  name?: string | null;
  thumb?: "small" | "medium" | "large" | null;
  empresaId?: string | null;
}) {
  if (!input.itemId) return null;
  const signed = signOneDriveProxyUrl({
    itemId: input.itemId,
    mimeType: input.mimeType,
    empresaId: input.empresaId ?? null,
  });
  if (!signed) return null;

  const params = new URLSearchParams({
    exp: String(signed.expiresAt),
    mime: signed.mimeType,
    sig: signed.sig,
  });
  if (signed.empresaId) params.set("emp", signed.empresaId);
  if (input.name) params.set("name", input.name);
  if (input.thumb) params.set("thumb", input.thumb);

  return `/api/public/onedrive-file/${encodeURIComponent(input.itemId)}?${params.toString()}`;
}
