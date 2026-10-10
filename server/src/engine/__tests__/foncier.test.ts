import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import type { AssocieInput, SimulationRequest, SimulationResult, StructureInput } from '@shared/schemas.js';
import { computeMicroFoncier } from '../foncier.js';
import { runSimulation } from '../simulator.js';

describe('computeMicroFoncier — art. 32 CGI', () => {
  it('should tax 70 % of gross rents up to 15 000 EUR', () => {
    const r = computeMicroFoncier(new Decimal('12000'));
    expect(r).toMatchObject({ eligible: true });
    expect(r.abattement.toNumber()).toBe(3600);
    expect(r.revenuNet.toNumber()).toBe(8400);
  });

  it('should stay eligible at exactly the ceiling, not a euro above', () => {
    expect(computeMicroFoncier(new Decimal('15000')).eligible).toBe(true);
    expect(computeMicroFoncier(new Decimal('15000.01')).eligible).toBe(false);
  });
});

const proprietaire = (over: Partial<AssocieInput> = {}): AssocieInput => ({
  nom: 'Proprietaire',
  partsPercent: 1,
  relation: 'SELF',
  maritalStatus: 'SINGLE',
  childrenCount: 0,
  autresRevenus: '40000.00',
  socialChargeRegime: 'STANDARD',
  apportCapital: '0.00',
  apportCompteCourant: '0.00',
  tauxInteretCCA: 0,
  ...over,
});

function enDirect(loyer: string, over: Partial<StructureInput> = {}, associes = [proprietaire()]): SimulationRequest {
  return {
    userProfile: { maritalStatus: 'SINGLE', childrenCount: 0, socialChargeRegime: 'STANDARD', autresRevenus: '40000.00' },
    structures: [
      {
        name: 'En direct',
        type: 'INDIVIDUAL',
        taxRegime: 'IR',
        ownershipShare: 1,
        tauxCotisationsSocialesLMP: 0.35,
        cotisationsMinimalesLMP: '1200.00',
        associes,
        costs: { mode: 'SOI_MEME', constitution: [{ label: 'Aucun', montant: '0.00' }], annuel: [{ label: 'Aucun', montant: '0.00' }] },
        assets: [
          {
            type: 'REAL_ESTATE',
            label: 'Appartement',
            purchasePrice: '200000.00',
            notaryFees: '16000.00',
            renovationCosts: '0.00',
            acquisitionDate: '2026-01-01T00:00:00.000Z',
            annualRent: loyer,
            chargesYearly: '1500.00',
            propertyTax: '1000.00',
            landRatio: 0.15,
            loan: {
              principal: '200000.00',
              interestRate: 0.04,
              insuranceRate: 0.003,
              durationMonths: 240,
              startDate: '2026-01-01T00:00:00.000Z',
              type: 'AMORTISSABLE',
            },
          },
        ],
        subsidiaries: [],
        ...over,
      },
    ],
    params: {
      horizonYears: 10,
      inflationRate: 0.02,
      propertyGrowth: 0.015,
      rentGrowthRate: 0,
      chargesGrowthRate: 0,
      propertyTaxGrowthRate: 0,
      dividendDistributionRate: 0,
      ccaRepaymentRate: 0,
      illiquidityDiscount: 0,
      demembrement: false,
      objectif: 'TRANSMISSION',
    },
  };
}

const annee1 = (r: SimulationResult) => r.yearlyData.find((y) => y.year === 1)!.entities['En direct'];

describe('location nue en direct — micro-foncier dans la projection', () => {
  it('should tax the owner on 70 % of the rents, whatever the charges and interest', () => {
    const r = annee1(runSimulation(enDirect('12000.00', { regimeFoncier: 'MICRO_FONCIER' })));
    expect(r.taxableProfit).toBe('8400.00');
    expect(r.foncier).toEqual({ regime: 'MICRO_FONCIER', abattementMicro: '3600.00' });
  });

  it('should leave the reel untouched when the micro is not chosen', () => {
    const r = annee1(runSimulation(enDirect('12000.00')));
    expect(r.foncier).toBeUndefined();
    // Interest and charges make the reel result far lower than the micro base.
    expect(parseFloat(r.taxableProfit)).toBeLessThan(8400);
  });

  it('should fall back to the reel above 15 000 EUR of rents', () => {
    const micro = annee1(runSimulation(enDirect('20000.00', { regimeFoncier: 'MICRO_FONCIER' })));
    const reel = annee1(runSimulation(enDirect('20000.00')));
    expect(micro.foncier).toEqual({ regime: 'REEL', abattementMicro: '0.00' });
    expect(micro.taxableProfit).toBe(reel.taxableProfit);
  });

  it('should judge the ceiling on each owner’s share in indivision', () => {
    const deux = [proprietaire({ nom: 'A', partsPercent: 0.5 }), proprietaire({ nom: 'B', partsPercent: 0.5 })];
    const r = annee1(runSimulation(enDirect('24000.00', { regimeFoncier: 'MICRO_FONCIER' }, deux)));
    // 12 000 EUR each: both stay at the micro.
    expect(r.foncier).toEqual({ regime: 'MICRO_FONCIER', abattementMicro: '7200.00' });
    expect(r.taxableProfit).toBe('16800.00');
  });

  it('should cost more tax than the reel when interest is heavy', () => {
    const impot = (req: SimulationRequest) => runSimulation(req).yearlyData.find((y) => y.year === 1)!.associes['Proprietaire'];
    const total = (a: { irTax: string; psTax: string }) => parseFloat(a.irTax) + parseFloat(a.psTax);
    // Heavy loan: the reel shows a deficit, the micro still taxes 70 % of the rents.
    expect(total(impot(enDirect('12000.00', { regimeFoncier: 'MICRO_FONCIER' })))).toBeGreaterThan(total(impot(enDirect('12000.00'))));
  });
});
