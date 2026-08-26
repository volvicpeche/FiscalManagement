import OpenAI from 'openai';
import type { ListingExtraction } from '@shared/listing.js';
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_JSON_SHAPE, buildUserPrompt } from './prompt.js';
import { parseExtractionJson } from './jsonMode.js';

export async function extractListingViaOpenAI(text: string): Promise<ListingExtraction> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY manquant');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: `${EXTRACTION_SYSTEM_PROMPT}\n\n${EXTRACTION_JSON_SHAPE}` },
      { role: 'user', content: buildUserPrompt(text) },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("L'analyse de l'annonce a echoue (OpenAI)");

  return parseExtractionJson(raw);
}
