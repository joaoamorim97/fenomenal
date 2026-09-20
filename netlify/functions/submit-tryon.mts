import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

/**
 * Função SÍNCRONA de submit.
 *
 * Recebe as imagens (foto do usuário + produto) e as informações da peça,
 * grava tudo no Netlify Blobs sob o `jobId` e marca o job como "processing".
 *
 * Isso é necessário porque a Background Function é invocada de forma assíncrona,
 * cujo limite de payload é pequeno (~256 KB). As funções síncronas aceitam até
 * ~4,5 MB de payload em base64, o que comporta as imagens. Depois deste submit,
 * o app dispara a Background Function passando apenas o jobId (corpo minúsculo).
 */

const STORE_NAME = 'tryons';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function isImageDataUrl(v: unknown): v is string {
  return typeof v === 'string' && /^data:image\/(jpeg|jpg|png|webp);base64,/.test(v);
}

// Estimativa do tamanho do binário a partir do comprimento do base64.
function approxBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return json(405, { error: 'Método não permitido', code: 'METHOD' });
  }

  let body: {
    jobId?: string;
    userImage?: string;
    productImage?: string;
    product?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Requisição inválida.', code: 'INVALID_INPUT' });
  }

  const jobId = (body.jobId || '').trim();
  if (!jobId) {
    return json(400, { error: 'jobId ausente.', code: 'INVALID_INPUT' });
  }
  if (!isImageDataUrl(body.userImage)) {
    return json(400, { error: 'Foto do usuário inválida.', code: 'INVALID_INPUT' });
  }
  if (approxBytes(body.userImage) > MAX_IMAGE_BYTES) {
    return json(413, { error: 'Imagem muito grande.', code: 'TOO_LARGE' });
  }
  if (body.productImage && !isImageDataUrl(body.productImage)) {
    // imagem de produto inválida: seguimos sem ela (a IA usa a descrição textual)
    body.productImage = undefined;
  }

  try {
    const store = getStore(STORE_NAME);
    await store.setJSON(`in_${jobId}`, {
      userImage: body.userImage,
      productImage: body.productImage ?? null,
      product: body.product ?? {},
    });
    await store.setJSON(jobId, { status: 'processing', updatedAt: Date.now() });
    return json(200, { ok: true, jobId });
  } catch (err) {
    console.error('[submit-tryon] erro ao gravar no Blobs', err);
    return json(500, { error: 'Erro ao preparar a geração.', code: 'OPENAI_ERROR' });
  }
};
