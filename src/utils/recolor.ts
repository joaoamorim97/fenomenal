/**
 * Recolorização da roupa no cliente (SEM IA) — comportamento de "balde de tinta".
 *
 * 1. Amostra a cor da roupa numa região do torso.
 * 2. Cresce uma máscara por CONEXÃO (flood fill), incluindo só pixels vizinhos
 *    de cor parecida com a semente — restrita a uma faixa do torso (o rosto e o
 *    cabelo, no topo da imagem, nunca são afetados).
 * 3. Se o preenchimento "vazar" (cobrir grande parte da imagem), reduz a
 *    tolerância; se ainda vazar, a paleta é escondida (não recolore nada).
 * 4. Recolore só a máscara aplicando de fato a cor escolhida (tom da paleta +
 *    luminosidade centrada nessa cor), preservando dobras/sombras.
 */

export interface PaletteColor {
  name: string;
  hex: string;
}

/** Paleta de cores para experimentação (visualização, não SKU de venda). */
export const TRYON_PALETTE: PaletteColor[] = [
  { name: 'Preto', hex: '#141414' },
  { name: 'Branco', hex: '#f0f0f0' },
  { name: 'Cinza', hex: '#8b8f94' },
  { name: 'Vermelho', hex: '#c1121f' },
  { name: 'Vinho', hex: '#6d1f2b' },
  { name: 'Rosa', hex: '#e06aa0' },
  { name: 'Laranja', hex: '#e0631f' },
  { name: 'Amarelo', hex: '#e6b422' },
  { name: 'Verde', hex: '#1f8f4d' },
  { name: 'Verde-militar', hex: '#4a5238' },
  { name: 'Azul', hex: '#1f66c4' },
  { name: 'Azul-marinho', hex: '#1c2b52' },
  { name: 'Roxo', hex: '#6a3aa0' },
  { name: 'Bege', hex: '#cdb79e' },
];

interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface LoadedImage {
  imageData: ImageData;
  width: number;
  height: number;
}

export async function loadImageData(src: string): Promise<LoadedImage> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = src;
  });
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas 2d indisponível');
  ctx.drawImage(img, 0, 0);
  return { imageData: ctx.getImageData(0, 0, width, height), width, height };
}

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function lum(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Faixa do torso (fração da imagem) — protege rosto/cabelo (topo) e bordas.
const BAND = { top: 0.3, bottom: 0.99, left: 0.05, right: 0.95 };

/**
 * Flood fill por cor (balde de tinta) a partir de sementes no torso.
 * Compara cada pixel com a cor de referência (tolerância em RGB) e cresce só
 * por vizinhança conectada, dentro da faixa do torso.
 */
export function computeGarmentMask(
  { imageData, width, height }: LoadedImage,
  threshold = 46,
): Uint8Array {
  const data = imageData.data;
  const mask = new Uint8Array(width * height);

  const yTop = Math.floor(height * BAND.top);
  const yBottom = Math.floor(height * BAND.bottom);
  const xLeft = Math.floor(width * BAND.left);
  const xRight = Math.floor(width * BAND.right);

  const ref = averagePatch(data, width, Math.floor(width * 0.5), Math.floor(height * 0.56), 10);
  const thr2 = threshold * threshold;

  const seeds: Array<[number, number]> = [
    [0.5, 0.56],
    [0.46, 0.52],
    [0.54, 0.52],
    [0.5, 0.64],
    [0.5, 0.72],
  ];
  const stack: number[] = [];
  for (const [sx, sy] of seeds) {
    stack.push(Math.floor(height * sy) * width + Math.floor(width * sx));
  }

  while (stack.length) {
    const idx = stack.pop()!;
    if (mask[idx]) continue;
    const x = idx % width;
    const y = (idx - x) / width;
    if (x < xLeft || x >= xRight || y < yTop || y >= yBottom) continue;
    const o = idx * 4;
    const dr = data[o] - ref.r;
    const dg = data[o + 1] - ref.g;
    const db = data[o + 2] - ref.b;
    if (dr * dr + dg * dg + db * db > thr2) continue;
    mask[idx] = 1;
    stack.push(idx - 1, idx + 1, idx - width, idx + width);
  }
  return mask;
}

function maskCount(mask: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += mask[i];
  return n;
}

/**
 * Escolhe automaticamente a melhor tolerância: começa alta e diminui enquanto
 * o preenchimento estiver "vazando" (cobrindo grande parte da imagem). Retorna
 * `usable=false` quando não dá para isolar a peça com segurança.
 */
export function buildGarmentMask(base: LoadedImage): {
  mask: Uint8Array;
  usable: boolean;
} {
  const total = base.width * base.height;
  const MIN = 0.02; // pelo menos ~2% da imagem (achou a peça)
  const MAX = 0.3; // no máximo ~30% (acima disso, vazou)

  let fallback: Uint8Array | null = null;
  for (const thr of [46, 38, 30, 24, 18, 13]) {
    const mask = computeGarmentMask(base, thr);
    const ratio = maskCount(mask) / total;
    if (ratio >= MIN && ratio <= MAX) return { mask, usable: true };
    if (ratio < MIN) fallback = mask; // pequena demais: guarda a maior tentativa
  }
  // Nenhuma tolerância isolou bem a peça.
  return { mask: fallback ?? new Uint8Array(total), usable: false };
}

function averagePatch(
  data: Uint8ClampedArray,
  width: number,
  cx: number,
  cy: number,
  radius: number,
): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const o = (y * width + x) * 4;
      if (o < 0 || o + 2 >= data.length) continue;
      r += data[o];
      g += data[o + 1];
      b += data[o + 2];
      n++;
    }
  }
  if (!n) return { r: 128, g: 128, b: 128 };
  return { r: r / n, g: g / n, b: b / n };
}

/* ------------------------- conversões de cor ------------------------- */

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/**
 * Recolore os pixels da máscara: a peça assume o tom (hue/sat) da cor escolhida
 * e a luminosidade fica centrada na luminosidade dessa cor, preservando só a
 * variação (dobras/sombras) da roupa original.
 */
export function recolor(
  base: LoadedImage,
  mask: Uint8Array,
  hex: string,
  shading = 0.85,
): string {
  const { imageData, width, height } = base;
  const src = imageData.data;
  const out = new Uint8ClampedArray(src);

  const t = hexToRgb(hex);
  const [tH, tS, tL] = rgbToHsl(t.r, t.g, t.b);

  let sum = 0;
  let count = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const o = i * 4;
    sum += lum(src[o], src[o + 1], src[o + 2]);
    count++;
  }
  const meanL = count ? sum / count / 255 : 0.5;
  const outS = tS < 0.05 ? tS : Math.max(tS, 0.55);

  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const o = i * 4;
    const pL = lum(src[o], src[o + 1], src[o + 2]) / 255;
    let outL = tL + (pL - meanL) * shading;
    if (outL < 0.05) outL = 0.05;
    if (outL > 0.97) outL = 0.97;
    const c = hslToRgb(tH, outS, outL);
    out[o] = c.r;
    out[o + 1] = c.g;
    out[o + 2] = c.b;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d indisponível');
  ctx.putImageData(new ImageData(out, width, height), 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
}
