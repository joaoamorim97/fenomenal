import type { GenerateRequest, GenerateResponse } from '../types';

/** Mensagens amigáveis por código de erro. */
const FRIENDLY_ERRORS: Record<string, string> = {
  MISSING_API_KEY:
    'O serviço de IA ainda não está configurado. Tente novamente mais tarde.',
  INVALID_INPUT: 'Não conseguimos ler sua foto. Tente enviar outra imagem.',
  TOO_LARGE: 'A imagem enviada é muito grande. Escolha uma foto menor.',
  OPENAI_ERROR:
    'Nossa IA não conseguiu gerar o look agora. Tente novamente em instantes.',
  TIMEOUT: 'A geração demorou mais que o esperado. Tente novamente.',
  RATE_LIMITED:
    'Muitas solicitações agora há pouco. Aguarde um momento e tente de novo.',
  NOT_DEPLOYED:
    'O serviço de geração não está disponível neste ambiente. É necessário publicar as Netlify Functions.',
  NETWORK:
    'Sem conexão com o servidor. Verifique sua internet e tente novamente.',
};

export function friendlyError(code?: string): string {
  if (code && FRIENDLY_ERRORS[code]) return FRIENDLY_ERRORS[code];
  return 'Algo deu errado ao gerar seu look. Tente novamente.';
}

const START_ENDPOINT = '/.netlify/functions/generate-image-background';
const STATUS_ENDPOINT = '/.netlify/functions/generate-status';

const POLL_INTERVAL_MS = 2500;
const MAX_WAIT_MS = 180_000; // 3 min

function newJobId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function generateTryOn(
  payload: GenerateRequest,
): Promise<GenerateResponse> {
  const jobId = newJobId();

  // 1) Dispara a background function (resposta 202 imediata).
  try {
    const res = await fetch(START_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, jobId }),
    });

    // 202 = aceito (background). 200 também é aceitável.
    if (res.status === 404) {
      console.error('[generateTryOn] função não encontrada (404).');
      return { error: friendlyError('NOT_DEPLOYED'), code: 'NOT_DEPLOYED' };
    }
    if (res.status !== 202 && res.status !== 200) {
      console.error('[generateTryOn] disparo falhou:', res.status);
      return { error: friendlyError('OPENAI_ERROR'), code: 'OPENAI_ERROR' };
    }
  } catch (err) {
    console.error('[generateTryOn] erro de rede no disparo:', err);
    return { error: friendlyError('NETWORK'), code: 'NETWORK' };
  }

  // 2) Faz polling do status até concluir, dar erro ou estourar o tempo.
  const deadline = Date.now() + MAX_WAIT_MS;
  await sleep(POLL_INTERVAL_MS);

  while (Date.now() < deadline) {
    try {
      const res = await fetch(
        `${STATUS_ENDPOINT}?jobId=${encodeURIComponent(jobId)}`,
        { headers: { 'Cache-Control': 'no-store' } },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          status: string;
          image?: string;
          error?: string;
          code?: string;
        };

        if (data.status === 'done' && data.image) {
          return { image: data.image };
        }
        if (data.status === 'error') {
          return {
            error: friendlyError(data.code),
            code: data.code ?? 'OPENAI_ERROR',
          };
        }
        // 'pending' | 'processing' -> continua aguardando
      }
    } catch (err) {
      // erro transitório de rede durante o polling: tenta de novo
      console.warn('[generateTryOn] polling falhou, tentando de novo:', err);
    }
    await sleep(POLL_INTERVAL_MS);
  }

  console.error('[generateTryOn] timeout aguardando o resultado.');
  return { error: friendlyError('TIMEOUT'), code: 'TIMEOUT' };
}
