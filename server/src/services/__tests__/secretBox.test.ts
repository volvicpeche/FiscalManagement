import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import { chiffrer, dechiffrer, stockageDisponible, StockageClesIndisponibleError } from '../secretBox.js';

const ORIGINAL = process.env.LLM_KEYS_SECRET;
const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  process.env.LLM_KEYS_SECRET = randomBytes(32).toString('base64');
});
afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.LLM_KEYS_SECRET;
  else process.env.LLM_KEYS_SECRET = ORIGINAL;
});

describe('secretBox', () => {
  it('should round-trip a key for its owner', () => {
    const blob = chiffrer('sk-ant-api03-secret', ALICE);
    expect(blob).not.toContain('secret');
    expect(dechiffrer(blob, ALICE)).toBe('sk-ant-api03-secret');
  });

  it('should never produce the same ciphertext twice', () => {
    expect(chiffrer('sk-meme-cle', ALICE)).not.toBe(chiffrer('sk-meme-cle', ALICE));
  });

  it('should refuse to decrypt for another owner', () => {
    const blob = chiffrer('sk-ant-api03-secret', ALICE);
    expect(() => dechiffrer(blob, BOB)).toThrow();
  });

  it('should refuse a tampered ciphertext', () => {
    const [v, iv, tag, c] = chiffrer('sk-ant-api03-secret', ALICE).split('.');
    const altere = Buffer.from(c, 'base64url');
    altere[0] ^= 1;
    expect(() => dechiffrer([v, iv, tag, altere.toString('base64url')].join('.'), ALICE)).toThrow();
  });

  it('should refuse to decrypt with another server key', () => {
    const blob = chiffrer('sk-ant-api03-secret', ALICE);
    process.env.LLM_KEYS_SECRET = randomBytes(32).toString('base64');
    expect(() => dechiffrer(blob, ALICE)).toThrow();
  });

  it('should report storage as unavailable without a valid LLM_KEYS_SECRET', () => {
    delete process.env.LLM_KEYS_SECRET;
    expect(stockageDisponible()).toBe(false);
    expect(() => chiffrer('x', ALICE)).toThrow(StockageClesIndisponibleError);

    process.env.LLM_KEYS_SECRET = Buffer.from('trop courte').toString('base64');
    expect(stockageDisponible()).toBe(false);
  });
});
