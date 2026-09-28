import {
  SavedScenarioSchema,
  SCENARIO_FORMAT_VERSION,
  type SavedScenario,
  type SaveScenarioRequest,
  type ScenarioSummary,
} from '@shared/scenario.js';
import type { Prisma } from '../generated/prisma/client.js';
import { db } from './db.js';

/**
 * Scenario persistence, in the Supabase Postgres, one row per scenario.
 *
 * Every function takes the owner first and filters on it: a scenario of
 * someone else is indistinguishable from one that does not exist (404, not
 * 403 — a 403 would confirm the id is real). This filter is the ONLY access
 * control on the data: the server connects as `postgres`, which bypasses RLS.
 */

/** Ids come from the URL; rejecting anything else spares Postgres a cast error. */
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ceiling on stored scenarios, PER USER. Each is capped at the 1 MB request
 * body limit, and sign-up is open: without it one account could fill the
 * database. Far above personal use.
 */
export const MAX_SCENARIOS = Number(process.env.MAX_SCENARIOS ?? 200);

export class TropDeScenariosError extends Error {
  constructor() {
    super(
      `Limite de ${MAX_SCENARIOS} scenarios enregistres atteinte. Supprimez-en avant d'en ajouter.`,
    );
    this.name = 'TropDeScenariosError';
  }
}

export function isValidId(id: string): boolean {
  return ID_PATTERN.test(id);
}

type Row = {
  id: string;
  nom: string;
  kind: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  data?: Prisma.JsonValue;
};

function toPlain(row: Row) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * A row we cannot parse (a `kind` or a payload no schema accepts any more) is
 * reported as missing rather than crashing the request: the caller gets a
 * clean 404 and the row stays for inspection.
 */
function toScenario(row: Row): SavedScenario | null {
  const parsed = SavedScenarioSchema.safeParse(toPlain(row));
  return parsed.success ? parsed.data : null;
}

export async function saveScenario(
  userId: string,
  input: SaveScenarioRequest,
): Promise<SavedScenario> {
  const existants = await db().scenario.count({ where: { userId } });
  if (existants >= MAX_SCENARIOS) throw new TropDeScenariosError();

  const row = await db().scenario.create({
    data: {
      userId,
      nom: input.nom,
      kind: input.kind,
      version: SCENARIO_FORMAT_VERSION,
      data: input.data as Prisma.InputJsonObject,
    },
  });
  return toScenario(row)!;
}

export async function getScenario(userId: string, id: string): Promise<SavedScenario | null> {
  if (!isValidId(id)) return null;
  const row = await db().scenario.findFirst({ where: { id, userId } });
  return row ? toScenario(row) : null;
}

export async function updateScenario(
  userId: string,
  id: string,
  input: SaveScenarioRequest,
): Promise<SavedScenario | null> {
  if (!isValidId(id)) return null;

  // updateMany: the only update that can filter on something else than the
  // primary key, so the owner check and the write are one statement.
  const { count } = await db().scenario.updateMany({
    where: { id, userId },
    data: {
      nom: input.nom,
      kind: input.kind,
      // Rewriting a scenario brings it up to the current format.
      version: SCENARIO_FORMAT_VERSION,
      data: input.data as Prisma.InputJsonObject,
    },
  });
  return count === 0 ? null : getScenario(userId, id);
}

export async function deleteScenario(userId: string, id: string): Promise<boolean> {
  if (!isValidId(id)) return false;
  const { count } = await db().scenario.deleteMany({ where: { id, userId } });
  return count > 0;
}

/** Most recently updated first — that is the one you usually want back. */
export async function listScenarios(userId: string): Promise<ScenarioSummary[]> {
  const rows = await db().scenario.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    // The payload can weigh up to 1 MB each; a listing never needs it.
    select: { id: true, nom: true, kind: true, version: true, createdAt: true, updatedAt: true },
  });

  const summaries: ScenarioSummary[] = [];
  for (const row of rows) {
    const scenario = toScenario({ ...row, data: {} });
    if (!scenario) continue;
    const { data: _data, ...summary } = scenario;
    summaries.push(summary);
  }
  return summaries;
}
