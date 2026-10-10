import { create } from 'zustand';
import type {
  AssetInput,
  AssocieInput,
  ManagementMode,
  RegimeLMNP,
  SaisonnierParams,
  SaisonnierSaisonInput,
  SimulationParams,
  SimulationRequest,
  SimulationResult,
  UserProfile,
} from '@shared/schemas.js';
import { redistributeParts } from '@shared/parts.js';
import type { CostPresets } from '@/hooks/useCostPresets';
import type { CostPresetKey } from '@/lib/profiles';

/**
 * Seasonal letting (meuble de tourisme), compared across the three ways to
 * hold it from one set of inputs:
 *
 *  - DIRECT: in one's own name, alone or in indivision. LMNP or LMP, decided
 *    by the engine (`statutMeubleAuto`, art. 155 IV), micro-BIC possible.
 *  - SARL_FAMILLE: a SARL de famille at IR (art. 239 bis AA) — each associe
 *    taxed as a furnished letter on their share, always at the reel (a
 *    company has no micro regime), with a company's costs.
 *  - SOCIETE_IS: a SAS or SARL at IS — the engine's IS company, the walls
 *    depreciated, the profits distributed as dividends. No manager's pay.
 *
 * An SCI is NOT one of them: letting furnished as a habit makes it liable to
 * IS of its own accord, and it loses what a civil company is for.
 */
/** The CA of a season as the engine reads it (engine/saisonnier.ts, caSaison). */
export function caDeSaison(s: SaisonnierSaisonInput): number {
  if (s.nuits !== undefined && s.prixNuit !== undefined) return s.nuits * s.tauxOccupation * parseFloat(s.prixNuit);
  return parseFloat(s.caPeriode);
}

export type MontageSaisonnier = 'DIRECT' | 'SARL_FAMILLE' | 'SOCIETE_IS';
export const MONTAGES_SAISONNIER: MontageSaisonnier[] = ['DIRECT', 'SARL_FAMILLE', 'SOCIETE_IS'];

/** Relations that may hold parts of a SARL de famille: direct line, siblings, spouses. */
const RELATIONS_FAMILLE: AssocieInput['relation'][] = ['SELF', 'SPOUSE', 'CHILD', 'GRANDCHILD', 'SIBLING'];

export function sarlFamillePossible(associes: AssocieInput[]): boolean {
  return associes.every((a) => RELATIONS_FAMILLE.includes(a.relation));
}

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
  // A gite is let furnished and equipped: beds, kitchen, linen, garden.
  mobilier: '15000.00',
  acquisitionDate: '2026-01-01T00:00:00.000Z',
  annualRent: '0.00',
  chargesYearly: '4000.00',
  propertyTax: '1800.00',
  landRatio: 0.15,
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

const DEFAULT_ASSOCIE: AssocieInput = {
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
  associes: AssocieInput[];
  /** DIRECT only — the SARL and the IS company are always at the reel. */
  regimeLMNP: RegimeLMNP;
  meubleTourismeClasse: boolean;
  /** Three of the four para-hotel services: higher art. 151 septies thresholds. */
  parahotellerie: boolean;
  tauxCotisationsSocialesLMP: number;
  managementMode: ManagementMode;
  params: SimulationParams;
  results: Record<MontageSaisonnier, SimulationResult | null>;
  montageActif: MontageSaisonnier;

  updateAsset: (a: Partial<AssetInput>) => void;
  updateLoan: (l: Partial<NonNullable<AssetInput['loan']>>) => void;
  updateSaison: (season: Saison, patch: Partial<SaisonnierSaisonInput>) => void;
  updateSaisonnierParams: (
    p: Partial<Omit<SaisonnierParams, 'hauteSaison' | 'moyenneSaison' | 'basseSaison'>>,
  ) => void;
  addAssocie: () => void;
  removeAssocie: (index: number) => void;
  updateAssocie: (index: number, a: Partial<AssocieInput>) => void;
  redistribute: () => void;
  updateParams: (p: Partial<SimulationParams>) => void;
  setTauxCotisationsSocialesLMP: (v: number) => void;
  setRegimeLMNP: (v: RegimeLMNP) => void;
  setMeubleTourismeClasse: (v: boolean) => void;
  setParahotellerie: (v: boolean) => void;
  setManagementMode: (m: ManagementMode) => void;
  setResult: (m: MontageSaisonnier, r: SimulationResult | null) => void;
  setMontageActif: (m: MontageSaisonnier) => void;
  /** Replaces every input from a saved scenario. Missing keys keep their default. */
  hydrate: (data: DonneesSauvees) => void;
}

