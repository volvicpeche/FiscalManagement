import type { FastifyInstance } from 'fastify';
import { SuppressionCompteRequestSchema } from '@shared/compte.js';
import { confirmationValide, exporterCompte, resumerCompte, supprimerCompte } from '../services/compte.js';

/**
 * The logged-in user's account: summary, export (RGPD art. 15 and 20) and
 * deletion (art. 17). Like every /api route, behind the Supabase token.
 */
export async function compteRoutes(server: FastifyInstance) {
  server.get('/api/me', async (request) => resumerCompte(request.user.id));

  server.get('/api/me/export', async (request, reply) => {
    const contenu = await exporterCompte(request.user);
    const jour = contenu.exporteLe.slice(0, 10);
    return reply
      .header('Content-Disposition', `attachment; filename="patrimonia-export-${jour}.json"`)
      .header('Cache-Control', 'no-store')
      .send(contenu);
  });

  server.delete('/api/me', async (request, reply) => {
    const parsed = SuppressionCompteRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Confirmation manquante' });
    }
    if (!confirmationValide(request.user, parsed.data.confirmation)) {
      return reply.status(400).send({
        error: request.user.email
          ? 'L’adresse saisie n’est pas celle du compte.'
          : 'Saisissez SUPPRIMER pour confirmer.',
      });
    }
    await supprimerCompte(request.user.id);
    request.log.info({ userId: request.user.id }, 'compte supprime');
    return reply.status(204).send();
  });
}
