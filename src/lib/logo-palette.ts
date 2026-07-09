// Utilidades para carregar a logo da empresa e derivar uma paleta de cores
// coerente a partir dela (usada nos exports Excel/PDF).

export type LogoImage = {
  dataUrl: string;
  bytes: Uint8Array;
  w: number;
  h: number;
  mime: string;
  ext: "png" | "jpg";
};

export type LogoPalette = {
  brand: string;        // cor principal (RGB hex, sem alpha)
  brandDark: string;
  brandSoft: string;    // versão muito clara
  onBrand: string;      // texto que contrasta com brand
};

const clamp = (n: number, min = 0, max = 255) => Math.max(min, Math.min(max, Math.round(n)));
const toHex = (n: number) => clamp(n).toString(16).padStart(2, "0");
export const rgbToHex = (r: number, g: number, b: number) => `${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
export const rgbToArgb = (r: number, g: number, b: number) => `FF${rgbToHex(r, g, b)}`;

function mix(c: number, target: number, t: number) { return c + (target - c) * t; }

export function paletteFromRgb(r: number, g: number, b: number): LogoPalette {
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  const dark = { r: mix(r, 0, 0.35), g: mix(g, 0, 0.35), b: mix(b, 0, 0.35) };
  const soft = { r: mix(r, 255, 0.85), g: mix(g, 255, 0.85), b: mix(b, 255, 0.85) };
  return {
    brand: rgbToHex(r, g, b),
    brandDark: rgbToHex(dark.r, dark.g, dark.b),
    brandSoft: rgbToHex(soft.r, soft.g, soft.b),
    onBrand: luma > 160 ? "0F1F33" : "FFFFFF",
  };
}

// Paleta padrão (fallback quando não há logo)
export const DEFAULT_PALETTE: LogoPalette = paletteFromRgb(31, 58, 95); // azul petróleo

export async function loadLogoImage(url?: string | null): Promise<LogoImage | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const mime = blob.type || "image/png";
    if (!mime.startsWith("image/")) return null;
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = dataUrl;
    });
    if (!dims.w || !dims.h) return null;
    const ext: "png" | "jpg" = mime.includes("jpeg") ? "jpg" : "png";
    return { dataUrl, bytes, w: dims.w, h: dims.h, mime, ext };
  } catch { return null; }
}

// Amostra pixels da imagem e retorna a cor "principal" (média ponderada,
// ignorando pixels quase brancos, quase pretos e transparentes).
export async function extractDominantColor(dataUrl: string): Promise<{ r: number; g: number; b: number } | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue;
      const R = data[i], G = data[i + 1], B = data[i + 2];
      const max = Math.max(R, G, B), min = Math.min(R, G, B);
      if (max < 30) continue;          // quase preto
      if (min > 230) continue;         // quase branco
      if (max - min < 12) continue;    // cinza pouco saturado
      r += R; g += G; b += B; n += 1;
    }
    if (!n) return null;
    return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
  } catch { return null; }
}

export async function paletteFromLogo(url?: string | null): Promise<{ logo: LogoImage | null; palette: LogoPalette }> {
  const logo = await loadLogoImage(url);
  if (!logo) return { logo: null, palette: DEFAULT_PALETTE };
  const rgb = await extractDominantColor(logo.dataUrl);
  const palette = rgb ? paletteFromRgb(rgb.r, rgb.g, rgb.b) : DEFAULT_PALETTE;
  return { logo, palette };
}
