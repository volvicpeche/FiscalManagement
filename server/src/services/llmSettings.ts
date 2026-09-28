import type { LlmSettingsRequest, LlmSettingsView } from '@shared/llmSettings.js';
import { LLM_DEFAULT_MODELS, LlmProviderSchema } from '@shared/llmSettings.js';
import type { AuthUser } from '../plugins/auth.js';
import { db } from './db.js';
import { chiffrer, dechiffrer, stockageDisponible } from './secretBox.js';
import { assertUrlPublique } from './netGuard.js';
import { configServeur, type LlmConfig } from './llm/config.js';

/**
 * Each user brings their own LLM key. The server's key (.env) only serves the
 * accounts listed in LLM_SERVER_KEY_EMAILS — sign-up is open, and anyone
 * else would be spending it.
 */

export class LlmNonConfigureError extends Error {
  readonly code = 'LLM_NON_CONFIGURE';
  constructor(message = 'Renseignez votre cle API dans « Cle LLM », en haut de la page, pour utiliser l’analyse automatique.') {
    super(message);
    this.name = 'LlmNonConfigureError';
  }
}

/** A request the user can fix (400), as opposed to a server fault. */
export class ParametresLlmInvalidesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParametresLlmInvalidesError';
  }
}

/** Accounts allowed to use the server's key: LLM_SERVER_KEY_EMAILS, comma-separated. */
export function cleServeurAutorisee(user: AuthUser): boolean {
  if (!user.email) return false;
  const liste = (process.env.LLM_SERVER_KEY_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return liste.includes(user.email.toLowerCase());
}

export async function lireParametresLlm(user: AuthUser): Promise<LlmSettingsView> {
  const row = await db().llmSettings.findUnique({ where: { userId: user.id } });
  const provider = row ? LlmProviderSchema.safeParse(row.provider) : null;
  // Same rules as resoudreConfigLlm, without decrypting anything.
  const perso = provider?.success ? provider.data : null;
  const serveur = cleServeurAutorisee(user) ? configServeur() : null;
  return {
    disponible: {
      annonce: perso !== null || serveur !== null,
      document: perso === 'anthropic' || serveur?.provider === 'anthropic',
    },
    configuree: Boolean(row && provider?.success),
    provider: provider?.success ? provider.data : null,
    model: row?.model ?? null,
    baseUrl: row?.baseUrl ?? null,
    cleFin: row?.cleFin ?? null,
    cleServeurAutorisee: cleServeurAutorisee(user),
    stockageDisponible: stockageDisponible(),
  };
}

export async function enregistrerParametresLlm(
  user: AuthUser,
  input: LlmSettingsRequest,
): Promise<LlmSettingsView> {
  const existant = await db().llmSettings.findUnique({ where: { userId: user.id } });

  let cleChiffree: string;
  let cleFin: string;
  if (input.apiKey) {
    cleChiffree = chiffrer(input.apiKey, user.id);
    cleFin = input.apiKey.slice(-4);
  } else if (existant && existant.provider === input.provider) {
    // Changing only the model or the URL: keep the stored key.
    cleChiffree = existant.cleChiffree;
    cleFin = existant.cleFin;
  } else {
    throw new ParametresLlmInvalidesError('Saisissez la cle API de ce fournisseur.');
  }

  const baseUrl = input.provider === 'openai_compatible' ? (input.baseUrl ?? null) : null;
  if (baseUrl) {
    // Checked here for a clear message, and again on every call
    // (fetchApiPublique): a name can be re-pointed after it was saved.
    try {
      await assertUrlPublique(new URL(baseUrl));
    } catch (err) {
      throw new ParametresLlmInvalidesError(
        err instanceof Error ? err.message : "URL de l'API refusee.",
      );
    }
  }

  const donnees = {
    provider: input.provider,
    model: input.model ?? null,
    baseUrl,
    cleChiffree,
    cleFin,
  };
  await db().llmSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...donnees },
    update: donnees,
  });
  return lireParametresLlm(user);
}

export async function supprimerParametresLlm(userId: string): Promise<void> {
  await db().llmSettings.deleteMany({ where: { userId } });
}

/**
 * Which provider and key serve this call:
 * 1. the user's own settings;
 * 2. otherwise the server's key, for allow-listed accounts only;
 * 3. otherwise LlmNonConfigureError.
 *
 * Reading tax documents needs Anthropic (it sends the PDF itself): a user
 * whose own key is another provider's falls back on rule 2 for that one.
 */
export async function resoudreConfigLlm(
  user: AuthUser,
  usage: 'annonce' | 'document',
): Promise<LlmConfig> {
  const row = await db().llmSettings.findUnique({ where: { userId: user.id } });
  const provider = row ? LlmProviderSchema.safeParse(row.provider) : null;

  if (row && provider?.success && (usage === 'annonce' || provider.data === 'anthropic')) {
    let apiKey: string;
    try {
      apiKey = dechiffrer(row.cleChiffree, user.id);
    } catch {
      // LLM_KEYS_SECRET changed or lost: the stored key is gone for good.
      throw new LlmNonConfigureError(
        'Votre cle API enregistree ne peut plus etre lue sur ce serveur. Saisissez-la a nouveau dans « Cle LLM ».',
      );
    }
    const model = row.model || LLM_DEFAULT_MODELS[provider.data];
    if (!model) throw new LlmNonConfigureError('Indiquez le nom du modele dans « Cle LLM ».');
    return { provider: provider.data, apiKey, model, baseUrl: row.baseUrl ?? undefined, source: 'utilisateur' };
  }

  if (cleServeurAutorisee(user)) {
    const serveur = configServeur();
    if (serveur && (usage === 'annonce' || serveur.provider === 'anthropic')) return serveur;
  }

  throw new LlmNonConfigureError(
    usage === 'document'
      ? 'La lecture des justificatifs necessite une cle Anthropic : renseignez-la dans « Cle LLM », en haut de la page.'
      : undefined,
  );
}
