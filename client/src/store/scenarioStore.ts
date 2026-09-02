import { create } from 'zustand';
import type {
  AssetInput,
  AssocieInput,
  EntityCostsInput,
  ManagementMode,
  ScenarioProfile,
  SimulationParams,
  SimulationRequest,
  SimulationResult,
  UserProfile,
} from '@shared/schemas.js';
import { redistributeParts } from '@shared/parts.js';
import { PROFILE_ORDER } from '@/lib/profiles';

/**
 * The three scenarios are DERIVED from one set of shared inputs rather than
 * kept as three copies to be synced. Editing the property, the loan or the
 * associes therefore applies to all three comparisons by construction.
 */

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_ASSET: AssetInput = {
  type: 'REAL_ESTATE',
  label: 'Bien immobilier',
  purchasePrice: '200000.00',
  notaryFees: '16000.00',
  renovationCosts: '30000.00',
  acquisitionDate: '2026-01-01T00:00:00.000Z',
  annualRent: '12000.00',
  chargesYearly: '2400.00',
  propertyTax: '1200.00',
  loan: {
    principal: '180000.00',
    interestRate: 0.035,
    insuranceRate: 0.0035,
    durationMonths: 240,
    startDate: '2026-01-01T00:00:00.000Z',
    type: 'AMORTISSABLE',
  },
};

const DEFAULT_PARAMS: SimulationParams = {
  horizonYears: 30,
  inflationRate: 0.02,
  propertyGrowth: 0.015,
  rentGrowthRate: 0.02,
  chargesGrowthRate: 0.02,
  propertyTaxGrowthRate: 0.02,
  dividendDistributionRate: 0.3,
  ccaRepaymentRate: 0,
  illiquidityDiscount: 0.1,
  demembrement: false,
  objectif: 'TRANSMISSION',
};

const DEFAULT_PROFILE: UserProfile = {
  maritalStatus: 'MARRIED',
  childrenCount: 2,
  socialChargeRegime: 'SWISS_EXEMPT',
  // Fallback only: when associes are declared, each one carries their own
  // other income and this is never read.
  autresRevenus: '0.00',
};

export function makeAssocie(over: Partial<AssocieInput> = {}): AssocieInput {
  return {
    nom: 'Nouvel associe',
    partsPercent: 0,
    relation: 'OTHER',
    maritalStatus: 'SINGLE',
    childrenCount: 0,
    autresRevenus: '0.00',
    socialChargeRegime: 'STANDARD',
    apportCapital: '0.00',
    apportCompteCourant: '0.00',
    tauxInteretCCA: 0,
    ...over,
  };
}

/**
 * The majority of the parts goes to the SELF associe when there is one, so the
 * SCI always has a clear decision-maker.
 */
function withDistributedParts(associes: AssocieInput[]): AssocieInput[] {
  const selfIndex = associes.findIndex((a) => a.relation === 'SELF');
  return redistributeParts(associes, selfIndex === -1 ? 0 : selfIndex);
}

const DEFAULT_ASSOCIES: AssocieInput[] = withDistributedParts([
  makeAssocie({
    nom: 'Moi',
    partsPercent: 0.5,
    relation: 'SELF',
    maritalStatus: 'MARRIED',
    childrenCount: 2,
    autresRevenus: '90000.00',
    socialChargeRegime: 'SWISS_EXEMPT',
    apportCapital: '500.00',
    apportCompteCourant: '40000.00',
  }),
  makeAssocie({
    nom: 'Conjoint(e)',
    partsPercent: 0.5,
    relation: 'SPOUSE',
    maritalStatus: 'MARRIED',
    childrenCount: 2,
    autresRevenus: '35000.00',
    socialChargeRegime: 'STANDARD',
    apportCapital: '500.00',
  }),
]);

const EMPTY_RESULTS: Record<ScenarioProfile, SimulationResult | null> = {
  SCI_IR: null,
  SCI_IS_SEULE: null,
  SCI_IS_HOLDING: null,
};

const EMPTY_OVERRIDES: Record<ScenarioProfile, Record<string, EntityCostsInput>> = {
  SCI_IR: {},
  SCI_IS_SEULE: {},
  SCI_IS_HOLDING: {},
};

