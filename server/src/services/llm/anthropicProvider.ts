import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// The SDK's structured-output helper is typed against the zod/v4 API, while
// the rest of this codebase uses classic zod (v3 API, exported by the same
// "zod" package). Building a local v4-flavoured mirror for this one call —
// then re-validating the result through the shared classic schema below —
// keeps that version split contained to this file.
import * as zv4 from 'zod/v4';
import { ListingExtractionSchema, type ListingExtraction } from '@shared/listing.js';
import { EXTRACTION_SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';

const ListingExtractionSchemaV4 = zv4.object({
  label: zv4.string().nullable(),
  ville: zv4.string().nullable(),
  codePostal: zv4.string().nullable(),
  surfaceM2: zv4.number().nullable(),
  nbPieces: zv4.number().nullable(),
  nbChambres: zv4.number().nullable(),
  capaciteCouchage: zv4.number().nullable(),
  prixVente: zv4.number().nullable(),
  atouts: zv4.object({
    piscine: zv4.boolean(),
    vue: zv4.boolean(),
    spa: zv4.boolean(),
    terrainPetanque: zv4.boolean(),
    climatisation: zv4.boolean(),
    parking: zv4.boolean(),
    autres: zv4.array(zv4.string()),
  }),
  estimationSaisonniere: zv4.object({
    hauteSaison: zv4.object({ tauxOccupation: zv4.number(), caPeriode: zv4.number() }),
    moyenneSaison: zv4.object({ tauxOccupation: zv4.number(), caPeriode: zv4.number() }),
    basseSaison: zv4.object({ tauxOccupation: zv4.number(), caPeriode: zv4.number() }),
    rationale: zv4.string(),
  }),
});

export async function extractListingViaAnthropic(text: string): Promise<ListingExtraction> {
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || 'claude-opus-5';

  const response = await client.messages.parse({
    model,
    max_tokens: 4000,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(text) }],
    output_config: { format: zodOutputFormat(ListingExtractionSchemaV4) },
  });

  if (!response.parsed_output) {
    throw new Error("L'analyse de l'annonce a echoue (Anthropic)");
  }

  return ListingExtractionSchema.parse(response.parsed_output);
}
