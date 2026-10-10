import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { hasDb, createUser, deleteCreatedUsers } from './helpers/testDb.js';
import { fakeSupabase, SUPABASE_URL, type FakeSupabase } from './helpers/jwt.js';
import { authPlugin } from '../plugins/auth.js';
import { llmSettingsRoutes } from '../routes/llmSettings.js';
import { listingRoutes } from '../routes/listings.js';
import { frontalierRoutes } from '../routes/frontalier.js';
import { closeDb } from '../services/db.js';

const ENV = ['LLM_KEYS_SECRET', 'LLM_SERVER_KEY_EMAILS'] as const;
const sauvegarde = Object.fromEntries(ENV.map((v) => [v, process.env[v]]));

describe.skipIf(!hasDb)('routes /api/me/llm (Postgres)', () => {
  let server: FastifyInstance;
  let supabase: FakeSupabase;
  let auth: Record<string, string>;

  beforeAll(async () => {
    process.env.LLM_KEYS_SECRET = randomBytes(32).toString('base64');
    delete process.env.LLM_SERVER_KEY_EMAILS;
    supabase = await fakeSupabase();
    server = Fastify();
    await server.register(authPlugin, { supabaseUrl: SUPABASE_URL, jwks: supabase.jwks });
    await server.register(llmSettingsRoutes);
    await server.register(listingRoutes);
    await server.register(frontalierRoutes);
    await server.ready();
    auth = { authorization: `Bearer ${await supabase.token(await createUser())}` };
  });

  afterAll(async () => {
    for (const v of ENV) {
      if (sauvegarde[v] === undefined) delete process.env[v];
      else process.env[v] = sauvegarde[v];
    }
    await server.close();
    await deleteCreatedUsers();
    await closeDb();
  });

  it('should need a login', async () => {
    expect((await server.inject({ method: 'GET', url: '/api/me/llm' })).statusCode).toBe(401);
  });

  it('should refuse the analysis without a key, with a code the client can act on', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/listings/analyze', headers: auth, payload: { text: 'x'.repeat(300) },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'LLM_NON_CONFIGURE', error: expect.stringMatching(/Cle LLM/) });
  });

  it('should refuse document reading without a key, before calling anything', async () => {
    const boundary = '----t';
    const res = await server.inject({
      method: 'POST', url: '/api/frontalier/documents?consentement=oui',
      headers: { ...auth, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: `--${boundary}\r\nContent-Disposition: form-data; name="f"; filename="a.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF\r\n--${boundary}--\r\n`,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'LLM_NON_CONFIGURE', error: expect.stringMatching(/justificatifs.*Cle LLM/) });
  });

  it('should save, show only the last 4 characters, and delete', async () => {
    const put = await server.inject({
      method: 'PUT', url: '/api/me/llm', headers: auth,
      payload: { provider: 'anthropic', apiKey: 'sk-ant-api03-secret-WXYZ', model: '' },
    });
    expect(put.statusCode).toBe(200);
    expect(put.body).not.toContain('secret');
    expect(put.json()).toMatchObject({ configuree: true, provider: 'anthropic', cleFin: 'WXYZ', model: null });

    const get = await server.inject({ method: 'GET', url: '/api/me/llm', headers: auth });
    expect(get.body).not.toContain('secret');
    expect(get.json().cleFin).toBe('WXYZ');

    expect((await server.inject({ method: 'DELETE', url: '/api/me/llm', headers: auth })).statusCode).toBe(204);
    expect((await server.inject({ method: 'GET', url: '/api/me/llm', headers: auth })).json().configuree).toBe(false);
  });

  it('should reject invalid settings in French', async () => {
    const http = await server.inject({
      method: 'PUT', url: '/api/me/llm', headers: auth,
      payload: { provider: 'openai_compatible', apiKey: 'sk-1234567890', model: 'm', baseUrl: 'http://api.exemple.fr/v1' },
    });
    expect(http.statusCode).toBe(400);
    expect(http.json().error).toMatch(/https/);

    const interne = await server.inject({
      method: 'PUT', url: '/api/me/llm', headers: auth,
      payload: { provider: 'openai_compatible', apiKey: 'sk-1234567890', model: 'm', baseUrl: 'https://10.0.0.5/v1' },
    });
    expect(interne.statusCode).toBe(400);
    expect(interne.json().error).toMatch(/non autorisee/);

    const sansCle = await server.inject({ method: 'PUT', url: '/api/me/llm', headers: auth, payload: { provider: 'gemini' } });
    expect(sansCle.statusCode).toBe(400);
  });

  it('should answer 503 when the server cannot store keys', async () => {
    const secret = process.env.LLM_KEYS_SECRET;
    delete process.env.LLM_KEYS_SECRET;
    const res = await server.inject({
      method: 'PUT', url: '/api/me/llm', headers: auth, payload: { provider: 'openai', apiKey: 'sk-1234567890' },
    });
    process.env.LLM_KEYS_SECRET = secret;
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toMatch(/LLM_KEYS_SECRET/);
  });
});
