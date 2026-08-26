import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ListingExtraction } from '@shared/listing.js';
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_JSON_SHAPE, buildUserPrompt } from './prompt.js';
import { parseExtractionJson } from './jsonMode.js';

export async function extractListingViaGemini(text: string): Promise<ListingExtraction> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY manquant');
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  const client = new GoogleGenerativeAI(apiKey);
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