/** What a save holds — older ones carry a single `proprietaire` and a chosen `statut`. */
export type DonneesSauvees = Partial<
  Pick<
    SaisonnierStore,
    | 'asset'
    | 'associes'
    | 'params'
    | 'tauxCotisationsSocialesLMP'
    | 'regimeLMNP'
    | 'meubleTourismeClasse'
    | 'parahotellerie'
    | 'managementMode'
  >
> & { proprietaire?: AssocieInput; statut?: string };

const AUCUN_RESULTAT: Record<MontageSaisonnier, SimulationResult | null> = {
  DIRECT: null,
  SARL_FAMILLE: null,
  SOCIETE_IS: null,
};

const avecParts = (associes: AssocieInput[]) => {
  const self = associes.findIndex((a) => a.relation === 'SELF');
  return redistributeParts(associes, self === -1 ? 0 : self);
};

/**
 * A save made before several associes: its single owner becomes the only
 * associe, held directly. Its chosen LMNP/LMP status is dropped — the engine
 * now decides it from the receipts and the household's other income.
 */
export function associesSauves(data: DonneesSauvees): AssocieInput[] | undefined {
  if (data.associes && data.associes.length > 0) return data.associes;
  if (data.proprietaire) return [{ ...data.proprietaire, relation: 'SELF', partsPercent: 1 }];
  return undefined;
}

export const useSaisonnierStore = create<SaisonnierStore>((set) => ({
  asset: DEFAULT_ASSET,
  associes: [DEFAULT_ASSOCIE],
  regimeLMNP: 'REEL',
  meubleTourismeClasse: false,
  parahotellerie: false,
  tauxCotisationsSocialesLMP: 0.35,
  managementMode: 'EN_LIGNE',
  params: DEFAULT_PARAMS,
  results: AUCUN_RESULTAT,
  montageActif: 'DIRECT',

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

  addAssocie: () =>
    set((s) => ({
      associes: avecParts([
        ...s.associes,
        { ...DEFAULT_ASSOCIE, nom: `Associe ${s.associes.length + 1}`, relation: 'CHILD', autresRevenus: '30000.00' },
      ]),
    })),
  removeAssocie: (index) => set((s) => ({ associes: avecParts(s.associes.filter((_, i) => i !== index)) })),
  updateAssocie: (index, a) =>
    set((s) => ({ associes: s.associes.map((x, i) => (i === index ? { ...x, ...a } : x)) })),
  redistribute: () => set((s) => ({ associes: avecParts(s.associes) })),

  updateParams: (p) => set((s) => ({ params: { ...s.params, ...p } })),
  setTauxCotisationsSocialesLMP: (v) => set({ tauxCotisationsSocialesLMP: v }),
  setRegimeLMNP: (regimeLMNP) => set({ regimeLMNP }),
  setMeubleTourismeClasse: (meubleTourismeClasse) => set({ meubleTourismeClasse }),
  setParahotellerie: (parahotellerie) => set({ parahotellerie }),
  setManagementMode: (managementMode) => set({ managementMode }),
  setResult: (m, r) => set((s) => ({ results: { ...s.results, [m]: r } })),
  setMontageActif: (montageActif) => set({ montageActif }),

  hydrate: (data) =>
    set((s) => ({
      asset: data.asset ?? s.asset,
      associes: associesSauves(data) ?? s.associes,
      params: data.params ?? s.params,
      tauxCotisationsSocialesLMP: data.tauxCotisationsSocialesLMP ?? s.tauxCotisationsSocialesLMP,
      regimeLMNP: data.regimeLMNP ?? s.regimeLMNP,
      meubleTourismeClasse: data.meubleTourismeClasse ?? s.meubleTourismeClasse,
      parahotellerie: data.parahotellerie ?? false,
      managementMode: data.managementMode ?? s.managementMode,
      // A loaded scenario has not been run yet.
      results: AUCUN_RESULTAT,
    })),
}));

