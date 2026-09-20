import type { Product } from '../types';

/**
 * Como as imagens oficiais da Fenomenal não puderam ser coletadas
 * automaticamente (o site responde HTTP 403 a requisições automatizadas),
 * geramos aqui uma ILUSTRAÇÃO vetorial da peça por categoria, para o catálogo
 * ficar visual e navegável. Assim que houver URLs reais das imagens, basta
 * preencher o campo `image` de cada produto em products.json que a imagem real
 * passa a ser usada no lugar da ilustração.
 */

// Paleta de cores das peças (tons de moda), escolhida de forma determinística.
const GARMENT_COLORS = [
  '#1f2937', // grafite
  '#111111', // preto
  '#7c2d12', // terracota
  '#3f3f46', // chumbo
  '#1e3a5f', // azul marinho
  '#6d5842', // caramelo
  '#4b5563', // cinza
  '#5b2333', // vinho
  '#2f4030', // verde musgo
  '#c8a15a', // dourado
];

const BG = '#efece6';
const BG2 = '#e4dfd6';

export function productPlaceholder(
  product: Pick<Product, 'id' | 'name' | 'category'>,
): string {
  const seed = hash(product.id);
  const color = GARMENT_COLORS[seed % GARMENT_COLORS.length];
  const shade = shadeColor(color, -18);
  const garment = drawGarment(product.category, product.name, color, shade);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="${BG2}"/>
    </linearGradient>
    <filter id="soft" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000000" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="600" height="800" fill="url(#bg)"/>
  <g filter="url(#soft)">${garment}</g>
  <text x="300" y="742" text-anchor="middle" fill="#111111" opacity="0.55" font-family="Inter, sans-serif" font-size="20" letter-spacing="7">FENOMENAL</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function drawGarment(
  category: string,
  name: string,
  color: string,
  shade: string,
): string {
  const c = (category + ' ' + name).toLowerCase();
  if (c.includes('conjunto')) return conjunto(color, shade);
  if (c.includes('jaqueta')) return jacket(color, shade);
  if (c.includes('polo')) return polo(color, shade);
  if (c.includes('baby')) return babyLook(color, shade);
  // blusa / camiseta / padrão
  return tee(color, shade);
}

/* ---------- silhuetas vetoriais (recortes simples e reconhecíveis) ---------- */

function tee(color: string, shade: string): string {
  return `
  <path d="M300 150
    L360 130 L430 175 L470 250 L420 290 L392 262
    L392 560 Q392 580 372 580 L228 580 Q208 580 208 560
    L208 262 L180 290 L130 250 L170 175 L240 130 Z"
    fill="${color}"/>
  <path d="M300 150 L360 130 Q300 205 240 130 L300 150Z" fill="${shade}"/>
  <path d="M208 262 L208 560 Q208 580 228 580 L250 580 L250 262 Z" fill="${shade}" opacity="0.35"/>`;
}

function babyLook(color: string, shade: string): string {
  return `
  <path d="M300 165
    L352 148 L412 188 L448 252 L406 288 L384 266
    L378 520 Q378 540 358 540 L242 540 Q222 540 222 520
    L216 266 L194 288 L152 252 L188 188 L248 148 Z"
    fill="${color}"/>
  <path d="M300 165 L352 148 Q300 212 248 148 L300 165Z" fill="${shade}"/>`;
}

function polo(color: string, shade: string): string {
  return `
  <path d="M300 155
    L360 135 L430 180 L470 255 L420 295 L392 267
    L392 560 Q392 580 372 580 L228 580 Q208 580 208 560
    L208 267 L180 295 L130 255 L170 180 L240 135 Z"
    fill="${color}"/>
  <path d="M258 140 L300 190 L342 140 L318 132 L300 150 L282 132 Z" fill="${shade}"/>
  <rect x="292" y="185" width="16" height="120" rx="3" fill="${shade}"/>
  <circle cx="300" cy="215" r="4" fill="${BG}"/>
  <circle cx="300" cy="255" r="4" fill="${BG}"/>`;
}

function jacket(color: string, shade: string): string {
  return `
  <path d="M300 150
    L362 132 L432 178 L474 258 L424 298 L396 270
    L396 600 Q396 618 378 618 L222 618 Q204 618 204 600
    L204 270 L176 298 L126 258 L168 178 L238 132 Z"
    fill="${color}"/>
  <path d="M300 150 L362 132 L318 176 L300 300 Z" fill="${shade}"/>
  <path d="M300 150 L238 132 L282 176 L300 300 Z" fill="${shade}" opacity="0.6"/>
  <rect x="296" y="176" width="8" height="430" rx="2" fill="${BG}" opacity="0.85"/>
  <circle cx="300" cy="200" r="3.5" fill="${BG}"/>
  <circle cx="300" cy="250" r="3.5" fill="${BG}"/>
  <circle cx="300" cy="300" r="3.5" fill="${BG}"/>`;
}

function conjunto(color: string, shade: string): string {
  return `
  <path d="M300 120
    L352 104 L412 144 L446 206 L406 240 L384 218
    L384 400 L216 400 L216 218 L194 240 L154 206 L188 144 L248 104 Z"
    fill="${color}"/>
  <path d="M300 120 L352 104 Q300 168 248 104 L300 120Z" fill="${shade}"/>
  <path d="M222 420 L378 420 L372 660 Q372 676 356 676 L316 676 L306 470 L294 470 L284 676 L244 676 Q228 676 228 660 Z"
    fill="${color}"/>
  <rect x="222" y="420" width="156" height="14" fill="${shade}"/>`;
}

/* --------------------------------- utils ---------------------------------- */

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function shadeColor(hex: string, percent: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + Math.round((255 * percent) / 100));
  const g = clamp(((n >> 8) & 0xff) + Math.round((255 * percent) / 100));
  const b = clamp((n & 0xff) + Math.round((255 * percent) / 100));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Retorna a imagem real do produto ou a ilustração de marca. */
export function resolveProductImage(product: Product): string {
  return product.image && product.image.trim().length > 0
    ? product.image
    : productPlaceholder(product);
}

/** true quando o produto tem uma foto REAL (não a ilustração gerada). */
export function hasRealImage(product: Product): boolean {
  return Boolean(product.image && product.image.trim().length > 0);
}
