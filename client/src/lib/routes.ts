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
  | 'prevoyance'
  | 'saisonnier'
  | 'aide'
  | 'connexion'
  | 'inscription'
  | 'mentions'
  | 'confidentialite'
  | 'compte'
  | 'confirmation';

export const CHEMINS: Record<Route, string> = {
  accueil: '/',
  credit: '/outils/credit',
  rendement: '/outils/rendement',
  interets: '/outils/interets-composes',
  sci: '/locatif/sci',
  frontalier: '/frontalier/tou',
  prevoyance: '/frontalier/3a-lpp',
  saisonnier: '/locatif/saisonnier',
  aide: '/aide',
  connexion: '/connexion',
  inscription: '/inscription',
  mentions: '/mentions-legales',
  confidentialite: '/confidentialite',
  compte: '/compte',
  confirmation: '/auth/confirmer',
};

/**
 * Paths a page used to have, still recognised so a bookmark keeps working.
 * nginx answers them with a 301 (nginx.conf.template); the router rewrites
 * them in place for the dev server.
 */
export const ANCIENS_CHEMINS: Record<string, Route> = {
  '/simulateurs/sci': 'sci',
  '/simulateurs/frontalier': 'frontalier',
  '/simulateurs/saisonnier': 'saisonnier',
};
