import type { FastifyInstance } from 'fastify';
import { MESSAGE_CLE_SECRETE, natureCleSupabase } from '../services/cleSupabase.js';

/**
 * Public settings the client needs before anyone is logged in. Served at run
 * time rather than baked into the bundle, so the same web image works for any
 * Supabase project. The publishable (or legacy anon) key is public by design:
 * it only identifies the project, and every table the server uses is closed
 * to it (see the migration). A SECRET key pasted there by mistake is refused:
 * it must never leave the server.
 */
export async function configRoutes(server: FastifyInstance) {
  server.get('/api/config', async (request, reply) => {
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseAnonKey) {
      return reply.status(503).send({ error: 'Authentification non configuree sur le serveur.' });
    }
    if (natureCleSupabase(supabaseAnonKey) === 'secret') {
      request.log.error(MESSAGE_CLE_SECRETE);
      return reply.status(503).send({ error: 'Authentification mal configuree sur le serveur. Prevenez l’administrateur.' });
    }
    return { supabaseAnonKey };
  });
}