export interface EntreesSaisonnier {
  asset: AssetInput;
  associes: AssocieInput[];
  regimeLMNP: RegimeLMNP;
  meubleTourismeClasse: boolean;
  parahotellerie: boolean;
  tauxCotisationsSocialesLMP: number;
  managementMode: ManagementMode;
  params: SimulationParams;
}

export const NOMS_MONTAGES: Record<MontageSaisonnier, string> = {
  DIRECT: 'En direct',
  SARL_FAMILLE: 'SARL de famille',
  SOCIETE_IS: 'Societe a l’IS',
};

/** What the SAVE holds: every input, none of the results. */
export function donneesASauver(s: EntreesSaisonnier): DonneesSauvees {
  return {
    asset: s.asset,
    associes: s.associes,
    params: s.params,
    tauxCotisationsSocialesLMP: s.tauxCotisationsSocialesLMP,
    regimeLMNP: s.regimeLMNP,
    meubleTourismeClasse: s.meubleTourismeClasse,
    parahotellerie: s.parahotellerie,
    managementMode: s.managementMode,
  };
}

/**
 * The three requests, one per way to hold the property. `presets` gives the
 * SARL de famille its costs: a company's setup (statutes, legal notice,
 * registration) and an LMP's yearly books, which no structure type carries
 * on its own.
 */
export function buildSaisonnierRequests(
  state: EntreesSaisonnier,
  presets: CostPresets,
): Record<MontageSaisonnier, SimulationRequest> {
  const premier = state.associes.find((a) => a.relation === 'SELF') ?? state.associes[0];
  const userProfile: UserProfile = {
    maritalStatus: premier.maritalStatus,
    childrenCount: premier.childrenCount,
    socialChargeRegime: premier.socialChargeRegime,
    autresRevenus: premier.autresRevenus,
    revenusExoneres: premier.revenusExoneres,
  };
  const commun = {
    taxRegime: 'IR' as const,
    ownershipShare: 1,
    associes: state.associes,
    assets: [state.asset],
    subsidiaries: [],
    tauxCotisationsSocialesLMP: state.tauxCotisationsSocialesLMP,
    cotisationsMinimalesLMP: '1200.00',
    meubleTourismeClasse: state.meubleTourismeClasse,
    parahotellerie: state.parahotellerie,
  };
  const mode = state.managementMode;
  const lignes = (key: CostPresetKey) => presets[mode][key];
  // Held directly or through translucent shares: nothing is distributed, and
  // the heirs receive walls or family shares without an illiquidity discount.
  const paramsIR = { ...state.params, dividendDistributionRate: 0, illiquidityDiscount: 0 };

  return {
    DIRECT: {
      userProfile,
      structures: [
        {
          ...commun,
          name: NOMS_MONTAGES.DIRECT,
          type: 'LMNP',
          statutMeubleAuto: true,
          regimeLMNP: state.regimeLMNP,
          // Empty: the engine picks the LMNP or LMP preset once it knows the status.
          costs: { mode, constitution: [], annuel: [] },
        },
      ],
      params: paramsIR,
    },
    SARL_FAMILLE: {
      userProfile,
      structures: [
        {
          ...commun,
          name: NOMS_MONTAGES.SARL_FAMILLE,
          type: 'LMNP',
          statutMeubleAuto: true,
          regimeLMNP: 'REEL',
          costs: { mode, constitution: lignes('SCI_IS').constitution, annuel: lignes('LMP').annuel },
        },
      ],
      params: paramsIR,
    },
    SOCIETE_IS: {
      userProfile,
      structures: [
        {
          ...commun,
          name: NOMS_MONTAGES.SOCIETE_IS,
          type: 'SCI_IS',
          taxRegime: 'IS',
          costs: { mode, constitution: [], annuel: [] },
        },
      ],
      // Dividends only: everything distributable goes to the associes.
      params: { ...state.params, dividendDistributionRate: 1 },
    },
  };
}
