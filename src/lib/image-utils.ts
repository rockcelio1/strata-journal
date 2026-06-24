// Image dimension reader + simple in-browser editor (rotate / crop / enhance).

export const MIN_IMAGE_DIM = 800; // px — qualquer lado abaixo disso é considerado baixa resolução

export async function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const out = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export type EditOps = {
  rotateDeg?: 0 | 90 | 180 | 270;
  cropAspect?: "1:1" | "4:3" | "3:4" | "16:9" | null;
  enhance?: boolean; // aumenta contraste/saturação
};

export async function applyImageEdits(file: File, ops: EditOps): Promise<File> {
  const img = await loadImage(file);
  const rotate = ops.rotateDeg ?? 0;
  // Rotaciona primeiro em um canvas
  const rotated = rotate === 0 ? img : rotateImage(img, rotate);
  // Recorta
  const cropped = ops.cropAspect ? cropCenter(rotated, ops.cropAspect) : rotated;
  // Enhance
  const canvas = document.createElement("canvas");
  canvas.width = cropped.width;
  canvas.height = cropped.height;
  const ctx = canvas.getContext("2d")!;
  if (ops.enhance) ctx.filter = "contrast(1.12) saturate(1.18) brightness(1.04)";
  ctx.drawImage(cropped, 0, 0);
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.95));
  if (!blob) throw new Error("Falha ao gerar imagem editada");
  return new File([blob], file.name.replace(/\.(png|webp)$/i, ".jpg"), { type: "image/jpeg" });
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function rotateImage(img: HTMLImageElement | HTMLCanvasElement, deg: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const w = img.width, h = img.height;
  if (deg === 90 || deg === 270) { c.width = h; c.height = w; } else { c.width = w; c.height = h; }
  const ctx = c.getContext("2d")!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2);
  return c;
}

function cropCenter(img: HTMLImageElement | HTMLCanvasElement, aspect: NonNullable<EditOps["cropAspect"]>): HTMLCanvasElement {
  const [aw, ah] = aspect.split(":").map(Number);
  const target = aw / ah;
  const cur = img.width / img.height;
  let cw = img.width, ch = img.height;
  if (cur > target) { cw = img.height * target; } else { ch = img.width / target; }
  const sx = (img.width - cw) / 2, sy = (img.height - ch) / 2;
  const c = document.createElement("canvas");
  c.width = Math.round(cw); c.height = Math.round(ch);
  c.getContext("2d")!.drawImage(img, sx, sy, cw, ch, 0, 0, c.width, c.height);
  return c;
}
