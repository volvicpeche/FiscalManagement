import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveLlmProvider } from '../index.js';

const ORIGINAL = process.env.LLM_PROVIDER;

beforeEach(() => {
  delete process.env.LLM_PROVIDER;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.LLM_PROVIDER;
  else process.env.LLM_PROVIDER = ORIGINAL;
});

describe('resolveLlmProvider', () => {
  it('should default to anthropic when unset', () => {
    expect(resolveLlmProvider()).toBe('anthropic');
  });

  it('should accept every documented provider, case-insensitively', () => {
    process.env.LLM_PROVIDER = 'OpenAI';
    expect(resolveLlmProvider()).toBe('openai');

    process.env.LLM_PROVIDER = 'gemini';
    expect(resolveLlmProvider()).toBe('gemini');

    process.env.LLM_PROVIDER = 'openai_compatible';
    expect(resolveLlmProvider()).toBe('openai_compatible');
  });

  it('should reject an unknown provider with a clear message', () => {
    process.env.LLM_PROVIDER = 'qwen';
    expect(() => resolveLlmProvider()).toThrow(/LLM_PROVIDER invalide/);
  });
});
