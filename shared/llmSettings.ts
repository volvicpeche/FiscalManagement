import { z } from 'zod';

/**
 * A user's own LLM API key, for the two buttons that call a model (listing
 * analysis, reading tax documents). The key goes up once, is stored
 * encrypted, and never comes back down: the client only ever sees its last
 * four characters.
 */

export const LLM_PROVIDERS = ['anthropic', 'openai', 'gemini', 'openai_compatible'] as const;
export const LlmProviderSchema = z.enum(LLM_PROVIDERS);
export type LlmProvider = z.infer<typeof LlmProviderSchema>;

export const LLM_PROVIDER_LABELS: Record<LlmProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (ChatGPT)',
  gemini: 'Google Gemini',
  openai_compatible: 'Compatible OpenAI (Mistral, DeepSeek, Groq…)',
};

/** Used when the user leaves the model empty. The compatible slot has none. */
export const LLM_DEFAULT_MODELS: Record<LlmProvider, string | null> = {
  anthropic: 'claude-opus-5',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-flash-latest',
  openai_compatible: null,
};

const vide = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const LlmSettingsRequestSchema = z
  .object({
    provider: LlmProviderSchema,
    /** Absent: keep the stored key (only allowed when the provider is unchanged). */
    apiKey: z.preprocess(
      vide,
      z
        .string()
        .trim()
        .min(10, 'Cle API trop courte.')
        .max(500, 'Cle API trop longue.')
        .regex(/^\S+$/, 'La cle API ne doit pas contenir d’espace.')
        .optional(),
    ),
    model: z.preprocess(vide, z.string().trim().max(100, 'Nom de modele trop long.').optional()),
    baseUrl: z.preprocess(
      vide,
      z
        .string()
        .trim()
        .url('URL invalide.')
        .max(300)
        .refine((u) => u.startsWith('https://'), 'L’URL doit commencer par https://.')
        .optional(),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.provider === 'openai_compatible') {
      if (!v.baseUrl) ctx.addIssue({ code: 'custom', path: ['baseUrl'], message: 'Indiquez l’URL de l’API.' });
      if (!v.model) ctx.addIssue({ code: 'custom', path: ['model'], message: 'Indiquez le nom du modele.' });
    }
  });
export type LlmSettingsRequest = z.infer<typeof LlmSettingsRequestSchema>;

/** What GET /api/me/llm returns. Never the key itself. */
export interface LlmSettingsView {
  /** The user has a key of their own. */
  configuree: boolean;
  provider: LlmProvider | null;
  model: string | null;
  baseUrl: string | null;
  /** Last four characters of the stored key, to recognise it. */
  cleFin: string | null;
  /** The user may fall back on the server's key (e-mail allow-list). */
  cleServeurAutorisee: boolean;
  /** Whether the server can store keys at all (LLM_KEYS_SECRET set). */
  stockageDisponible: boolean;
}
