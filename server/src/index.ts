import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { simulationRoutes } from './routes/simulation.js';
import { listingRoutes } from './routes/listings.js';
import { scenarioRoutes } from './routes/scenarios.js';
import { frontalierRoutes } from './routes/frontalier.js';
import { configRoutes } from './routes/config.js';
import { llmSettingsRoutes } from './routes/llmSettings.js';
import { closeBrowser } from './services/browserFetch.js';
import { closeDb } from './services/db.js';
import { authPlugin } from './plugins/auth.js';
import { diagnostiquerSupabase, formaterDiagnostic } from './services/diagnosticSupabase.js';

const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) {
  // Refuse to start rather than serve the API to anyone.
  console.error('SUPABASE_URL absente : impossible de verifier les connexions. Voir server/.env.example.');
  process.exit(1);
}

const server = Fastify({ logger: true });

await server.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
});

// Before any route: every /api route but /health and /config needs a token.
await server.register(authPlugin, {
  supabaseUrl,
  // Only for a project still signing with its legacy JWT secret (HS256).
  jwtSecret: process.env.SUPABASE_JWT_SECRET || undefined,
});

await server.register(configRoutes);
await server.register(llmSettingsRoutes);

await server.register(simulationRoutes);
await server.register(listingRoutes);
await server.register(scenarioRoutes);
await server.register(frontalierRoutes);

server.get('/api/health', async () => {
  return { status: 'ok' };
});

// The listing fallback keeps a Chrome alive between requests, and Prisma a
// connection pool: do not leave either running when the server goes down.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await closeBrowser();
    await server.close();
    await closeDb();
    process.exit(0);
  });
}

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
    // After listening, and without waiting: a slow or paused Supabase must
    // not hold the app back. The verdict lands in the logs a moment later.
    if (process.env.SUPABASE_DIAGNOSTIC !== 'false') {
      diagnostiquerSupabase({
        supabaseUrl,
        anonKey: process.env.SUPABASE_ANON_KEY || undefined,
        jwtSecret: process.env.SUPABASE_JWT_SECRET || undefined,
      })
        .then((lignes) => console.log(formaterDiagnostic(lignes)))
        .catch((err) => server.log.warn({ err }, 'diagnostic Supabase impossible'));
    }
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
