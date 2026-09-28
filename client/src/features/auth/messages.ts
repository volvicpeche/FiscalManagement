import { z } from 'zod';

/** Supabase answers in English, by code: what the user reads is this. */
const PAR_CODE: Record<string, string> = {
  invalid_credentials: 'E-mail ou mot de passe incorrect.',
  email_not_confirmed:
    "Adresse e-mail pas encore confirmee : cliquez sur le lien recu par e-mail, puis reconnectez-vous.",
  user_already_exists: 'Un compte existe deja avec cette adresse. Connectez-vous.',
  email_exists: 'Un compte existe deja avec cette adresse. Connectez-vous.',
  weak_password: 'Mot de passe trop faible : allongez-le ou melangez lettres, chiffres et symboles.',
  same_password: "Le nouveau mot de passe doit etre different de l'ancien.",
  over_email_send_rate_limit: "Trop d'e-mails envoyes. Patientez quelques minutes avant de reessayer.",
  over_request_rate_limit: 'Trop de tentatives. Patientez quelques minutes avant de reessayer.',
  otp_expired: 'Ce lien a expire ou a deja servi. Demandez-en un nouveau.',
  signup_disabled: 'La creation de compte est desactivee.',
  email_address_invalid: 'Adresse e-mail invalide.',
};

export function messageErreur(err: unknown): string {
  if (err && typeof err === 'object') {
    const { code, status } = err as { code?: string; status?: number };
    if (code && PAR_CODE[code]) return PAR_CODE[code];
    if (status === 429) return PAR_CODE.over_request_rate_limit;
  }
  if (err instanceof TypeError) return "Service d'authentification injoignable. Reessayez.";
  return 'Une erreur est survenue. Reessayez.';
}

export const MOT_DE_PASSE_MIN = 10;

export const EmailSchema = z.string().trim().email('Adresse e-mail invalide.');
export const MotDePasseSchema = z
  .string()
  .min(MOT_DE_PASSE_MIN, `Au moins ${MOT_DE_PASSE_MIN} caracteres.`)
  .max(72, '72 caracteres au maximum.');

/** First French message of a failed parse, or null when valid. */
export function premiereErreur(result: z.ZodSafeParseResult<unknown>): string | null {
  return result.success ? null : (result.error.issues[0]?.message ?? 'Saisie invalide.');
}
