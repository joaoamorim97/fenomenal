import { createHash } from 'node:crypto';
import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { buildTryOnPrompt } from '../lib/tryon-prompt';

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/images/edits';
const STORE_NAME = 'tryons';
const OPENAI_TIMEOUT_MS = 120_000;
const JOB_TTL_MS = 15 * 60 * 1000;

const allowedModels = new Set(['gpt-image-1.5', 'gpt-image-1']);
const allowedSizes = new Set(['1024x1024', '1024x1536', '1536x1024']);
const allowedQualities = new Set(['low', 'medium', 'high']);

const rawModel = process.env.TRYON_MODEL || 'gpt-image-1.5';
const rawSize = process.env.TRYON_IMAGE_SIZE || '1024x1536';
const rawQuality = process.env.TRYON_IMAGE_QUALITY || 'medium';
const MODEL = allowedModels.has(rawModel) ? rawModel : 'gpt-image-1.5';
const IMAGE_SIZE = allowedSizes.has(rawSize) ? rawSize : '1024x1536';
const IMAGE_QUALITY = allowedQualities.has(rawQuality) ? rawQuality : 'medium';

interface StoredProduct { id: string; name: string; category: string; description: string; }
interface JobState {
  status: 'queued' | 'running' | 'done' | 'error';
  tokenHash: string;
  updatedAt: number;
  expiresAt: number;
  code?: string;
  error?: string;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseDataUrl(value: unknown): { bytes: ArrayBuffer; mime: string } | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) return null;
  return {
    bytes: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    mime: match[1],
  };
}

function extension(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') return;
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  let jobId = '';
  let inputLoaded = false;

  try {
    const body = (await req.json()) as { jobId?: unknown };
    jobId = typeof body.jobId === 'string' ? body.jobId : '';
    const accessToken = req.headers.get('x-tryon-token') || '';
    if (!/^[0-9a-f-]{36}$/.test(jobId) || !accessToken) return;

    const state = (await store.get(`job/${jobId}`, { type: 'json' })) as JobState | null;
    if (!state || state.tokenHash !== hash(accessToken) || state.status !== 'queued') return;

    const input = (await store.get(`input/${jobId}`, { type: 'json' })) as {
      userImage?: unknown;
      productImage?: unknown;
      product?: StoredProduct;
    } | null;
    inputLoaded = Boolean(input);
    if (!input?.product) throw new JobError('INVALID_INPUT', 'Dados da geração não encontrados.');

    const person = parseDataUrl(input.userImage);
    const garment = parseDataUrl(input.productImage);
    if (!person || !garment) {
      throw new JobError('INVALID_INPUT', 'Imagens da geração inválidas.');
    }

    const now = Date.now();
    await store.setJSON(`job/${jobId}`, {
      ...state,
      status: 'running',
      updatedAt: now,
      expiresAt: now + JOB_TTL_MS,
    } satisfies JobState, { metadata: { expiresAt: now + JOB_TTL_MS } });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new JobError('MISSING_API_KEY', 'Serviço de IA não configurado.');

    const form = new FormData();
    form.append('model', MODEL);
    form.append('prompt', buildTryOnPrompt(input.product));
    form.append('size', IMAGE_SIZE);
    form.append('quality', IMAGE_QUALITY);
    form.append('input_fidelity', 'high');
    form.append('n', '1');
    form.append('image[]', new Blob([person.bytes], { type: person.mime }), `person.${extension(person.mime)}`);
    form.append('image[]', new Blob([garment.bytes], { type: garment.mime }), `garment.${extension(garment.mime)}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(OPENAI_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const raw = await response.text();
    if (!response.ok) {
      console.error('[generate-bg] OpenAI', { jobId, status: response.status, model: MODEL, quality: IMAGE_QUALITY, detail: raw.slice(0, 300) });
      const code = response.status === 429 ? 'RATE_LIMITED' : response.status === 401 ? 'MISSING_API_KEY' : 'OPENAI_ERROR';
      throw new JobError(code, 'A IA não conseguiu gerar a imagem.');
    }

    const payload = JSON.parse(raw) as { data?: Array<{ b64_json?: string }> };
    const base64 = payload.data?.[0]?.b64_json;
    if (!base64) throw new JobError('OPENAI_ERROR', 'A IA retornou uma resposta inválida.');

    const output = Uint8Array.from(Buffer.from(base64, 'base64')).buffer;
    await store.set(`result/${jobId}`, output, { metadata: { contentType: 'image/png', expiresAt: Date.now() + JOB_TTL_MS } });
    await store.setJSON(`job/${jobId}`, {
      ...state,
      status: 'done',
      updatedAt: Date.now(),
      expiresAt: Date.now() + JOB_TTL_MS,
    } satisfies JobState, { metadata: { expiresAt: Date.now() + JOB_TTL_MS } });
    console.log('[generate-bg] concluído', { jobId, model: MODEL, quality: IMAGE_QUALITY });
  } catch (error) {
    const jobError = error instanceof JobError
      ? error
      : error instanceof Error && error.name === 'AbortError'
        ? new JobError('TIMEOUT', 'A geração demorou mais que o esperado.')
        : new JobError('OPENAI_ERROR', 'Erro interno ao gerar a imagem.');
    console.error('[generate-bg] falha', { jobId, code: jobError.code, message: jobError.message });
    if (jobId) {
      const current = await store.get(`job/${jobId}`, { type: 'json' }).catch(() => null) as JobState | null;
      if (current) {
        await store.setJSON(`job/${jobId}`, {
          ...current,
          status: 'error',
          code: jobError.code,
          error: jobError.message,
          updatedAt: Date.now(),
          expiresAt: Date.now() + JOB_TTL_MS,
        } satisfies JobState, { metadata: { expiresAt: Date.now() + JOB_TTL_MS } }).catch(() => undefined);
      }
    }
  } finally {
    if (jobId && inputLoaded) await store.delete(`input/${jobId}`).catch(() => undefined);
  }
};

class JobError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'JobError';
  }
}
