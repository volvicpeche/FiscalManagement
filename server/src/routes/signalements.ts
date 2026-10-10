import type { FastifyInstance } from 'fastify';
import { SignalementRequestSchema } from '@shared/frontalier.js';
import { CantonIndisponibleError } from '../engine/frontalier/index.js';
import { isValidId } from '../services/scenarioStore.js';
import {
  TropDeSignalementsError,
  creerSignalement,
  listerSignalements,
  supprimerSignalement,
} from '../services/signalements.js';

/** « Ce chiffre me semble faux »: sending a report, and the user's own list. */
export async function signalementRoutes(server: FastifyInstance) {
  server.post('/api/frontalier/signalements', async (request, reply) => {
    const parsed = SignalementRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      const specific = parsed.error.issues.find((i) => i.message !== 'Invalid input');
      return reply.status(400).send({ error: specific?.message ?? 'Signalement invalide' });
    }
    try {
      const cree = await creerSignalement(request.user.id, parsed.data);
      return reply.status(201).send(cree);
    } catch (err) {
      if (err instanceof TropDeSignalementsError) return reply.status(429).send({ error: err.message });
      if (err instanceof CantonIndisponibleError) {
        return reply.status(422).send({ error: err.message, code: 'CANTON_INDISPONIBLE' });
      }
      throw err;
    }
  });

  server.get('/api/me/signalements', async (request) => listerSignalements(request.user.id));

  server.delete<{ Params: { id: string } }>('/api/me/signalements/:id', async (request, reply) => {
    const { id } = request.params;
    if (!isValidId(id) || !(await supprimerSignalement(request.user.id, id))) {
      return reply.status(404).send({ error: 'Signalement introuvable' });
    }
    return reply.status(204).send();
  });
}
