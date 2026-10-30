import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import catalog from '../../src/data/products.json';

const STORE_NAME = 'tryons';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
const JOB_TTL_MS = 15 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 4;
const hits = new Map<string, number[]>();

const products = new Map(catalog.map((product) => [product.id, product]));

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

function parseDataUrl(value: unknown, mime: RegExp): { value: string; bytes: number } | null {
  if (typeof value !== 'string' || !mime.test(value)) return null;
  const comma = value.indexOf(',');
  if (comma < 0) return null;
  const encoded = value.slice(comma + 1);
  if (!encoded || !/^[A-Za-z0-9+/=]+$/.test(encoded)) return null;
  const bytes = Math.floor((encoded.length * 3) / 4);
  return { value, bytes };
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const active = (hits.get(ip) ?? []).filter((time) => now - time < RATE_WINDOW_MS);
  active.push(now);
  hits.set(ip, active);
  return active.length > RATE_MAX;
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido.', code: 'METHOD' });
  if (!req.headers.get('content-type')?.includes('application/json')) {
    return json(415, { error: 'Formato não suportado.', code: 'INVALID_INPUT' });
  }
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_TOTAL_BYTES * 1.4) {
    return json(413, { error: 'Arquivos muito grandes.', code: 'TOO_LARGE' });
  }

  const ip = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'unknown';
  if (isRateLimited(ip)) {
    return json(429, { error: 'Muitas tentativas. Aguarde um minuto.', code: 'RATE_LIMITED' });
  }

  let body: { userImage?: unknown; productImage?: unknown; product?: { id?: unknown } };
  try { body = await req.json(); }
  catch { return json(400, { error: 'Requisição inválida.', code: 'INVALID_INPUT' }); }

  const userImage = parseDataUrl(body.userImage, /^data:image\/(jpeg|jpg|png|webp);base64,/);
  const productImage = parseDataUrl(body.productImage, /^data:image\/(jpeg|jpg|png|webp);base64,/);
  const productId = typeof body.product?.id === 'string' ? body.product.id : '';
  const product = products.get(productId);

  if (!userImage || !productImage || !product) {
    return json(400, { error: 'Foto ou produto inválido.', code: 'INVALID_INPUT' });
  }
  if ([userImage, productImage].some((image) => image.bytes > MAX_IMAGE_BYTES)) {
    return json(413, { error: 'Uma das imagens é muito grande.', code: 'TOO_LARGE' });
  }
  if (userImage.bytes + productImage.bytes > MAX_TOTAL_BYTES) {
    return json(413, { error: 'As imagens excedem o limite total.', code: 'TOO_LARGE' });
  }

  const jobId = randomUUID();
  const accessToken = randomBytes(24).toString('base64url');
  const now = Date.now();
  const store = getStore({ name: STORE_NAME });

  try {
    await store.setJSON(`input/${jobId}`, {
      userImage: userImage.value,
      productImage: productImage.value,
      product: { id: product.id, name: product.name, category: product.category, description: product.description },
    }, { metadata: { expiresAt: now + JOB_TTL_MS } });
    await store.setJSON(`job/${jobId}`, {
      status: 'queued', tokenHash: tokenHash(accessToken), updatedAt: now, expiresAt: now + JOB_TTL_MS,
    }, { metadata: { expiresAt: now + JOB_TTL_MS } });

    const triggerUrl = new URL('/.netlify/functions/generate-image-background', req.url);
    const trigger = await fetch(triggerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tryon-Token': accessToken },
      body: JSON.stringify({ jobId }),
    });
    if (trigger.status !== 202 && !trigger.ok) {
      await Promise.allSettled([store.delete(`input/${jobId}`), store.delete(`job/${jobId}`)]);
      console.error('[submit-tryon] background não aceitou o job', trigger.status);
      return json(502, { error: 'Não foi possível iniciar a geração.', code: 'OPENAI_ERROR' });
    }

    return json(202, { jobId, accessToken });
  } catch (err) {
    await Promise.allSettled([store.delete(`input/${jobId}`), store.delete(`job/${jobId}`)]);
    console.error('[submit-tryon] falha no preparo do job', err);
    return json(500, { error: 'Erro ao preparar a geração.', code: 'OPENAI_ERROR' });
  }
};
