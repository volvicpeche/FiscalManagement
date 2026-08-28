import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  SavedScenarioSchema,
  SCENARIO_FORMAT_VERSION,
  type SavedScenario,
  type SaveScenarioRequest,
  type ScenarioSummary,
} from '@shared/scenario.js';

/**
 * Scenario persistence, on the filesystem.
 *
 * Deliberately not Prisma: nothing under server/src touches a database, and the
 * app is documented as running without one. Requiring a Postgres install just
 * to save a scenario would be a real regression for a tool run locally. The
 * interface here is narrow enough that swapping in Prisma later means
 * reimplementing five functions.
 *
 * One JSON file per scenario, written atomically — a crash mid-write leaves the
 * previous version intact rather than a truncated file.
 */

const DATA_DIR = process.env.SCENARIO_DIR ?? path.join(process.cwd(), 'data', 'scenarios');

/** Ids come from the URL, so they must never be able to escape the directory. */
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidId(id: string): boolean {
  return ID_PATTERN.test(id);
}

function fileFor(id: string): string {
  if (!isValidId(id)) throw new Error('Identifiant de scenario invalide');
  return path.join(DATA_DIR, `${id}.json`);
}

async function ensureDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

/** Write to a sibling temp file, then rename: rename is atomic on both OSes. */
async function writeAtomic(file: string, contents: string): Promise<void> {
  const tmp = `${file}.${randomUUID()}.tmp`;
  await writeFile(tmp, contents, 'utf8');
  await rename(tmp, file);
}

export async function saveScenario(input: SaveScenarioRequest): Promise<SavedScenario> {
  await ensureDir();
  const now = new Date().toISOString();

  const scenario: SavedScenario = {
    id: randomUUID(),
    nom: input.nom,
    kind: input.kind,
    version: SCENARIO_FORMAT_VERSION,
    createdAt: now,
    updatedAt: now,
    data: input.data,
  };

  await writeAtomic(fileFor(scenario.id), JSON.stringify(scenario, null, 2));
  return scenario;
}

export async function getScenario(id: string): Promise<SavedScenario | null> {
  try {
    const raw = await readFile(fileFor(id), 'utf8');
    const parsed = SavedScenarioSchema.safeParse(JSON.parse(raw));
    // A file we cannot parse is reported as missing rather than crashing the
    // request: the caller gets a clean 404 and the file stays for inspection.
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function updateScenario(
  id: string,
  input: SaveScenarioRequest,
): Promise<SavedScenario | null> {
  const existing = await getScenario(id);
  if (!existing) return null;

  const updated: SavedScenario = {
    ...existing,
    nom: input.nom,
    kind: input.kind,
    // Rewriting a scenario brings it up to the current format.
    version: SCENARIO_FORMAT_VERSION,
    updatedAt: new Date().toISOString(),
    data: input.data,
  };

  await writeAtomic(fileFor(id), JSON.stringify(updated, null, 2));
  return updated;
}

export async function deleteScenario(id: string): Promise<boolean> {
  try {
    await unlink(fileFor(id));
    return true;
  } catch {
    return false;
  }
}

/** Most recently updated first — that is the one you usually want back. */
export async function listScenarios(): Promise<ScenarioSummary[]> {
  await ensureDir();

  let files: string[];
  try {
    files = await readdir(DATA_DIR);
  } catch {
    return [];
  }

  const summaries: ScenarioSummary[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const scenario = await getScenario(file.replace(/\.json$/, ''));
    if (!scenario) continue;
    const { data: _data, ...summary } = scenario;
    summaries.push(summary);
  }

  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
