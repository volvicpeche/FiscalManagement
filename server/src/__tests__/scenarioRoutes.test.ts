import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { hasDb, createUser, deleteCreatedUsers } from './helpers/testDb.js';
import { fakeSupabase, SUPABASE_URL, type FakeSupabase } from './helpers/jwt.js';

process.env.MAX_SCENARIOS = '3';
const { authPlugin } = await import('../plugins/auth.js');
const { scenarioRoutes } = await import('../routes/scenarios.js');
const { listingRoutes } = await import('../routes/listings.js');
const { LLM_QUOTA_JOUR, jourUtc } = await import('../services/llmQuota.js');
const { db, closeDb } = await import('../services/db.js');

describe.skipIf(!hasDb)('routes /api/simulations (Postgres)', () => {
  let server: FastifyInstance;
  let supabase: FakeSupabase;
  let alice: { id: string; auth: Record<string, string> };
  let bob: { id: string; auth: Record<string, string> };

  const as = async (id: string) => ({ id, auth: { authorization: `Bearer ${await supabase.token(id)}` } });

  beforeAll(async () => {
    supabase = await fakeSupabase();
    server = Fastify();
    await server.register(authPlugin, { supabaseUrl: SUPABASE_URL, jwks: supabase.jwks });
    await server.register(scenarioRoutes);
    await server.register(listingRoutes);
    await server.ready();
    alice = await as(await createUser());
    bob = await as(await createUser());
  });

  afterAll(async () => {
    await server.close();
    await deleteCreatedUsers();
    await closeDb();
  });

  const corps = { nom: 'Achat Lyon', kind: 'sci', data: { prix: '250000.00' } };

  it('should refuse the listing without a token', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/simulations' });
    expect(res.statusCode).toBe(401);
  });

  it('should save, list, read, update and delete for the owner', async () => {
    const cree = await server.inject({ method: 'POST', url: '/api/simulations', headers: alice.auth, payload: corps });
    expect(cree.statusCode).toBe(201);
    const { id } = cree.json();

    const liste = await server.inject({ method: 'GET', url: '/api/simulations', headers: alice.auth });
    expect(liste.json().map((s: { id: string }) => s.id)).toContain(id);

    const lu = await server.inject({ method: 'GET', url: `/api/simulations/${id}`, headers: alice.auth });
    expect(lu.json().data).toEqual(corps.data);

    const maj = await server.inject({
      method: 'PUT', url: `/api/simulations/${id}`, headers: alice.auth, payload: { ...corps, nom: 'Achat Lyon 2' },
    });
    expect(maj.statusCode).toBe(200);
    expect(maj.json().nom).toBe('Achat Lyon 2');

    const sup = await server.inject({ method: 'DELETE', url: `/api/simulations/${id}`, headers: alice.auth });
    expect(sup.statusCode).toBe(204);
  });

  it("should answer 404 on someone else's scenario, whatever the verb", async () => {
    const { id } = (
      await server.inject({ method: 'POST', url: '/api/simulations', headers: alice.auth, payload: corps })
    ).json();

    for (const method of ['GET', 'PUT', 'DELETE'] as const) {
      const res = await server.inject({
        method, url: `/api/simulations/${id}`, headers: bob.auth, payload: method === 'PUT' ? corps : undefined,
      });
      expect(res.statusCode, method).toBe(404);
    }
    const liste = await server.inject({ method: 'GET', url: '/api/simulations', headers: bob.auth });
    expect(liste.json()).toEqual([]);

    await server.inject({ method: 'DELETE', url: `/api/simulations/${id}`, headers: alice.auth });
  });

  it('should keep 400 on an invalid body and on a malformed id', async () => {
    const vide = await server.inject({
      method: 'POST', url: '/api/simulations', headers: alice.auth, payload: { ...corps, nom: '' },
    });
    expect(vide.statusCode).toBe(400);
    expect(vide.json().error).toMatch(/nom/);

    const idInvalide = await server.inject({ method: 'GET', url: '/api/simulations/xyz', headers: alice.auth });
    expect(idInvalide.statusCode).toBe(400);
  });

  it('should answer 409 past the per-user ceiling', async () => {
    const carol = await as(await createUser());
    for (let i = 0; i < 3; i++) {
      await server.inject({ method: 'POST', url: '/api/simulations', headers: carol.auth, payload: corps });
    }
    const res = await server.inject({ method: 'POST', url: '/api/simulations', headers: carol.auth, payload: corps });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/Limite/);
  });

  it('should answer 429 on a listing analysis once the daily quota is spent', async () => {
    // The quota only applies to the server's key, i.e. to allow-listed accounts.
    process.env.LLM_SERVER_KEY_EMAILS = 'dave@exemple.fr';
    process.env.LLM_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'sk-cle-du-serveur';
    const daveId = await createUser();
    const dave = { id: daveId, auth: { authorization: `Bearer ${await supabase.token(daveId, { email: 'dave@exemple.fr' })}` } };
    await db().llmUsage.create({ data: { userId: dave.id, jour: jourUtc(), appels: LLM_QUOTA_JOUR } });

    const res = await server.inject({
      method: 'POST', url: '/api/listings/analyze', headers: dave.auth, payload: { text: 'T3 a Lyon, 250 000 EUR' },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toMatch(/Quota/);
  });
});
