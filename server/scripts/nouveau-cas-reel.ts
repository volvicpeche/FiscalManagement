/**
 * Prepares a real case for the test suite (src/__tests__/cas-reels/) from
 * the export a colleague downloads in « Mon compte », or from a raw request.
 *
 *   npx tsx scripts/nouveau-cas-reel.ts --export patrimonia-export.json \
 *     --id 2026-ge-couple-c1 [--scenario "TOU 2026"] [--description "..."]
 *   npx tsx scripts/nouveau-cas-reel.ts --requete requete.json --id ...
 *
 * The file it writes is anonymised (no first name, no property label) and
 * its `attendu` is empty: fill it with the lines of the bordereaux. The
 * engine's own figures are printed alongside, to spot a gap at once.
 * `--exemple` copies the engine's figures into `attendu` instead: a format
 * sample, flagged as such, never a real case.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { FrontalierRequestSchema, anonymiserFoyer, type DecompteReel, type FrontalierRequestInput } from '@shared/frontalier.js';
import { buildFrontalierRequest, useFrontalierStore } from '@/store/frontalierStore';
import { CHAMPS_DECOMPTE, simulateFrontalier } from '../src/engine/frontalier/index.js';
import { CasReelSchema } from '../src/__tests__/cas-reels/format.js';

const DOSSIER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/__tests__/cas-reels');

const { values } = parseArgs({
  options: {
    export: { type: 'string' },
    scenario: { type: 'string' },
    requete: { type: 'string' },
    id: { type: 'string' },
    description: { type: 'string', default: 'A completer : profil du foyer, sans nom.' },
    exemple: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
  },
});

function arreter(message: string): never {
  console.error(message);
  process.exit(2);
}

if (!values.id || (!values.export && !values.requete)) {
  arreter('Usage : nouveau-cas-reel --id <annee>-<canton>-<profil> (--export <export.json> [--scenario <nom>] | --requete <requete.json>)');
}

/** The household as the simulator would send it, from a saved frontalier scenario. */
function depuisExport(fichier: string, nom?: string): FrontalierRequestInput {
  const contenu = JSON.parse(fs.readFileSync(fichier, 'utf8')) as {
    scenarios?: { nom: string; kind: string; data: Record<string, unknown> }[];
  };
  const candidats = (contenu.scenarios ?? []).filter((s) => s.kind === 'frontalier' && (!nom || s.nom === nom));
  if (candidats.length === 0) arreter(`Aucun scenario frontalier${nom ? ` nomme « ${nom} »` : ''} dans ${fichier}.`);
  if (candidats.length > 1) {
    arreter(`Plusieurs scenarios frontalier, precisez --scenario :\n${candidats.map((s) => `  - ${s.nom}`).join('\n')}`);
  }
  // The store's own loading: migrations of older saves included.
  useFrontalierStore.getState().hydrate(candidats[0].data as never);
  return buildFrontalierRequest(useFrontalierStore.getState());
}

const brute = values.export
  ? depuisExport(values.export, values.scenario)
  : (JSON.parse(fs.readFileSync(values.requete!, 'utf8')) as FrontalierRequestInput);
const requete = anonymiserFoyer(brute);
const parsee = FrontalierRequestSchema.parse(requete);
const resultat = simulateFrontalier(parsee);

const calcule = Object.fromEntries(
  Object.entries(CHAMPS_DECOMPTE).map(([champ, { lire }]) => [champ, lire(resultat)]),
) as Required<DecompteReel>;

const cas = CasReelSchema.parse({
  id: values.id,
  description: values.exemple ? `${values.description} Exemple : chiffres du moteur, pas un decompte.` : values.description,
  exemple: values.exemple,
  source: {
    annee: parsee.annee,
    canton: parsee.canton,
    documents: values.exemple ? ['aucun : exemple de format'] : ['A completer : bordereau ICC, bordereau IFD'],
  },
  requete,
  attendu: values.exemple ? calcule : {},
  tolerance: '5.00',
});

const cible = path.join(DOSSIER, `${cas.id}.json`);
if (fs.existsSync(cible) && !values.force) arreter(`${cible} existe deja (--force pour l'ecraser).`);
fs.writeFileSync(cible, `${JSON.stringify(cas, null, 2)}\n`);

console.log(`Ecrit : ${path.relative(process.cwd(), cible)}\n`);
console.log('Ce que calcule le moteur, a comparer aux bordereaux :');
for (const [champ, { libelle }] of Object.entries(CHAMPS_DECOMPTE)) {
  console.log(`  ${champ.padEnd(20)} ${libelle.padEnd(34)} ${calcule[champ as keyof DecompteReel].padStart(12)} CHF`);
}
if (!values.exemple) {
  console.log('\nReportez dans « attendu » les lignes lues sur les bordereaux (les autres restent absentes),');
  console.log('completez « description » et « source.documents », puis : npx vitest run src/__tests__/casReels.test.ts');
}
