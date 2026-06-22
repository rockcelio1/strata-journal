// Compressão de imagens no cliente: redimensiona p/ caber em maxDim e exporta JPEG com qualidade alvo.
export async function compressImage(
  file: File,
  opts: { maxDim?: number; quality?: number; maxBytes?: number } = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const maxDim = opts.maxDim ?? 2560;
  const quality = opts.quality ?? 0.85;
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024;

  const img = await loadImage(file);
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);

  let q = quality;
  let blob = await canvasToBlob(canvas, q);
  while (blob.size > maxBytes && q > 0.4) {
    q -= 0.1;
    blob = await canvasToBlob(canvas, q);
  }
  const newName = file.name.replace(/\.(heic|heif|png|webp)$/i, ".jpg");
  return new File([blob], newName.endsWith(".jpg") ? newName : `${newName}.jpg`, {
    type: "image/jpeg", lastModified: Date.now(),
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, q: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob falhou"))), "image/jpeg", q);
  });
}
