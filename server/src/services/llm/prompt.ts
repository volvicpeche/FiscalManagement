/**
 * Prompt shared by every provider. Anthropic gets a machine-checked JSON
 * schema via structured outputs (see anthropicProvider.ts); the other
 * providers only get JSON mode (valid JSON syntax, not a specific shape), so
 * they additionally need the shape spelled out here in the prompt itself.
 */

export const EXTRACTION_SYSTEM_PROMPT = `Tu extrais les caracteristiques d'un bien immobilier a partir du texte brut d'une annonce de vente en France, en vue d'une exploitation en location saisonniere.

Renseigne null pour toute information absente du texte plutot que de deviner une valeur precise (surface, prix, nombre de pieces, localite...).

Propose ensuite une estimation INDICATIVE et PRUDENTE du potentiel de location saisonniere (taux d'occupation et chiffre d'affaires par saison), fondee sur la localite, le standing du bien et ses atouts (piscine, vue, spa, etc.). Explique brievement les hypotheses retenues dans le champ rationale — cette estimation n'est pas une donnee de marche verifiee, l'utilisateur doit pouvoir juger de sa fiabilite.`;

/**
 * JSON shape description for providers with plain JSON mode (no schema
 * enforcement). Field names and nesting must match ListingExtractionSchema
 * in shared/listing.ts exactly.
 */
export const EXTRACTION_JSON_SHAPE = `Reponds UNIQUEMENT avec un objet JSON valide (aucun texte avant/apres, aucun bloc markdown), exactement sous cette forme :
{
  "label": string | null,
  "ville": string | null,
  "codePostal": string | null,
  "surfaceM2": number | null,
  "nbPieces": number | null,
  "nbChambres": number | null,
  "capaciteCouchage": number | null,
  "prixVente": number | null,
  "atouts": {
    "piscine": boolean,
    "vue": boolean,
    "spa": boolean,
    "terrainPetanque": boolean,
    "climatisation": boolean,
    "parking": boolean,
    "autres": string[]
  },
  "estimationSaisonniere": {
    "hauteSaison": { "tauxOccupation": number (0-1), "caPeriode": number },
    "moyenneSaison": { "tauxOccupation": number (0-1), "caPeriode": number },
    "basseSaison": { "tauxOccupation": number (0-1), "caPeriode": number },
    "rationale": string
  }
}`;

export function buildUserPrompt(listingText: string): string {
  return `Annonce (texte extrait de la page) :\n\n${listingText}`;
}
