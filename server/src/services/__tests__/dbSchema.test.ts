import { describe, it, expect, afterAll } from 'vitest';
import { hasDb } from '../../__tests__/helpers/testDb.js';
import { db, closeDb, DB_SCHEMA } from '../db.js';

// The Supabase project is shared with other applications: every Patrimonia
// table, the migration history included, must sit in its own schema.
describe.skipIf(!hasDb)('schema `tax` (Postgres)', () => {
  afterAll(() => closeDb());

  it('should keep every table of ours in the tax schema', async () => {
    const rows = await db().$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = ${DB_SCHEMA} ORDER BY table_name`;
    expect(rows.map((r) => r.table_name)).toEqual(['_prisma_migrations', 'llm_settings', 'llm_usage', 'scenarios']);
  });

  it('should create nothing in public', async () => {
    const rows = await db().$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('_prisma_migrations', 'scenarios', 'llm_usage', 'llm_settings')`;
    expect(rows).toEqual([]);
  });

  it('should give the Data API roles no access to the schema', async () => {
    const [row] = await db().$queryRaw<{ anon: boolean; authenticated: boolean }[]>`
      SELECT has_schema_privilege('anon', ${DB_SCHEMA}, 'USAGE') AS anon,
             has_schema_privilege('authenticated', ${DB_SCHEMA}, 'USAGE') AS authenticated`;
    expect(row).toEqual({ anon: false, authenticated: false });
  });
});
