import { createHash } from 'node:crypto';
import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'tryons';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET') return new Response(null, { status: 405 });
  const jobId = new URL(req.url).searchParams.get('jobId') || '';
  const token = req.headers.get('x-tryon-token') || '';
  if (!/^[0-9a-f-]{36}$/.test(jobId) || !token) return new Response(null, { status: 400 });

  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  try {
    const state = await store.get(`job/${jobId}`, { type: 'json' }) as {
      status?: string; tokenHash?: string; expiresAt?: number;
    } | null;
    if (!state || state.tokenHash !== hash(token)) return new Response(null, { status: 404 });
    if (state.status !== 'done') return new Response(null, { status: 409 });

    const image = await store.get(`result/${jobId}`, { type: 'arrayBuffer' });
    if (!image) return new Response(null, { status: 404 });

    // A resposta já está em memória: removemos os blobs pessoais após o consumo.
    await Promise.allSettled([store.delete(`result/${jobId}`), store.delete(`job/${jobId}`)]);
    return new Response(image, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(image.byteLength),
        'Cache-Control': 'no-store, private',
      },
    });
  } catch (error) {
    console.error('[tryon-result] falha', error);
    return new Response(null, { status: 503 });
  }
};
