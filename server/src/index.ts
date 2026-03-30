import Fastify from 'fastify';
import cors from '@fastify/cors';
import { simulationRoutes } from './routes/simulation.js';

const server = Fastify({ logger: true });

await server.register(cors, {
  origin: 'http://localhost:5173',
});

await server.register(simulationRoutes);

server.get('/api/health', async () => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
