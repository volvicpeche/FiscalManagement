import { db } from './db.js';

/**
 * Daily quota of paid LLM calls per user (listing analysis, document reading).
 * Sign-up is open: without it any account could spend the server's API key.
 * nginx still rate-limits per IP; this one follows the account.
 *
 * Raw SQL: the table is qualified with its schema (see DB_SCHEMA in db.ts).
 */
export const LLM_QUOTA_JOUR = Number(process.env.LLM_QUOTA_JOUR ?? 20);

export class QuotaLlmAtteintError extends Error {
  constructor() {
    super(`Quota de ${LLM_QUOTA_JOUR} analyses par jour atteint. Reessayez demain.`);
    this.name = 'QuotaLlmAtteintError';
  }
}

/** The UTC calendar day, as a DATE column expects it. */
export function jourUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Books `n` calls for today, or throws without booking anything if they would
 * exceed the quota. One atomic statement: two concurrent requests cannot both
 * slip under the ceiling.
 */
export async function consommerQuota(userId: string, n = 1, now: Date = new Date()): Promise<void> {
  const jour = jourUtc(now);
  const rows = await db().$queryRaw<{ appels: number }[]>`
    INSERT INTO tax.llm_usage (user_id, jour, appels)
    SELECT ${userId}::uuid, ${jour}::date, ${n}
    WHERE ${n} <= ${LLM_QUOTA_JOUR}
    ON CONFLICT (user_id, jour) DO UPDATE
      SET appels = tax.llm_usage.appels + EXCLUDED.appels
      WHERE tax.llm_usage.appels + EXCLUDED.appels <= ${LLM_QUOTA_JOUR}
    RETURNING appels`;
  if (rows.length === 0) throw new QuotaLlmAtteintError();
}
