import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import { hasDb, createUser, deleteCreatedUsers } from '../../__tests__/helpers/testDb.js';
import {
  enregistrerParametresLlm, lireParametresLlm, supprimerParametresLlm, resoudreConfigLlm,
  LlmNonConfigureError, ParametresLlmInvalidesError,
} from '../llmSettings.js';
import { db, closeDb } from '../db.js';

const ENV = ['LLM_KEYS_SECRET', 'LLM_SERVER_KEY_EMAILS', 'LLM_PROVIDER', 'ANTHROPIC_API_KEY'] as const;
const sauvegarde = Object.fromEntries(ENV.map((v) => [v, process.env[v]]));

describe.skipIf(!hasDb)('llmSettings (Postgres)', () => {
  let alice: { id: string; email: string };
  let bob: { id: string; email: string };

  beforeEach(async () => {
    process.env.LLM_KEYS_SECRET = randomBytes(32).toString('base64');
    process.env.LLM_SERVER_KEY_EMAILS = 'Proprio@Exemple.fr, autre@exemple.fr';
    process.env.LLM_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'sk-cle-du-serveur';
    alice = { id: await createUser(), email: 'alice@exemple.fr' };
    bob = { id: await createUser(), email: 'proprio@exemple.fr' };
  });

  afterAll(async () => {
    for (const v of ENV) {
      if (sauvegarde[v] === undefined) delete process.env[v];
      else process.env[v] = sauvegarde[v];
    }
    await deleteCreatedUsers();
    await closeDb();
  });

  it('should store the key encrypted and never give it back', async () => {
    const vue = await enregistrerParametresLlm(alice, { provider: 'openai', apiKey: 'sk-proj-abcdefgh1234' });
    expect(vue).toMatchObject({ configuree: true, provider: 'openai', cleFin: '1234', cleServeurAutorisee: false });
    expect(JSON.stringify(vue)).not.toContain('abcdefgh');

    const row = await db().llmSettings.findUniqueOrThrow({ where: { userId: alice.id } });
    expect(row.cleChiffree).not.toContain('abcdefgh');
  });

  it("should resolve the user's own key, with the default model", async () => {
    await enregistrerParametresLlm(alice, { provider: 'openai', apiKey: 'sk-proj-abcdefgh1234' });
    expect(await resoudreConfigLlm(alice, 'annonce')).toEqual({
      provider: 'openai', apiKey: 'sk-proj-abcdefgh1234', model: 'gpt-4o-mini', baseUrl: undefined, source: 'utilisateur',
    });
  });

  it('should keep the stored key when only the model changes', async () => {
    await enregistrerParametresLlm(alice, { provider: 'anthropic', apiKey: 'sk-ant-api03-zzzz9876' });
    await enregistrerParametresLlm(alice, { provider: 'anthropic', model: 'claude-haiku-4-5' });
    const config = await resoudreConfigLlm(alice, 'annonce');
    expect(config.apiKey).toBe('sk-ant-api03-zzzz9876');
    expect(config.model).toBe('claude-haiku-4-5');
  });

  it('should demand a new key when the provider changes', async () => {
    await enregistrerParametresLlm(alice, { provider: 'anthropic', apiKey: 'sk-ant-api03-zzzz9876' });
    await expect(enregistrerParametresLlm(alice, { provider: 'gemini' })).rejects.toBeInstanceOf(ParametresLlmInvalidesError);
  });

  it('should refuse a compatible API on an internal address', async () => {
    await expect(
      enregistrerParametresLlm(alice, {
        provider: 'openai_compatible', apiKey: 'sk-local-123456', model: 'm', baseUrl: 'https://127.0.0.1:11434/v1',
      }),
    ).rejects.toBeInstanceOf(ParametresLlmInvalidesError);
  });

  it('should refuse a user with no key who is not on the allow-list', async () => {
    await expect(resoudreConfigLlm(alice, 'annonce')).rejects.toBeInstanceOf(LlmNonConfigureError);
  });

  it("should serve an allow-listed user with the server's key, whatever the e-mail case", async () => {
    const config = await resoudreConfigLlm(bob, 'annonce');
    expect(config).toMatchObject({ source: 'serveur', apiKey: 'sk-cle-du-serveur' });
    expect((await lireParametresLlm(bob)).cleServeurAutorisee).toBe(true);
  });

  it('should need Anthropic to read documents', async () => {
    await enregistrerParametresLlm(alice, { provider: 'openai', apiKey: 'sk-proj-abcdefgh1234' });
    await expect(resoudreConfigLlm(alice, 'document')).rejects.toThrow(/Anthropic/);

    // An allow-listed user with an OpenAI key falls back on the server's Anthropic key.
    await enregistrerParametresLlm(bob, { provider: 'openai', apiKey: 'sk-proj-abcdefgh1234' });
    expect(await resoudreConfigLlm(bob, 'document')).toMatchObject({ provider: 'anthropic', source: 'serveur' });
  });

  it('should ask for the key again when LLM_KEYS_SECRET changed', async () => {
    await enregistrerParametresLlm(alice, { provider: 'openai', apiKey: 'sk-proj-abcdefgh1234' });
    process.env.LLM_KEYS_SECRET = randomBytes(32).toString('base64');
    await expect(resoudreConfigLlm(alice, 'annonce')).rejects.toThrow(/Saisissez-la a nouveau/);
  });

  it("should never hand one user another's key", async () => {
    await enregistrerParametresLlm(alice, { provider: 'openai', apiKey: 'sk-proj-abcdefgh1234' });
    const carol = { id: await createUser(), email: 'carol@exemple.fr' };
    await expect(resoudreConfigLlm(carol, 'annonce')).rejects.toBeInstanceOf(LlmNonConfigureError);
    // Even with the row copied onto her: the ciphertext is bound to Alice.
    const row = await db().llmSettings.findUniqueOrThrow({ where: { userId: alice.id } });
    await db().llmSettings.create({ data: { ...row, userId: carol.id } });
    await expect(resoudreConfigLlm(carol, 'annonce')).rejects.toBeInstanceOf(LlmNonConfigureError);
  });

  it('should forget the key on deletion', async () => {
    await enregistrerParametresLlm(alice, { provider: 'openai', apiKey: 'sk-proj-abcdefgh1234' });
    await supprimerParametresLlm(alice.id);
    expect((await lireParametresLlm(alice)).configuree).toBe(false);
  });
});
