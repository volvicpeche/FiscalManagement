import type { ListingExtraction } from '@shared/listing.js';
import { extractListingViaAnthropic } from './anthropicProvider.js';
import { extractListingViaOpenAI } from './openaiProvider.js';
import { extractListingViaGemini } from './geminiProvider.js';
import { extractListingViaOpenAiCompatible } from './openaiCompatibleProvider.js';

const PROVIDERS = ['anthropic', 'openai', 'gemini', 'openai_compatible'] as const;
export type LlmProvider = (typeof PROVIDERS)[number];

export function resolveLlmProvider(): LlmProvider {
  const raw = (process.env.LLM_PROVIDER || 'anthropic').trim().toLowerCase();
  if ((PROVIDERS as readonly string[]).includes(raw)) return raw as LlmProvider;

  throw new Error(
    `LLM_PROVIDER invalide : "${raw}". Valeurs acceptees : ${PROVIDERS.join(', ')}.`,
  );
}

/**
 * Extracts listing features + a rough seasonal-rental estimate via whichever
 * LLM provider is configured through LLM_PROVIDER (default: anthropic).
 * Each provider reads its own API key / model env vars — see .env.example.
 */
export async function extractListingViaLlm(text: string): Promise<ListingExtraction> {
  switch (resolveLlmProvider()) {
    case 'anthropic':
      return extractListingViaAnthropic(text);
    case 'openai':
      return extractListingViaOpenAI(text);
    case 'gemini':
      return extractListingViaGemini(text);
    case 'openai_compatible':
      return extractListingViaOpenAiCompatible(text);
  }
}
