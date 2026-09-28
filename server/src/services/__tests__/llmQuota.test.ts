import { describe, it, expect, afterAll } from 'vitest';
import { hasDb, createUser, deleteCreatedUsers } from '../../__tests__/helpers/testDb.js';

process.env.LLM_QUOTA_JOUR = '3';
const { consommerQuota, jourUtc, QuotaLlmAtteintError } = await import('../llmQuota.js');
const { closeDb } = await import('../db.js');

describe('jourUtc', () => {
  it('should cut the day at midnight UTC', () => {
    expect(jourUtc(new Date('2026-09-28T23:30:00-02:00')).toISOString()).toBe('2026-09-29T00:00:00.000Z');
  });
});

describe.skipIf(!hasDb)('consommerQuota (Postgres)', () => {
  afterAll(async () => {
    await deleteCreatedUsers();
    await closeDb();
  });

  const lundi = new Date('2026-09-28T10:00:00Z');
  const mardi = new Date('2026-09-29T08:00:00Z');

  it('should allow calls up to the quota, then refuse', async () => {
    const user = await createUser();
    for (let i = 0; i < 3; i++) await consommerQuota(user, 1, lundi);
    await expect(consommerQuota(user, 1, lundi)).rejects.toBeInstanceOf(QuotaLlmAtteintError);
  });

  it('should start again the next day', async () => {
    const user = await createUser();
    for (let i = 0; i < 3; i++) await consommerQuota(user, 1, lundi);
    await expect(consommerQuota(user, 1, mardi)).resolves.toBeUndefined();
  });

  it('should refuse a batch that would overflow, without booking any of it', async () => {
    const user = await createUser();
    await consommerQuota(user, 2, lundi);
    await expect(consommerQuota(user, 2, lundi)).rejects.toBeInstanceOf(QuotaLlmAtteintError);
    // The refused batch booked nothing: one call is still left.
    await expect(consommerQuota(user, 1, lundi)).resolves.toBeUndefined();
  });

  it('should refuse a first batch larger than the quota', async () => {
    const user = await createUser();
    await expect(consommerQuota(user, 4, lundi)).rejects.toBeInstanceOf(QuotaLlmAtteintError);
  });

  it('should not let concurrent calls slip past the quota', async () => {
    const user = await createUser();
    const res = await Promise.allSettled(Array.from({ length: 10 }, () => consommerQuota(user, 1, lundi)));
    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
  });

  it('should keep users apart', async () => {
    const a = await createUser();
    const b = await createUser();
    for (let i = 0; i < 3; i++) await consommerQuota(a, 1, lundi);
    await expect(consommerQuota(b, 1, lundi)).resolves.toBeUndefined();
  });
});
