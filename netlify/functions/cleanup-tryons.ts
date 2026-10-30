import type { Handler } from '@netlify/functions';
import { schedule } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

/** Defesa de privacidade: remove inputs/resultados órfãos após o TTL de 15 min. */
const cleanup: Handler = async () => {
  const store = getStore({ name: 'tryons', consistency: 'strong' });
  const now = Date.now();
  let removed = 0;

  try {
    const entries = await store.list();
    for (const entry of entries.blobs) {
      const details = await store.getMetadata(entry.key);
      const expiresAt = Number(details?.metadata?.expiresAt ?? 0);
      if (expiresAt > 0 && expiresAt < now) {
        await store.delete(entry.key);
        removed++;
      }
    }
    console.log('[cleanup-tryons]', { removed });
    return { statusCode: 200 };
  } catch (error) {
    console.error('[cleanup-tryons] falha', error);
    return { statusCode: 500 };
  }
};

export const handler = schedule('@hourly', cleanup);
