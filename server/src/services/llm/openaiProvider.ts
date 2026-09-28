import OpenAI from 'openai';
import type { ListingExtraction } from '@shared/listing.js';
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_JSON_SHAPE, buildUserPrompt } from './prompt.js';
import { parseExtractionJson } from './jsonMode.js';
import type { LlmConfig } from './config.js';

export async function extractListingViaOpenAI(text: string, config: LlmConfig): Promise<ListingExtraction> {
  const model = config.model;
  const client = new OpenAI({ apiKey: config.apiKey });
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
