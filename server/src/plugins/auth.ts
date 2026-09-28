import fp from 'fastify-plugin';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/**
 * Authentication of every /api route by a Supabase access token.
 *
 * Supabase signs its access tokens with an asymmetric key and publishes the
 * public half at /auth/v1/.well-known/jwks.json: the server verifies them
 * locally, with no secret and no call to Supabase per request (jose caches the
 * key set). The token comes in `Authorization: Bearer <jwt>`, never in a
 * cookie, so there is no CSRF surface.
 */

export interface AuthUser {
  id: string;
  email: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the auth hook on every non-public /api route. */
    user: AuthUser;
  }
}

/** Reachable without a token. /api/config gives the client what it needs to log in. */
const PUBLIC_ROUTES = new Set(['/api/health', '/api/config']);

export interface AuthOptions {
  /** Supabase project URL, e.g. https://abcd.supabase.co */
  supabaseUrl: string;
  /** Overrides the remote key set — tests sign their own tokens. */
  jwks?: JWTVerifyGetKey;
}

const SESSION_EXPIREE = { error: 'Session expiree, reconnectez-vous.' };

export const authPlugin = fp<AuthOptions>(
  async (server, opts) => {
    const base = opts.supabaseUrl.replace(/\/+$/, '');
    const issuer = `${base}/auth/v1`;
    const jwks = opts.jwks ?? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

    server.decorateRequest('user', null as unknown as AuthUser);

    server.addHook('onRequest', async (request, reply) => {
      const path = request.url.split('?')[0];
      if (!path.startsWith('/api/') || PUBLIC_ROUTES.has(path)) return;

      const header = request.headers.authorization;
      const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
      if (!token) return reply.status(401).send({ error: 'Connexion requise.' });

      try {
        const { payload } = await jwtVerify(token, jwks, {
          issuer,
          audience: 'authenticated',
        });
        if (typeof payload.sub !== 'string' || !payload.sub) {
          return reply.status(401).send(SESSION_EXPIREE);
        }
        request.user = {
          id: payload.sub,
          email: typeof payload.email === 'string' ? payload.email : null,
        };
      } catch (err) {
        request.log.info({ err: (err as Error).message }, 'jeton refuse');
        return reply.status(401).send(SESSION_EXPIREE);
      }
    });
  },
  { name: 'auth' },
);
