import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ListingExtraction } from '@shared/listing.js';
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_JSON_SHAPE, buildUserPrompt } from './prompt.js';
import { parseExtractionJson } from './jsonMode.js';
import type { LlmConfig } from './config.js';

export async function extractListingViaGemini(text: string, config: LlmConfig): Promise<ListingExtraction> {
  const modelName = config.model;
  const client = new GoogleGenerativeAI(config.apiKey);
  const model = client.getGenerativeModel({
    model: modelName,
    systemInstruction: `${EXTRACTION_SYSTEM_PROMPT}\n\n${EXTRACTION_JSON_SHAPE}`,
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent(buildUserPrompt(text));
  const raw = result.response.text();
  if (!raw) throw new Error("L'analyse de l'annonce a echoue (Gemini)");

  return parseExtractionJson(raw);
}
