import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// `prisma generate` needs no database: fall back to a placeholder so the build
// (Docker, CI) does not require DATABASE_URL. `migrate deploy` does connect,
// and fails loudly on the placeholder.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/non-configuree',
  },
});
