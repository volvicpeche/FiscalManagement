import { create } from 'zustand';
import type {
  CommuneGe,
  EtatCivilGe,
  FrontalierRequestInput,
  PrevoyanceRequestInput,
  PrevoyanceResult,
} from '@shared/frontalier.js';

/**
 * The 3a / LPP tool: a short form of its own, or the full household taken
 * over from the TOU simulator. Kept in memory only, like the TOU inputs: a
 * reload forgets the figures.
 */

export type ActiviteConjoint = 'AUCUNE' | 'FRANCE' | 'SUISSE';

export interface SaisieSimple {
  etatCivil: EtatCivilGe;
  communeTravail: CommuneGe;
  enfants: number;
  salaireBrut: string;
  cotisationsSociales: string;
  lppOrdinaire: string;
  affilieLpp: boolean;
  impotSourceRetenu: string;
  primesAssuranceMaladie: string;
  conjointActivite: ActiviteConjoint;
  /** CHF for a Swiss salary, EUR for a French one. */
  conjointRevenuBrut: string;
  /** French net taxable income (EUR), for the rate; ignored for a Swiss salary. */
  conjointRevenuNetEur: string;
}

export interface Versements {
  pilier3a: string;
  rachatLpp: string;
  /** As typed in the field; empty: unknown. Converted by buildPrevoyanceRequest. */
  potentielRachat: string;
}

/** AVS/AI/APG 5,3 % + AC 1,1 % + AANP about 1 %: what a certificat de salaire usually shows. */
export const TAUX_COTISATIONS_ESTIME = 0.074;
export const TAUX_CHANGE_DEFAUT = '0.9300';

export const SAISIE_VIDE: SaisieSimple = {
  etatCivil: 'CELIBATAIRE',
  communeTravail: 'GENEVE',
  enfants: 0,
  salaireBrut: '0.00',
  cotisationsSociales: '0.00',
  lppOrdinaire: '0.00',
  affilieLpp: true,
  impotSourceRetenu: '0.00',
  primesAssuranceMaladie: '0.00',
  conjointActivite: 'AUCUNE',
  conjointRevenuBrut: '0.00',
  conjointRevenuNetEur: '0.00',
};

export const VERSEMENTS_DEFAUT: Versements = { pilier3a: '7258.00', rachatLpp: '0.00', potentielRachat: '' };

/** The household of the short form, as the engine expects it. Children count, ages unknown: 10 years, no childcare. */
export function foyerSimple(s: SaisieSimple): FrontalierRequestInput {
  const marie = s.etatCivil === 'MARIE';
  return {
    annee: 2026,
    etatCivil: s.etatCivil,
    canton: 'GE',
    communeTravail: s.communeTravail,
    tauxChangeEurChf: TAUX_CHANGE_DEFAUT,
    contribuable: {
      activite: 'SUISSE',
      salaireBrut: s.salaireBrut,
      cotisationsSociales: s.cotisationsSociales,
      lppOrdinaire: s.lppOrdinaire,
      affilieLpp: s.affilieLpp,
      impotSourceRetenu: s.impotSourceRetenu,
    },
    conjoint: marie
      ? s.conjointActivite === 'SUISSE'
        ? { activite: 'SUISSE', salaireBrut: s.conjointRevenuBrut }
        : s.conjointActivite === 'FRANCE'
          ? { activite: 'FRANCE', revenuFranceBrutEur: s.conjointRevenuBrut, revenuFranceNetEur: s.conjointRevenuNetEur }
          : { activite: 'AUCUNE' }
      : undefined,
    enfants: Array.from({ length: s.enfants }, () => ({ age: 10, fraisGarde: '0.00' })),
    deductions: { primesAssuranceMaladie: s.primesAssuranceMaladie },
  };
}

/** The potential as typed: empty or unreadable means unknown. */
function potentiel(saisi: string): string | undefined {
  const x = parseFloat(saisi);
  return Number.isFinite(x) && x >= 0 ? x.toFixed(2) : undefined;
}

export function buildPrevoyanceRequest(foyer: FrontalierRequestInput, v: Versements): PrevoyanceRequestInput {
  return {
    requete: foyer,
    personne: 'contribuable',
    pilier3a: v.pilier3a,
    rachatLpp: v.rachatLpp,
    potentielRachat: potentiel(v.potentielRachat),
  };
}

interface PrevoyanceStore {
  saisie: SaisieSimple;
  /** The full household of the TOU simulator, when taken over; null: the short form applies. */
  foyerTou: FrontalierRequestInput | null;
  versements: Versements;
  result: PrevoyanceResult | null;
  majSaisie: (patch: Partial<SaisieSimple>) => void;
  majVersements: (patch: Partial<Versements>) => void;
  reprendreTou: (foyer: FrontalierRequestInput) => void;
  oublierTou: () => void;
  setResult: (r: PrevoyanceResult | null) => void;
}

export const usePrevoyanceStore = create<PrevoyanceStore>((set) => ({
  saisie: SAISIE_VIDE,
  foyerTou: null,
  versements: VERSEMENTS_DEFAUT,
  result: null,
  majSaisie: (patch) => set((s) => ({ saisie: { ...s.saisie, ...patch }, result: null })),
  majVersements: (patch) => set((s) => ({ versements: { ...s.versements, ...patch } })),
  // The payments already typed in the TOU become the starting point here.
  reprendreTou: (foyer) =>
    set((s) => ({
      foyerTou: foyer,
      versements: {
        ...s.versements,
        pilier3a: foyer.contribuable.pilier3a ?? s.versements.pilier3a,
        rachatLpp: foyer.contribuable.lppRachats ?? s.versements.rachatLpp,
      },
      result: null,
    })),
  oublierTou: () => set({ foyerTou: null, result: null }),
  setResult: (result) => set({ result }),
}));
