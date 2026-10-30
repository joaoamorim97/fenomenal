/**
 * Balde de tinta (estilo Paint) para a imagem gerada. Roda no navegador, sem IA.
 *
 * Como a área é escolhida:
 *  1. Parte do PIXEL TOCADO e só cresce por vizinhos conectados (flood fill).
 *  2. Mede a diferença de cada pixel para a cor tocada usando:
 *     - crominância normalizada (o "tom" da cor), com peso alto: separa blusa
 *       preta de cabelo castanho, pele ou fundo;
 *     - luminosidade, com peso baixo: deixa passar dobras e sombras da peça;
 *     - textura (densidade de bordas): cabelo e fundo têm mais detalhe que tecido.
 *  3. Calcula, numa única passada, a área pintada para TODAS as tolerâncias
 *     (custo minimax por fila de baldes) e para antes do salto brusco de área
 *     que indica que a tinta escapou da peça.
 *
 * A cor aplicada é a cor escolhida de verdade; só a variação de luz da peça
 * é mantida, para não parecer um adesivo. Buracos pequenos são fechados e a
 * borda é suavizada.
 */

export interface PaletteColor {
  name: string;
  hex: string;
}

/** Cores para simulação visual; não representam disponibilidade comercial. */
export const PAINT_PALETTE: PaletteColor[] = [
  { name: 'Preto', hex: '#141414' },
  { name: 'Branco', hex: '#f2f2f2' },
  { name: 'Cinza', hex: '#8b8f94' },
  { name: 'Bege', hex: '#cdb79e' },
  { name: 'Vermelho', hex: '#db1431' },
  { name: 'Vinho', hex: '#761e2c' },
  { name: 'Rosa', hex: '#ff619b' },
  { name: 'Laranja', hex: '#ed6d21' },
  { name: 'Amarelo', hex: '#fbb92f' },
  { name: 'Verde', hex: '#2f9e5f' },
  { name: 'Azul', hex: '#1f5fe0' },
  { name: 'Azul-marinho', hex: '#120a8f' },
  { name: 'Roxo', hex: '#6b3f89' },
];

export interface PaintSurface {
  width: number;
  height: number;
  /** ImageData exibido; `current` aponta para os pixels dele. */
  imageData: ImageData;
  /** RGBA original (imutável). */
  original: Uint8ClampedArray;
  /** RGBA de trabalho, exibido no canvas. */
  current: Uint8ClampedArray;
  /** Atributos por pixel da imagem original suavizada. */
  lum: Uint8Array;
  chromaA: Int8Array;
  chromaB: Int8Array;
  texture: Uint8Array;
  /** Força de borda fina: linhas entre peças diferentes. */
  edge: Uint8Array;
  /**
   * Qual pintura "é dona" de cada pixel (0 = nunca pintado). Peças já pintadas
   * viram barreira para novos toques; tocar nelas repinta a peça inteira.
   */
  owner: Int32Array;
  nextOwner: number;
}

export interface FillStep {
  indices: Int32Array;
  /** RGB anterior de cada pixel alterado (3 bytes por índice). */
  previous: Uint8Array;
  /** Dono anterior de cada pixel alterado. */
  previousOwner: Int32Array;
}

export type FillOutcome =
  | { ok: true; step: FillStep; coverage: number; limited: boolean }
  | { ok: false; reason: 'leak' | 'outside' };

/** Fração máxima da imagem que um toque pode pintar. */
export const MAX_FILL_COVERAGE = 0.45;

/** Tolerância máxima analisada por toque. */
const MAX_LEVEL = 70;

/**
 * Converte o controle "alcance" (0–100, 50 = automático) num ajuste em níveis
 * de tolerância em torno da escolha automática.
 */
export function rangeToAdjust(range: number): number {
  return Math.round((Math.max(0, Math.min(100, range)) - 50) * 0.4);
}

/** Pesos da distância de cor (exportados para calibração em testes). */
export const PAINT_TUNING = {
  lum: 0.3, // por unidade de luminosidade (0–255)
  chroma: 1.5, // por unidade de crominância armazenada
  texture: 1.1, // por unidade de textura acima da textura tocada
  textureSlack: 5,
  edge: 4.0, // por unidade de borda fina (máximo 3x3 do gradiente)
  edgeSlack: 2,
};
const CHROMA_SCALE = 40;

