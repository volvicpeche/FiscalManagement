import { create } from 'zustand';
import type {
  AssetInput,
  AssocieInput,
  SaisonnierParams,
  SaisonnierSaisonInput,
  SimulationParams,
  SimulationRequest,
  SimulationResult,
} from '@shared/schemas.js';

/**
 * LMP is a standalone product, not a fourth entry in the SCI/Holding
 * comparator: an SCI cannot legally run a meublé saisonnier activity (see
 * CLAUDE.md), so this scenario lives in its own store rather than being
 * squeezed into `scenarioStore`'s three-way `ScenarioProfile` shape.
 *
 * v1 supports a single owner (the common case for an LMP), not a full
 * multi-associe indivision like the SCI forms — the engine already supports
 * more, this store just doesn't expose it yet.
 */

type Saison = 'hauteSaison' | 'moyenneSaison' | 'basseSaison';

const DEFAULT_SAISONNIER: SaisonnierParams = {
  hauteSaison: { tauxOccupation: 0.85, caPeriode: '15000.00' },
  moyenneSaison: { tauxOccupation: 0.55, caPeriode: '8000.00' },
  basseSaison: { tauxOccupation: 0.25, caPeriode: '2500.00' },
  gestion: 'CONCIERGERIE',
  commissionPlateforme: 0.15,
  fraisMenageLingeAnnuel: '3000.00',
  fraisConciergeriePercent: 0.25,
};

const DEFAULT_ASSET: AssetInput = {
  type: 'REAL_ESTATE',
  label: 'Mas en Provence',
  purchasePrice: '450000.00',
  notaryFees: '36000.00',
  renovationCosts: '20000.00',
  acquisitionDate: '2026-01-01T00:00:00.000Z',
  annualRent: '0.00',
  chargesYearly: '4000.00',
  propertyTax: '1800.00',
  saisonnier: DEFAULT_SAISONNIER,
  loan: {
    principal: '350000.00',
    interestRate: 0.035,
    insuranceRate: 0.0035,
    durationMonths: 240,
    startDate: '2026-01-01T00:00:00.000Z',
    type: 'AMORTISSABLE',
  },
};

const DEFAULT_PROPRIETAIRE: AssocieInput = {
  nom: 'Vous',
  partsPercent: 1,
  relation: 'SELF',
  maritalStatus: 'MARRIED',
  childrenCount: 0,
  autresRevenus: '60000.00',
  socialChargeRegime: 'STANDARD',
  apportCapital: '0.00',
  apportCompteCourant: '0.00',
  tauxInteretCCA: 0,
};

const DEFAULT_PARAMS: SimulationParams = {
  horizonYears: 20,
  inflationRate: 0.02,
  propertyGrowth: 0.015,
  rentGrowthRate: 0.02,
  chargesGrowthRate: 0.02,
  propertyTaxGrowthRate: 0.02,
  dividendDistributionRate: 0,
  ccaRepaymentRate: 0,
  illiquidityDiscount: 0.1,
  demembrement: false,
  objectif: 'TRANSMISSION',
};

interface SaisonnierStore {
  asset: AssetInput;
  proprietaire: AssocieInput;
  tauxCotisationsSocialesLMP: number;
  params: SimulationParams;
  result: SimulationResult | null;

  updateAsset: (a: Partial<AssetInput>) => void;
  updateLoan: (l: Partial<NonNullable<AssetInput['loan']>>) => void;
  updateSaison: (season: Saison, patch: Partial<SaisonnierSaisonInput>) => void;
  updateSaisonnierParams: (
    p: Partial<Omit<SaisonnierParams, 'hauteSaison' | 'moyenneSaison' | 'basseSaison'>>,
  ) => void;
  updateProprietaire: (a: Partial<AssocieInput>) => void;
  updateParams: (p: Partial<SimulationParams>) => void;
  setTauxCotisationsSocialesLMP: (v: number) => void;
  setResult: (r: SimulationResult | null) => void;
  /** Replaces every input from a saved scenario. Missing keys keep their default. */
  hydrate: (data: Partial<Pick<SaisonnierStore, 'asset' | 'proprietaire' | 'params' | 'tauxCotisationsSocialesLMP'>>) => void;
}

export const useSaisonnierStore = create<SaisonnierStore>((set) => ({
  asset: DEFAULT_ASSET,
  proprietaire: DEFAULT_PROPRIETAIRE,
  tauxCotisationsSocialesLMP: 0.35,
  params: DEFAULT_PARAMS,
  result: null,

  updateAsset: (a) => set((s) => ({ asset: { ...s.asset, ...a } })),

  updateLoan: (l) =>
    set((s) => (s.asset.loan ? { asset: { ...s.asset, loan: { ...s.asset.loan, ...l } } } : {})),

  updateSaison: (season, patch) =>
    set((s) => ({
      asset: {
        ...s.asset,
        saisonnier: {
          ...(s.asset.saisonnier ?? DEFAULT_SAISONNIER),
          [season]: { ...(s.asset.saisonnier ?? DEFAULT_SAISONNIER)[season], ...patch },
        },
      },
    })),

  updateSaisonnierParams: (p) =>
    set((s) => ({
      asset: { ...s.asset, saisonnier: { ...(s.asset.saisonnier ?? DEFAULT_SAISONNIER), ...p } },
    })),

  updateProprietaire: (a) => set((s) => ({ proprietaire: { ...s.proprietaire, ...a } })),
  updateParams: (p) => set((s) => ({ params: { ...s.params, ...p } })),
  setTauxCotisationsSocialesLMP: (v) => set({ tauxCotisationsSocialesLMP: v }),
  setResult: (result) => set({ result }),

  hydrate: (data) =>
    set((s) => ({
      asset: data.asset ?? s.asset,
      proprietaire: data.proprietaire ?? s.proprietaire,
      params: data.params ?? s.params,
      tauxCotisationsSocialesLMP:
        data.tauxCotisationsSocialesLMP ?? s.tauxCotisationsSocialesLMP,
      // A loaded scenario has not been run yet.
      result: null,
    })),
}));

/** Builds the single-structure LMP request the engine expects. */
export function buildSaisonnierRequest(state: {
  asset: AssetInput;
  proprietaire: AssocieInput;
  tauxCotisationsSocialesLMP: number;
  params: SimulationParams;
}): SimulationRequest {
  return {
    userProfile: {
      maritalStatus: state.proprietaire.maritalStatus,
      childrenCount: state.proprietaire.childrenCount,
      socialChargeRegime: state.proprietaire.socialChargeRegime,
    },
    structures: [
      {
        name: 'LMP',
        type: 'LMP',
        taxRegime: 'IR',
        ownershipShare: 1,
        associes: [state.proprietaire],
        costs: { mode: 'EN_LIGNE', constitution: [], annuel: [] },
        assets: [state.asset],
        subsidiaries: [],
        tauxCotisationsSocialesLMP: state.tauxCotisationsSocialesLMP,
      },
    ],
    params: state.params,
  };
}
