/**
 * The « ce chiffre me semble faux » reports, for the editor: list them, and
 * turn one into a real case of the test suite (src/__tests__/cas-reels/).
 * Reads the database of DATABASE_URL (server/.env), like the server.
 *
 *   npx tsx scripts/signalement-vers-cas.ts --liste
 *   npx tsx scripts/signalement-vers-cas.ts --id <uuid> --cas 2026-ge-couple-b1
 *
 * The household is already anonymised in the database. The comment is NOT
 * copied into the case: it was written by a person and may name them.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import Decimal from 'decimal.js';
import { DecompteReelSchema, FrontalierRequestSchema } from '@shared/frontalier.js';
import { comparerAuDecompte, simulateFrontalier } from '../src/engine/frontalier/index.js';
import { closeDb, db } from '../src/services/db.js';
import { CasReelSchema } from '../src/__tests__/cas-reels/format.js';

const DOSSIER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/__tests__/cas-reels');

const { values } = parseArgs({
  options: {
    liste: { type: 'boolean', default: false },
    id: { type: 'string' },
    cas: { type: 'string' },
    force: { type: 'boolean', default: false },
  },
});

/** Largest gap between the engine of today and the assessment, or null without one. */
function ecartMax(requete: unknown, decompte: unknown): Decimal | null {
  const d = DecompteReelSchema.safeParse(decompte);
  const r = FrontalierRequestSchema.safeParse(requete);
  if (!d.success || !r.success || Object.keys(d.data).length === 0) return null;
  const ecarts = comparerAuDecompte(simulateFrontalier(r.data), d.data);
  return ecarts.reduce((m, e) => Decimal.max(m, new Decimal(e.ecart).abs()), new Decimal(0));
}

async function lister() {
  const rows = await db().signalement.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
  if (rows.length === 0) return console.log('Aucun signalement.');
  for (const s of rows) {
    const ecart = ecartMax(s.requete, s.decompte);
    console.log(
      [
        s.id,
        s.createdAt.toISOString().slice(0, 10),
        `${s.canton} ${s.annee}`,
        ecart ? `ecart max ${ecart.toFixed(0)} CHF` : 'sans decompte',
        s.commentaire ? `« ${s.commentaire.slice(0, 60)}${s.commentaire.length > 60 ? '…' : ''} »` : '',
      ].join('  '),
    );
  }
}

async function versCas(id: string, casId: string) {
  const s = await db().signalement.findUnique({ where: { id } });
  if (!s) throw new Error(`Signalement ${id} introuvable.`);
  const cas = CasReelSchema.parse({
    id: casId,
    description: 'A completer : profil du foyer en une phrase, sans nom.',
    source: {
      annee: s.annee,
      canton: s.canton,
      documents: [`signalement du ${s.createdAt.toISOString().slice(0, 10)} : montants saisis par la personne, a verifier sur ses bordereaux`],
    },
    requete: s.requete,
    attendu: s.decompte,
  });
  const cible = path.join(DOSSIER, `${cas.id}.json`);
  if (fs.existsSync(cible) && !values.force) throw new Error(`${cible} existe deja (--force pour l'ecraser).`);
  fs.writeFileSync(cible, `${JSON.stringify(cas, null, 2)}\n`);
  console.log(`Ecrit : ${path.relative(process.cwd(), cible)}`);
  if (s.commentaire) console.log(`Commentaire (non copie) : « ${s.commentaire} »`);
  console.log('Completez « description », puis : npx vitest run src/__tests__/casReels.test.ts');
}

try {
  if (values.liste) await lister();
  else if (values.id && values.cas) await versCas(values.id, values.cas);
  else {
    console.error('Usage : signalement-vers-cas --liste | --id <uuid> --cas <annee>-<canton>-<profil>');
    process.exitCode = 2;
  }
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
