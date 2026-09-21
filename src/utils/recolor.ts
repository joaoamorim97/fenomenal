/**
 * Recolorização da roupa no cliente (SEM IA).
 *
 * 1. Amostramos a cor da roupa numa região central do torso.
 * 2. Crescemos uma máscara por similaridade de cor — usando distância
 *    NORMALIZADA pelo brilho, para incluir dobras/sombras da mesma cor e
 *    excluir regiões de cor diferente (pele, fundo, toalha, etc.). Fica
 *    restrita a uma faixa do torso, então rosto/cabelo NUNCA são afetados.
 * 3. Recolorimos a máscara aplicando de fato a cor escolhida: usamos o tom
 *    (hue/saturação) da paleta e centramos a luminosidade na luminosidade da
 *    própria cor, preservando só a VARIAÇÃO (dobras/sombras). Assim a peça fica
 *    realmente na cor da paleta, não só num tom levemente puxado.
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

/** Carrega um dataURL/URL em ImageData num canvas offscreen. */
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

/**
 * Distância de cor NORMALIZADA pelo brilho: reescala o pixel para o mesmo
 * brilho da referência antes de comparar. Assim uma dobra escura e uma parte
 * iluminada da MESMA cor ficam próximas, mas cores diferentes ficam distantes.
 */
function normalizedDist2(px: Rgb, ref: Rgb, refLum: number): number {
  const pl = lum(px.r, px.g, px.b);
  let factor = refLum / Math.max(pl, 10);
  if (factor > 2.6) factor = 2.6;
  if (factor < 0.4) factor = 0.4;
  const sr = px.r * factor;
  const sg = px.g * factor;
  const sb = px.b * factor;
  const dr = sr - ref.r;
  const dg = sg - ref.g;
  const db = sb - ref.b;
  return dr * dr + dg * dg + db * db;
}

export function computeGarmentMask(
  { imageData, width, height }: LoadedImage,
  threshold = 52,
): Uint8Array {
  const data = imageData.data;
  const mask = new Uint8Array(width * height);

  // Faixa do torso: ignora o topo (rosto/cabelo) e as bordas laterais.
  const yTop = Math.floor(height * 0.32);
  const yBottom = Math.floor(height * 0.99);
  const xLeft = Math.floor(width * 0.05);
  const xRight = Math.floor(width * 0.95);

  const ref = averagePatch(data, width, Math.floor(width * 0.5), Math.floor(height * 0.55), 12);
  const refLum = lum(ref.r, ref.g, ref.b);
  const thr2 = threshold * threshold;

  const seeds: Array<[number, number]> = [
    [0.5, 0.5],
    [0.5, 0.6],
    [0.44, 0.55],
    [0.56, 0.55],
    [0.5, 0.68],
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
    const d2 = normalizedDist2({ r: data[o], g: data[o + 1], b: data[o + 2] }, ref, refLum);
    if (d2 > thr2) continue;
    mask[idx] = 1;
    stack.push(idx - 1, idx + 1, idx - width, idx + width);
  }
  return mask;
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
 * Aplica a cor escolhida nos pixels da máscara. A peça assume o TOM (hue/sat)
 * da cor da paleta e a luminosidade fica centrada na luminosidade dessa cor,
 * mantendo apenas a variação (dobras/sombras) da roupa original.
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

  // Luminosidade média da roupa (para centrar a variação).
  let sum = 0;
  let count = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const o = i * 4;
    sum += lum(src[o], src[o + 1], src[o + 2]);
    count++;
  }
  const meanL = count ? sum / count / 255 : 0.5;

  // Saturação mínima para cores cromáticas aparecerem de verdade em peças escuras.
  const outS = tS < 0.05 ? tS : Math.max(tS, 0.55);

  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const o = i * 4;
    const pL = lum(src[o], src[o + 1], src[o + 2]) / 255;
    // desloca em torno da luminosidade-alvo, preservando as dobras
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

/** true se a máscara cobre uma área plausível de roupa. */
export function maskIsUsable(mask: Uint8Array): boolean {
  let count = 0;
  for (let i = 0; i < mask.length; i++) count += mask[i];
  return count / mask.length > 0.015;
}
