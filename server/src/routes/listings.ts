import type { FastifyInstance } from 'fastify';
import { ListingAnalyzeRequestSchema } from '@shared/listing.js';
import { analyzeListing, analyzeListingText } from '../services/listingAnalyzer.js';

export async function listingRoutes(server: FastifyInstance) {
  server.post('/api/listings/analyze', async (request, reply) => {
    const parsed = ListingAnalyzeRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      // Surface the actual French message: the client renders `error` verbatim.
      // A failed union carries only Zod's generic "Invalid input", which tells
      // the user nothing — replace it with what they actually need to do.
      const specific = parsed.error.issues.find((i) => i.message !== 'Invalid input');
      return reply.status(400).send({
        error: specific?.message ?? "Fournissez soit l'URL de l'annonce, soit son texte.",
        details: parsed.error.flatten(),
      });
    }

    try {
      return 'url' in parsed.data
        ? await analyzeListing(parsed.data.url)
        : await analyzeListingText(parsed.data.text);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Echec de l'analyse de l'annonce";
      return reply.status(422).send({ error: message });
    }
  });
}
