import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { hasDb, createUser, deleteCreatedUsers } from '../../__tests__/helpers/testDb.js';
import { importerScenarios } from '../scenarioImport.js';
import { listScenarios, getScenario } from '../scenarioStore.js';
import { closeDb } from '../db.js';

describe.skipIf(!hasDb)('importerScenarios (Postgres)', () => {
  let dir: string;

  const fichier = (id: string, nom: string, updatedAt: string) => ({
    id, nom, kind: 'sci', version: 1, createdAt: '2026-01-10T09:00:00.000Z', updatedAt, data: { prix: '100000.00' },
  });
  const A = '0a4c1e2f-1111-4aaa-8aaa-000000000001';
  const B = '0a4c1e2f-1111-4aaa-8aaa-000000000002';

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'patrimonia-import-'));
    await writeFile(path.join(dir, `${A}.json`), JSON.stringify(fichier(A, 'Ancien', '2026-02-01T00:00:00.000Z')));
    await writeFile(path.join(dir, `${B}.json`), JSON.stringify(fichier(B, 'Recent', '2026-03-01T00:00:00.000Z')));
    await writeFile(path.join(dir, 'casse.json'), '{ pas du json');
    await writeFile(path.join(dir, 'inconnu.json'), JSON.stringify({ nom: 'sans id' }));
    await writeFile(path.join(dir, 'notes.txt'), 'ignore');
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
    await deleteCreatedUsers();
    await closeDb();
  });

  it('should import valid files, keep ids and dates, and report the rest', async () => {
    const user = await createUser();
    const bilan = await importerScenarios(dir, user);

    expect(bilan.importes.sort()).toEqual(['Ancien', 'Recent']);
    expect(bilan.rejetes.map((r) => r.fichier).sort()).toEqual(['casse.json', 'inconnu.json']);

    expect((await listScenarios(user)).map((s) => s.nom)).toEqual(['Recent', 'Ancien']);
    const ancien = await getScenario(user, A);
    expect(ancien?.createdAt).toBe('2026-01-10T09:00:00.000Z');
    expect(ancien?.data).toEqual({ prix: '100000.00' });

    // Run again: nothing duplicated.
    const encore = await importerScenarios(dir, user);
    expect(encore.importes).toEqual([]);
    expect(encore.dejaPresents.sort()).toEqual(['Ancien', 'Recent']);
    expect(await listScenarios(user)).toHaveLength(2);
  });
});
