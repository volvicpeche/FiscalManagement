import { z } from 'zod';

/**
 * The account page: what the server holds about a user, its export (right of
 * access and portability, RGPD art. 15 and 20) and its deletion (art. 17).
 */

/** Bump when the shape of the export changes. */
export const EXPORT_FORMAT_VERSION = 1;

/** What the account page lists, without the payloads. */
export const ResumeCompteSchema = z.object({
  scenarios: z.object({ sci: z.number(), saisonnier: z.number(), frontalier: z.number() }),
  cleLlm: z.boolean(),
  /** « Ce chiffre me semble faux » reports. */
  signalements: z.number(),
});
export type ResumeCompte = z.infer<typeof ResumeCompteSchema>;

/**
 * Everything the server stores for the user. The LLM key itself is never in
 * it, not even encrypted: only what the « Cle LLM » dialog shows.
 */
export const ExportCompteSchema = z.object({
  format: z.literal(EXPORT_FORMAT_VERSION),
  exporteLe: z.string().datetime(),
  compte: z.object({ id: z.string().uuid(), email: z.string().nullable() }),
  scenarios: z.array(
    z.object({
      id: z.string().uuid(),
      nom: z.string(),
      kind: z.string(),
      version: z.number(),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
      data: z.unknown(),
    }),
  ),
  cleLlm: z
    .object({
      provider: z.string(),
      model: z.string().nullable(),
      baseUrl: z.string().nullable(),
      cleFin: z.string(),
      updatedAt: z.string().datetime(),
    })
    .nullable(),
  consommationLlm: z.array(z.object({ jour: z.string(), appels: z.number() })),
  signalements: z.array(
    z.object({
      id: z.string().uuid(),
      createdAt: z.string().datetime(),
      canton: z.string(),
      annee: z.number(),
      requete: z.unknown(),
      resultat: z.unknown(),
      decompte: z.unknown(),
      commentaire: z.string(),
    }),
  ),
});
export type ExportCompte = z.infer<typeof ExportCompteSchema>;

/** Deleting the account: the user types their e-mail address again. */
export const SuppressionCompteRequestSchema = z.object({
  confirmation: z.string().trim().min(1, 'Saisissez votre adresse e-mail pour confirmer'),
});
export type SuppressionCompteRequest = z.infer<typeof SuppressionCompteRequestSchema>;
