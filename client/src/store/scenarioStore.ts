import { create } from 'zustand';
import type { SimulationRequest, SimulationResult } from '@shared/schemas.js';

// ─── Default asset (shared between scenarios) ────────────────────────────────

const DEFAULT_ASSET = {
  type: 'REAL_ESTATE' as const,
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
    type: 'AMORTISSABLE' as const,
  },
};

const DEFAULT_PARAMS = {
  horizonYears: 30,
  inflationRate: 0.02,
  propertyGrowth: 0.015,
  rentGrowthRate: 0.02,
  chargesGrowthRate: 0.02,
  propertyTaxGrowthRate: 0.02,
  dividendDistributionRate: 0,
};

const DEFAULT_PROFILE = {
  maritalStatus: 'MARRIED' as const,
  childrenCount: 2,
  socialChargeRegime: 'SWISS_EXEMPT' as const,
};

// ─── Scenario A: Holding + SCI IS ────────────────────────────────────────────

const SCENARIO_A: SimulationRequest = {
  userProfile: DEFAULT_PROFILE,
  structures: [
    {
      name: 'Holding',
      type: 'HOLDING',
      taxRegime: 'IS',
      ownershipShare: 1.0,
      assets: [],
      subsidiaries: [
        {
          name: 'SCI Alpha (IS)',
          type: 'SCI_IS',
          taxRegime: 'IS',
          ownershipShare: 0.95,
          assets: [{ ...DEFAULT_ASSET }],
          subsidiaries: [],
        },
      ],
    },
  ],
  params: { ...DEFAULT_PARAMS, dividendDistributionRate: 0.3 },
};

// ─── Scenario B: SCI IR (direct, no holding) ────────────────────────────────

const SCENARIO_B: SimulationRequest = {
  userProfile: DEFAULT_PROFILE,
  structures: [
    {
      name: 'SCI Beta (IR)',
      type: 'SCI_IR',
      taxRegime: 'IR',
      ownershipShare: 1.0,
      assets: [{ ...DEFAULT_ASSET }],
      subsidiaries: [],
    },
  ],
  params: { ...DEFAULT_PARAMS },
};

// ─── Store ───────────────────────────────────────────────────────────────────

interface ScenarioStore {
  scenarioA: SimulationRequest;
  scenarioB: SimulationRequest;
  resultA: SimulationResult | null;
  resultB: SimulationResult | null;
  comparisonMode: boolean;

  setScenarioA: (s: SimulationRequest) => void;
  setScenarioB: (s: SimulationRequest) => void;
  setResultA: (r: SimulationResult | null) => void;
  setResultB: (r: SimulationResult | null) => void;
  setComparisonMode: (v: boolean) => void;

  // Convenience updaters for Scenario A
  updateUserProfile: (profile: Partial<SimulationRequest['userProfile']>) => void;
  updateStructureA: (index: number, structure: Partial<SimulationRequest['structures'][0]>) => void;
  updateAssetA: (structureIdx: number, assetIdx: number, asset: Partial<SimulationRequest['structures'][0]['assets'][0]>) => void;
  updateLoanA: (structureIdx: number, assetIdx: number, loan: Partial<NonNullable<SimulationRequest['structures'][0]['assets'][0]['loan']>>) => void;
  updateParamsA: (params: Partial<SimulationRequest['params']>) => void;

  // Sync shared fields from A to B (asset, loan, user profile)
  syncSharedFields: () => void;
}

function findFirstAssetPath(structures: SimulationRequest['structures']): { sIdx: number; aIdx: number } | null {
  for (let sIdx = 0; sIdx < structures.length; sIdx++) {
    if (structures[sIdx].assets.length > 0) return { sIdx, aIdx: 0 };
    // Check subsidiaries
    for (let subIdx = 0; subIdx < (structures[sIdx].subsidiaries?.length ?? 0); subIdx++) {
      const sub = (structures[sIdx].subsidiaries as SimulationRequest['structures'])[subIdx];
      if (sub.assets.length > 0) return { sIdx, aIdx: 0 };
    }
  }
  return null;
}

function getAssetFromStructures(structures: SimulationRequest['structures']): SimulationRequest['structures'][0]['assets'][0] | null {
  for (const s of structures) {
    if (s.assets.length > 0) return s.assets[0];
    if (s.subsidiaries) {
      for (const sub of s.subsidiaries as SimulationRequest['structures']) {
        if (sub.assets.length > 0) return sub.assets[0];
      }
    }
  }
  return null;
}

