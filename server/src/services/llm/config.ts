import { LLM_DEFAULT_MODELS, type LlmProvider } from '@shared/llmSettings.js';
import { assertUrlPublique } from '../netGuard.js';

/**
 * Everything a provider needs for one call. It comes either from the user's
 * own settings (services/llmSettings.ts) or from the server's .env, and the
 * providers read nothing else — no process.env inside them.
 */
export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  /** openai_compatible only. */
  baseUrl?: string;
  /**
   * `utilisateur`: typed by a user — the base URL is theirs, so every request
   * to it is checked against the internal network (fetchApiPublique).
   * `serveur`: the administrator's .env, trusted (it may be a local Ollama).
   */
  source: 'utilisateur' | 'serveur';
}

const PROVIDERS: readonly LlmProvider[] = ['anthropic', 'openai', 'gemini', 'openai_compatible'];

export function resolveLlmProvider(): LlmProvider {
  const raw = (process.env.LLM_PROVIDER || 'anthropic').trim().toLowerCase();
  if ((PROVIDERS as readonly string[]).includes(raw)) return raw as LlmProvider;

  throw new Error(
    `LLM_PROVIDER invalide : "${raw}". Valeurs acceptees : ${PROVIDERS.join(', ')}.`,
  );
}

/** The server's own key, from .env (see .env.example), or null when it has none. */
export function configServeur(): LlmConfig | null {
  const provider = resolveLlmProvider();
  const env = process.env;
  const brut: Record<LlmProvider, { apiKey?: string; model?: string; baseUrl?: string }> = {
    anthropic: { apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL },
    openai: { apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL },
    gemini: { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL },
    openai_compatible: {
      apiKey: env.OPENAI_COMPATIBLE_API_KEY,
      model: env.OPENAI_COMPATIBLE_MODEL,
      baseUrl: env.OPENAI_COMPATIBLE_BASE_URL,
    },
  };
  const { apiKey, model, baseUrl } = brut[provider];
  const modele = model || LLM_DEFAULT_MODELS[provider];
  if (!apiKey || !modele || (provider === 'openai_compatible' && !baseUrl)) return null;
  return { provider, apiKey, model: modele, baseUrl, source: 'serveur' };
}

/**
 * `fetch` for an API whose address a user typed: HTTPS only, every request
 * checked against the internal network on the addresses the name resolves to
 * (netGuard), and no redirect followed — a public endpoint redirecting to
 * 169.254.169.254 would otherwise hand the server's metadata to the model.
 */
export const fetchApiPublique: typeof fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.protocol !== 'https:') throw new Error("L'URL de l'API doit etre en https://.");
  await assertUrlPublique(url);
  const response = await fetch(input, { ...init, redirect: 'manual' });
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("L'API a repondu par une redirection, refusee par securite. Verifiez l'URL.");
  }
  return response;
};

const NOMS: Record<LlmProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini',
  openai_compatible: "l'API compatible OpenAI",
};

/**
 * The providers' SDKs fail in English with their own wording; what the user
 * reads should say what to do. Keyed on the HTTP status they all expose.
 */
export function messageErreurLlm(err: unknown, config: LlmConfig): string {
  const status = (err as { status?: number })?.status;
  const nom = NOMS[config.provider];
  const aVous = config.source === 'utilisateur';
  if (status === 401 || status === 403) {
    return aVous
      ? `Cle API refusee par ${nom}. Verifiez-la dans « Cle LLM », en haut de la page.`
      : `Cle API du serveur refusee par ${nom}. Prevenez l'administrateur.`;
  }
  if (status === 404) return `Modele « ${config.model} » introuvable chez ${nom}. Verifiez son nom dans « Cle LLM ».`;
  if (status === 429) return `${nom} limite le debit ou le credit de cette cle est epuise. Reessayez plus tard.`;
  if (status === 402) return `Credit epuise sur ce compte ${nom}.`;
  return err instanceof Error ? err.message : `Echec de l'appel a ${nom}.`;
}
