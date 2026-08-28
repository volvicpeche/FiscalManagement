import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { simulationRoutes } from './routes/simulation.js';
import { listingRoutes } from './routes/listings.js';
import { closeBrowser } from './services/browserFetch.js';

const server = Fastify({ logger: true });

await server.register(cors, {
  origin: 'http://localhost:5173',
});

await server.register(simulationRoutes);
await server.register(listingRoutes);

server.get('/api/health', async () => {
  return { status: 'ok' };
});

// The listing fallback keeps a Chrome alive between requests; do not leave it
// running when the server goes down.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await closeBrowser();
    await server.close();
    process.exit(0);
  });
}

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
