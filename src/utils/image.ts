/** Tamanho máximo aceito para a foto enviada pelo usuário (bytes). */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // 12 MB

export const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export interface ProcessedImage {
  /** dataURL (base64) pronto para preview e envio */
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Lê um File, valida tipo/tamanho e redimensiona para um limite máximo,
 * exportando como JPEG comprimido para reduzir o payload enviado à Function.
 */
export async function processImageFile(
  file: File,
  maxDimension = 1280,
  quality = 0.85,
): Promise<ProcessedImage> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new AppImageError(
      'Formato não suportado. Use JPG, PNG ou WEBP.',
      'INVALID_TYPE',
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AppImageError(
      'A imagem é muito grande. Escolha uma foto de até 12 MB.',
      'TOO_LARGE',
    );
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const { canvas, width, height } = drawToCanvas(img, maxDimension);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return { dataUrl, width, height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new AppImageError('Não foi possível ler a imagem.', 'DECODE'));
    img.src = src;
  });
}

function drawToCanvas(img: HTMLImageElement, maxDimension: number) {
  let { width, height } = img;
  if (width > maxDimension || height > maxDimension) {
    const scale = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new AppImageError('Não foi possível processar a imagem.', 'CANVAS');
  }
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, width, height };
}

export class AppImageError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'AppImageError';
    this.code = code;
  }
}

/** Converte um dataURL em Blob (usado no compartilhamento). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
