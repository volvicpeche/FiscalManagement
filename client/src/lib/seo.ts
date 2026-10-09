import { CHEMINS, type Route } from './routes';

/**
 * Title, description and indexing of every page — one table for two readers:
 *
 * - the build (vite.config.ts) writes one HTML file per page with these tags
 *   in its <head>, so a crawler or a link preview gets them without running
 *   any JavaScript, plus sitemap.xml and robots.txt;
 * - the app (App.tsx) applies them on every navigation, for the tab title.
 *
 * Plain data and string functions only: the Vite config imports this file.
 * The texts keep their accents, unlike the UI: they are what a search engine
 * matches and shows.
 */

export const SITE_URL = 'https://frontaxapp.fr';
export const SITE_NOM = 'Patrimonia';
export const IMAGE_PARTAGE = '/og-image.png';

export interface MetaPage {
  titre: string;
  description: string;
  /** false: noindex — pages with nothing to find (login, e-mail links). */
  indexer: boolean;
  /** Listed in sitemap.xml: public pages with real content. */
  sitemap: boolean;
}

export const META: Record<Route, MetaPage> = {
  accueil: {
    titre: 'Patrimonia — Simulateurs de crédit, rendement locatif et fiscalité immobilière',
    description:
      'Crédit immobilier, rendement locatif, intérêts composés : des calculs clairs et gratuits, sans compte. Et des simulateurs SCI, holding et frontalier suisse pour comparer les montages et leur fiscalité.',
    indexer: true,
    sitemap: true,
  },
  credit: {
    titre: 'Simulateur de crédit immobilier : mensualité et capacité d’emprunt | Patrimonia',
    description:
      'Calculez votre mensualité, le coût total de votre crédit et votre capacité d’emprunt selon la norme HCSF (35 %, 25 ans). Comparez 15, 20 et 25 ans. Gratuit, sans inscription.',
    indexer: true,
    sitemap: true,
  },
  rendement: {
    titre: 'Calcul de rendement locatif : brut, net et cash-flow | Patrimonia',
    description:
      'Rendement brut, rendement net de charges et de vacance, cash-flow mensuel avec ou sans crédit : évaluez un investissement locatif en une minute. Gratuit, sans inscription.',
    indexer: true,
    sitemap: true,
  },
  interets: {
    titre: 'Simulateur d’intérêts composés : épargne et versements mensuels | Patrimonia',
    description:
      'Ce que devient votre épargne avec des versements réguliers : capital final, intérêts gagnés, valeur après inflation, année par année. Capitalisation mensuelle ou annuelle.',
    indexer: true,
    sitemap: true,
  },
  aide: {
    titre: 'Comprendre la SCI à l’IR ou à l’IS, la holding, le LMNP et la TOU | Patrimonia',
    description:
      'Les notions derrière les simulateurs, expliquées simplement : SCI à l’IR ou à l’IS, holding, location meublée LMNP et LMP, transmission, taxation ordinaire ultérieure des frontaliers.',
    indexer: true,
    sitemap: true,
  },
  sci: {
    titre: 'Simulateur SCI à l’IR, à l’IS et holding sur 30 ans | Patrimonia',
    description:
      'Comparez SCI à l’IR, SCI à l’IS, holding et LMNP sur 30 ans : impôts, trésorerie, TRI net de revente et coût de transmission, à partir d’une seule saisie.',
    indexer: true,
    sitemap: false,
  },
  frontalier: {
    titre: 'Frontalier Genève : simulateur TOU ou impôt à la source | Patrimonia',
    description:
      'Quasi-résident ou impôt à la source ? Test des 90 %, ICC et IFD calculés, gain de chaque déduction, pas à pas, avec lecture automatique de vos justificatifs.',
    indexer: true,
    sitemap: false,
  },
  saisonnier: {
    titre: 'Simulateur location saisonnière et meublé de tourisme (LMNP) | Patrimonia',
    description:
      'Rentabilité d’un meublé de tourisme saison par saison, LMNP au réel ou micro-BIC, trésorerie et transmission, à partir d’une annonce analysée automatiquement.',
    indexer: true,
    sitemap: false,
  },
  mentions: {
    titre: 'Mentions légales | Patrimonia',
    description: 'Éditeur, hébergement et licence du site Patrimonia.',
    indexer: true,
    sitemap: false,
  },
  confidentialite: {
    titre: 'Politique de confidentialité | Patrimonia',
    description: 'Les données collectées par Patrimonia, pourquoi, combien de temps, et vos droits.',
    indexer: true,
    sitemap: false,
  },
  connexion: { titre: 'Connexion | Patrimonia', description: 'Connectez-vous à Patrimonia.', indexer: false, sitemap: false },
  inscription: {
    titre: 'Créer un compte | Patrimonia',
    description: 'Créez un compte gratuit pour enregistrer vos simulations.',
    indexer: false,
    sitemap: false,
  },
  confirmation: { titre: 'Confirmation | Patrimonia', description: '', indexer: false, sitemap: false },
};

const echapper = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const urlAbsolue = (route: Route) => SITE_URL + (CHEMINS[route] === '/' ? '/' : CHEMINS[route]);

/** The tags placed between the seo markers of index.html. */
export function enteteHtml(route: Route): string {
  const m = META[route];
  const t = echapper(m.titre);
  const d = echapper(m.description);
  const url = urlAbsolue(route);
  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    m.indexer ? '' : '<meta name="robots" content="noindex" />',
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NOM}" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE_URL}${IMAGE_PARTAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ]
    .filter(Boolean)
    .join('\n    ');
}

export function sitemapXml(): string {
  const urls = (Object.keys(META) as Route[])
    .filter((r) => META[r].sitemap)
    .map((r) => `  <url><loc>${urlAbsolue(r)}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function robotsTxt(): string {
  return `User-agent: *\nDisallow: /api/\nDisallow: /auth/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}

/** In the app: the tab title and the tags a navigation changes. */
export function appliquerMeta(route: Route) {
  const m = META[route];
  document.title = m.titre;
  const poser = (selecteur: string, attribut: string, valeur: string) =>
    document.head.querySelector(selecteur)?.setAttribute(attribut, valeur);
  poser('meta[name="description"]', 'content', m.description);
  poser('link[rel="canonical"]', 'href', urlAbsolue(route));
}
