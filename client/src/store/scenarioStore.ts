import { create } from 'zustand';
import type { SimulationRequest, SimulationResult } from '@shared/schemas.js';

const DEFAULT_SCENARIO: SimulationRequest = {
  userProfile: {
    maritalStatus: 'MARRIED',
    childrenCount: 2,
    socialChargeRegime: 'SWISS_EXEMPT',
  },
  structures: [
    {
      name: 'SCI Alpha',
      type: 'SCI_IS',
      taxRegime: 'IS',
      ownershipShare: 1.0,
      assets: [
        {
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
        },
      ],
      subsidiaries: [],
    },
  ],
  params: {
    horizonYears: 30,
    inflationRate: 0.02,
    propertyGrowth: 0.015,
    rentGrowthRate: 0.02,
    chargesGrowthRate: 0.02,
    propertyTaxGrowthRate: 0.02,
  },
};

interface ScenarioStore {
  scenario: SimulationRequest;
  result: SimulationResult | null;
  setScenario: (scenario: SimulationRequest) => void;
  updateUserProfile: (profile: Partial<SimulationRequest['userProfile']>) => void;
  updateStructure: (index: number, structure: Partial<SimulationRequest['structures'][0]>) => void;
  updateAsset: (structureIndex: number, assetIndex: number, asset: Partial<SimulationRequest['structures'][0]['assets'][0]>) => void;
  updateLoan: (structureIndex: number, assetIndex: number, loan: Partial<NonNullable<SimulationRequest['structures'][0]['assets'][0]['loan']>>) => void;
  updateParams: (params: Partial<SimulationRequest['params']>) => void;
  setResult: (result: SimulationResult | null) => void;
}

export const useScenarioStore = create<ScenarioStore>((set) => ({
  scenario: DEFAULT_SCENARIO,
  result: null,

  setScenario: (scenario) => set({ scenario }),

  updateUserProfile: (profile) =>
    set((state) => ({
      scenario: {
        ...state.scenario,
        userProfile: { ...state.scenario.userProfile, ...profile },
      },
    })),

  updateStructure: (index, structure) =>
    set((state) => {
      const structures = [...state.scenario.structures];
      structures[index] = { ...structures[index], ...structure };
      return { scenario: { ...state.scenario, structures } };
    }),

  updateAsset: (structureIndex, assetIndex, asset) =>
    set((state) => {
      const structures = [...state.scenario.structures];
      const assets = [...structures[structureIndex].assets];
      assets[assetIndex] = { ...assets[assetIndex], ...asset };
      structures[structureIndex] = { ...structures[structureIndex], assets };
      return { scenario: { ...state.scenario, structures } };
    }),

  updateLoan: (structureIndex, assetIndex, loan) =>
    set((state) => {
      const structures = [...state.scenario.structures];
      const assets = [...structures[structureIndex].assets];
      const currentLoan = assets[assetIndex].loan ?? {
        principal: '0.00',
        interestRate: 0,
        insuranceRate: 0,
        durationMonths: 240,
        startDate: '2026-01-01T00:00:00.000Z',
        type: 'AMORTISSABLE' as const,
      };
      assets[assetIndex] = { ...assets[assetIndex], loan: { ...currentLoan, ...loan } };
      structures[structureIndex] = { ...structures[structureIndex], assets };
      return { scenario: { ...state.scenario, structures } };
    }),

  updateParams: (params) =>
    set((state) => ({
      scenario: {
        ...state.scenario,
        params: { ...state.scenario.params, ...params },
      },
    })),

  setResult: (result) => set({ result }),
}));
