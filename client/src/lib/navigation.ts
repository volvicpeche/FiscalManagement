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
  {
    route: 'prevoyance',
    titre: '3e pilier et rachat LPP',
    resume: 'Ce que rapportent un versement 3a et un rachat LPP, et si la TOU devient avantageuse.',
  },
];

/**
 * Logged-in only, real estate held in one's own name, alone or in
 * indivision: no company to create. A group with no entry is not shown.
 */
export const LOCATIF_DIRECT: EntreeNav[] = [
  {
    route: 'direct',
    titre: 'Location nue ou meublee',
    resume: 'En votre nom : micro-foncier, reel, LMNP micro-BIC et reel compares sur 30 ans.',
  },
];

/**
 * Logged-in only, real estate through a company: statutes, an accountant,
 * general meetings, annual accounts. The seasonal letting sits here: a
 * commercial activity, which several people usually run through a SARL de
 * famille or a company at IS.
 */
export const LOCATIF_SOCIETE: EntreeNav[] = [
  {
    route: 'sci',
    titre: 'SCI / Holding',
    resume: 'SCI a l’IR, SCI a l’IS et holding comparees sur 30 ans : fiscalite, tresorerie, revente, transmission.',
  },
  {
    route: 'saisonnier',
    titre: 'Location saisonniere',
    resume: 'Meuble de tourisme en direct, en SARL de famille ou en societe a l’IS : les trois compares.',
  },
];

/** A titled set of entries inside a family; untitled when the family has a single one. */
export interface GroupeNav {
  titre: string;
  /** One line under the title: what sets this group apart. */
  sousTitre: string;
  entrees: EntreeNav[];
}

/** The families of advanced simulators, as the menus, the home page and the help show them. */
export interface Rubrique {
  titre: string;
  /** One line about the family, under its title on the home page. */
  sousTitre: string;
  /** Section of the help page that explains them. */
  ancreAide: string;
  /** Empty groups are left out. */
  groupes: GroupeNav[];
  /** Every entry of the family, groups flattened. */
  entrees: EntreeNav[];
}

function rubrique(titre: string, sousTitre: string, ancreAide: string, entrees: EntreeNav[]): Rubrique {
  const groupes = entrees.length > 0 ? [{ titre: '', sousTitre: '', entrees }] : [];
  return { titre, sousTitre, ancreAide, groupes, entrees };
}

/**
 * One header menu per family. Real estate is split in two on purpose: held in
 * one's own name, or through a company — two different projects, each page
 * with its own inputs, a box on each to compare with the other.
 */
export const RUBRIQUES: Rubrique[] = [
  rubrique('Frontaliers', '', 'frontaliers', FRONTALIERS),
  rubrique(
    'Investir en direct',
    'En votre nom, seul ou en indivision : pas de societe, pas de statuts, comptabilite legere.',
    'direct',
    LOCATIF_DIRECT,
  ),
  rubrique(
    'Investir en societe',
    'Une societe a creer et a faire vivre : statuts, comptable, assemblees generales, comptes annuels.',
    'societe',
    LOCATIF_SOCIETE,
  ),
].filter((r) => r.entrees.length > 0);

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
