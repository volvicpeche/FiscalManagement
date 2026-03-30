import { describe, it, expect } from 'vitest';
import type { SimulationRequest } from '@shared/schemas.js';
import { runSimulation } from '../simulator.js';

const baseRequest: SimulationRequest = {
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
          label: 'Appartement Lyon',
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

describe('runSimulation', () => {
  it('should return 30 years of data', () => {
    const result = runSimulation(baseRequest);
    expect(result.yearlyData).toHaveLength(30);
    expect(result.yearlyData[0].year).toBe(1);
    expect(result.yearlyData[29].year).toBe(30);
  });

  it('should have entity data for SCI Alpha each year', () => {
    const result = runSimulation(baseRequest);
    for (const yearData of result.yearlyData) {
      expect(yearData.entities['SCI Alpha']).toBeDefined();
      expect(yearData.entities['SCI Alpha'].grossRevenue).toBeDefined();
    }
  });

  it('should show increasing gross revenue over time (rent growth)', () => {
    const result = runSimulation(baseRequest);
    const y1 = parseFloat(result.yearlyData[0].entities['SCI Alpha'].grossRevenue);
    const y30 = parseFloat(result.yearlyData[29].entities['SCI Alpha'].grossRevenue);
    expect(y30).toBeGreaterThan(y1);
  });

  it('should show zero remaining debt after loan duration (20 years)', () => {
    const result = runSimulation(baseRequest);
    const y20 = parseFloat(result.yearlyData[19].entities['SCI Alpha'].remainingDebt);
    expect(y20).toBeCloseTo(0, 0);
  });

  it('should have zero loan payment after year 20', () => {
    const result = runSimulation(baseRequest);
    const y25 = parseFloat(result.yearlyData[24].entities['SCI Alpha'].loanPayment);
    expect(y25).toBe(0);
  });

  it('should compute positive total net wealth at year 30', () => {
    const result = runSimulation(baseRequest);
    expect(parseFloat(result.summary.totalNetWealth)).toBeGreaterThan(0);
  });

  it('should compute positive total tax paid', () => {
    const result = runSimulation(baseRequest);
    expect(parseFloat(result.summary.totalTaxPaid)).toBeGreaterThan(0);
  });

  it('should show increasing market value over time', () => {
    const result = runSimulation(baseRequest);
    const mv1 = parseFloat(result.yearlyData[0].entities['SCI Alpha'].assetMarketValue);
    const mv30 = parseFloat(result.yearlyData[29].entities['SCI Alpha'].assetMarketValue);
    expect(mv30).toBeGreaterThan(mv1);
  });

  it('should handle IR regime correctly', () => {
    const irRequest: SimulationRequest = {
      ...baseRequest,
      structures: [
        {
          ...baseRequest.structures[0],
          name: 'SCI Beta',
          type: 'SCI_IR',
          taxRegime: 'IR',
        },
      ],
    };

    const result = runSimulation(irRequest);
    expect(result.yearlyData).toHaveLength(30);
    // IR entities should have 0 depreciation
    expect(parseFloat(result.yearlyData[0].entities['SCI Beta'].depreciation)).toBe(0);
  });

  it('should compute IFI when patrimony exceeds threshold', () => {
    // Create a high-value asset to trigger IFI
    const highValueRequest: SimulationRequest = {
      ...baseRequest,
      structures: [
        {
          ...baseRequest.structures[0],
          assets: [
            {
              ...baseRequest.structures[0].assets[0],
              purchasePrice: '2000000.00',
              notaryFees: '160000.00',
              annualRent: '80000.00',
              loan: {
                principal: '500000.00',
                interestRate: 0.035,
                insuranceRate: 0.0035,
                durationMonths: 240,
                startDate: '2026-01-01T00:00:00.000Z',
                type: 'AMORTISSABLE',
              },
            },
          ],
        },
      ],
    };

    const result = runSimulation(highValueRequest);
    // Net real estate > 1.3M, so IFI should be > 0
    const ifiYear1 = parseFloat(result.yearlyData[0].ifiTax);
    expect(ifiYear1).toBeGreaterThan(0);
  });
});
