import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { configServeur, fetchApiPublique, messageErreurLlm, type LlmConfig } from '../config.js';

const VARS = ['LLM_PROVIDER', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'OPENAI_COMPATIBLE_API_KEY',
  'OPENAI_COMPATIBLE_BASE_URL', 'OPENAI_COMPATIBLE_MODEL'] as const;
const sauvegarde: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const v of VARS) {
    sauvegarde[v] = process.env[v];
    delete process.env[v];
  }
});
afterEach(() => {
  for (const v of VARS) {
    if (sauvegarde[v] === undefined) delete process.env[v];
    else process.env[v] = sauvegarde[v];
  }
  vi.unstubAllGlobals();
});

describe('configServeur', () => {
  it('should be null without a server key', () => {
    expect(configServeur()).toBeNull();
  });

  it('should read the anthropic key and default the model', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-serveur';
    expect(configServeur()).toEqual({
      provider: 'anthropic', apiKey: 'sk-serveur', model: 'claude-opus-5', baseUrl: undefined, source: 'serveur',
    });
  });

  it('should need a URL and a model for the compatible provider', () => {
    process.env.LLM_PROVIDER = 'openai_compatible';
    process.env.OPENAI_COMPATIBLE_API_KEY = 'k';
    expect(configServeur()).toBeNull();
    process.env.OPENAI_COMPATIBLE_BASE_URL = 'http://localhost:11434/v1';
    process.env.OPENAI_COMPATIBLE_MODEL = 'qwen';
    expect(configServeur()?.baseUrl).toBe('http://localhost:11434/v1');
  });
});

describe('fetchApiPublique', () => {
  it('should refuse plain http', async () => {
    await expect(fetchApiPublique('http://api.exemple.fr/v1/chat')).rejects.toThrow(/https/);
  });

  it('should refuse an internal address', async () => {
    await expect(fetchApiPublique('https://127.0.0.1/v1')).rejects.toThrow(/non autorisee/);
    await expect(fetchApiPublique('https://169.254.169.254/latest')).rejects.toThrow(/non autorisee/);
  });

  it('should refuse to follow a redirect', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://10.0.0.1/' } })));
    await expect(fetchApiPublique('https://93.184.216.34/v1')).rejects.toThrow(/redirection/);
  });

  it('should pass a normal answer through', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"ok":true}', { status: 200 })));
    const res = await fetchApiPublique('https://93.184.216.34/v1');
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('messageErreurLlm', () => {
  const perso: LlmConfig = { provider: 'openai', apiKey: 'k', model: 'gpt-x', source: 'utilisateur' };

  it('should tell the user to check their own key on a 401', () => {
    expect(messageErreurLlm({ status: 401 }, perso)).toMatch(/Cle API refusee par OpenAI.*Cle LLM/);
  });

  it('should not blame the user for the server key', () => {
    expect(messageErreurLlm({ status: 401 }, { ...perso, source: 'serveur' })).toMatch(/administrateur/);
  });

  it('should name the model on a 404', () => {
    expect(messageErreurLlm({ status: 404 }, perso)).toMatch(/gpt-x/);
  });
});
