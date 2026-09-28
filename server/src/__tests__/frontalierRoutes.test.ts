import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// Key resolution needs the database; here the user simply has an Anthropic
// key of their own (no quota). Refusals without a key: llmRoutes.test.ts.
vi.mock('../services/llmSettings.js', async (original) => ({
  ...(await original<typeof import('../services/llmSettings.js')>()),
  resoudreConfigLlm: async () => ({ provider: 'anthropic', apiKey: 'sk-test', model: 'm', source: 'utilisateur' }),
}));

const { frontalierRoutes } = await import('../routes/frontalier.js');

let server: FastifyInstance;

beforeAll(async () => {
  server = Fastify();
  server.decorateRequest('user', null as never);
  server.addHook('onRequest', async (request) => {
    request.user = { id: '11111111-2222-4333-8444-555555555555', email: 'a@b.fr' };
  });
  await server.register(frontalierRoutes);
  await server.ready();
});

afterAll(() => server.close());

const requete = {
  annee: 2026,
  etatCivil: 'CELIBATAIRE',
  tauxChangeEurChf: '0.93',
  contribuable: { activite: 'SUISSE', salaireBrut: '90000.00', cotisationsSociales: '5800.00' },
  deductions: {},
};

function multipart(fichiers: { nom: string; type: string; contenu: string }[]) {
  const boundary = '----patrimonia-test';
  const corps = fichiers
    .map(
      (f) =>
        `--${boundary}\r\nContent-Disposition: form-data; name="fichiers"; filename="${f.nom}"\r\nContent-Type: ${f.type}\r\n\r\n${f.contenu}\r\n`,
    )
    .join('');
  return {
    payload: `${corps}--${boundary}--\r\n`,
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

describe('POST /api/frontalier/run', () => {
  it('should return the simulation for a valid request', async () => {
    const res = await server.inject({ method: 'POST', url: '/api/frontalier/run', payload: requete });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.test90.eligible).toBe(true);
    expect(Number(body.totalTou)).toBeGreaterThan(0);
  });

  it('should reject a married household without a spouse, in French', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/frontalier/run',
      payload: { ...requete, etatCivil: 'MARIE' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/conjoint/);
  });
});

describe('POST /api/frontalier/documents', () => {
  it('should refuse a request that is not multipart', async () => {
    const res = await server.inject({ method: 'POST', url: '/api/frontalier/documents', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('should report an unsupported format per file without calling the model', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/frontalier/documents',
      ...multipart([{ nom: 'notes.txt', type: 'text/plain', contenu: 'bonjour' }]),
    });
    expect(res.statusCode).toBe(200);
    const [resultat] = res.json();
    expect(resultat.fileName).toBe('notes.txt');
    expect(resultat.extraction).toBeNull();
    expect(resultat.erreur).toMatch(/Format non pris en charge/);
  });
});
