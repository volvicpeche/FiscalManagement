import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { SavedScenarioSchema } from '@shared/scenario.js';
import type { Prisma } from '../generated/prisma/client.js';
import { db } from './db.js';

/**
 * One-off import of the scenarios saved as JSON files before the database
 * (one file per scenario, `<id>.json`, in the `scenarios` volume) into the
 * account of one user.
 *
 * Idempotent: a scenario whose id is already in the database is left as is,
 * so the import can be run again after a partial failure. Ids and dates are
 * kept, so the list comes back in the same order.
 */
export interface BilanImport {
  importes: string[];
  dejaPresents: string[];
  rejetes: { fichier: string; raison: string }[];
}

export async function importerScenarios(dir: string, userId: string): Promise<BilanImport> {
  const bilan: BilanImport = { importes: [], dejaPresents: [], rejetes: [] };
  const fichiers = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();

  for (const fichier of fichiers) {
    let brut: unknown;
    try {
      brut = JSON.parse(await readFile(path.join(dir, fichier), 'utf8'));
    } catch (err) {
      bilan.rejetes.push({ fichier, raison: `JSON illisible : ${(err as Error).message}` });
      continue;
    }

    const parsed = SavedScenarioSchema.safeParse(brut);
    if (!parsed.success) {
      bilan.rejetes.push({ fichier, raison: parsed.error.issues[0]?.message ?? 'format inconnu' });
      continue;
    }

    const s = parsed.data;
    const { count } = await db().scenario.createMany({
      data: [
        {
          id: s.id,
          userId,
          nom: s.nom,
          kind: s.kind,
          version: s.version,
          data: s.data as Prisma.InputJsonObject,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        },
      ],
      skipDuplicates: true,
    });
    (count === 1 ? bilan.importes : bilan.dejaPresents).push(s.nom);
  }

  return bilan;
}
