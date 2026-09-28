import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet, type JWTVerifyGetKey } from 'jose';

/**
 * Stands in for a Supabase project: a key pair whose public half the auth
 * plugin is given instead of the remote JWKS, and tokens shaped like the ones
 * Supabase issues (ES256, iss = <url>/auth/v1, aud = authenticated).
 */
export const SUPABASE_URL = 'https://projet-test.supabase.co';
export const ISSUER = `${SUPABASE_URL}/auth/v1`;

export interface FakeSupabase {
  jwks: JWTVerifyGetKey;
  token(sub: string, over?: { iss?: string; aud?: string; exp?: string | number; email?: string }): Promise<string>;
}

export async function fakeSupabase(): Promise<FakeSupabase> {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test', alg: 'ES256' };
  return {
    jwks: createLocalJWKSet({ keys: [jwk] }),
    token: (sub, over = {}) =>
      new SignJWT({ email: over.email ?? `${sub.slice(0, 8)}@exemple.fr`, role: 'authenticated' })
        .setProtectedHeader({ alg: 'ES256', kid: 'test' })
        .setSubject(sub)
        .setIssuer(over.iss ?? ISSUER)
        .setAudience(over.aud ?? 'authenticated')
        .setIssuedAt()
        .setExpirationTime(over.exp ?? '1h')
        .sign(privateKey),
  };
}
