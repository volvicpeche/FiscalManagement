import type { FastifyInstance } from 'fastify';
import { SimulationRequestSchema } from '@shared/schemas.js';
import { runSimulation } from '../engine/simulator.js';

export async function simulationRoutes(server: FastifyInstance) {
  server.post('/api/simulations/run', async (request, reply) => {
    const parsed = SimulationRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }

    const result = runSimulation(parsed.data);
    return result;
  });
}
