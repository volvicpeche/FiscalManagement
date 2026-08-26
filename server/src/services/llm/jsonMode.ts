import { ListingExtractionSchema, type ListingExtraction } from '@shared/listing.js';

/** Strips a markdown code fence around a JSON blob, if the model added one despite instructions. */
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

/** Parses a JSON-mode provider's raw text response into a validated ListingExtraction. */
export function parseExtractionJson(raw: string): ListingExtraction {
  let data: unknown;
  try {
    data = JSON.parse(stripCodeFence(raw));
  } catch {
    throw new Error("Le modele n'a pas renvoye un JSON valide");
  }

  const parsed = ListingExtractionSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("La reponse du modele ne correspond pas au format attendu");
  }
  return parsed.data;
}
