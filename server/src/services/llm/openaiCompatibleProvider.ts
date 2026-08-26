import OpenAI from 'openai';
import type { ListingExtraction } from '@shared/listing.js';
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_JSON_SHAPE, buildUserPrompt } from './prompt.js';
import { parseExtractionJson } from './jsonMode.js';

/**
 * Any OpenAI-compatible chat-completions endpoint: Qwen/DashScope, DeepSeek,
 * Groq, Mistral, a local Ollama/vLLM server, etc. One generic slot instead of
 * a bespoke module per provider — they all speak the same wire format.
 */
export async function extractListingViaOpenAiCompatible(text: string): Promise<ListingExtraction> {
  const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY;
  const baseURL = process.env.OPENAI_COMPATIBLE_BASE_URL;
  const model = process.env.OPENAI_COMPATIBLE_MODEL;

  if (!apiKey || !baseURL || !model) {
    throw new Error(
      'OPENAI_COMPATIBLE_API_KEY, OPENAI_COMPATIBLE_BASE_URL et OPENAI_COMPATIBLE_MODEL doivent tous etre renseignes',
    );
  }

  const client = new OpenAI({ apiKey, baseURL });
  const completion = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: `${EXTRACTION_SYSTEM_PROMPT}\n\n${EXTRACTION_JSON_SHAPE}` },
      { role: 'user', content: buildUserPrompt(text) },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("L'analyse de l'annonce a echoue (endpoint compatible OpenAI)");

  return parseExtractionJson(raw);
}
