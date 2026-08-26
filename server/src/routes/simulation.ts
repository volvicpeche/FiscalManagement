import type { FastifyInstance } from 'fastify';
import { SimulationRequestSchema, ManagementMode, StructureType } from '@shared/schemas.js';
import { runSimulation } from '../engine/simulator.js';
import { getPresetCostLines } from '../engine/costs.js';

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

  /**
   * Cost presets for every mode/structure pair, so the client can pre-fill the
   * form without duplicating the table. The engine stays the single source.
   */
  server.get('/api/costs/presets', async () => {
    const presets: Record<string, Record<string, { constitution: unknown[]; annuel: unknown[] }>> = {};

    for (const mode of ManagementMode.options) {
      presets[mode] = {};
      for (const type of StructureType.options) {
        const lines = getPresetCostLines(mode, type);
        presets[mode][type] = {
          constitution: lines.constitution.map((l) => ({ label: l.label, montant: l.montant.toFixed(2) })),
          annuel: lines.annuel.map((l) => ({ label: l.label, montant: l.montant.toFixed(2) })),
        };
      }
    }

    return presets;
  });
}
