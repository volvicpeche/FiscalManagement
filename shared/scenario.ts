import { z } from 'zod';

/**
 * A saved scenario.
 *
 * `data` is deliberately opaque to the server: it is the client store's own
 * shape, which changes as the forms change, and mirroring it here would mean
 * editing two schemas for every new field. `version` is what makes that safe —
 * a save written under an older format can be recognised and reported rather
 * than loaded into a form that no longer matches it.
 */

/** Bump when the client store's shape changes incompatibly. */
export const SCENARIO_FORMAT_VERSION = 1;

export const ScenarioKind = z.enum(['sci', 'saisonnier']);
export type ScenarioKind = z.infer<typeof ScenarioKind>;

export const SavedScenarioSchema = z.object({
  id: z.string().uuid(),
  nom: z.string().min(1).max(120),
  kind: ScenarioKind,
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  data: z.record(z.string(), z.unknown()),
});
export type SavedScenario = z.infer<typeof SavedScenarioSchema>;

/** What a listing returns: everything but the payload. */
export const ScenarioSummarySchema = SavedScenarioSchema.omit({ data: true });
export type ScenarioSummary = z.infer<typeof ScenarioSummarySchema>;

export const SaveScenarioRequestSchema = z.object({
  nom: z.string().min(1, 'Donnez un nom au scenario').max(120),
  kind: ScenarioKind,
  data: z.record(z.string(), z.unknown()),
});
export type SaveScenarioRequest = z.infer<typeof SaveScenarioRequestSchema>;

/** True when a save predates the current format and may not load cleanly. */
export function isOutdated(scenario: Pick<SavedScenario, 'version'>): boolean {
  return scenario.version !== SCENARIO_FORMAT_VERSION;
}