// ─── Scenario construction ───────────────────────────────────────────────────

export interface SharedInputs {
  userProfile: UserProfile;
  asset: AssetInput;
  associes: AssocieInput[];
  params: SimulationParams;
  managementMode: ManagementMode;
  costOverrides: Record<ScenarioProfile, Record<string, EntityCostsInput>>;
}

function costsFor(
  shared: SharedInputs,
  profile: ScenarioProfile,
  entityName: string,
): EntityCostsInput {
  const override = shared.costOverrides[profile]?.[entityName];
  if (override) return override;
  return { mode: shared.managementMode, constitution: [], annuel: [] };
}

/** Builds the request for one profile out of the shared inputs. */
export function buildScenario(profile: ScenarioProfile, shared: SharedInputs): SimulationRequest {
  const { userProfile, asset, associes, params } = shared;

  if (profile === 'SCI_IR') {
    return {
      userProfile,
      structures: [
        {
          name: 'SCI (IR)',
          type: 'SCI_IR',
          taxRegime: 'IR',
          ownershipShare: 1,
          tauxCotisationsSocialesLMP: 0.35,
          cotisationsMinimalesLMP: '1200.00',
          associes,
          costs: costsFor(shared, profile, 'SCI (IR)'),
          assets: [asset],
          subsidiaries: [],
        },
      ],
      // An SCI at IR distributes nothing: the associes are taxed on the
      // result whether they take the cash out or not.
      params: { ...params, dividendDistributionRate: 0 },
    };
  }

  if (profile === 'SCI_IS_SEULE') {
    return {
      userProfile,
      structures: [
        {
          name: 'SCI (IS)',
          type: 'SCI_IS',
          taxRegime: 'IS',
          ownershipShare: 1,
          tauxCotisationsSocialesLMP: 0.35,
          cotisationsMinimalesLMP: '1200.00',
          associes,
          costs: costsFor(shared, profile, 'SCI (IS)'),
          assets: [asset],
          subsidiaries: [],
        },
      ],
      params,
    };
  }

  // Holding + SCI: the associes hold the holding, which owns the SCI outright.
  return {
    userProfile,
    structures: [
      {
        name: 'Holding',
        type: 'HOLDING',
        taxRegime: 'IS',
        ownershipShare: 1,
        tauxCotisationsSocialesLMP: 0.35,
          cotisationsMinimalesLMP: '1200.00',
        associes,
        costs: costsFor(shared, profile, 'Holding'),
        assets: [],
        subsidiaries: [
          {
            name: 'SCI (IS)',
            type: 'SCI_IS',
            taxRegime: 'IS',
            ownershipShare: 1,
            associes: [],
            costs: costsFor(shared, profile, 'SCI (IS)'),
            assets: [asset],
            subsidiaries: [],
          },
        ],
      },
    ],
    params,
  };
}

