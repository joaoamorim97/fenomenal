/**
 * Recolorização da roupa no cliente (SEM IA).
 *
 * Como isolar "a roupa" numa foto qualquer sem IA é difícil, usamos uma
 * heurística prática que funciona bem para as peças do provador:
 *  1. Amostramos a cor da roupa numa região central do torso.
 *  2. Crescemos uma máscara por similaridade de cor, restrita a uma faixa
 *     vertical do torso (nunca no rosto/cabelo, que ficam no topo da imagem).
 *  3. Recolorimos só os pixels da máscara com um "colorize" que PRESERVA a
 *     luminância (mantém dobras, sombras e brilhos do tecido).
 *
 * É uma visualização — não é perfeito para estampas complexas, mas dá um
 * resultado convincente em peças de cor sólida, sem custo de IA.
 */

export interface PaletteColor {
  name: string;
  hex: string;
}

/** Paleta de cores para experimentação (visualização, não SKU de venda). */
export const TRYON_PALETTE: PaletteColor[] = [
  { name: 'Preto', hex: '#1a1a1a' },
  { name: 'Branco', hex: '#eeeeee' },
  { name: 'Cinza', hex: '#8b8f94' },
  { name: 'Vermelho', hex: '#b3202c' },
  { name: 'Vinho', hex: '#6d1f2b' },
  { name: 'Rosa', hex: '#d98aa6' },
  { name: 'Laranja', hex: '#d5732b' },
  { name: 'Amarelo', hex: '#d9b13b' },
  { name: 'Verde', hex: '#2f7d4f' },
  { name: 'Verde-militar', hex: '#4a5238' },
  { name: 'Azul', hex: '#2f5fa6' },
  { name: 'Azul-marinho', hex: '#20304f' },
  { name: 'Roxo', hex: '#5b3a86' },
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

/**
 * Calcula a máscara da roupa (Uint8Array 0/1) por similaridade de cor a partir
 * de sementes no torso, restrita a uma faixa vertical (protege rosto/cabelo).
 */
export function computeGarmentMask(
  { imageData, width, height }: LoadedImage,
  threshold = 60,
): Uint8Array {
  const data = imageData.data;
  const mask = new Uint8Array(width * height);

  // Faixa do torso: ignora o topo (rosto/cabelo) e as bordas laterais.
  const yTop = Math.floor(height * 0.3);
  const yBottom = Math.floor(height * 0.99);
  const xLeft = Math.floor(width * 0.06);
  const xRight = Math.floor(width * 0.94);

  // Cor de referência = média de um retalho central do torso.
  const ref = averagePatch(data, width, Math.floor(width * 0.5), Math.floor(height * 0.55), 12);

  const thr2 = threshold * threshold;

  // Region growing (flood fill) por similaridade à cor de referência.
  const seeds: Array<[number, number]> = [
    [0.5, 0.5],
    [0.5, 0.6],
    [0.44, 0.55],
    [0.56, 0.55],
    [0.5, 0.7],
  ];
  const stack: number[] = [];
  for (const [sx, sy] of seeds) {
    const px = Math.floor(width * sx);
    const py = Math.floor(height * sy);
    stack.push(py * width + px);
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

/**
 * Aplica a nova cor nos pixels da máscara, preservando a luminância original.
 * Retorna um dataURL (JPEG) da imagem recolorida.
 */
export function recolor(
  base: LoadedImage,
  mask: Uint8Array,
  hex: string,
  strength = 0.85,
): string {
  const { imageData, width, height } = base;
  const src = imageData.data;
  const out = new Uint8ClampedArray(src); // cópia (não mutar o original)
  const t = hexToRgb(hex);

  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const o = i * 4;
    const l = (0.299 * src[o] + 0.587 * src[o + 1] + 0.114 * src[o + 2]) / 255;

    let cr: number;
    let cg: number;
    let cb: number;
    if (l < 0.5) {
      const k = l * 2;
      cr = t.r * k;
      cg = t.g * k;
      cb = t.b * k;
    } else {
      const k = (l - 0.5) * 2;
      cr = t.r + (255 - t.r) * k;
      cg = t.g + (255 - t.g) * k;
      cb = t.b + (255 - t.b) * k;
    }
    out[o] = src[o] * (1 - strength) + cr * strength;
    out[o + 1] = src[o + 1] * (1 - strength) + cg * strength;
    out[o + 2] = src[o + 2] * (1 - strength) + cb * strength;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d indisponível');
  ctx.putImageData(new ImageData(out, width, height), 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
}

/** true se a máscara cobre uma área plausível de roupa (evita recolor ruim). */
export function maskIsUsable(mask: Uint8Array): boolean {
  let count = 0;
  for (let i = 0; i < mask.length; i++) count += mask[i];
  const ratio = count / mask.length;
  // precisa cobrir pelo menos ~1.5% da imagem para valer a pena
  return ratio > 0.015;
}
