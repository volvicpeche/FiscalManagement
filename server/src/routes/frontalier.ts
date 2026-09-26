import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { FrontalierRequestSchema, type DocumentExtractionResult } from '@shared/frontalier.js';
import { simulateFrontalier } from '../engine/frontalierGe.js';
import { extractDocument, mediaTypeAccepte } from '../services/llm/documentExtractor.js';

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

    return simulateFrontalier(parsed.data);
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

    // One call per file, in parallel: a failed read is reported for that file
    // and never sinks the others.
    const resultats = await Promise.all(
      recus.map(async ({ fileName, mime, buffer }): Promise<DocumentExtractionResult> => {
        if (!mediaTypeAccepte(mime)) {
          return { fileName, extraction: null, erreur: `Format non pris en charge (${mime}) : PDF, JPEG, PNG ou WebP` };
        }
        try {
          return { fileName, extraction: await extractDocument(buffer, mime, fileName), erreur: null };
        } catch (err) {
          request.log.warn({ err, fileName }, 'lecture de document echouee');
          return { fileName, extraction: null, erreur: err instanceof Error ? err.message : 'Lecture echouee' };
        }
      }),
    );

    return resultats;
  });
}
