import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

/**
 * Endpoint SÍNCRONO e rápido, consultado em polling pelo app.
 * Lê o resultado do job no Netlify Blobs e devolve o status atual.
 *
 * GET /.netlify/functions/generate-status?jobId=xxx
 *   -> { status: 'pending' | 'processing' | 'done' | 'error', image?, error?, code? }
 */

const STORE_NAME = 'tryons';

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export default async (req: Request, _context: Context) => {
  const jobId = new URL(req.url).searchParams.get('jobId')?.trim();
  if (!jobId) {
    return json(400, { status: 'error', code: 'INVALID_INPUT', error: 'jobId ausente.' });
  }

  try {
    const store = getStore(STORE_NAME);
    const data = (await store.get(jobId, { type: 'json' })) as
      | { status: string; image?: string; error?: string; code?: string }
      | null;

    if (!data) {
      // Ainda não começou a gravar (a background function pode não ter iniciado).
      return json(200, { status: 'pending' });
    }

    // Quando terminou (sucesso ou erro), limpamos o blob para não acumular.
    if (data.status === 'done' || data.status === 'error') {
      await store.delete(jobId).catch(() => undefined);
    }

    return json(200, data);
  } catch (err) {
    console.error('[generate-status] erro ao ler o blob', err);
    return json(200, { status: 'pending' });
  }
};
