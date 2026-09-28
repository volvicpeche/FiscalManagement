import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Encryption of the users' LLM API keys at rest: AES-256-GCM with a server
 * key, LLM_KEYS_SECRET (32 random bytes, base64), that lives only in
 * server/.env — never in the database. A dump of the database, or a read of
 * the Supabase dashboard, gives ciphertexts only.
 *
 * Each ciphertext is bound to its owner (GCM additional data = user id): a
 * row copied onto another user fails to decrypt instead of lending them a key.
 *
 * Format: `v1.<iv>.<tag>.<ciphertext>`, each part base64url.
 */

const VERSION = 'v1';

export class StockageClesIndisponibleError extends Error {
  constructor() {
    super(
      "L'enregistrement des cles API n'est pas configure sur ce serveur (LLM_KEYS_SECRET). Contactez l'administrateur.",
    );
    this.name = 'StockageClesIndisponibleError';
  }
}

/** The 32-byte key, or null when LLM_KEYS_SECRET is absent or malformed. */
function cleServeur(): Buffer | null {
  const brut = process.env.LLM_KEYS_SECRET?.trim();
  if (!brut) return null;
  const cle = Buffer.from(brut, 'base64');
  return cle.length === 32 ? cle : null;
}

export function stockageDisponible(): boolean {
  return cleServeur() !== null;
}

export function chiffrer(texte: string, proprietaire: string): string {
  const cle = cleServeur();
  if (!cle) throw new StockageClesIndisponibleError();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', cle, iv);
  cipher.setAAD(Buffer.from(proprietaire, 'utf8'));
  const chiffre = Buffer.concat([cipher.update(texte, 'utf8'), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), chiffre]
    .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
    .join('.');
}

/** Throws on a wrong key, a wrong owner or a tampered value — never returns garbage. */
export function dechiffrer(blob: string, proprietaire: string): string {
  const cle = cleServeur();
  if (!cle) throw new StockageClesIndisponibleError();
  const [version, iv, tag, chiffre] = blob.split('.');
  if (version !== VERSION || !iv || !tag || chiffre === undefined) {
    throw new Error('Cle API stockee illisible.');
  }
  const decipher = createDecipheriv('aes-256-gcm', cle, Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(proprietaire, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(chiffre, 'base64url')), decipher.final()]).toString('utf8');
}
