import type { FastifyInstance } from 'fastify';
import { SaveScenarioRequestSchema } from '@shared/scenario.js';
import {
  deleteScenario,
  getScenario,
  isValidId,
  listScenarios,
  saveScenario,
  updateScenario,
} from '../services/scenarioStore.js';

export async function scenarioRoutes(server: FastifyInstance) {
  server.get('/api/simulations', async () => listScenarios());

  server.get<{ Params: { id: string } }>('/api/simulations/:id', async (request, reply) => {
    const { id } = request.params;
    if (!isValidId(id)) {
      return reply.status(400).send({ error: 'Identifiant de scenario invalide' });
    }

    const scenario = await getScenario(id);
    if (!scenario) {
      return reply.status(404).send({ error: 'Scenario introuvable' });
    }
    return scenario;
  });

  server.post('/api/simulations', async (request, reply) => {
    const parsed = SaveScenarioRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      const first = parsed.error.issues.find((i) => i.message !== 'Invalid input');
      return reply.status(400).send({
        error: first?.message ?? 'Scenario invalide',
        details: parsed.error.flatten(),
      });
    }

    return reply.status(201).send(await saveScenario(parsed.data));
  });

  server.put<{ Params: { id: string } }>('/api/simulations/:id', async (request, reply) => {
    const { id } = request.params;
    if (!isValidId(id)) {
      return reply.status(400).send({ error: 'Identifiant de scenario invalide' });
    }

    const parsed = SaveScenarioRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      const first = parsed.error.issues.find((i) => i.message !== 'Invalid input');
      return reply.status(400).send({
        error: first?.message ?? 'Scenario invalide',
        details: parsed.error.flatten(),
      });
    }

    const updated = await updateScenario(id, parsed.data);
    if (!updated) {
      return reply.status(404).send({ error: 'Scenario introuvable' });
    }
    return updated;
  });

  server.delete<{ Params: { id: string } }>('/api/simulations/:id', async (request, reply) => {
    const { id } = request.params;
    if (!isValidId(id)) {
      return reply.status(400).send({ error: 'Identifiant de scenario invalide' });
    }

    const removed = await deleteScenario(id);
    if (!removed) {
      return reply.status(404).send({ error: 'Scenario introuvable' });
    }
    return reply.status(204).send();
  });
}
