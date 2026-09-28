import OpenAI from 'openai';
import type { ListingExtraction } from '@shared/listing.js';
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_JSON_SHAPE, buildUserPrompt } from './prompt.js';
import { parseExtractionJson } from './jsonMode.js';
import { fetchApiPublique, type LlmConfig } from './config.js';

/**
 * Any OpenAI-compatible chat-completions endpoint: Qwen/DashScope, DeepSeek,
 * Groq, Mistral, a local Ollama/vLLM server, etc. One generic slot instead of
 * a bespoke module per provider — they all speak the same wire format.
 */
export async function extractListingViaOpenAiCompatible(text: string, config: LlmConfig): Promise<ListingExtraction> {
  const { apiKey, baseUrl: baseURL, model } = config;
  if (!baseURL) throw new Error("URL de l'API compatible OpenAI manquante");

  // A base URL typed by a user is an address the server will call: guard
  // every request against the internal network (see fetchApiPublique).
  const client = new OpenAI({
    apiKey,
    baseURL,
    ...(config.source === 'utilisateur' && { fetch: fetchApiPublique, maxRetries: 0 }),
  });
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
