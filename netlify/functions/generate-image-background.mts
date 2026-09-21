import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

/**
 * BACKGROUND FUNCTION — provador virtual.
 *
 * Roda de forma assíncrona (o cliente recebe 202 na hora) e pode levar até
 * 15 min, contornando o limite de 10s das functions síncronas no plano free.
 *
 * Fluxo:
 *  1. o app envia { jobId, userImage, productImage, product };
 *  2. aqui gravamos "processing" no Netlify Blobs;
 *  3. chamamos a OpenAI (gpt-image-1-mini);
 *  4. gravamos "done" (com a imagem) ou "error" no Blobs;
 *  5. o app consulta o resultado via generate-status.
 *
 * A OPENAI_API_KEY vive SOMENTE aqui (variável de ambiente do servidor).
 */

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/images/edits';
// gpt-image-1.5: sucessor do gpt-image-1 — melhor qualidade, saída mais barata
// (US$32/1M vs US$40/1M) e suporta input_fidelity=high (preserva rosto/mãos).
// O gpt-image-1 está sendo descontinuado. gpt-image-1-mini NÃO suporta
// input_fidelity=high (altera o rosto). Tudo configurável via env.
const MODEL = process.env.TRYON_MODEL || 'gpt-image-1.5';
const IMAGE_SIZE = process.env.TRYON_IMAGE_SIZE || '1024x1536';
// "medium" reduz muito artefatos/alucinações (mãos, dedos extras, rosto) frente
// ao "low". Use "high" para o máximo de fidelidade (mais caro) ou "low" p/ custo.
const IMAGE_QUALITY = process.env.TRYON_IMAGE_QUALITY || 'medium';
// input_fidelity=high preserva rosto/identidade e detalhes das imagens de entrada.
const INPUT_FIDELITY = process.env.TRYON_INPUT_FIDELITY || 'high';
// input_fidelity=high só é suportado nos modelos completos, não no mini.
const SUPPORTS_HIGH_FIDELITY = MODEL !== 'gpt-image-1-mini';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const STORE_NAME = 'tryons';

interface JobResult {
  status: 'processing' | 'done' | 'error';
  image?: string;
  error?: string;
  code?: string;
  updatedAt: number;
}

interface Product {
  name?: string;
  category?: string;
  description?: string;
  color?: string;
}

export default async (req: Request, _context: Context) => {
  const store = getStore(STORE_NAME);

  let jobId = '';
  try {
    const trigger = (await req.json()) as { jobId?: string };
    jobId = (trigger.jobId || '').trim();

    if (!jobId) {
      // Sem jobId não há como o cliente recuperar o resultado.
      console.error('[generate-bg] jobId ausente');
      return;
    }

    // As imagens foram gravadas no Blobs pela função síncrona submit-tryon.
    const input = (await store.get(`in_${jobId}`, { type: 'json' })) as {
      userImage?: string;
      productImage?: string | null;
      product?: Product;
    } | null;

    if (!input) {
      console.error('[generate-bg] input não encontrado no Blobs para', jobId);
      return void (await save(store, jobId, {
        status: 'error',
        code: 'INVALID_INPUT',
        error: 'Dados da geração não encontrados.',
        updatedAt: Date.now(),
      }));
    }

    await save(store, jobId, { status: 'processing', updatedAt: Date.now() });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[generate-bg] OPENAI_API_KEY não configurada.');
      return void (await save(store, jobId, {
        status: 'error',
        code: 'MISSING_API_KEY',
        error: 'Serviço de IA não configurado.',
        updatedAt: Date.now(),
      }));
    }

    const userImage = parseDataUrl(input.userImage);
    if (!userImage) {
      return void (await save(store, jobId, {
        status: 'error',
        code: 'INVALID_INPUT',
        error: 'Foto do usuário ausente ou inválida.',
        updatedAt: Date.now(),
      }));
    }
    if (userImage.bytes.byteLength > MAX_IMAGE_BYTES) {
      return void (await save(store, jobId, {
        status: 'error',
        code: 'TOO_LARGE',
        error: 'Imagem muito grande.',
        updatedAt: Date.now(),
      }));
    }

    const productImage = parseDataUrl(input.productImage ?? undefined);
    if (productImage && productImage.bytes.byteLength > MAX_IMAGE_BYTES) {
      return void (await save(store, jobId, {
        status: 'error',
        code: 'TOO_LARGE',
        error: 'Imagem do produto muito grande.',
        updatedAt: Date.now(),
      }));
    }

    const prompt = buildPrompt(input.product ?? {}, Boolean(productImage));

    // Já temos as imagens em memória; limpamos o input do Blobs.
    await store.delete(`in_${jobId}`).catch(() => undefined);

    const form = new FormData();
    form.append('model', MODEL);
    form.append('prompt', prompt);
    form.append('size', IMAGE_SIZE);
    form.append('quality', IMAGE_QUALITY);
    if (INPUT_FIDELITY === 'high' && SUPPORTS_HIGH_FIDELITY) {
      form.append('input_fidelity', 'high');
    }
    form.append('n', '1');
    form.append(
      'image[]',
      new Blob([userImage.bytes], { type: userImage.mime }),
      'user.' + extFromMime(userImage.mime),
    );
    if (productImage) {
      form.append(
        'image[]',
        new Blob([productImage.bytes], { type: productImage.mime }),
        'product.' + extFromMime(productImage.mime),
      );
    }

    const res = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    const raw = await res.text();
    if (!res.ok) {
      console.error('[generate-bg] OpenAI erro', res.status, raw.slice(0, 500));
      return void (await save(store, jobId, {
        status: 'error',
        code: res.status === 429 ? 'RATE_LIMITED' : 'OPENAI_ERROR',
        error: 'Falha ao gerar a imagem.',
        updatedAt: Date.now(),
      }));
    }

    const data = JSON.parse(raw) as {
      data?: Array<{ b64_json?: string }>;
    };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      console.error('[generate-bg] resposta sem b64_json', raw.slice(0, 300));
      return void (await save(store, jobId, {
        status: 'error',
        code: 'OPENAI_ERROR',
        error: 'Resposta inválida da IA.',
        updatedAt: Date.now(),
      }));
    }

    await save(store, jobId, {
      status: 'done',
      image: `data:image/png;base64,${b64}`,
      updatedAt: Date.now(),
    });
    console.log('[generate-bg] job concluído', jobId);
  } catch (err) {
    console.error('[generate-bg] erro inesperado', err);
    if (jobId) {
      await save(store, jobId, {
        status: 'error',
        code: 'OPENAI_ERROR',
        error: 'Erro interno ao gerar a imagem.',
        updatedAt: Date.now(),
      }).catch(() => undefined);
    }
  }
};

