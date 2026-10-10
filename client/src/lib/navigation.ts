import type { Route } from './routes';

/** One place for what the menus and the home page list. */
export interface EntreeNav {
  route: Route;
  titre: string;
  resume: string;
}

/** Public: plain arithmetic computed in the browser, no account. */
export const OUTILS: EntreeNav[] = [
  { route: 'credit', titre: 'Credit immobilier', resume: 'Mensualite, cout total, comparatif de durees et capacite d’emprunt.' },
  { route: 'rendement', titre: 'Rendement locatif', resume: 'Rendement brut, net et cash-flow mensuel d’un bien, en une minute.' },
  { route: 'interets', titre: 'Interets composes', resume: 'Ce que devient une epargne reguliere au fil des annees.' },
];

/** Logged-in only, for someone working in Switzerland. */
export const FRONTALIERS: EntreeNav[] = [
  {
    route: 'frontalier',
    titre: 'TOU ou impot a la source',
    resume: 'Taxation ordinaire ulterieure contre impot a la source, pas a pas, justificatifs lus automatiquement.',
  },
];

/** Logged-in only, for someone investing in real estate. */
export const INVESTISSEMENT_LOCATIF: EntreeNav[] = [
  {
    route: 'sci',
    titre: 'SCI / Holding',
    resume: 'SCI a l’IR, a l’IS, holding et LMNP compares sur 30 ans : fiscalite, tresorerie, succession.',
  },
  {
    route: 'saisonnier',
    titre: 'Location saisonniere',
    resume: 'Meuble de tourisme saison par saison, en LMNP : tresorerie, reports et transmission, annonce analysee.',
  },
];

/** The two families of advanced simulators, as the menus and the home page show them. */
export interface Rubrique {
  titre: string;
  /** Section of the help page that explains them. */
  ancreAide: string;
  entrees: EntreeNav[];
}

export const RUBRIQUES: Rubrique[] = [
  { titre: 'Frontaliers', ancreAide: 'frontaliers', entrees: FRONTALIERS },
  { titre: 'Investissement locatif', ancreAide: 'locatif', entrees: INVESTISSEMENT_LOCATIF },
];

/** Every advanced simulator, whatever its family. */
export const SIMULATEURS: EntreeNav[] = RUBRIQUES.flatMap((r) => r.entrees);

const CLE_DERNIER = 'patrimonia.dernierSimulateur';

/** Last advanced simulator opened in this browser, if any. */
export function lireDernierSimulateur(): Route | null {
  try {
    const r = localStorage.getItem(CLE_DERNIER) as Route | null;
    return r && SIMULATEURS.some((s) => s.route === r) ? r : null;
  } catch {
    return null;
  }
}

export function memoriserDernierSimulateur(route: Route) {
  try {
    localStorage.setItem(CLE_DERNIER, route);
  } catch {
    /* private browsing: nothing to remember */
  }
}
