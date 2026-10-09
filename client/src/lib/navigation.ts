import type { Route } from './router';

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

/** Logged-in only: the engine, saved scenarios, document reading. */
export const SIMULATEURS: EntreeNav[] = [
  {
    route: 'sci',
    titre: 'SCI / Holding',
    resume: 'SCI a l’IR, a l’IS, holding et LMNP compares sur 30 ans : fiscalite, tresorerie, succession.',
  },
  {
    route: 'frontalier',
    titre: 'Frontalier Suisse',
    resume: 'Taxation ordinaire ulterieure contre impot a la source, pas a pas, justificatifs lus automatiquement.',
  },
  {
    route: 'saisonnier',
    titre: 'Location saisonniere',
    resume: 'Meuble de tourisme saison par saison, en LMNP : tresorerie, reports et transmission, annonce analysee.',
  },
];

export const ROUTES_PROTEGEES = new Set<Route>(SIMULATEURS.map((s) => s.route));