export function createSurface(imageData: ImageData): PaintSurface {
  const { width: w, height: h, data } = imageData;
  const n = w * h;
  const original = new Uint8ClampedArray(data);
  const smooth = blurRgb(original, w, h);

  const lum = new Uint8Array(n);
  const chromaA = new Int8Array(n);
  const chromaB = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    const r = smooth[i * 3], g = smooth[i * 3 + 1], b = smooth[i * 3 + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    lum[i] = l;
    const norm = CHROMA_SCALE / (l + 10);
    chromaA[i] = clamp(Math.round((r - g) * norm), -127, 127);
    chromaB[i] = clamp(Math.round(((r + g) / 2 - b) * norm), -127, 127);
  }

  // Textura: média 5x5 do gradiente de luminosidade.
  const grad = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const gx = lum[y * w + Math.min(w - 1, x + 1)] - lum[y * w + Math.max(0, x - 1)];
      const gy = lum[Math.min(h - 1, y + 1) * w + x] - lum[Math.max(0, y - 1) * w + x];
      grad[i] = Math.min(255, Math.abs(gx) + Math.abs(gy));
    }
  }
  const texture = boxMean(grad, w, h, 2);

  // Borda fina reforçada: máximo 3x3 do gradiente. Vira uma "parede" contínua
  // nas costuras e barras (ex.: blusa preta sobre calça preta), fechando
  // falhas de 1–2 px por onde a tinta escaparia.
  const edge = maxFilter3(grad, w, h);

  return {
    width: w, height: h, imageData, original, current: data,
    lum, chromaA, chromaB, texture, edge, owner: new Int32Array(n), nextOwner: 1,
  };
}

export function resetSurface(surface: PaintSurface): void {
  surface.current.set(surface.original);
  surface.owner.fill(0);
}

export function undoFill(surface: PaintSurface, step: FillStep): void {
  const { current, owner } = surface;
  for (let k = 0; k < step.indices.length; k++) {
    const i = step.indices[k];
    const o = i * 4;
    current[o] = step.previous[k * 3];
    current[o + 1] = step.previous[k * 3 + 1];
    current[o + 2] = step.previous[k * 3 + 2];
    owner[i] = step.previousOwner[k];
  }
}

/**
 * Calcula o custo minimax de cada pixel conectado ao ponto tocado e escolhe a
 * tolerância: automática (primeiro platô = peça inteira) + `adjust`, ou um
 * valor fixo quando `fixedLevel` é informado (usado em testes).
 */
