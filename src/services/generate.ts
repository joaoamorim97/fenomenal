import type { GenerateRequest, GenerateResponse } from '../types';

const FRIENDLY_ERRORS: Record<string, string> = {
  MISSING_API_KEY: 'O serviço de IA ainda não está configurado.',
  INVALID_INPUT: 'Não conseguimos preparar sua foto ou a peça. Tente novamente.',
  TOO_LARGE: 'As imagens ficaram grandes demais. Escolha uma foto menor.',
  OPENAI_ERROR: 'A IA não conseguiu finalizar este look. Tente novamente.',
  TIMEOUT: 'A geração demorou mais que o esperado. Tente novamente.',
  RATE_LIMITED: 'Muitas solicitações agora. Aguarde um minuto e tente novamente.',
  JOB_EXPIRED: 'Esta geração expirou. Toque em tentar novamente.',
  STATUS_UNAVAILABLE: 'O serviço está temporariamente indisponível.',
  NOT_DEPLOYED: 'O serviço de geração ainda não foi publicado neste ambiente.',
  NETWORK: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.',
};

export function friendlyError(code?: string): string {
  return (code && FRIENDLY_ERRORS[code]) || 'Algo deu errado ao gerar seu look. Tente novamente.';
}

const SUBMIT_ENDPOINT = '/.netlify/functions/submit-tryon';
const STATUS_ENDPOINT = '/.netlify/functions/generate-status';
const RESULT_ENDPOINT = '/.netlify/functions/tryon-result';
const MAX_WAIT_MS = 180_000;

interface JobCredentials { jobId: string; accessToken: string; }

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

async function parseErrorCode(response: Response): Promise<string> {
  try {
    const body = await response.json() as { code?: string };
    return body.code || 'OPENAI_ERROR';
  } catch {
    return response.status === 404 ? 'NOT_DEPLOYED' : response.status === 413 ? 'TOO_LARGE' : 'OPENAI_ERROR';
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function generateTryOn(
  payload: GenerateRequest,
  signal?: AbortSignal,
): Promise<GenerateResponse> {
  let credentials: JobCredentials;

  try {
    const response = await fetch(SUBMIT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    if (!response.ok) {
      const code = await parseErrorCode(response);
      console.error('[generateTryOn] submit', response.status, code);
      return { error: friendlyError(code), code };
    }
    credentials = await response.json() as JobCredentials;
    if (!credentials.jobId || !credentials.accessToken) throw new Error('Credenciais do job ausentes.');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return { code: 'ABORTED' };
    console.error('[generateTryOn] submit/rede', error);
    return { error: friendlyError('NETWORK'), code: 'NETWORK' };
  }

  const deadline = Date.now() + MAX_WAIT_MS;
  let interval = 1_800;
  let consecutiveFailures = 0;

  while (Date.now() < deadline) {
    try {
      await abortableSleep(interval, signal);
      const status = await fetch(`${STATUS_ENDPOINT}?jobId=${encodeURIComponent(credentials.jobId)}`, {
        headers: { 'X-Tryon-Token': credentials.accessToken, 'Cache-Control': 'no-store' },
        signal,
      });
      if (!status.ok) {
        consecutiveFailures++;
        if (status.status === 404 || status.status === 410) return { error: friendlyError('JOB_EXPIRED'), code: 'JOB_EXPIRED' };
        if (consecutiveFailures >= 4) return { error: friendlyError('STATUS_UNAVAILABLE'), code: 'STATUS_UNAVAILABLE' };
      } else {
        consecutiveFailures = 0;
        const state = await status.json() as { status: string; code?: string };
        if (state.status === 'error') {
          return { error: friendlyError(state.code), code: state.code || 'OPENAI_ERROR' };
        }
        if (state.status === 'done') {
          const result = await fetch(`${RESULT_ENDPOINT}?jobId=${encodeURIComponent(credentials.jobId)}`, {
            headers: { 'X-Tryon-Token': credentials.accessToken },
            signal,
          });
          if (!result.ok) return { error: friendlyError('OPENAI_ERROR'), code: 'OPENAI_ERROR' };
          return { image: await blobToDataUrl(await result.blob()) };
        }
      }
      interval = Math.min(Math.round(interval * 1.25), 5_000);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return { code: 'ABORTED' };
      consecutiveFailures++;
      console.warn('[generateTryOn] polling transitório', error);
      if (consecutiveFailures >= 4) return { error: friendlyError('NETWORK'), code: 'NETWORK' };
    }
  }

  return { error: friendlyError('TIMEOUT'), code: 'TIMEOUT' };
}
