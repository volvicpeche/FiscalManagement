import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { FrontalierRequestSchema, type DocumentExtractionResult } from '@shared/frontalier.js';
import { CantonIndisponibleError, simulateFrontalier } from '../engine/frontalier/index.js';
import { extractDocument, mediaTypeAccepte } from '../services/llm/documentExtractor.js';
import { messageErreurLlm } from '../services/llm/config.js';
import { reserverQuota, resoudreLlm } from './llmAcces.js';

const MAX_FICHIER = 10 * 1024 * 1024;
const MAX_FICHIERS = 10;

export async function frontalierRoutes(server: FastifyInstance) {
  await server.register(multipart, {
    limits: { fileSize: MAX_FICHIER, files: MAX_FICHIERS },
  });

  server.post('/api/frontalier/run', async (request, reply) => {
    const parsed = FrontalierRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      const specific = parsed.error.issues.find((i) => i.message !== 'Invalid input');
      return reply.status(400).send({
        error: specific?.message ?? 'Parametres de simulation invalides',
        details: parsed.error.flatten(),
      });
    }

    try {
      return simulateFrontalier(parsed.data);
    } catch (err) {
      // A canton on the list whose official figures are not in the engine yet.
      if (err instanceof CantonIndisponibleError) {
        return reply.status(422).send({ error: err.message, code: 'CANTON_INDISPONIBLE' });
      }
      throw err;
    }
  });

  /**
   * Reads uploaded tax documents. Files stay in memory and are never written
   * to disk: only the extracted figures leave this handler, and only the
   * user decides whether they go into a saved scenario.
   */
  server.post('/api/frontalier/documents', async (request, reply) => {
    if (!request.isMultipart()) {
      return reply.status(400).send({ error: 'Envoyez les documents en multipart/form-data' });
    }

    // No usable key: refuse before receiving a single byte of the files.
    const config = await resoudreLlm(request, reply, 'document');
    if (!config) return reply;

    const recus: { fileName: string; mime: string; buffer: Buffer }[] = [];
    try {
      for await (const part of request.files()) {
        const buffer = await part.toBuffer();
        recus.push({ fileName: part.filename, mime: part.mimetype, buffer });
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.status(413).send({ error: 'Un fichier depasse 10 Mo' });
      }
      if (code === 'FST_FILES_LIMIT') {
        return reply.status(413).send({ error: `${MAX_FICHIERS} fichiers au maximum par envoi` });
      }
      throw err;
    }

    if (recus.length === 0) {
      return reply.status(400).send({ error: 'Aucun fichier recu' });
    }

    // One paid call per readable file. On the server's key they are booked
    // all at once: a batch that would overflow the quota is refused whole
    // rather than half read.
    const payants = recus.filter((r) => mediaTypeAccepte(r.mime)).length;
    if (payants > 0 && !(await reserverQuota(request, reply, config, payants))) return reply;

    // One call per file, in parallel: a failed read is reported for that file
    // and never sinks the others.
    const resultats = await Promise.all(
      recus.map(async ({ fileName, mime, buffer }): Promise<DocumentExtractionResult> => {
        if (!mediaTypeAccepte(mime)) {
          return { fileName, extraction: null, erreur: `Format non pris en charge (${mime}) : PDF, JPEG, PNG ou WebP` };
        }
        try {
          return { fileName, extraction: await extractDocument(buffer, mime, fileName, config), erreur: null };
        } catch (err) {
          request.log.warn({ err, fileName }, 'lecture de document echouee');
          return { fileName, extraction: null, erreur: messageErreurLlm(err, config) };
        }
      }),
    );

    return resultats;
  });
}
