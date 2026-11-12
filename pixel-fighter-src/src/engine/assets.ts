// Image cache + tinted silhouettes (for afterimages, hit flashes and glowing outlines).

const imgCache = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement>>();

export function getImage(src: string): HTMLImageElement | null {
  if (!src) return null;
  const c = imgCache.get(src);
  if (c && c.complete && c.naturalWidth > 0) return c;
  if (!c) loadImage(src);
  return null;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  const c = imgCache.get(src);
  if (c && c.complete && c.naturalWidth > 0) return Promise.resolve(c);
  let p = pending.get(src);
  if (p) return p;
  p = new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { pending.delete(src); res(img); };
    img.onerror = () => { pending.delete(src); rej(new Error('Image failed to load')); };
    img.src = src;
    imgCache.set(src, img);
  });
  pending.set(src, p);
  return p;
}

export async function preloadAll(srcs: string[]) {
  await Promise.all(srcs.filter(Boolean).map(s => loadImage(s).catch(() => null)));
}

const tintCache = new Map<string, HTMLCanvasElement>();
/** Returns a canvas containing the frame region filled with a solid color (keeps alpha). */
export function getTinted(img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, color: string): HTMLCanvasElement {
  const key = `${img.src.length}:${img.src.slice(-32)}:${sx},${sy},${sw},${sh}:${color}`;
  let c = tintCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = Math.max(1, sw); c.height = Math.max(1, sh);
  const g = c.getContext('2d')!;
  g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, sw, sh);
  if (tintCache.size > 3000) tintCache.clear();
  tintCache.set(key, c);
  return c;
}

export function canvasToDataURL(c: HTMLCanvasElement) { return c.toDataURL('image/png'); }

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingEnabled = false;
  return [c, g];
}

/** Find opaque bounds of a region of an image. Returns null when fully transparent. */
export function opaqueBounds(data: ImageData, x0: number, y0: number, w: number, h: number, alphaMin = 8) {
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  const W = data.width;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    if (x < 0 || y < 0 || x >= W || y >= data.height) continue;
    if (data.data[(y * W + x) * 4 + 3] > alphaMin) {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function imageToData(img: HTMLImageElement): ImageData {
  const [, g] = makeCanvas(img.naturalWidth, img.naturalHeight);
  g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
}
