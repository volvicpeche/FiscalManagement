import fp from 'fastify-plugin';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/**
 * Authentication of every /api route by a Supabase access token, verified
 * locally with no call to Supabase per request. Two kinds of project exist:
 *
 * - Signing keys (projects created or migrated since 2025): tokens are signed
 *   with an asymmetric key whose public half is published at
 *   /auth/v1/.well-known/jwks.json (jose caches it). Nothing secret here.
 * - Legacy JWT secret (older projects): tokens are HS256, signed with the
 *   project's shared secret, and the JWKS is empty. Accepted ONLY when
 *   SUPABASE_JWT_SECRET is configured — an HS256 token is otherwise refused,
 *   never checked against a key it was not made for.
 *
 * The algorithm in the token header picks the key; jose then refuses any
 * mismatch between that algorithm and the key type (so no `alg: none`, no
 * HS256 signed with a public key). The token comes in `Authorization: Bearer
 * <jwt>`, never in a cookie, so there is no CSRF surface.
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
  /** Legacy JWT secret of the project, for HS256 tokens. Absent: HS256 refused. */
  jwtSecret?: string;
}

const SESSION_EXPIREE = { error: 'Session expiree, reconnectez-vous.' };

export const authPlugin = fp<AuthOptions>(
  async (server, opts) => {
    const base = opts.supabaseUrl.replace(/\/+$/, '');
    const issuer = `${base}/auth/v1`;
    const jwks = opts.jwks ?? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    const secret = opts.jwtSecret ? new TextEncoder().encode(opts.jwtSecret) : null;

    const key: JWTVerifyGetKey = async (header, token) => {
      if (header.alg === 'HS256') {
        if (!secret) throw new Error('jeton HS256 sans SUPABASE_JWT_SECRET configure');
        return secret;
      }
      return jwks(header, token);
    };

    server.decorateRequest('user', null as unknown as AuthUser);

    server.addHook('onRequest', async (request, reply) => {
      const path = request.url.split('?')[0];
      if (!path.startsWith('/api/') || PUBLIC_ROUTES.has(path)) return;

      const header = request.headers.authorization;
      const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
      if (!token) return reply.status(401).send({ error: 'Connexion requise.' });

      try {
        const { payload } = await jwtVerify(token, key, {
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