export function selectRegion(
  surface: PaintSurface,
  px: number,
  py: number,
  adjust = 0,
  fixedLevel?: number,
) {
  const { width: w, height: h, lum, chromaA, chromaB, texture, edge, owner } = surface;
  const T = PAINT_TUNING;
  const n = w * h;
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return null;

  // Tocou numa peça já pintada: repinta exatamente aquela peça.
  const tappedOwner = owner[y0 * w + x0];
  if (tappedOwner > 0) {
    const region = new Uint8Array(n);
    let count = 0;
    let minX = x0, maxX = x0, minY = y0, maxY = y0;
    for (let i = 0; i < n; i++) {
      if (owner[i] !== tappedOwner) continue;
      region[i] = 1;
      count++;
      const x = i % w, y = (i - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return {
      region, coverage: count / n, limited: false, areas: [] as number[], auto: -1, chosen: -1,
      repaintOwner: tappedOwner as number | undefined, bounds: { minX, maxX, minY, maxY },
    };
  }

  // Atributos de referência: média 5x5 ao redor do toque.
  let sl = 0, sa = 0, sb = 0, st = 0, se = 0, sn = 0;
  for (let y = Math.max(0, y0 - 2); y <= Math.min(h - 1, y0 + 2); y++) {
    for (let x = Math.max(0, x0 - 2); x <= Math.min(w - 1, x0 + 2); x++) {
      const i = y * w + x;
      sl += lum[i]; sa += chromaA[i]; sb += chromaB[i]; st += texture[i]; se += edge[i]; sn++;
    }
  }
  sl /= sn; sa /= sn; sb /= sn; st /= sn; se /= sn;

  const maxT = MAX_LEVEL;
  const limit = Math.floor(n * MAX_FILL_COVERAGE);
  const cost = (i: number) => {
    const dl = (lum[i] - sl) * T.lum;
    const da = (chromaA[i] - sa) * T.chroma;
    const db = (chromaB[i] - sb) * T.chroma;
    const dt = Math.max(0, texture[i] - st - T.textureSlack) * T.texture;
    // Borda relativa ao ponto tocado: peças lisas viram "parede" nas costuras;
    // peças estampadas/texturizadas continuam pintáveis.
    const de = Math.max(0, edge[i] - se - T.edgeSlack) * T.edge;
    return Math.min(255, Math.round(Math.sqrt(dl * dl + da * da + db * db + dt * dt + de * de)));
  };

  // Fila de baldes por nível de custo (0..maxT), com listas encadeadas.
  const level = new Uint8Array(n);
  const queued = new Uint8Array(n);
  const head = new Int32Array(maxT + 1).fill(-1);
  const next = new Int32Array(n);
  const areaAt = new Int32Array(maxT + 1);
  const push = (i: number, c: number) => {
    queued[i] = 1;
    level[i] = c;
    next[i] = head[c];
    head[c] = i;
  };

  const start = y0 * w + x0;
  push(start, 0);
  let total = 0;
  let overflow = false;

  for (let t = 0; t <= maxT && !overflow; t++) {
    while (head[t] !== -1) {
      const p = head[t];
      head[t] = next[p];
      total++;
      areaAt[t]++;
      if (total > limit) { overflow = true; break; }
      const x = p % w;
      const neighbors = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < n - w ? p + w : -1];
      for (const q of neighbors) {
        if (q < 0 || queued[q]) continue;
        if (owner[q] > 0) { queued[q] = 2; continue; } // peça já pintada = barreira
        const c = Math.max(t, cost(q));
        if (c <= maxT) push(q, c);
        else queued[q] = 2; // fora do alcance atual
      }
    }
  }

  // Área acumulada por tolerância (fração da imagem).
  for (let t = 1; t <= maxT; t++) areaAt[t] += areaAt[t - 1];
  const areas = Array.from(areaAt, (a) => a / n);

  // Último nível totalmente processado e abaixo do limite de cobertura.
  const usable = overflow ? areas.findIndex((a) => a >= MAX_FILL_COVERAGE) - 1 : maxT;
  if (usable < 0) return { region: null, coverage: 1, limited: true, areas, auto: -1, chosen: -1 };

  const auto = pickTolerance(areas, usable);
  const target = fixedLevel ?? auto + adjust;
  const chosen = Math.max(0, Math.min(usable, target));
  if (fixedLevel !== undefined && fixedLevel > usable) {
    return { region: null, coverage: 1, limited: true, areas, auto, chosen: -1 };
  }

  // Todos os níveis <= chosen foram totalmente processados (chosen < nível do
  // estouro), então "level <= chosen" é exatamente a região conectada.
  const region = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (queued[i] === 1 && level[i] <= chosen) region[i] = 1;

  // Acabamento 1: a parede de borda para a tinta 1–2 px antes do limite real
  // da peça. Cresce até 3 px para pixels de MESMA cor (sem o termo de borda),
  // eliminando o contorno escuro e os pontinhos causados por relevo do tecido.
  const colorLimit = Math.max(chosen, 6) + 4;
  // Sem textura: a borda da peça tem gradiente alto, mas a cor é a mesma.
  const colorCost = (i: number) => {
    const dl = (lum[i] - sl) * T.lum;
    const da = (chromaA[i] - sa) * T.chroma;
    const db = (chromaB[i] - sb) * T.chroma;
    return Math.sqrt(dl * dl + da * da + db * db);
  };
  let frontier: number[] = [];
  for (let i = 0; i < n; i++) if (region[i]) frontier.push(i);
  for (let pass = 0; pass < 4; pass++) {
    const added: number[] = [];
    for (const p of frontier) {
      const x = p % w;
      const around = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < n - w ? p + w : -1];
      for (const q of around) {
        if (q < 0 || region[q] || owner[q] > 0 || colorCost(q) > colorLimit) continue;
        region[q] = 1;
        added.push(q);
      }
    }
    frontier = added;
  }

  let count = 0;
  let minX = x0, maxX = x0, minY = y0, maxY = y0;
  for (let i = 0; i < n; i++) {
    if (!region[i]) continue;
    count++;
    const x = i % w, y = (i - x) / w;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  // Acabamento 2: preenche buracos fechados pequenos (botões, brilhos, trama).
  count += fillSmallHoles(region, owner, w, { minX, maxX, minY, maxY }, Math.floor(n * 0.003));
  return {
    region, coverage: count / n, limited: target > usable, areas, auto, chosen,
    bounds: { minX, maxX, minY, maxY },
  };
}

/**
 * Modo automático: a primeira tolerância em que a área para de crescer
 * (platô) é a peça inteira, antes de a tinta cruzar a borda para outra peça.
 * Depois avança dentro do platô enquanto o crescimento continuar mínimo.
 */
export function pickTolerance(areas: number[], usable: number): number {
  const MIN_AREA = 0.0015; // regiões menores que isso ainda são "um pedaço"
  const STABLE = 0.1; // crescimento máximo em 2 níveis para contar como platô
  const MAX_PLATEAU_GROWTH = 0.15; // quanto a área pode crescer dentro do platô

  // Parada dura: salto de área num único nível MUITO maior que o ritmo de
  // crescimento recente = a tinta atravessou para outra peça (ex.: legging
  // preta encostando na blusa preta). Crescimento rápido mas contínuo, comum
  // no começo do preenchimento de uma peça lisa, não conta.
  const factor = (t: number) => (areas[t - 1] > 0 ? areas[t] / areas[t - 1] : Infinity);
  let hardStop = usable;
  for (let t = 1; t <= usable; t++) {
    const before = areas[t - 1];
    if (before < 0.001 || areas[t] - before < 0.03) continue;
    const recent = Math.max(t >= 2 ? factor(t - 1) : Infinity, t >= 3 ? factor(t - 2) : 1);
    if (factor(t) - 1 >= 3 * (recent - 1) + 0.25) {
      hardStop = t - 1;
      break;
    }
  }

  const growth = (t: number) => (areas[t + 2] - areas[t]) / areas[t];
  for (let t = 1; t + 2 <= hardStop; t++) {
    if (areas[t] < MIN_AREA || growth(t) > STABLE) continue;
    const start = t;
    let best = t;
    while (
      best + 1 <= hardStop &&
      best + 3 <= usable &&
      growth(best + 1) <= STABLE &&
      (areas[best + 1] - areas[start]) / areas[start] <= MAX_PLATEAU_GROWTH
    ) best++;
    // Platô curto numa área minúscula é só o começo da peça: continua.
    if (areas[start] < 0.01 && best - start < 3) { t = best; continue; }
    return best;
  }
  // Sem platô: usa o nível logo antes do salto brusco, ou um valor moderado.
  return hardStop < usable ? hardStop : Math.min(usable, 12);
}

/** Pinta a região conectada ao ponto (px, py) com a cor `hex`. */
export function bucketFill(
  surface: PaintSurface,
  px: number,
  py: number,
  hex: string,
  adjust = 0,
  fixedLevel?: number,
): FillOutcome {
  const selection = selectRegion(surface, px, py, adjust, fixedLevel);
  if (!selection) return { ok: false, reason: 'outside' };
  if (!selection.region || !selection.bounds) return { ok: false, reason: 'leak' };

  const { width: w, height: h, original, current, owner } = surface;
  const { region, bounds } = selection;
  const targetOwner = selection.repaintOwner ?? surface.nextOwner++;
  // Pixels de OUTRA peça pintada nunca são tocados.
  const foreign = (i: number) => owner[i] > 0 && owner[i] !== targetOwner;

  // Fecha buracos pequenos e suaviza a borda, só no retângulo da região.
  const radius = Math.max(1, Math.round(Math.min(w, h) / 400));
  const pad = radius + 2;
  const bx0 = Math.max(0, bounds.minX - pad), by0 = Math.max(0, bounds.minY - pad);
  const bx1 = Math.min(w - 1, bounds.maxX + pad), by1 = Math.min(h - 1, bounds.maxY + pad);
  const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;

  const crop = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) {
    const row = (y + by0) * w + bx0;
    for (let x = 0; x < bw; x++) crop[y * bw + x] = region[row + x];
  }
  const closed = erode(dilate(crop, bw, bh, radius), bw, bh, radius);
  for (let i = 0; i < crop.length; i++) if (crop[i]) closed[i] = 1;
  const alpha = boxCount3(closed, bw, bh); // 0..9
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      if (foreign((y + by0) * w + x + bx0)) { closed[y * bw + x] = 0; alpha[y * bw + x] = 0; }
    }
  }

  // Luz média e contraste da peça, para manter dobras com a nova cor.
  let lumSum = 0, lumCount = 0, changed = 0;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const c = y * bw + x;
      if (!alpha[c]) continue;
      changed++;
      if (closed[c]) {
        const o = ((y + by0) * w + x + bx0) * 4;
        lumSum += luminance(original[o], original[o + 1], original[o + 2]);
        lumCount++;
      }
    }
  }
  const meanL = lumCount ? lumSum / lumCount : 0.5;
  let varSum = 0;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      if (!closed[y * bw + x]) continue;
      const o = ((y + by0) * w + x + bx0) * 4;
      const d = luminance(original[o], original[o + 1], original[o + 2]) - meanL;
      varSum += d * d;
    }
  }
  const std = lumCount ? Math.sqrt(varSum / lumCount) : 0.1;
  // Peças de baixo contraste (ex.: preto) ganham mais realce de dobras.
  const shading = clamp(0.11 / Math.max(std, 0.01), 0.6, 1.8);

  const [tH, tS, tL] = rgbToHsl(...hexToRgb(hex));
  const indices = new Int32Array(changed);
  const previous = new Uint8Array(changed * 3);
  const previousOwner = new Int32Array(changed);
  let k = 0;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const c = y * bw + x;
      const a9 = alpha[c];
      if (!a9) continue;
      const i = (y + by0) * w + x + bx0;
      const o = i * 4;
      indices[k] = i;
      previous[k * 3] = current[o];
      previous[k * 3 + 1] = current[o + 1];
      previous[k * 3 + 2] = current[o + 2];
      previousOwner[k] = owner[i];
      k++;
      if (closed[c]) owner[i] = targetOwner;

      const pL = luminance(original[o], original[o + 1], original[o + 2]);
      const outL = clamp(tL + (pL - meanL) * shading, 0.03, 0.97);
      const [r, g, b] = hslToRgb(tH, tS, outL);
      const a = a9 / 9;
      // Mistura sobre a foto original: repintar não acumula tons antigos.
      current[o] = original[o] * (1 - a) + r * a;
      current[o + 1] = original[o + 1] * (1 - a) + g * a;
      current[o + 2] = original[o + 2] * (1 - a) + b * a;
    }
  }

  return {
    ok: true,
    step: { indices, previous, previousOwner },
    coverage: selection.coverage,
    limited: selection.limited,
  };
}

