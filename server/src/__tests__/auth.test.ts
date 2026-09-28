import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { authPlugin } from '../plugins/auth.js';
import { configRoutes } from '../routes/config.js';
import { SignJWT } from 'jose';
import { fakeSupabase, SUPABASE_URL, ISSUER, type FakeSupabase } from './helpers/jwt.js';

const USER = '11111111-2222-4333-8444-555555555555';

let server: FastifyInstance;
let supabase: FakeSupabase;

beforeAll(async () => {
  supabase = await fakeSupabase();
  process.env.SUPABASE_ANON_KEY = 'cle-anon-publique';
  server = Fastify();
  await server.register(authPlugin, { supabaseUrl: SUPABASE_URL, jwks: supabase.jwks });
  await server.register(configRoutes);
  server.get('/api/health', async () => ({ status: 'ok' }));
  server.get('/api/moi', async (request) => request.user);
  await server.ready();
});

afterAll(() => server.close());

const moi = (authorization?: string) =>
  server.inject({
    method: 'GET',
    url: '/api/moi',
    headers: authorization ? { authorization } : {},
  });

describe('auth plugin', () => {
  it('should refuse a request without a token', async () => {
    const res = await moi();
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/Connexion requise/);
  });

  it('should refuse a header that is not a bearer token', async () => {
    expect((await moi('Basic ZmxvcmlhbjpzZWNyZXQ=')).statusCode).toBe(401);
  });

  it('should refuse a garbage token', async () => {
    const res = await moi('Bearer pas.un.jeton');
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/reconnectez-vous/);
  });

  it('should accept a valid token and expose the user', async () => {
    const res = await moi(`Bearer ${await supabase.token(USER, { email: 'a@b.fr' })}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: USER, email: 'a@b.fr' });
  });

  it('should refuse an expired token', async () => {
    const token = await supabase.token(USER, { exp: Math.floor(Date.now() / 1000) - 60 });
    expect((await moi(`Bearer ${token}`)).statusCode).toBe(401);
  });

  it('should refuse a token from another Supabase project', async () => {
    const token = await supabase.token(USER, { iss: 'https://autre.supabase.co/auth/v1' });
    expect((await moi(`Bearer ${token}`)).statusCode).toBe(401);
  });

  it('should refuse a token not issued to a logged-in user', async () => {
    // The anon key itself is a JWT with aud "anon"-like claims: never a session.
    const token = await supabase.token(USER, { aud: 'anon' });
    expect((await moi(`Bearer ${token}`)).statusCode).toBe(401);
  });

  it('should refuse a token signed with another key', async () => {
    const autre = await fakeSupabase();
    expect((await moi(`Bearer ${await autre.token(USER)}`)).statusCode).toBe(401);
  });

  it('should leave /api/health public', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
  });

  it('should leave /api/config public, and serve the anon key', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/config' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ supabaseAnonKey: 'cle-anon-publique' });
  });

  it('should never serve a secret key to the browser', async () => {
    const avant = process.env.SUPABASE_ANON_KEY;
    process.env.SUPABASE_ANON_KEY = 'sb_secret_ne-doit-jamais-sortir';
    const res = await server.inject({ method: 'GET', url: '/api/config' });
    process.env.SUPABASE_ANON_KEY = avant;
    expect(res.statusCode).toBe(503);
    expect(res.body).not.toContain('sb_secret');
  });

  it('should not be fooled by a query string on a public route', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/moi?/api/health' });
    expect(res.statusCode).toBe(401);
  });
});

describe('auth plugin — legacy JWT secret (HS256)', () => {
  const SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';
  const hs256 = (secret: string, over: { iss?: string } = {}) =>
    new SignJWT({ email: 'legacy@exemple.fr', role: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(USER)
      .setIssuer(over.iss ?? ISSUER)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));

  let legacy: FastifyInstance;

  beforeAll(async () => {
    legacy = Fastify();
    await legacy.register(authPlugin, { supabaseUrl: SUPABASE_URL, jwks: supabase.jwks, jwtSecret: SECRET });
    legacy.get('/api/moi', async (request) => request.user);
    await legacy.ready();
  });

  afterAll(() => legacy.close());

  const moiLegacy = (token: string) =>
    legacy.inject({ method: 'GET', url: '/api/moi', headers: { authorization: `Bearer ${token}` } });

  it('should accept a token signed with the configured secret', async () => {
    const res = await moiLegacy(await hs256(SECRET));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: USER, email: 'legacy@exemple.fr' });
  });

  it('should refuse a token signed with another secret', async () => {
    expect((await moiLegacy(await hs256('un-autre-secret-de-plus-de-32-caracteres!!'))).statusCode).toBe(401);
  });

  it('should still check the issuer of an HS256 token', async () => {
    const token = await hs256(SECRET, { iss: 'https://autre.supabase.co/auth/v1' });
    expect((await moiLegacy(token)).statusCode).toBe(401);
  });

  it('should keep accepting asymmetric tokens alongside', async () => {
    expect((await moiLegacy(await supabase.token(USER))).statusCode).toBe(200);
  });

  it('should refuse an HS256 token when no secret is configured', async () => {
    // `server` (first describe) has no jwtSecret.
    const res = await moi(`Bearer ${await hs256(SECRET)}`);
    expect(res.statusCode).toBe(401);
  });

  it('should refuse an unsigned token (alg: none)', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
      sub: USER, iss: ISSUER, aud: 'authenticated', iat: now, exp: now + 3600,
    })}.`;
    expect((await moiLegacy(unsigned)).statusCode).toBe(401);
  });
});
