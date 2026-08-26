import type { FastifyInstance } from 'fastify';
import { ListingAnalyzeRequestSchema } from '@shared/listing.js';
import { analyzeListing } from '../services/listingAnalyzer.js';

export async function listingRoutes(server: FastifyInstance) {
  server.post('/api/listings/analyze', async (request, reply) => {
    const parsed = ListingAnalyzeRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }

    try {
      return await analyzeListing(parsed.data.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Echec de l'analyse de l'annonce";
      return reply.status(422).send({ error: message });
    }
  });
}
