/**
 * Imports the scenarios saved as JSON files (before the database) into one
 * Supabase account. Run once, inside the server container:
 *
 *   docker compose exec server node dist/server/src/scripts/import-scenarios.js \
 *     --user <uuid Supabase> [--dir /app/server/data/scenarios]
 *
 * The uuid is in Supabase → Authentication → Users. Safe to run again.
 */
import 'dotenv/config';
import { parseArgs } from 'node:util';
import { importerScenarios } from '../services/scenarioImport.js';
import { closeDb } from '../services/db.js';
import { isValidId } from '../services/scenarioStore.js';

const { values } = parseArgs({
  options: {
    user: { type: 'string' },
    dir: { type: 'string', default: '/app/server/data/scenarios' },
  },
});

if (!values.user || !isValidId(values.user)) {
  console.error('Usage : import-scenarios --user <uuid Supabase> [--dir <dossier>]');
  process.exit(2);
}

try {
  const bilan = await importerScenarios(values.dir!, values.user);
  console.log(`Importes      : ${bilan.importes.length}`);
  for (const nom of bilan.importes) console.log(`  + ${nom}`);
  console.log(`Deja presents : ${bilan.dejaPresents.length}`);
  console.log(`Rejetes       : ${bilan.rejetes.length}`);
  for (const r of bilan.rejetes) console.log(`  ! ${r.fichier} : ${r.raison}`);
  process.exitCode = bilan.rejetes.length > 0 ? 1 : 0;
} catch (err) {
  console.error(`Echec de l'import : ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await closeDb();
}