/* ----------------------------- auxiliares ----------------------------- */

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function blurRgb(src: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const tmp = new Uint16Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = (y * w + Math.max(0, x - 1)) * 4;
      const m = (y * w + x) * 4;
      const r = (y * w + Math.min(w - 1, x + 1)) * 4;
      const t = (y * w + x) * 3;
      tmp[t] = src[l] + src[m] + src[r];
      tmp[t + 1] = src[l + 1] + src[m + 1] + src[r + 1];
      tmp[t + 2] = src[l + 2] + src[m + 2] + src[r + 2];
    }
  }
  const out = new Uint8ClampedArray(w * h * 3);
  for (let y = 0; y < h; y++) {
    const up = Math.max(0, y - 1) * w, mid = y * w, down = Math.min(h - 1, y + 1) * w;
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        out[(mid + x) * 3 + c] = (tmp[(up + x) * 3 + c] + tmp[(mid + x) * 3 + c] + tmp[(down + x) * 3 + c]) / 9;
      }
    }
  }
  return out;
}

/** Tabela de somas acumuladas (summed-area table). */
function summedArea(values: Uint8Array, w: number, h: number): Int32Array {
  const s = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += values[y * w + x];
      s[(y + 1) * (w + 1) + x + 1] = s[y * (w + 1) + x + 1] + row;
    }
  }
  return s;
}

