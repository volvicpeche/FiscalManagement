import { randomUUID } from 'node:crypto';
import { db } from '../../services/db.js';

/**
 * Tests that need Postgres run against DATABASE_URL, migrated beforehand
 * (prisma/test/supabase-auth-stub.sql, then `prisma migrate deploy`: see
 * ci.yml). Without it they are skipped, so `npx vitest` still works on a
 * machine with no database.
 *
 * Test files run in parallel on the same database: each one works with users
 * of its own and only ever deletes those, never the whole table.
 */
export const hasDb = Boolean(process.env.DATABASE_URL);

const created = new Set<string>();

/** A user as Supabase would have created it, so the foreign keys hold. */
export async function createUser(id: string = randomUUID()): Promise<string> {
  await db().$executeRaw`INSERT INTO auth.users (id) VALUES (${id}::uuid)`;
  created.add(id);
  return id;
}

/** Deletes the users this file created; their rows follow (ON DELETE CASCADE). */
export async function deleteCreatedUsers(): Promise<void> {
  if (created.size === 0) return;
  const ids = [...created];
  created.clear();
  await db().$executeRaw`DELETE FROM auth.users WHERE id = ANY(${ids}::uuid[])`;
}
