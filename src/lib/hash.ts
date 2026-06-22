// Hash SHA-256 estável de um objeto JSON (ordenando chaves) — usado na assinatura digital do RDO.
function sortKeys(value: any): any {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((acc: any, k) => { acc[k] = sortKeys(value[k]); return acc; }, {});
  }
  return value;
}

export async function sha256OfJson(obj: any): Promise<string> {
  const canonical = JSON.stringify(sortKeys(obj));
  const bytes = new TextEncoder().encode(canonical);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
