import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { hasDb, createUser, deleteCreatedUsers } from '../../__tests__/helpers/testDb.js';

// Read at import time by the store.
process.env.MAX_SCENARIOS = '5';

const {
  saveScenario, getScenario, updateScenario, deleteScenario, listScenarios, isValidId,
  TropDeScenariosError,
} = await import('../scenarioStore.js');
const { db, closeDb } = await import('../db.js');

const payload = (over: Record<string, unknown> = {}) => ({
  nom: 'Mon scenario',
  kind: 'sci' as const,
  data: { asset: { purchasePrice: '200000.00' }, ...over },
});

const INCONNU = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

describe('isValidId', () => {
  it('should accept a uuid', () => {
    expect(isValidId(INCONNU)).toBe(true);
  });

  it('should reject anything that is not a uuid', () => {
    expect(isValidId('../../etc/passwd')).toBe(false);
    expect(isValidId('scenario')).toBe(false);
    expect(isValidId('')).toBe(false);
  });
});

describe.skipIf(!hasDb)('scenarioStore (Postgres)', () => {
  let alice: string;
  let bob: string;

  beforeEach(async () => {
    await deleteCreatedUsers();
    alice = await createUser();
    bob = await createUser();
  });

  afterAll(async () => {
    await deleteCreatedUsers();
    await closeDb();
  });

  describe('saveScenario', () => {
    it('should return the saved scenario with an id and timestamps', async () => {
      const s = await saveScenario(alice, payload());
      expect(isValidId(s.id)).toBe(true);
      expect(s.nom).toBe('Mon scenario');
      expect(s.version).toBe(1);
      expect(s.createdAt).toBe(s.updatedAt);
    });

    it('should round-trip the payload untouched', async () => {
      const data = { a: 1, b: 'deux', c: { d: [1, 2, 3] }, e: null };
      const saved = await saveScenario(alice, { nom: 'X', kind: 'saisonnier', data });
      const loaded = await getScenario(alice, saved.id);
      expect(loaded?.data).toEqual(data);
    });

    it('should give each save its own id', async () => {
      const a = await saveScenario(alice, payload());
      const b = await saveScenario(alice, payload());
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('getScenario', () => {
    it('should return null for an unknown id', async () => {
      expect(await getScenario(alice, INCONNU)).toBeNull();
    });

    it('should return null rather than throw on a malformed id', async () => {
      expect(await getScenario(alice, 'pas-un-uuid')).toBeNull();
    });

    it('should return null for a row no schema accepts any more', async () => {
      const saved = await saveScenario(alice, payload());
      await db().scenario.update({ where: { id: saved.id }, data: { kind: 'disparu' } });
      expect(await getScenario(alice, saved.id)).toBeNull();
    });
  });

  describe('updateScenario', () => {
    it('should overwrite the payload and move updatedAt', async () => {
      const saved = await saveScenario(alice, payload());
      await new Promise((r) => setTimeout(r, 5));
      const updated = await updateScenario(alice, saved.id, {
        nom: 'Renomme',
        kind: 'sci',
        data: { asset: { purchasePrice: '300000.00' } },
      });

      expect(updated?.nom).toBe('Renomme');
      expect(updated?.createdAt).toBe(saved.createdAt);
      expect(updated?.updatedAt).not.toBe(saved.updatedAt);
      expect((updated?.data.asset as Record<string, string>).purchasePrice).toBe('300000.00');
    });

    it('should return null for an unknown id', async () => {
      expect(await updateScenario(alice, INCONNU, payload())).toBeNull();
    });
  });

  describe('deleteScenario', () => {
    it('should remove the scenario', async () => {
      const saved = await saveScenario(alice, payload());
      expect(await deleteScenario(alice, saved.id)).toBe(true);
      expect(await getScenario(alice, saved.id)).toBeNull();
    });

    it('should report false for an unknown id', async () => {
      expect(await deleteScenario(alice, INCONNU)).toBe(false);
    });
  });

  describe('listScenarios', () => {
    it('should start empty', async () => {
      expect(await listScenarios(alice)).toEqual([]);
    });

    it('should omit the payload — a listing does not need it', async () => {
      await saveScenario(alice, payload());
      const [summary] = await listScenarios(alice);
      expect(summary).not.toHaveProperty('data');
      expect(summary.nom).toBe('Mon scenario');
    });

    it('should put the most recently updated first', async () => {
      const a = await saveScenario(alice, { ...payload(), nom: 'Premier' });
      await new Promise((r) => setTimeout(r, 5));
      await saveScenario(alice, { ...payload(), nom: 'Second' });
      await new Promise((r) => setTimeout(r, 5));
      await updateScenario(alice, a.id, { ...payload(), nom: 'Premier, modifie' });

      expect((await listScenarios(alice)).map((s) => s.nom)).toEqual(['Premier, modifie', 'Second']);
    });
  });

  describe('isolation between users', () => {
    it('should not list the scenarios of another user', async () => {
      await saveScenario(alice, payload());
      expect(await listScenarios(bob)).toEqual([]);
    });

    it('should not let another user read, update or delete a scenario', async () => {
      const saved = await saveScenario(alice, payload());

      expect(await getScenario(bob, saved.id)).toBeNull();
      expect(await updateScenario(bob, saved.id, { ...payload(), nom: 'Vole' })).toBeNull();
      expect(await deleteScenario(bob, saved.id)).toBe(false);

      // Untouched for its owner.
      const intact = await getScenario(alice, saved.id);
      expect(intact?.nom).toBe('Mon scenario');
    });

    it('should delete the scenarios of a deleted account', async () => {
      const saved = await saveScenario(alice, payload());
      await db().$executeRaw`DELETE FROM auth.users WHERE id = ${alice}::uuid`;
      expect(await db().scenario.findUnique({ where: { id: saved.id } })).toBeNull();
    });

    it('should refuse a user that does not exist in auth.users', async () => {
      await expect(saveScenario(randomUUID(), payload())).rejects.toThrow();
    });
  });

  describe('plafond', () => {
    it('should refuse a new scenario once the ceiling is reached', async () => {
      for (let i = 0; i < 5; i++) await saveScenario(alice, payload());
      await expect(saveScenario(alice, payload())).rejects.toBeInstanceOf(TropDeScenariosError);
    });

    it('should count the ceiling per user', async () => {
      for (let i = 0; i < 5; i++) await saveScenario(alice, payload());
      await expect(saveScenario(bob, payload())).resolves.toBeDefined();
    });

    it('should accept one again after a deletion', async () => {
      const ids = [];
      for (let i = 0; i < 5; i++) ids.push((await saveScenario(alice, payload())).id);
      await deleteScenario(alice, ids[0]);
      await expect(saveScenario(alice, payload())).resolves.toBeDefined();
    });
  });
});