// Este arquivo roda como BACKGROUND FUNCTION por causa do sufixo "-background"
// no nome (convenção do Netlify, totalmente suportada). O cliente recebe 202
// imediatamente e o resultado é gravado no Netlify Blobs.

// ---------------------------------------------------------------------------

async function save(
  store: ReturnType<typeof getStore>,
  jobId: string,
  result: JobResult,
): Promise<void> {
  await store.setJSON(jobId, result);
}

interface ParsedImage {
  bytes: ArrayBuffer;
  mime: string;
}

function parseDataUrl(dataUrl?: string): ParsedImage | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mime)) {
    return null;
  }
  try {
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0) return null;
    const bytes = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );
    return { bytes, mime };
  } catch {
    return null;
  }
}

function extFromMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function buildPrompt(product: Product, hasProductImage: boolean): string {
  const name = (product.name || 'a peça de roupa selecionada').trim();
  const category = (product.category || '').trim();
  const description = (product.description || '').trim();
  const color = (product.color || '').trim();

  const parts: string[] = [];
  parts.push(
    'Edite a PRIMEIRA imagem, que é a foto real de uma pessoa. A ÚNICA coisa que você pode mudar é a ROUPA. Todo o resto deve permanecer idêntico à foto original. Este é um provador virtual de moda.',
  );
  parts.push(
    'REGRA ABSOLUTA E INEGOCIÁVEL — NÃO MEXA NO ROSTO: é PROIBIDO alterar, redesenhar, mover, suavizar, estilizar, "melhorar", distorcer ou substituir o rosto. Trate a área do rosto e da cabeça como uma zona travada/congelada: mantenha exatamente os mesmos pixels do rosto original. Preserve com fidelidade absoluta a identidade e todos os traços: formato do rosto, olhos, sobrancelhas, nariz, boca, lábios, queixo, mandíbula, bochechas, orelhas, expressão, rugas, barba e pelos faciais, sinais, pintas, cicatrizes e maquiagem. O rosto do resultado tem que ser reconhecível como EXATAMENTE a MESMA pessoa. NUNCA gere um rosto novo, "parecido", "inspirado", mais bonito, mais jovem ou mais simétrico.',
  );
  parts.push(
    'É proibido deformar ou distorcer o rosto, a cabeça, o pescoço, as mãos e o corpo. Se houver qualquer conflito, priorize manter o rosto intacto acima de qualquer ajuste na roupa.',
  );
  parts.push(
    'ANATOMIA CORRETA — MÃOS: preserve as mãos e os dedos EXATAMENTE como na foto original, com o número correto de dedos (cinco por mão). É terminantemente proibido adicionar dedos, remover dedos, fundir dedos, criar dedos extras ou membros extras, ou distorcer mãos, dedos, braços e pernas. Nada de deformidades anatômicas.',
  );
  parts.push(
    'NÃO alucine: não invente objetos, acessórios, textos ou elementos que não existam na foto original; não altere o que a pessoa segura nas mãos. O resultado deve ser fotorrealista, natural e sem artefatos.',
  );
  parts.push(
    'PRESERVE também, sem alterar: o cabelo (cor, corte, textura e comprimento), o tom e a textura da pele, as proporções e o tipo do corpo, as mãos e os dedos, a pose, o ângulo da cabeça, o enquadramento, o fundo/cenário, os reflexos e a iluminação da foto original.',
  );
  parts.push(
    'NÃO troque a pessoa por outra, NÃO rejuvenesça nem envelheça, NÃO afine nem engorde o rosto ou o corpo, NÃO altere etnia, gênero ou idade. Altere APENAS a região do corpo onde fica a roupa, deixando o rosto e a cabeça exatamente como estão.',
  );
  if (hasProductImage) {
    parts.push(
      'Use a SEGUNDA imagem como referência visual exata da roupa. Reproduza com fidelidade a cor, o corte, o caimento, as estampas e os detalhes dessa peça. Não adicione logos, textos ou estampas que não existam na peça de referência e não remova detalhes importantes dela.',
    );
  } else {
    parts.push(
      'Vista a pessoa com a seguinte peça, de forma realista e bem ajustada ao corpo, com caimento natural do tecido.',
    );
  }
  const desc: string[] = [];
  desc.push(`Peça: ${name}.`);
  if (category) desc.push(`Categoria: ${category}.`);
  if (color) desc.push(`Cor: ${color}.`);
  if (description) desc.push(`Detalhes: ${description}`);
  parts.push(desc.join(' '));
  parts.push(
    'Resultado fotorrealista, de alta qualidade, adequado para e-commerce de moda. Enquadre a roupa de forma natural sobre o corpo.',
  );
  return parts.join('\n');
}