export function buildAllScenarios(shared: SharedInputs): Record<ScenarioProfile, SimulationRequest> {
  return {
    SCI_IR: buildScenario('SCI_IR', shared),
    SCI_IS_SEULE: buildScenario('SCI_IS_SEULE', shared),
    SCI_IS_HOLDING: buildScenario('SCI_IS_HOLDING', shared),
  };
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface ScenarioStore extends SharedInputs {
  results: Record<ScenarioProfile, SimulationResult | null>;
  /** Profile whose cost breakdown is on screen. */
  activeProfile: ScenarioProfile;

  updateUserProfile: (p: Partial<UserProfile>) => void;
  updateAsset: (a: Partial<AssetInput>) => void;
  updateLoan: (l: Partial<NonNullable<AssetInput['loan']>>) => void;
  updateParams: (p: Partial<SimulationParams>) => void;

  addAssocie: () => void;
  removeAssocie: (index: number) => void;
  updateAssocie: (index: number, a: Partial<AssocieInput>) => void;
  /** Re-splits the parts, leaving the majority to the SELF associe. */
  redistribute: () => void;

  setManagementMode: (m: ManagementMode) => void;
  setCostOverride: (profile: ScenarioProfile, entityName: string, costs: EntityCostsInput) => void;
  resetCostOverride: (profile: ScenarioProfile, entityName: string) => void;

  /** Replaces every input from a saved scenario. Missing keys keep their default. */
  hydrate: (data: Partial<SharedInputs>) => void;
  setActiveProfile: (p: ScenarioProfile) => void;
  setResult: (p: ScenarioProfile, r: SimulationResult | null) => void;
  clearResults: () => void;
}

export const useScenarioStore = create<ScenarioStore>((set) => ({
  userProfile: DEFAULT_PROFILE,
  asset: DEFAULT_ASSET,
  associes: DEFAULT_ASSOCIES,
  params: DEFAULT_PARAMS,
  managementMode: 'EN_LIGNE',
  costOverrides: EMPTY_OVERRIDES,
  results: EMPTY_RESULTS,
  activeProfile: 'SCI_IS_SEULE',

  updateUserProfile: (p) => set((s) => ({ userProfile: { ...s.userProfile, ...p } })),
  updateAsset: (a) => set((s) => ({ asset: { ...s.asset, ...a } })),
  updateLoan: (l) =>
    set((s) => (s.asset.loan ? { asset: { ...s.asset, loan: { ...s.asset.loan, ...l } } } : {})),
  updateParams: (p) => set((s) => ({ params: { ...s.params, ...p } })),

  // Adding or removing an associe re-splits the parts, so the total always
  // lands back on 100 % without the user having to fix it by hand.
  addAssocie: () =>
    set((s) => ({
      associes: withDistributedParts([
        ...s.associes,
        makeAssocie({ nom: `Associe ${s.associes.length + 1}` }),
      ]),
    })),

  removeAssocie: (index) =>
    set((s) => ({ associes: withDistributedParts(s.associes.filter((_, i) => i !== index)) })),

  updateAssocie: (index, a) =>
    set((s) => ({
      associes: s.associes.map((assoc, i) => (i === index ? { ...assoc, ...a } : assoc)),
    })),

  redistribute: () => set((s) => ({ associes: withDistributedParts(s.associes) })),

  setManagementMode: (managementMode) => set({ managementMode, costOverrides: EMPTY_OVERRIDES }),

  setCostOverride: (profile, entityName, costs) =>
    set((s) => ({
      costOverrides: {
        ...s.costOverrides,
        [profile]: { ...s.costOverrides[profile], [entityName]: costs },
      },
    })),

  resetCostOverride: (profile, entityName) =>
    set((s) => {
      const next = { ...s.costOverrides[profile] };
      delete next[entityName];
      return { costOverrides: { ...s.costOverrides, [profile]: next } };
    }),

  hydrate: (data) =>
    set((s) => ({
      userProfile: data.userProfile ?? s.userProfile,
      asset: data.asset ?? s.asset,
      associes: data.associes ?? s.associes,
      params: data.params ?? s.params,
      managementMode: data.managementMode ?? s.managementMode,
      costOverrides: data.costOverrides ?? s.costOverrides,
      // A loaded scenario has not been run yet.
      results: EMPTY_RESULTS,
    })),

  setActiveProfile: (activeProfile) => set({ activeProfile }),
  setResult: (p, r) => set((s) => ({ results: { ...s.results, [p]: r } })),
  clearResults: () => set({ results: EMPTY_RESULTS }),
}));

// ─── Derived selectors ───────────────────────────────────────────────────────

export function selectSharedInputs(s: ScenarioStore): SharedInputs {
  return {
    userProfile: s.userProfile,
    asset: s.asset,
    associes: s.associes,
    params: s.params,
    managementMode: s.managementMode,
    costOverrides: s.costOverrides,
  };
}

export function partsTotal(associes: AssocieInput[]): number {
  return associes.reduce((sum, a) => sum + a.partsPercent, 0);
}

export function partsAreValid(associes: AssocieInput[]): boolean {
  if (associes.length === 0) return true;
  return Math.abs(partsTotal(associes) - 1) < 1e-6;
}

export function hasAnyResult(results: Record<ScenarioProfile, SimulationResult | null>): boolean {
  return PROFILE_ORDER.some((p) => results[p] !== null);
}
