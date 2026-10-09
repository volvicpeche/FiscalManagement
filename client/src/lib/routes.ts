/**
 * Every page and its path. No React here: the Vite config imports it to
 * generate one HTML file per public page (see seo.ts).
 */

export type Route =
  | 'accueil'
  | 'credit'
  | 'rendement'
  | 'interets'
  | 'sci'
  | 'frontalier'
  | 'saisonnier'
  | 'aide'
  | 'connexion'
  | 'inscription'
  | 'mentions'
  | 'confidentialite'
  | 'confirmation';

export const CHEMINS: Record<Route, string> = {
  accueil: '/',
  credit: '/outils/credit',
  rendement: '/outils/rendement',
  interets: '/outils/interets-composes',
  sci: '/simulateurs/sci',
  frontalier: '/simulateurs/frontalier',
  saisonnier: '/simulateurs/saisonnier',
  aide: '/aide',
  connexion: '/connexion',
  inscription: '/inscription',
  mentions: '/mentions-legales',
  confidentialite: '/confidentialite',
  confirmation: '/auth/confirmer',
};
