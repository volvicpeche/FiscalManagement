import type { FastifyInstance } from 'fastify';
import { LlmSettingsRequestSchema } from '@shared/llmSettings.js';
import {
  enregistrerParametresLlm,
  lireParametresLlm,
  ParametresLlmInvalidesError,
  supprimerParametresLlm,
} from '../services/llmSettings.js';
import { StockageClesIndisponibleError } from '../services/secretBox.js';

/**
 * The logged-in user's own LLM provider and key. The key is write-only: no
 * response ever carries it, only its last four characters.
 */
export async function llmSettingsRoutes(server: FastifyInstance) {
  server.get('/api/me/llm', async (request) => lireParametresLlm(request.user));

  server.put('/api/me/llm', async (request, reply) => {
    const parsed = LlmSettingsRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      const first = parsed.error.issues.find((i) => i.message !== 'Invalid input');
      return reply.status(400).send({ error: first?.message ?? 'Parametres invalides' });
    }
    try {
      return await enregistrerParametresLlm(request.user, parsed.data);
    } catch (err) {
      if (err instanceof ParametresLlmInvalidesError) return reply.status(400).send({ error: err.message });
      if (err instanceof StockageClesIndisponibleError) return reply.status(503).send({ error: err.message });
      throw err;
    }
  });

  server.delete('/api/me/llm', async (request, reply) => {
    await supprimerParametresLlm(request.user.id);
    return reply.status(204).send();
  });
}