function windowSum(s: Int32Array, w: number, x0: number, y0: number, x1: number, y1: number): number {
  const W = w + 1;
  return s[(y1 + 1) * W + x1 + 1] - s[y0 * W + x1 + 1] - s[(y1 + 1) * W + x0] + s[y0 * W + x0];
}

function boxMean(values: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const s = summedArea(values, w, h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
      out[y * w + x] = windowSum(s, w, x0, y0, x1, y1) / ((x1 - x0 + 1) * (y1 - y0 + 1));
    }
  }
  return out;
}

/**
 * Preenche componentes de "não-região" totalmente cercados pela região dentro
 * da caixa delimitadora, se forem menores que `maxHole` pixels.
 * Retorna quantos pixels foram adicionados.
 */
function fillSmallHoles(
  region: Uint8Array,
  owner: Int32Array,
  w: number,
  b: { minX: number; maxX: number; minY: number; maxY: number },
  maxHole: number,
): number {
  const seen = new Uint8Array(region.length);
  let added = 0;
  const stack: number[] = [];
  const component: number[] = [];
  for (let y = b.minY; y <= b.maxY; y++) {
    for (let x = b.minX; x <= b.maxX; x++) {
      const start = y * w + x;
      if (region[start] || seen[start]) continue;
      component.length = 0;
      let touchesBorder = false;
      seen[start] = 1;
      stack.push(start);
      while (stack.length) {
        const p = stack.pop()!;
        component.push(p);
        const px = p % w, py = (p - px) / w;
        if (px === b.minX || px === b.maxX || py === b.minY || py === b.maxY) touchesBorder = true;
        if (owner[p] > 0) touchesBorder = true; // não engole outra peça pintada
        if (component.length > maxHole) touchesBorder = true; // grande demais: não é buraco
        const around = [
          px > b.minX ? p - 1 : -1, px < b.maxX ? p + 1 : -1,
          py > b.minY ? p - w : -1, py < b.maxY ? p + w : -1,
        ];
        for (const q of around) {
          if (q < 0 || region[q] || seen[q]) continue;
          seen[q] = 1;
          stack.push(q);
        }
      }
      if (!touchesBorder) {
        for (const p of component) region[p] = 1;
        added += component.length;
      }
    }
  }
  return added;
}

