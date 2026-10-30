import { createHash } from 'node:crypto';
import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'tryons';

interface JobState {
  status: 'queued' | 'running' | 'done' | 'error';
  tokenHash: string;
  updatedAt: number;
  expiresAt: number;
  code?: string;
  error?: string;
}

const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET') return json(405, { status: 'error', code: 'METHOD' });
  const jobId = new URL(req.url).searchParams.get('jobId') || '';
  const token = req.headers.get('x-tryon-token') || '';
  if (!/^[0-9a-f-]{36}$/.test(jobId) || !token) return json(400, { status: 'error', code: 'INVALID_INPUT' });

  try {
    const store = getStore({ name: STORE_NAME, consistency: 'strong' });
    const state = await store.get(`job/${jobId}`, { type: 'json' }) as JobState | null;
    if (!state || state.tokenHash !== hash(token)) return json(404, { status: 'expired', code: 'JOB_EXPIRED' });
    if (state.expiresAt < Date.now()) {
      await Promise.allSettled([store.delete(`job/${jobId}`), store.delete(`input/${jobId}`), store.delete(`result/${jobId}`)]);
      return json(410, { status: 'expired', code: 'JOB_EXPIRED' });
    }
    return json(200, {
      status: state.status === 'queued' ? 'pending' : state.status === 'running' ? 'processing' : state.status,
      code: state.code,
      error: state.error,
    });
  } catch (error) {
    console.error('[generate-status] falha', error);
    return json(503, { status: 'error', code: 'STATUS_UNAVAILABLE' });
  }
};
