import { z } from 'zod';

/**
 * Structured extraction from a real-estate listing page, produced by an LLM
 * from the page's raw text — see server/src/services/listingAnalyzer.ts.
 *
 * Fields are nullable rather than optional: a structured-output schema needs
 * every key present, and `null` is how the model signals "not mentioned in
 * the listing" without inventing a plausible-looking number.
 */

export const ListingAtoutsSchema = z.object({
  piscine: z.boolean(),
  vue: z.boolean(),
  spa: z.boolean(),
  terrainPetanque: z.boolean(),
  climatisation: z.boolean(),
  parking: z.boolean(),
  /** Anything notable that doesn't fit a fixed flag (jacuzzi, terrasse, etc.). */
  autres: z.array(z.string()),
});
export type ListingAtouts = z.infer<typeof ListingAtoutsSchema>;

const SaisonEstimateSchema = z.object({
  tauxOccupation: z.number().min(0).max(1),
  caPeriode: z.number().min(0),
});

export const ListingExtractionSchema = z.object({
  label: z.string().nullable(),
  ville: z.string().nullable(),
  codePostal: z.string().nullable(),
  surfaceM2: z.number().nullable(),
  nbPieces: z.number().nullable(),
  nbChambres: z.number().nullable(),
  capaciteCouchage: z.number().nullable(),
  prixVente: z.number().nullable(),
  atouts: ListingAtoutsSchema,
  /**
   * Rough, unverified estimate of seasonal rental potential — the model's own
   * general knowledge of French rental markets, not a market data lookup.
   * Always presented to the user as a suggestion to review, never applied
   * silently.
   */
  estimationSaisonniere: z.object({
    hauteSaison: SaisonEstimateSchema,
    moyenneSaison: SaisonEstimateSchema,
    basseSaison: SaisonEstimateSchema,
    rationale: z.string(),
  }),
});
export type ListingExtraction = z.infer<typeof ListingExtractionSchema>;

/**
 * Either a URL to fetch, or text the user pasted.
 *
 * The paste route is not a convenience: SeLoger, LeBonCoin and PAP answer 403
 * to any server-side request whatever the headers, so for those portals
 * pasting is the only way the feature can work at all.
 */
export const ListingAnalyzeRequestSchema = z.union([
  z.object({ url: z.string().url("L'URL de l'annonce est invalide") }),
  z.object({ text: z.string().min(1, "Le texte de l'annonce est vide") }),
]);
export type ListingAnalyzeRequest = z.infer<typeof ListingAnalyzeRequestSchema>;
