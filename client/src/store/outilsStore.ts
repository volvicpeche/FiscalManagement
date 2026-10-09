import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { TypeBien } from '@shared/outils/credit.js';
import type { Capitalisation } from '@shared/outils/interetsComposes.js';

/**
 * Inputs of the three quick tools. Rates are held in percent (3.5 means
 * 3.5 %) because that is what the user types; the pages divide by 100 before
 * calling shared/outils.
 *
 * Kept in this browser's localStorage so a reload does not wipe them — a
 * convenience for one visitor, never shared, never sent anywhere. zustand's
 * persist swallows a storage that throws (private browsing): the tools then
 * simply start from the defaults.
 */

export interface SaisieCredit {
  prix: number;
  typeBien: TypeBien;
  /** null: the default for the type of property. */
  tauxNotaire: number | null;
  travaux: number;
  fraisDossier: number;
  apport: number;
  taux: number;
  annees: number;
  tauxAssurance: number;
  revenus: number;
  chargesCredits: number;
  /** Comparison rows: one rate per duration. */
  durees: { annees: number; taux: number }[];
}

export interface SaisieCapacite {
  revenus: number;
  chargesCredits: number;
  tauxEndettementMax: number;
  taux: number;
  tauxAssurance: number;
  annees: number;
  apport: number;
  typeBien: TypeBien;
  travaux: number;
}

export interface SaisieRendement {
  prix: number;
  typeBien: TypeBien;
  travaux: number;
  loyerMensuel: number;
  vacanceMois: number;
  chargesAnnuelles: number;
  taxeFonciere: number;
  avecCredit: boolean;
  apport: number;
  taux: number;
  annees: number;
  tauxAssurance: number;
}

export interface SaisieEpargne {
  capitalInitial: number;
  versementMensuel: number;
  tauxAnnuel: number;
  annees: number;
  capitalisation: Capitalisation;
  inflation: number;
}

interface Saisies {
  credit: SaisieCredit;
  capacite: SaisieCapacite;
  rendement: SaisieRendement;
  epargne: SaisieEpargne;
}

const DEFAUTS: Saisies = {
  credit: {
    prix: 250000,
    typeBien: 'ANCIEN',
    tauxNotaire: null,
    travaux: 0,
    fraisDossier: 2500,
    apport: 30000,
    taux: 3.3,
    annees: 20,
    tauxAssurance: 0.3,
    revenus: 0,
    chargesCredits: 0,
    durees: [
      { annees: 15, taux: 3.15 },
      { annees: 20, taux: 3.3 },
      { annees: 25, taux: 3.45 },
    ],
  },
  capacite: {
    revenus: 4500,
    chargesCredits: 0,
    tauxEndettementMax: 35,
    taux: 3.3,
    tauxAssurance: 0.3,
    annees: 25,
    apport: 30000,
    typeBien: 'ANCIEN',
    travaux: 0,
  },
  rendement: {
    prix: 150000,
    typeBien: 'ANCIEN',
    travaux: 0,
    loyerMensuel: 750,
    vacanceMois: 0.5,
    chargesAnnuelles: 900,
    taxeFonciere: 1000,
    avecCredit: true,
    apport: 15000,
    taux: 3.3,
    annees: 20,
    tauxAssurance: 0.3,
  },
  epargne: {
    capitalInitial: 10000,
    versementMensuel: 200,
    tauxAnnuel: 5,
    annees: 20,
    capitalisation: 'MENSUELLE',
    inflation: 2,
  },
};

interface OutilsStore extends Saisies {
  maj: <K extends keyof Saisies>(outil: K, patch: Partial<Saisies[K]>) => void;
  reinitialiser: (outil: keyof Saisies) => void;
}

export const useOutilsStore = create<OutilsStore>()(
  persist(
    (set) => ({
      ...DEFAUTS,
      maj: (outil, patch) => set((s) => ({ [outil]: { ...s[outil], ...patch } }) as Partial<Saisies>),
      reinitialiser: (outil) => set({ [outil]: DEFAUTS[outil] } as Partial<Saisies>),
    }),
    {
      name: 'patrimonia.outils',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // A field added later must not come back undefined from an older save.
      merge: (sauve, actuel) => {
        const s = (sauve ?? {}) as Partial<Saisies>;
        return {
          ...actuel,
          credit: { ...actuel.credit, ...s.credit },
          capacite: { ...actuel.capacite, ...s.capacite },
          rendement: { ...actuel.rendement, ...s.rendement },
          epargne: { ...actuel.epargne, ...s.epargne },
        };
      },
    },
  ),
);
