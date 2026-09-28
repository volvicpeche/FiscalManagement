import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Every Patrimonia table lives in its own Postgres schema, `tax`: the Supabase
 * project is shared with other applications, whose tables sit in `public`.
 * Putting `schema=tax` on the migration URL makes `prisma migrate` create the
 * schema if needed, run the migrations with search_path = tax, and keep its
 * own `_prisma_migrations` table there too — never colliding with another
 * Prisma project in `public`. Keep in sync with DB_SCHEMA (src/services/db.ts).
 */
const DB_SCHEMA = 'tax';

function withSchema(url: string): string {
  const u = new URL(url);
  u.searchParams.set('schema', DB_SCHEMA);
  return u.toString();
}

// `prisma generate` needs no database: fall back to a placeholder so the build
// (Docker, CI) does not require DATABASE_URL. `migrate deploy` does connect,
// and fails loudly on the placeholder.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: withSchema(process.env.DATABASE_URL ?? 'postgresql://localhost:5432/non-configuree'),
  },
});
