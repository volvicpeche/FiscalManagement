import type { FastifyInstance } from 'fastify';

/**
 * Public settings the client needs before anyone is logged in. Served at run
 * time rather than baked into the bundle, so the same web image works for any
 * Supabase project. The anon key is public by design: it only identifies the
 * project, and every table the server uses is closed to it (see the migration).
 */
export async function configRoutes(server: FastifyInstance) {
  server.get('/api/config', async (_request, reply) => {
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseAnonKey) {
      return reply.status(503).send({ error: 'Authentification non configuree sur le serveur.' });
    }
    return { supabaseAnonKey };
  });
}
