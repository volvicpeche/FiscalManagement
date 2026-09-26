#!/usr/bin/env node
/**
 * Turns the AFC source-tax tariff file (tarJJkt.txt, record format
 * "Structure et formats d'enregistrement des bareme de l'impot a la source",
 * valable des 2025) into a compact TypeScript module the engine imports.
 *
 * Only the rate change-points are kept: the raw file lists every CHF 50 step,
 * most of which repeat the previous rate.
 *
 *   node server/scripts/generate-tarif-source.mjs \
 *     server/src/engine/tarifs/tar26ge.txt server/src/engine/tarifs/tarifSourceGe2026.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: generate-tarif-source.mjs <tarJJkt.txt> <sortie.ts>');
  process.exit(1);
}

const KEEP = /^(A[0-5]|B[0-5]|C[0-5]|H[1-5])N$/;
const tariffs = new Map();
let validFrom = null;

for (const line of readFileSync(input, 'latin1').split(/\r?\n/)) {
  if (!line.startsWith('06')) continue;
  const code = line.slice(6, 16).trim();
  if (!KEEP.test(code)) continue;

  validFrom ??= line.slice(16, 24);
  const fromCentimes = Number(line.slice(24, 33));
  const rateBp = Number(line.slice(54, 59)); // impot en %, 2 decimales

  const key = code.slice(0, 2);
  const rows = tariffs.get(key) ?? [];
  if (rows.length === 0 || rows[rows.length - 1][1] !== rateBp) rows.push([fromCentimes, rateBp]);
  tariffs.set(key, rows);
}

for (const rows of tariffs.values()) rows.sort((a, b) => a[0] - b[0]);

const body = [...tariffs.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([code, rows]) => `  ${code}: [${rows.map(([f, r]) => `[${f},${r}]`).join(',')}],`)
  .join('\n');

writeFileSync(
  output,
  `// GENERE par server/scripts/generate-tarif-source.mjs a partir de ${input.split('/').pop()}.
// Ne pas modifier a la main : regenerer depuis le fichier officiel de l'AFC.

/** Date initiale de validite du fichier source (AAAAMMJJ). */
export const TARIF_SOURCE_VALIDITE = '${validFrom}';

/**
 * Par code de bareme : points de changement du taux, sous la forme
 * [revenu mensuel des, en centimes ; taux en points de base (1 % = 100)].
 */
export const TARIF_SOURCE: Record<string, [number, number][]> = {
${body}
};
`,
);

console.log(`${tariffs.size} baremes ecrits dans ${output}`);
