import type { ListingExtraction } from '@shared/listing.js';
import { extractListingViaAnthropic } from './anthropicProvider.js';
import { extractListingViaOpenAI } from './openaiProvider.js';
import { extractListingViaGemini } from './geminiProvider.js';
import { extractListingViaOpenAiCompatible } from './openaiCompatibleProvider.js';
import type { LlmConfig } from './config.js';

export { resolveLlmProvider, configServeur, type LlmConfig } from './config.js';

/**
 * Extracts listing features + a rough seasonal-rental estimate with the
 * provider and key of `config` — the user's own, or the server's for the
 * allow-listed accounts (services/llmSettings.ts).
 */
export async function extractListingViaLlm(text: string, config: LlmConfig): Promise<ListingExtraction> {
  switch (config.provider) {
    case 'anthropic':
      return extractListingViaAnthropic(text, config);
    case 'openai':
      return extractListingViaOpenAI(text, config);
    case 'gemini':
      return extractListingViaGemini(text, config);
    case 'openai_compatible':
      return extractListingViaOpenAiCompatible(text, config);
  }
}
