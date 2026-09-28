import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * The one Prisma client of the process, created on first use.
 *
 * Lazy on purpose: the engine routes (/run, /frontalier/run, presets) need no
 * database, and neither do their tests. Only the routes that store something
 * open a connection.
 *
 * On Supabase, DATABASE_URL is the SESSION pooler (Supavisor, port 5432): the
 * direct connection is IPv6-only, and the transaction pooler (6543) does not
 * support the prepared statements Prisma uses.
 */
let client: PrismaClient | null = null;

/**
 * The Postgres schema holding every Patrimonia table. The Supabase project is
 * shared with other applications (their tables are in `public`), so nothing of
 * ours goes there. Raw SQL must qualify its tables with it: the adapter option
 * below only applies to the queries Prisma generates. Keep in sync with
 * prisma.config.ts, which applies the migrations to the same schema.
 */
export const DB_SCHEMA = 'tax';

export function db(): PrismaClient {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL absente : la base de donnees n est pas configuree.');
    }
    client = new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema: DB_SCHEMA }) });
  }
  return client;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}