function setAssetInStructures(
  structures: SimulationRequest['structures'],
  asset: SimulationRequest['structures'][0]['assets'][0],
): SimulationRequest['structures'] {
  return structures.map(s => {
    if (s.assets.length > 0) {
      return { ...s, assets: [asset, ...s.assets.slice(1)] };
    }
    if (s.subsidiaries && (s.subsidiaries as SimulationRequest['structures']).length > 0) {
      return {
        ...s,
        subsidiaries: (s.subsidiaries as SimulationRequest['structures']).map(sub => {
          if (sub.assets.length > 0) {
            return { ...sub, assets: [asset, ...sub.assets.slice(1)] };
          }
          return sub;
        }),
      };
    }
    return s;
  });
}

export const useScenarioStore = create<ScenarioStore>((set, get) => ({
  scenarioA: SCENARIO_A,
  scenarioB: SCENARIO_B,
  resultA: null,
  resultB: null,
  comparisonMode: true,

  setScenarioA: (s) => set({ scenarioA: s }),
  setScenarioB: (s) => set({ scenarioB: s }),
  setResultA: (r) => set({ resultA: r }),
  setResultB: (r) => set({ resultB: r }),
  setComparisonMode: (v) => set({ comparisonMode: v }),

  updateUserProfile: (profile) =>
    set((state) => ({
      scenarioA: { ...state.scenarioA, userProfile: { ...state.scenarioA.userProfile, ...profile } },
      scenarioB: { ...state.scenarioB, userProfile: { ...state.scenarioB.userProfile, ...profile } },
    })),

  updateStructureA: (index, structure) =>
    set((state) => {
      const structures = [...state.scenarioA.structures];
      structures[index] = { ...structures[index], ...structure };
      return { scenarioA: { ...state.scenarioA, structures } };
    }),

  updateAssetA: (structureIdx, assetIdx, asset) =>
    set((state) => {
      // Update asset in scenario A (could be in a subsidiary)
      const currentAsset = getAssetFromStructures(state.scenarioA.structures);
      if (!currentAsset) return {};
      const updatedAsset = { ...currentAsset, ...asset };
      const structuresA = setAssetInStructures(state.scenarioA.structures, updatedAsset);
      const structuresB = setAssetInStructures(state.scenarioB.structures, updatedAsset);
      return {
        scenarioA: { ...state.scenarioA, structures: structuresA },
        scenarioB: { ...state.scenarioB, structures: structuresB },
      };
    }),

  updateLoanA: (structureIdx, assetIdx, loan) =>
    set((state) => {
      const currentAsset = getAssetFromStructures(state.scenarioA.structures);
      if (!currentAsset?.loan) return {};
      const updatedLoan = { ...currentAsset.loan, ...loan };
      const updatedAsset = { ...currentAsset, loan: updatedLoan };
      const structuresA = setAssetInStructures(state.scenarioA.structures, updatedAsset);
      const structuresB = setAssetInStructures(state.scenarioB.structures, updatedAsset);
      return {
        scenarioA: { ...state.scenarioA, structures: structuresA },
        scenarioB: { ...state.scenarioB, structures: structuresB },
      };
    }),

  updateParamsA: (params) =>
    set((state) => ({
      scenarioA: { ...state.scenarioA, params: { ...state.scenarioA.params, ...params } },
      scenarioB: {
        ...state.scenarioB,
        params: {
          ...state.scenarioB.params,
          // Sync all params except dividend rate (B has no holding)
          ...Object.fromEntries(
            Object.entries(params).filter(([k]) => k !== 'dividendDistributionRate'),
          ),
        },
      },
    })),

  syncSharedFields: () => {
    const state = get();
    const assetA = getAssetFromStructures(state.scenarioA.structures);
    if (!assetA) return;
    const structuresB = setAssetInStructures(state.scenarioB.structures, assetA);
    set({
      scenarioB: {
        ...state.scenarioB,
        userProfile: { ...state.scenarioA.userProfile },
        structures: structuresB,
        params: {
          ...state.scenarioA.params,
          dividendDistributionRate: 0, // IR has no holding dividends
        },
      },
    });
  },
}));

// Helper to extract the first asset from any scenario (for forms)
export function getFirstAsset(scenario: SimulationRequest) {
  return getAssetFromStructures(scenario.structures);
}
