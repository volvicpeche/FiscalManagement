import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// The store reads its directory at import time, so it must be set first.
const dir = await mkdtemp(path.join(tmpdir(), 'patrimonia-scenarios-'));
process.env.SCENARIO_DIR = dir;

const {
  saveScenario, getScenario, updateScenario, deleteScenario, listScenarios, isValidId,
} = await import('../scenarioStore.js');

const payload = (over: Record<string, unknown> = {}) => ({
  nom: 'Mon scenario',
  kind: 'sci' as const,
  data: { asset: { purchasePrice: '200000.00' }, ...over },
});

beforeEach(async () => {
  for (const s of await listScenarios()) await deleteScenario(s.id);
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('isValidId', () => {
  it('should accept a uuid', () => {
    expect(isValidId('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true);
  });

  it('should reject anything that could escape the directory', () => {
    // Ids arrive from the URL: a traversal must never reach the filesystem.
    expect(isValidId('../../etc/passwd')).toBe(false);
    expect(isValidId('..')).toBe(false);
    expect(isValidId('scenario')).toBe(false);
    expect(isValidId('')).toBe(false);
  });
});

describe('saveScenario', () => {
  it('should return the saved scenario with an id and timestamps', async () => {
    const s = await saveScenario(payload());
    expect(isValidId(s.id)).toBe(true);
    expect(s.nom).toBe('Mon scenario');
    expect(s.version).toBe(1);
    expect(s.createdAt).toBe(s.updatedAt);
  });

  it('should round-trip the payload untouched', async () => {
    const data = { a: 1, b: 'deux', c: { d: [1, 2, 3] }, e: null };
    const saved = await saveScenario({ nom: 'X', kind: 'saisonnier', data });
    const loaded = await getScenario(saved.id);
    expect(loaded?.data).toEqual(data);
  });

  it('should give each save its own id', async () => {
    const a = await saveScenario(payload());
    const b = await saveScenario(payload());
    expect(a.id).not.toBe(b.id);
  });
});

describe('getScenario', () => {
  it('should return null for an unknown id', async () => {
    expect(await getScenario('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBeNull();
  });

  it('should return null rather than throw on a malformed id', async () => {
    expect(await getScenario('pas-un-uuid')).toBeNull();
  });
});

describe('updateScenario', () => {
  it('should overwrite the payload and move updatedAt', async () => {
    const saved = await saveScenario(payload());
    await new Promise((r) => setTimeout(r, 5));
    const updated = await updateScenario(saved.id, {
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
    expect(
      await updateScenario('3f2504e0-4f89-41d3-9a0c-0305e82c3301', payload()),
    ).toBeNull();
  });
});

describe('deleteScenario', () => {
  it('should remove the scenario', async () => {
    const saved = await saveScenario(payload());
    expect(await deleteScenario(saved.id)).toBe(true);
    expect(await getScenario(saved.id)).toBeNull();
  });

  it('should report false for an unknown id', async () => {
    expect(await deleteScenario('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(false);
  });
});

describe('listScenarios', () => {
  it('should start empty', async () => {
    expect(await listScenarios()).toEqual([]);
  });

  it('should omit the payload — a listing does not need it', async () => {
    await saveScenario(payload());
    const [summary] = await listScenarios();
    expect(summary).not.toHaveProperty('data');
    expect(summary.nom).toBe('Mon scenario');
  });

  it('should put the most recently updated first', async () => {
    const a = await saveScenario({ ...payload(), nom: 'Premier' });
    await new Promise((r) => setTimeout(r, 5));
    await saveScenario({ ...payload(), nom: 'Second' });
    await new Promise((r) => setTimeout(r, 5));
    await updateScenario(a.id, { ...payload(), nom: 'Premier, modifie' });

    expect((await listScenarios()).map((s) => s.nom)).toEqual(['Premier, modifie', 'Second']);
  });
});
