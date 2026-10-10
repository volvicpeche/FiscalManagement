import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { FrontalierRequestSchema } from '@shared/frontalier.js';
import { hasDb, createUser, deleteCreatedUsers } from './helpers/testDb.js';
import { fakeSupabase, SUPABASE_URL, type FakeSupabase } from './helpers/jwt.js';

process.env.MAX_SIGNALEMENTS_JOUR = '3';
const { authPlugin } = await import('../plugins/auth.js');
const { signalementRoutes } = await import('../routes/signalements.js');
const { simulateFrontalier } = await import('../engine/frontalier/index.js');
const { db, closeDb } = await import('../services/db.js');

const requete = {
  annee: 2026,
  etatCivil: 'CELIBATAIRE',
  communeTravail: 'GENEVE',
  tauxChangeEurChf: '0.93',
  contribuable: { prenom: 'Camille', activite: 'SUISSE', salaireBrut: '90000.00', cotisationsSociales: '6000.00', codeTarifIS: 'A0' },
  deductions: {},
  biensFrance: [{ label: 'Maison de Thonon', usage: 'LOCATIF', loyersBrutsEur: '9000.00' }],
};

describe('routes des signalements without a token', () => {
  let server: FastifyInstance;
  beforeAll(async () => {
    server = Fastify();
    await server.register(authPlugin, { supabaseUrl: SUPABASE_URL, jwks: (await fakeSupabase()).jwks });
    await server.register(signalementRoutes);
    await server.ready();
  });
  afterAll(() => server.close());

  it.each([
    ['POST', '/api/frontalier/signalements'],
    ['GET', '/api/me/signalements'],
    ['DELETE', '/api/me/signalements/00000000-0000-0000-0000-000000000000'],
  ] as const)('should answer 401 to %s %s', async (method, url) => {
    expect((await server.inject({ method, url })).statusCode).toBe(401);
  });
});

describe.skipIf(!hasDb)('routes des signalements (Postgres)', () => {
  let server: FastifyInstance;
  let supabase: FakeSupabase;

  const compte = async () => {
    const id = await createUser();
    return { id, auth: { authorization: `Bearer ${await supabase.token(id)}` } };
  };
  const envoyer = (auth: Record<string, string>, payload: unknown) =>
    server.inject({ method: 'POST', url: '/api/frontalier/signalements', headers: auth, payload: payload as object });

  beforeAll(async () => {
    supabase = await fakeSupabase();
    server = Fastify();
    await server.register(authPlugin, { supabaseUrl: SUPABASE_URL, jwks: supabase.jwks });
    await server.register(signalementRoutes);
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    await deleteCreatedUsers();
    await closeDb();
  });

  it('should refuse a report without consent', async () => {
    const alice = await compte();
    const res = await envoyer(alice.auth, { requete });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/Cochez la case/);
    expect(await db().signalement.count({ where: { userId: alice.id } })).toBe(0);
  });

  it('should store the household anonymised, recompute the result, and answer the gaps', async () => {
    const alice = await compte();
    const res = await envoyer(alice.auth, {
      requete,
      decompte: { icc: '9000.00', ifd: '700.00' },
      commentaire: 'Mon bordereau ICC dit 9 000',
      consentement: true,
    });
    expect(res.statusCode).toBe(201);

    const attendu = simulateFrontalier(FrontalierRequestSchema.parse(requete));
    const { id, ecarts } = res.json();
    expect(ecarts.map((e: { champ: string }) => e.champ)).toEqual(['icc', 'ifd']);
    expect(ecarts[0]).toMatchObject({ calcule: attendu.icc.total, reel: '9000.00' });

    const row = await db().signalement.findUniqueOrThrow({ where: { id } });
    const json = JSON.stringify(row.requete);
    expect(json).not.toContain('Camille');
    expect(json).not.toContain('Thonon');
    expect(row).toMatchObject({ userId: alice.id, canton: 'GE', annee: 2026, commentaire: 'Mon bordereau ICC dit 9 000' });
    expect((row.resultat as { totalTou: string }).totalTou).toBe(attendu.totalTou);
  });

  it('should accept a report without any line of the assessment', async () => {
    const alice = await compte();
    const res = await envoyer(alice.auth, { requete, consentement: true });
    expect(res.statusCode).toBe(201);
    expect(res.json().ecarts).toEqual([]);
  });

  it('should refuse a line that is not an amount', async () => {
    const alice = await compte();
    const res = await envoyer(alice.auth, { requete, decompte: { icc: 'beaucoup' }, consentement: true });
    expect(res.statusCode).toBe(400);
  });

  it('should cap the reports per day', async () => {
    const alice = await compte();
    for (let i = 0; i < 3; i++) expect((await envoyer(alice.auth, { requete, consentement: true })).statusCode).toBe(201);
    const res = await envoyer(alice.auth, { requete, consentement: true });
    expect(res.statusCode).toBe(429);
  });

  it('should list and delete only the user’s own reports', async () => {
    const alice = await compte();
    const bob = await compte();
    const { id } = (await envoyer(alice.auth, { requete, decompte: { icc: '9000.00' }, consentement: true })).json();

    const liste = (await server.inject({ method: 'GET', url: '/api/me/signalements', headers: alice.auth })).json();
    expect(liste).toEqual([expect.objectContaining({ id, canton: 'GE', annee: 2026, lignesDecompte: 1 })]);
    expect((await server.inject({ method: 'GET', url: '/api/me/signalements', headers: bob.auth })).json()).toEqual([]);

    expect((await server.inject({ method: 'DELETE', url: `/api/me/signalements/${id}`, headers: bob.auth })).statusCode).toBe(404);
    expect((await server.inject({ method: 'DELETE', url: `/api/me/signalements/${id}`, headers: alice.auth })).statusCode).toBe(204);
    expect((await server.inject({ method: 'DELETE', url: `/api/me/signalements/${id}`, headers: alice.auth })).statusCode).toBe(404);
  });
});
