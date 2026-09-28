import type { FastifyReply, FastifyRequest } from 'fastify';
import type { LlmConfig } from '../services/llm/config.js';
import { LlmNonConfigureError, resoudreConfigLlm } from '../services/llmSettings.js';
import { consommerQuota, QuotaLlmAtteintError } from '../services/llmQuota.js';

/**
 * Before any paid LLM call: which key serves it, and — when it is the
 * server's — booking `appels` calls against the daily quota. A user's own key
 * is theirs to spend: no quota then.
 *
 * Returns null once it has answered the request itself (403 no key, 429).
 */
export async function preparerLlm(
  request: FastifyRequest,
  reply: FastifyReply,
  usage: 'annonce' | 'document',
  appels = 1,
): Promise<LlmConfig | null> {
  let config: LlmConfig;
  try {
    config = await resoudreConfigLlm(request.user, usage);
  } catch (err) {
    if (err instanceof LlmNonConfigureError) {
      await reply.status(403).send({ error: err.message, code: err.code });
      return null;
    }
    throw err;
  }

  if (config.source === 'serveur') {
    try {
      await consommerQuota(request.user.id, appels);
    } catch (err) {
      if (err instanceof QuotaLlmAtteintError) {
        await reply.status(429).send({ error: err.message });
        return null;
      }
      throw err;
    }
  }
  return config;
}
