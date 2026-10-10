import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { ExportCompteSchema } from '@shared/compte.js';
import { hasDb, createUser, deleteCreatedUsers } from './helpers/testDb.js';
import { fakeSupabase, SUPABASE_URL, type FakeSupabase } from './helpers/jwt.js';

process.env.LLM_KEYS_SECRET ??= randomBytes(32).toString('base64');
const { authPlugin } = await import('../plugins/auth.js');
const { compteRoutes } = await import('../routes/compte.js');
const { scenarioRoutes } = await import('../routes/scenarios.js');
const { llmSettingsRoutes } = await import('../routes/llmSettings.js');
const { consommerQuota } = await import('../services/llmQuota.js');
const { db, closeDb } = await import('../services/db.js');

describe('routes /api/me without a token', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    const supabase = await fakeSupabase();
    server = Fastify();
    await server.register(authPlugin, { supabaseUrl: SUPABASE_URL, jwks: supabase.jwks });
    await server.register(compteRoutes);
    await server.ready();
  });

  afterAll(() => server.close());

  it.each([
    ['GET', '/api/me'],
    ['GET', '/api/me/export'],
    ['DELETE', '/api/me'],
  ] as const)('should answer 401 to %s %s', async (method, url) => {
    expect((await server.inject({ method, url })).statusCode).toBe(401);
  });
});

describe.skipIf(!hasDb)('routes /api/me (Postgres)', () => {
  let server: FastifyInstance;
  let supabase: FakeSupabase;

  const compte = async () => {
    const id = await createUser();
    const email = `${id.slice(0, 8)}@exemple.fr`;
    return { id, email, auth: { authorization: `Bearer ${await supabase.token(id, { email })}` } };
  };

  /** A scenario, a key and a day of LLM usage, as a real account would have. */
  const remplir = async (c: { id: string; auth: Record<string, string> }) => {
    for (const kind of ['sci', 'sci', 'frontalier'] as const) {
      const res = await server.inject({
        method: 'POST', url: '/api/simulations', headers: c.auth, payload: { nom: `Projet ${kind}`, kind, data: { prix: '1' } },
      });
      expect(res.statusCode).toBe(201);
    }
    const cle = await server.inject({
      method: 'PUT', url: '/api/me/llm', headers: c.auth,
      payload: { provider: 'anthropic', apiKey: 'sk-ant-api03-secret-WXYZ', model: '' },
    });
    expect(cle.statusCode).toBe(200);
    await consommerQuota(c.id, 2);
  };

  beforeAll(async () => {
    supabase = await fakeSupabase();
    server = Fastify();
    await server.register(authPlugin, { supabaseUrl: SUPABASE_URL, jwks: supabase.jwks });
    await server.register(compteRoutes);
    await server.register(scenarioRoutes);
    await server.register(llmSettingsRoutes);
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    await deleteCreatedUsers();
    await closeDb();
  });

  it('should sum up the account', async () => {
    const alice = await compte();
    await remplir(alice);
    const res = await server.inject({ method: 'GET', url: '/api/me', headers: alice.auth });
    expect(res.json()).toEqual({ scenarios: { sci: 2, saisonnier: 0, frontalier: 1 }, cleLlm: true });
  });

  it('should export every row of the user, and nobody else’s, without the key', async () => {
    const alice = await compte();
    const bob = await compte();
    await remplir(alice);
    await remplir(bob);

    const res = await server.inject({ method: 'GET', url: '/api/me/export', headers: alice.auth });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="patrimonia-export-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(res.headers['cache-control']).toBe('no-store');

    const contenu = ExportCompteSchema.parse(res.json());
    expect(contenu.compte).toEqual({ id: alice.id, email: alice.email });
    expect(contenu.scenarios).toHaveLength(3);
    expect(contenu.scenarios[0].data).toEqual({ prix: '1' });
    expect(contenu.cleLlm).toMatchObject({ provider: 'anthropic', cleFin: 'WXYZ' });
    expect(contenu.consommationLlm).toEqual([{ jour: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), appels: 2 }]);

    // Not a trace of the key, encrypted or not, nor of Bob.
    expect(res.body).not.toContain('secret');
    expect(res.body).not.toMatch(/chiffr/i);
    expect(res.body).not.toContain(bob.id);
  });

  it('should refuse a deletion whose confirmation is not the account’s address, and keep everything', async () => {
    const alice = await compte();
    await remplir(alice);

    for (const payload of [undefined, {}, { confirmation: '' }, { confirmation: 'autre@exemple.fr' }]) {
      const res = await server.inject({ method: 'DELETE', url: '/api/me', headers: alice.auth, payload });
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
    }
    expect(await db().scenario.count({ where: { userId: alice.id } })).toBe(3);
  });

  it('should delete the account and all its rows, and only those', async () => {
    const alice = await compte();
    const bob = await compte();
    await remplir(alice);
    await remplir(bob);

    const res = await server.inject({
      method: 'DELETE', url: '/api/me', headers: alice.auth, payload: { confirmation: `  ${alice.email.toUpperCase()} ` },
    });
    expect(res.statusCode).toBe(204);

    const restant = async (id: string) => ({
      utilisateur: (await db().$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM auth.users WHERE id = ${id}::uuid`)[0].n,
      scenarios: await db().scenario.count({ where: { userId: id } }),
      cle: await db().llmSettings.count({ where: { userId: id } }),
      usage: await db().llmUsage.count({ where: { userId: id } }),
    });
    expect(await restant(alice.id)).toEqual({ utilisateur: 0, scenarios: 0, cle: 0, usage: 0 });
    expect(await restant(bob.id)).toEqual({ utilisateur: 1, scenarios: 3, cle: 1, usage: 1 });
  });
});
