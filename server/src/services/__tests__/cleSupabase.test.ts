import { describe, it, expect } from 'vitest';
import { natureCleSupabase } from '../cleSupabase.js';
import { cleLegacy as jwt } from '../../__tests__/helpers/cleLegacy.js';

describe('natureCleSupabase', () => {
  it('should recognise the current keys by their prefix', () => {
    expect(natureCleSupabase('sb_publishable_AbCdEf123')).toBe('publishable');
    expect(natureCleSupabase('sb_secret_AbCdEf123')).toBe('secret');
  });

  it('should read the role of a legacy JWT key', () => {
    expect(natureCleSupabase(jwt('anon'))).toBe('anon_legacy');
    expect(natureCleSupabase(jwt('service_role'))).toBe('secret');
  });

  it('should not guess on anything else', () => {
    expect(natureCleSupabase('pas-une-cle')).toBe('inconnue');
    expect(natureCleSupabase('a.b.c')).toBe('inconnue');
  });
});

