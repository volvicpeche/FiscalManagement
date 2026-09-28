import type { FastifyReply, FastifyRequest } from 'fastify';
import type { LlmConfig } from '../services/llm/config.js';
import { LlmNonConfigureError, resoudreConfigLlm } from '../services/llmSettings.js';
import { consommerQuota, QuotaLlmAtteintError } from '../services/llmQuota.js';

/**
 * Which key serves a paid LLM call: the user's own, or the server's for the
 * allow-listed accounts. Answers 403 itself (and returns null) when there is
 * none — callers check this BEFORE doing any work, e.g. before receiving
 * uploaded files.
 */
export async function resoudreLlm(
  request: FastifyRequest,
  reply: FastifyReply,
  usage: 'annonce' | 'document',
): Promise<LlmConfig | null> {
  try {
    return await resoudreConfigLlm(request.user, usage);
  } catch (err) {
    if (err instanceof LlmNonConfigureError) {
      await reply.status(403).send({ error: err.message, code: err.code });
      return null;
    }
    throw err;
  }
}

/**
 * Books `appels` calls against the daily quota when the server's key serves
 * them; a user's own key is theirs to spend, no quota then. Answers 429 itself
 * (and returns false) past the quota.
 */
export async function reserverQuota(
  request: FastifyRequest,
  reply: FastifyReply,
  config: LlmConfig,
  appels = 1,
): Promise<boolean> {
  if (config.source !== 'serveur') return true;
  try {
    await consommerQuota(request.user.id, appels);
    return true;
  } catch (err) {
    if (err instanceof QuotaLlmAtteintError) {
      await reply.status(429).send({ error: err.message });
      return false;
    }
    throw err;
  }
}

/** Both, for a single call whose cost is known up front. */
export async function preparerLlm(
  request: FastifyRequest,
  reply: FastifyReply,
  usage: 'annonce' | 'document',
  appels = 1,
): Promise<LlmConfig | null> {
  const config = await resoudreLlm(request, reply, usage);
  if (!config) return null;
  return (await reserverQuota(request, reply, config, appels)) ? config : null;
}