function maxFilter3(values: Uint8Array, w: number, h: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let m = values[i];
      if (x > 0 && values[i - 1] > m) m = values[i - 1];
      if (x < w - 1 && values[i + 1] > m) m = values[i + 1];
      tmp[i] = m;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let m = tmp[i];
      if (y > 0 && tmp[i - w] > m) m = tmp[i - w];
      if (y < h - 1 && tmp[i + w] > m) m = tmp[i + w];
      out[i] = m;
    }
  }
  return out;
}

function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const s = summedArea(mask, w, h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      out[y * w + x] = windowSum(s, w, Math.max(0, x - r), y0, Math.min(w - 1, x + r), y1) > 0 ? 1 : 0;
    }
  }
  return out;
}

function erode(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const s = summedArea(mask, w, h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
      out[y * w + x] = windowSum(s, w, x0, y0, x1, y1) === (x1 - x0 + 1) * (y1 - y0 + 1) ? 1 : 0;
    }
  }
  return out;
}

/** Quantos dos 9 vizinhos (3x3) estão na máscara: vira o alpha da borda. */
function boxCount3(mask: Uint8Array, w: number, h: number): Uint8Array {
  const s = summedArea(mask, w, h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 1), y1 = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - 1), x1 = Math.min(w - 1, x + 1);
      out[y * w + x] = Math.round((windowSum(s, w, x0, y0, x1, y1) * 9) / ((x1 - x0 + 1) * (y1 - y0 + 1)));
    }
  }
  return out;
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  return [hue, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
