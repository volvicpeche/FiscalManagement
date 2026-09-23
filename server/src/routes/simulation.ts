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
      // An LMNP at the micro-BIC keeps no books: its own preset, under a key
      // of its own since it is not a structure type.
      const micro = getPresetCostLines(mode, 'LMNP', 'MICRO_BIC');
      presets[mode].LMNP_MICRO_BIC = {
        constitution: micro.constitution.map((l) => ({ label: l.label, montant: l.montant.toFixed(2) })),
        annuel: micro.annuel.map((l) => ({ label: l.label, montant: l.montant.toFixed(2) })),
      };
    }

    return presets;
  });
}
