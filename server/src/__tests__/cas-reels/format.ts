import { z } from 'zod';
import { CantonTravail, DecompteReelSchema } from '@shared/frontalier.js';

/**
 * A real case: the inputs of a household, anonymised, and what the canton
 * actually assessed. See README.md in this folder for how to add one.
 */
export const CasReelSchema = z
  .object({
    /** Also the file name, without .json: <annee>-<canton>-<profil>, e.g. 2026-ge-couple-c1. */
    id: z.string().regex(/^\d{4}-[a-z]{2}-[a-z0-9-]+$/, 'id : <annee>-<canton>-<profil>, en minuscules'),
    /** The profile in a sentence: who, what income, which deductions matter. Never a name. */
    description: z.string().min(10),
    /** true: NOT an assessment, figures copied from the engine to show the format. */
    exemple: z.boolean().default(false),
    source: z
      .object({
        /** Fiscal year of the assessment (revenus de cette annee). */
        annee: z.number().int().min(2020),
        canton: CantonTravail,
        /** The documents the figures were read from, e.g. « bordereau ICC 2026 ». */
        documents: z.array(z.string()).min(1),
      })
      .strict(),
    /** A FrontalierRequest input, validated against the engine's schema when the year is loaded. */
    requete: z.record(z.string(), z.unknown()),
    attendu: DecompteReelSchema,
    /** Accepted gap per line, CHF. The bordereaux round to the franc; 5 CHF leaves room for that and no more. */
    tolerance: z.string().regex(/^\d+(\.\d{1,2})?$/).default('5.00'),
    /**
     * A gap understood but not fixed yet, and why. The test then expects the
     * gap: the day the engine gets it right, it fails, asking to remove this.
     */
    ecartConnu: z.string().optional(),
  })
  .strict();
export type CasReel = z.infer<typeof CasReelSchema>;
