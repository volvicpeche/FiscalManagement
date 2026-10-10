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
    expect(body.canton).toBe('GE');
    expect(body.autorite).toBe('AFC-GE');
  });

  it('should refuse Zurich with 422 until its official figures are in the engine', async () => {
    const res = await server.inject({ method: 'POST', url: '/api/frontalier/run', payload: { ...requete, canton: 'ZH' } });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('CANTON_INDISPONIBLE');
    expect(res.json().error).toMatch(/Zurich/);
  });

  it('should refuse a canton outside the list with 400', async () => {
    const res = await server.inject({ method: 'POST', url: '/api/frontalier/run', payload: { ...requete, canton: 'VD' } });
    expect(res.statusCode).toBe(400);
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

  it('should refuse the files until the user has agreed to send them to their provider', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/frontalier/documents',
      ...multipart([{ nom: 'certificat.pdf', type: 'application/pdf', contenu: '%PDF' }]),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: 'CONSENTEMENT_REQUIS' });
  });

  it('should report an unsupported format per file without calling the model', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/frontalier/documents?consentement=oui',
      ...multipart([{ nom: 'notes.txt', type: 'text/plain', contenu: 'bonjour' }]),
    });
    expect(res.statusCode).toBe(200);
    const [resultat] = res.json();
    expect(resultat.fileName).toBe('notes.txt');
    expect(resultat.extraction).toBeNull();
    expect(resultat.erreur).toMatch(/Format non pris en charge/);
  });
});
