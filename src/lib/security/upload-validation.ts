/**
 * Validação de upload: magic bytes + limites de tamanho.
 *
 * `content-type` do navegador é enviado pelo cliente e pode ser forjado.
 * Um `.exe` renomeado para `.jpg` chega como `image/jpeg` sem esta checagem.
 *
 * Uso (client-side, antes do supabase.storage.upload):
 *   const check = await validateUploadFile(file);
 *   if (!check.ok) { toast.error(check.message); return; }
 */

export type UploadKind = "image" | "pdf" | "video" | "xlsx" | "docx";

export const UPLOAD_SIZE_LIMITS: Record<UploadKind, number> = {
  image: 10 * 1024 * 1024,
  pdf: 20 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  xlsx: 10 * 1024 * 1024,
  docx: 10 * 1024 * 1024,
};

const ALLOWED_MIME: Record<string, UploadKind> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "application/pdf": "pdf",
  "video/mp4": "video",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

function bytesEq(bytes: Uint8Array, offset: number, sig: number[]): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (bytes[offset + i] !== sig[i]) return false;
  return true;
}

/** Detecta o mime real pelos primeiros bytes. Retorna null se desconhecido. */
export function detectMimeFromMagicBytes(bytes: Uint8Array): string | null {
  // JPEG: FF D8 FF
  if (bytesEq(bytes, 0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytesEq(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // WEBP: 'RIFF' .... 'WEBP'
  if (bytesEq(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && bytesEq(bytes, 8, [0x57, 0x45, 0x42, 0x50])) return "image/webp";
  // PDF: 25 50 44 46 (%PDF)
  if (bytesEq(bytes, 0, [0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  // MP4: bytes 4..7 == 'ftyp'
  if (bytesEq(bytes, 4, [0x66, 0x74, 0x79, 0x70])) return "video/mp4";
  // ZIP (XLSX/DOCX começam com PK 03 04)
  if (bytesEq(bytes, 0, [0x50, 0x4b, 0x03, 0x04])) return "application/zip";
  return null;
}

export type UploadValidation =
  | { ok: true; kind: UploadKind; detectedMime: string; declaredMime: string }
  | { ok: false; code: "size" | "mime" | "magic" | "empty"; message: string; detectedMime?: string; declaredMime?: string };

const KB = 1024;
function fmtBytes(n: number) {
  if (n >= KB * KB) return `${Math.round(n / (KB * KB))} MB`;
  if (n >= KB) return `${Math.round(n / KB)} KB`;
  return `${n} B`;
}

/**
 * Valida um arquivo do usuário. Verifica:
 *  1) mime declarado permitido
 *  2) tamanho <= limite da categoria
 *  3) magic bytes coerentes com o mime declarado
 */
export async function validateUploadFile(file: File): Promise<UploadValidation> {
  const declared = file.type || "application/octet-stream";
  const kind = ALLOWED_MIME[declared];
  if (!kind) {
    return {
      ok: false,
      code: "mime",
      declaredMime: declared,
      message: "Arquivo inválido ou formato não permitido.",
    };
  }
  if (file.size <= 0) {
    return { ok: false, code: "empty", declaredMime: declared, message: "Arquivo vazio." };
  }
  const limit = UPLOAD_SIZE_LIMITS[kind];
  if (file.size > limit) {
    return {
      ok: false,
      code: "size",
      declaredMime: declared,
      message: `O arquivo excede o tamanho máximo permitido (${fmtBytes(limit)}).`,
    };
  }
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detected = detectMimeFromMagicBytes(head);
  if (!detected) {
    return {
      ok: false,
      code: "magic",
      declaredMime: declared,
      message: "Arquivo inválido ou formato não permitido.",
    };
  }
  // XLSX/DOCX vêm como ZIP na assinatura; aceitar quando declarado é o Office correspondente.
  const okZipOffice =
    detected === "application/zip" && (kind === "xlsx" || kind === "docx");
  if (detected !== declared && !okZipOffice) {
    return {
      ok: false,
      code: "magic",
      declaredMime: declared,
      detectedMime: detected,
      message: "Arquivo inválido ou formato não permitido.",
    };
  }
  return { ok: true, kind, detectedMime: detected, declaredMime: declared };
}
