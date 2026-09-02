import { describe, it, expect } from 'vitest';
import type {
  SimulationRequest,
  SimulationResult,
  AssocieInput,
  EntityCostsInput,
  SaisonnierParams,
} from '@shared/schemas.js';
import { runSimulation } from '../simulator.js';

const NO_COSTS: EntityCostsInput = {
  mode: 'SOI_MEME',
  constitution: [{ label: 'Aucun', montant: '0.00' }],
  annuel: [{ label: 'Aucun', montant: '0.00' }],
};

const baseRequest: SimulationRequest = {
  userProfile: {
    maritalStatus: 'MARRIED',
    childrenCount: 2,
    socialChargeRegime: 'SWISS_EXEMPT',
    autresRevenus: '0.00',
  },
  structures: [
    {
      name: 'SCI Alpha',
      type: 'SCI_IS',
      taxRegime: 'IS',
      ownershipShare: 1.0,
      tauxCotisationsSocialesLMP: 0.35,
    cotisationsMinimalesLMP: '1200.00',
      associes: [],
      costs: NO_COSTS,
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
    dividendDistributionRate: 0,
    ccaRepaymentRate: 0,
    illiquidityDiscount: 0.1,
    demembrement: false,
    objectif: 'TRANSMISSION',
  },
};

/** Addresses a year by its number rather than its index — year 0 leads. */
function yearOf(result: SimulationResult, year: number) {
  const row = result.yearlyData.find((y) => y.year === year);
  if (!row) throw new Error(`Year ${year} not found`);
  return row;
}

function associe(over: Partial<AssocieInput> = {}): AssocieInput {
  return {
    nom: 'Associe',
    partsPercent: 1,
    relation: 'SELF',
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

describe('runSimulation', () => {
  it('should return the horizon plus a year 0 for incorporation', () => {
    const result = runSimulation(baseRequest);
    expect(result.yearlyData).toHaveLength(31);
    expect(result.yearlyData[0].year).toBe(0);
    expect(result.yearlyData[30].year).toBe(30);
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
    const y1 = parseFloat(yearOf(result, 1).entities['SCI Alpha'].grossRevenue);
    const y30 = parseFloat(yearOf(result, 30).entities['SCI Alpha'].grossRevenue);
    expect(y30).toBeGreaterThan(y1);
  });

  it('should show zero remaining debt after loan duration (20 years)', () => {
    const result = runSimulation(baseRequest);
    const y20 = parseFloat(yearOf(result, 20).entities['SCI Alpha'].remainingDebt);
    expect(y20).toBeCloseTo(0, 0);
  });

  it('should have zero loan payment after year 20', () => {
    const result = runSimulation(baseRequest);
    const y25 = parseFloat(yearOf(result, 25).entities['SCI Alpha'].loanPayment);
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
    const mv1 = parseFloat(yearOf(result, 1).entities['SCI Alpha'].assetMarketValue);
    const mv30 = parseFloat(yearOf(result, 30).entities['SCI Alpha'].assetMarketValue);
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
    expect(result.yearlyData).toHaveLength(31);
    // IR entities should have 0 depreciation
    expect(parseFloat(yearOf(result, 1).entities['SCI Beta'].depreciation)).toBe(0);
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
    expect(parseFloat(yearOf(result, 1).ifiTax)).toBeGreaterThan(0);
  });

  it('should distribute dividends when dividendDistributionRate > 0', () => {
    // High-rent asset so entity accumulates positive cash quickly
    const divRequest: SimulationRequest = {
      ...baseRequest,
      structures: [
        {
          ...baseRequest.structures[0],
          assets: [
            {
              ...baseRequest.structures[0].assets[0],
              annualRent: '24000.00', // High rent to ensure positive cash
            },
          ],
        },
      ],
      params: {
        ...baseRequest.params,
        horizonYears: 10,
        dividendDistributionRate: 0.5,
      },
    };

    const result = runSimulation(divRequest);
    const hasDividends = result.yearlyData.some(y => parseFloat(y.userNetDividend) > 0);
    expect(hasDividends).toBe(true);
  });

  it('should handle Holding + SCI hierarchy with Mere-Fille', () => {
    const result = runSimulation(holdingRequest(0.95));
    expect(result.yearlyData).toHaveLength(11);
    expect(yearOf(result, 1).entities['SCI Fille']).toBeDefined();
    expect(yearOf(result, 1).entities['Holding']).toBeDefined();
  });
});

function holdingRequest(ownershipShare: number): SimulationRequest {
  return {
    userProfile: baseRequest.userProfile,
    structures: [
      {
        name: 'Holding',
        type: 'HOLDING',
        taxRegime: 'IS',
        ownershipShare: 1.0,
        tauxCotisationsSocialesLMP: 0.35,
    cotisationsMinimalesLMP: '1200.00',
        associes: [],
        costs: NO_COSTS,
        assets: [],
        subsidiaries: [
          {
            ...baseRequest.structures[0],
            name: 'SCI Fille',
            ownershipShare,
            assets: [{ ...baseRequest.structures[0].assets[0], annualRent: '30000.00' }],
          },
        ],
      },
    ],
    params: { ...baseRequest.params, horizonYears: 10, dividendDistributionRate: 0.3 },
  };
}

describe('runSimulation — intra-group dividends', () => {
  it('should remit only the parent share of the subsidiary cash', () => {
    // Regression: the holding used to receive 100% of the SCI cash whatever
    // its ownership share.
    const full = runSimulation(holdingRequest(1.0));
    const partial = runSimulation(holdingRequest(0.5));

    expect(parseFloat(full.summary.totalNetWealth)).toBeGreaterThan(
      parseFloat(partial.summary.totalNetWealth),
    );
  });
});

describe('runSimulation — year 0 (incorporation)', () => {
  it('should book the setup costs and nothing else', () => {
    const result = runSimulation({
      ...baseRequest,
      structures: [{ ...baseRequest.structures[0], costs: { mode: 'EXPERT_COMPTABLE', constitution: [], annuel: [] } }],
    });
    const y0 = yearOf(result, 0);

    expect(parseFloat(y0.entities['SCI Alpha'].grossRevenue)).toBe(0);
    expect(parseFloat(y0.entities['SCI Alpha'].tax)).toBe(0);
    expect(parseFloat(y0.operatingCosts)).toBeGreaterThan(0);
    expect(parseFloat(y0.totalNetCashFlow)).toBeLessThan(0);
    expect(parseFloat(result.summary.fraisConstitution)).toBe(parseFloat(y0.operatingCosts));
  });

  it('should already show the loan and the property at year 0', () => {
    const result = runSimulation(baseRequest);
    const y0 = yearOf(result, 0);
    // The full amount borrowed, before the first year of repayments.
    expect(parseFloat(y0.entities['SCI Alpha'].remainingDebt)).toBe(180000);
    expect(parseFloat(y0.entities['SCI Alpha'].assetMarketValue)).toBe(216000);
  });

  it('should reconcile year 0 debt with year 1 capital repaid', () => {
    const result = runSimulation(baseRequest);
    const y0 = yearOf(result, 0).entities['SCI Alpha'];
    const y1 = yearOf(result, 1).entities['SCI Alpha'];

    expect(parseFloat(y0.remainingDebt) - parseFloat(y1.loanPrincipal)).toBeCloseTo(
      parseFloat(y1.remainingDebt),
      2,
    );
  });

  it('should repay exactly the borrowed capital over the life of the loan', () => {
    const result = runSimulation(baseRequest);
    const totalCapital = result.yearlyData.reduce(
      (acc, y) => acc + parseFloat(y.entities['SCI Alpha'].loanPrincipal),
      0,
    );
    expect(totalCapital).toBeCloseTo(180000, 0);
  });
});

describe('runSimulation — structure costs', () => {
  const withMode = (mode: EntityCostsInput['mode']): SimulationRequest => ({
    ...baseRequest,
    structures: [
      { ...baseRequest.structures[0], costs: { mode, constitution: [], annuel: [] } },
    ],
  });

  it('should cost more to run with an expert-comptable than alone', () => {
    const soiMeme = runSimulation(withMode('SOI_MEME'));
    const ec = runSimulation(withMode('EXPERT_COMPTABLE'));

    expect(parseFloat(ec.summary.totalOperatingCosts)).toBeGreaterThan(
      parseFloat(soiMeme.summary.totalOperatingCosts),
    );
    expect(parseFloat(ec.summary.fraisConstitution)).toBeGreaterThan(
      parseFloat(soiMeme.summary.fraisConstitution),
    );
  });

  it('should leave less wealth behind when the structure costs more', () => {
    const soiMeme = runSimulation(withMode('SOI_MEME'));
    const ec = runSimulation(withMode('EXPERT_COMPTABLE'));
    expect(parseFloat(ec.summary.totalNetWealth)).toBeLessThan(
      parseFloat(soiMeme.summary.totalNetWealth),
    );
  });

  it('should index the running costs on inflation', () => {
    const result = runSimulation(withMode('EXPERT_COMPTABLE'));
    const y1 = parseFloat(yearOf(result, 1).entities['SCI Alpha'].operatingCosts);
    const y10 = parseFloat(yearOf(result, 10).entities['SCI Alpha'].operatingCosts);
    expect(y10).toBeGreaterThan(y1);
    expect(y10).toBeCloseTo(y1 * Math.pow(1.02, 9), 2);
  });

  it('should deduct the running costs from the taxable profit', () => {
    const free = runSimulation(withMode('SOI_MEME'));
    const paid = runSimulation(withMode('EXPERT_COMPTABLE'));
    const profit = (r: SimulationResult) =>
      parseFloat(yearOf(r, 1).entities['SCI Alpha'].taxableProfit);
    expect(profit(paid)).toBeLessThan(profit(free));
  });

  it('should make the Holding + SCI setup cost about twice an SCI alone', () => {
    const sci = runSimulation(withMode('EXPERT_COMPTABLE'));
    const withHolding = runSimulation({
      ...holdingRequest(1.0),
      structures: [
        {
          ...holdingRequest(1.0).structures[0],
          costs: { mode: 'EXPERT_COMPTABLE', constitution: [], annuel: [] },
          subsidiaries: [
            {
              ...(holdingRequest(1.0).structures[0].subsidiaries as SimulationRequest['structures'])[0],
              costs: { mode: 'EXPERT_COMPTABLE', constitution: [], annuel: [] },
            },
          ],
        },
      ],
      params: { ...baseRequest.params, horizonYears: 30 },
    });

    const ratio =
      parseFloat(withHolding.summary.totalOperatingCosts) /
      parseFloat(sci.summary.totalOperatingCosts);
    expect(ratio).toBeGreaterThan(1.8);
    expect(ratio).toBeLessThan(2.5);
  });
});

describe('runSimulation — associes at IR', () => {
  const irWithAssocies = (associes: AssocieInput[]): SimulationRequest => ({
    ...baseRequest,
    structures: [
      {
        ...baseRequest.structures[0],
        name: 'SCI Familiale',
        type: 'SCI_IR',
        taxRegime: 'IR',
        associes,
        assets: [{ ...baseRequest.structures[0].assets[0], annualRent: '40000.00', loan: undefined }],
      },
    ],
    params: { ...baseRequest.params, horizonYears: 5 },
  });

  it('should report one row per associe', () => {
    const result = runSimulation(
      irWithAssocies([
        associe({ nom: 'Florian', partsPercent: 0.6 }),
        associe({ nom: 'Marie', partsPercent: 0.4, relation: 'SPOUSE' }),
      ]),
    );
    const y1 = yearOf(result, 1);
    expect(Object.keys(y1.associes).sort()).toEqual(['Florian', 'Marie']);
  });

  it('should split the quote-part pro-rata by parts', () => {
    const result = runSimulation(
      irWithAssocies([
        associe({ nom: 'Florian', partsPercent: 0.75 }),
        associe({ nom: 'Marie', partsPercent: 0.25, relation: 'SPOUSE' }),
      ]),
    );
    const y1 = yearOf(result, 1);
    const florian = parseFloat(y1.associes['Florian'].quotePart);
    const marie = parseFloat(y1.associes['Marie'].quotePart);
    expect(florian / marie).toBeCloseTo(3, 5);
  });

  it('should tax associes differently according to their own other income', () => {
    // Same parts, very different households — the whole point of the module.
    const result = runSimulation(
      irWithAssocies([
        associe({ nom: 'Modeste', partsPercent: 0.5, autresRevenus: '12000.00' }),
        associe({ nom: 'Aise', partsPercent: 0.5, relation: 'SPOUSE', autresRevenus: '180000.00' }),
      ]),
    );
    const y1 = yearOf(result, 1);
    expect(parseFloat(y1.associes['Aise'].irTax)).toBeGreaterThan(
      parseFloat(y1.associes['Modeste'].irTax),
    );
  });

  it('should exempt a Swiss-affiliated associe from CSG/CRDS while taxing the other', () => {
    const result = runSimulation(
      irWithAssocies([
        associe({ nom: 'Suisse', partsPercent: 0.5, socialChargeRegime: 'SWISS_EXEMPT' }),
        associe({ nom: 'Francais', partsPercent: 0.5, relation: 'SPOUSE', socialChargeRegime: 'STANDARD' }),
      ]),
    );
    const y1 = yearOf(result, 1);
    expect(parseFloat(y1.associes['Suisse'].psTax)).toBeLessThan(
      parseFloat(y1.associes['Francais'].psTax),
    );
  });

  it('should not tax the SCI itself at IR', () => {
    const result = runSimulation(irWithAssocies([associe({ nom: 'Florian', partsPercent: 1 })]));
    expect(parseFloat(yearOf(result, 1).entities['SCI Familiale'].tax)).toBe(0);
  });

  it('should charge a foncier deficit against the associe global income', () => {
    // Heavy loan, low rent: the early years run at a loss.
    const deficitaire = runSimulation({
      ...baseRequest,
      structures: [
        {
          ...baseRequest.structures[0],
          name: 'SCI Deficit',
          type: 'SCI_IR',
          taxRegime: 'IR',
          associes: [associe({ nom: 'Florian', partsPercent: 1, autresRevenus: '90000.00' })],
          assets: [{ ...baseRequest.structures[0].assets[0], annualRent: '4000.00' }],
        },
      ],
      params: { ...baseRequest.params, horizonYears: 3 },
    });

    // A negative IR means the SCI reduced the associe's overall tax bill.
    expect(parseFloat(yearOf(deficitaire, 1).associes['Florian'].irTax)).toBeLessThan(0);
    expect(parseFloat(yearOf(deficitaire, 1).associes['Florian'].psTax)).toBe(0);
  });
});

describe('runSimulation — LMP saisonnier', () => {
  const saisonnierAsset = {
    ...baseRequest.structures[0].assets[0],
    label: 'Mas en Provence',
    annualRent: '0.00',
    loan: undefined,
    saisonnier: {
      hauteSaison: { tauxOccupation: 0.9, caPeriode: '18000.00' },
      moyenneSaison: { tauxOccupation: 0.6, caPeriode: '9000.00' },
      basseSaison: { tauxOccupation: 0.3, caPeriode: '3000.00' },
      gestion: 'SOI_MEME',
      commissionPlateforme: 0.15,
      fraisMenageLingeAnnuel: '2000.00',
      fraisConciergeriePercent: 0.25,
    } satisfies SaisonnierParams,
  };

  const lmpRequest = (overrides: Partial<SaisonnierParams> = {}): SimulationRequest => ({
    ...baseRequest,
    structures: [
      {
        ...baseRequest.structures[0],
        name: 'LMP Provence',
        type: 'LMP',
        taxRegime: 'IR',
        associes: [associe({ nom: 'Florian', partsPercent: 1, autresRevenus: '40000.00' })],
        assets: [{ ...saisonnierAsset, saisonnier: { ...saisonnierAsset.saisonnier, ...overrides } }],
      },
    ],
    params: { ...baseRequest.params, horizonYears: 3 },
  });

  it('should compute gross revenue from the seasonal buckets, not annualRent', () => {
    const y1 = yearOf(runSimulation(lmpRequest()), 1);
    expect(parseFloat(y1.entities['LMP Provence'].grossRevenue)).toBeCloseTo(30000, 2);
  });

  it('should not tax the LMP entity itself — it is translucent like an SCI at IR', () => {
    const y1 = yearOf(runSimulation(lmpRequest()), 1);
    expect(parseFloat(y1.entities['LMP Provence'].tax)).toBe(0);
  });

  it('should apply depreciation on a BIC reel basis, unlike an SCI at IR', () => {
    const y1 = yearOf(runSimulation(lmpRequest()), 1);
    expect(parseFloat(y1.entities['LMP Provence'].depreciation)).toBeGreaterThan(0);
  });

  it('should charge the platform commission plus menage/linge in SOI_MEME mode', () => {
    const y1 = yearOf(runSimulation(lmpRequest({ gestion: 'SOI_MEME' })), 1);
    const baseCharges = 2400 + 1200; // chargesYearly + propertyTax from the shared fixture
    const exploitationFees = 30000 * 0.15 + 2000;
    expect(parseFloat(y1.entities['LMP Provence'].charges)).toBeCloseTo(baseCharges + exploitationFees, 2);
  });

  it('should charge only the conciergerie fee in CONCIERGERIE mode — no platform commission on top', () => {
    const y1 = yearOf(runSimulation(lmpRequest({ gestion: 'CONCIERGERIE' })), 1);
    const baseCharges = 2400 + 1200;
    const exploitationFees = 30000 * 0.25;
    expect(parseFloat(y1.entities['LMP Provence'].charges)).toBeCloseTo(baseCharges + exploitationFees, 2);
  });

  it('should tax the associe on TNS contributions rather than the foncier PS rate', () => {
    const y1 = yearOf(runSimulation(lmpRequest()), 1);
    // The quote-part is positive after depreciation and charges: TNS applies.
    expect(parseFloat(y1.associes['Florian'].psTax)).toBeGreaterThan(0);
  });

  it('should impute an LMP deficit fully against the associe global income, no 10 700 EUR cap', () => {
    // Basse saison only, no loan: revenue barely covers charges, likely a loss.
    const deficitaire = lmpRequest({
      hauteSaison: { tauxOccupation: 0.2, caPeriode: '2000.00' },
      moyenneSaison: { tauxOccupation: 0.1, caPeriode: '1000.00' },
    });
    const y1 = yearOf(runSimulation(deficitaire), 1);
    const quotePart = parseFloat(y1.associes['Florian'].quotePart);
    expect(quotePart).toBeLessThan(0);
    expect(parseFloat(y1.associes['Florian'].irTax)).toBeLessThan(0);
  });
});

describe('runSimulation — comptes courants d\'associes', () => {
  const withCCA = (repaymentRate: number, taux = 0): SimulationRequest => ({
    ...baseRequest,
    structures: [
      {
        ...baseRequest.structures[0],
        associes: [
          associe({ nom: 'Florian', partsPercent: 1, apportCompteCourant: '50000.00', tauxInteretCCA: taux }),
        ],
        assets: [{ ...baseRequest.structures[0].assets[0], annualRent: '40000.00' }],
      },
    ],
    params: { ...baseRequest.params, horizonYears: 10, ccaRepaymentRate: repaymentRate },
  });

  it('should carry the initial balance at year 0', () => {
    const result = runSimulation(withCCA(0));
    expect(parseFloat(yearOf(result, 0).associes['Florian'].ccaBalance)).toBe(50000);
  });

  it('should never repay when the repayment rate is 0', () => {
    const result = runSimulation(withCCA(0));
    expect(parseFloat(yearOf(result, 10).associes['Florian'].ccaBalance)).toBe(50000);
  });

  it('should draw the balance down when repaying', () => {
    const result = runSimulation(withCCA(0.5));
    const y10 = parseFloat(yearOf(result, 10).associes['Florian'].ccaBalance);
    expect(y10).toBeLessThan(50000);
  });

  it('should hand the repayment to the associe without any tax on it', () => {
    const result = runSimulation(withCCA(0.5));
    const y1 = yearOf(result, 1).associes['Florian'];
    expect(parseFloat(y1.ccaRepayment)).toBeGreaterThan(0);
    // No IR, no PS: an SCI at IS attributes no result to its associes, and
    // repaying a loan is not income.
    expect(parseFloat(y1.irTax)).toBe(0);
    expect(parseFloat(y1.psTax)).toBe(0);
    expect(parseFloat(y1.netCashFlow)).toBeCloseTo(parseFloat(y1.ccaRepayment), 2);
  });

  it('should accrue interest on a remunerated compte courant', () => {
    const result = runSimulation(withCCA(0, 0.03));
    expect(parseFloat(yearOf(result, 1).associes['Florian'].ccaInterest)).toBeCloseTo(1500, 2);
  });

  it('should deduct the CCA interest from the taxable profit', () => {
    const gratuit = runSimulation(withCCA(0, 0));
    const remunere = runSimulation(withCCA(0, 0.03));
    const profit = (r: SimulationResult) =>
      parseFloat(yearOf(r, 1).entities['SCI Alpha'].taxableProfit);
    expect(profit(remunere)).toBeLessThan(profit(gratuit));
  });
});

describe('runSimulation — projection detail', () => {
  it('should split the loan payment into interest and capital', () => {
    const result = runSimulation(baseRequest);
    for (const year of [1, 10, 20]) {
      const e = yearOf(result, year).entities['SCI Alpha'];
      expect(parseFloat(e.loanInterest) + parseFloat(e.loanPrincipal)).toBeCloseTo(
        parseFloat(e.loanPayment),
        2,
      );
    }
  });

  it('should shift the payment from interest to capital as the loan runs down', () => {
    const result = runSimulation(baseRequest);
    const y1 = yearOf(result, 1).entities['SCI Alpha'];
    const y19 = yearOf(result, 19).entities['SCI Alpha'];

    expect(parseFloat(y1.loanInterest)).toBeGreaterThan(parseFloat(y19.loanInterest));
    expect(parseFloat(y19.loanPrincipal)).toBeGreaterThan(parseFloat(y1.loanPrincipal));
  });

  it('should report charges and taxe fonciere together, growing with their rates', () => {
    const result = runSimulation(baseRequest);
    // Year 1 is unindexed: 2 400 of charges + 1 200 of taxe fonciere.
    expect(parseFloat(yearOf(result, 1).entities['SCI Alpha'].charges)).toBeCloseTo(3600, 2);
    expect(parseFloat(yearOf(result, 10).entities['SCI Alpha'].charges)).toBeCloseTo(
      3600 * Math.pow(1.02, 9),
      2,
    );
  });

  it('should reconcile the taxable profit from the reported lines at IS', () => {
    const result = runSimulation({
      ...baseRequest,
      structures: [
        { ...baseRequest.structures[0], costs: { mode: 'EXPERT_COMPTABLE', constitution: [], annuel: [] } },
      ],
    });
    const e = yearOf(result, 3).entities['SCI Alpha'];

    const reconstructed =
      parseFloat(e.grossRevenue) -
      parseFloat(e.charges) -
      parseFloat(e.loanInterest) -
      parseFloat(e.depreciation) -
      parseFloat(e.operatingCosts);

    expect(reconstructed).toBeCloseTo(parseFloat(e.taxableProfit), 2);
  });
});

describe('runSimulation — wealth basis', () => {
  const richAsset = { ...baseRequest.structures[0].assets[0], annualRent: '40000.00' };

  it('should not destroy wealth by distributing dividends', () => {
    // Distributed cash lands in the associe's pocket; it does not vanish.
    const base = {
      ...baseRequest,
      structures: [{ ...baseRequest.structures[0], assets: [richAsset] }],
    };
    const capitalise = runSimulation({
      ...base,
      params: { ...baseRequest.params, horizonYears: 15, dividendDistributionRate: 0 },
    });
    const distribue = runSimulation({
      ...base,
      params: { ...baseRequest.params, horizonYears: 15, dividendDistributionRate: 0.8 },
    });

    // Distributing costs the dividend tax, but not the whole dividend.
    const ecart =
      parseFloat(capitalise.summary.totalNetWealth) - parseFloat(distribue.summary.totalNetWealth);
    expect(ecart).toBeGreaterThan(0);
    expect(ecart).toBeLessThan(parseFloat(capitalise.summary.totalNetWealth) * 0.4);
  });

  it('should charge the associe tax against the family wealth at IR', () => {
    // The SCI at IR pays nothing itself, so the tax must come off somewhere.
    const irRequest: SimulationRequest = {
      ...baseRequest,
      structures: [
        {
          ...baseRequest.structures[0],
          name: 'SCI IR',
          type: 'SCI_IR',
          taxRegime: 'IR',
          associes: [associe({ nom: 'Florian', partsPercent: 1, autresRevenus: '90000.00' })],
          assets: [richAsset],
        },
      ],
      params: { ...baseRequest.params, horizonYears: 20 },
    };
    const modeste: SimulationRequest = {
      ...irRequest,
      structures: [
        {
          ...irRequest.structures[0],
          associes: [associe({ nom: 'Florian', partsPercent: 1, autresRevenus: '0.00' })],
        },
      ],
    };

    // Same SCI, same cash: the associe in the top bracket ends up poorer.
    expect(parseFloat(irRequest.structures[0].associes[0].autresRevenus)).toBeGreaterThan(0);
    expect(parseFloat(runSimulation(irRequest).summary.totalNetWealth)).toBeLessThan(
      parseFloat(runSimulation(modeste).summary.totalNetWealth),
    );
  });

  it('should keep the repaid compte courant inside the family wealth', () => {
    const withCCA = (repaymentRate: number): SimulationRequest => ({
      ...baseRequest,
      structures: [
        {
          ...baseRequest.structures[0],
          associes: [associe({ nom: 'Florian', partsPercent: 1, apportCompteCourant: '50000.00' })],
          assets: [richAsset],
        },
      ],
      params: { ...baseRequest.params, horizonYears: 20, ccaRepaymentRate: repaymentRate },
    });

    // Moving cash from the company to the associe is wealth-neutral.
    const garde = parseFloat(runSimulation(withCCA(0)).summary.totalNetWealth);
    const rembourse = parseFloat(runSimulation(withCCA(1)).summary.totalNetWealth);
    expect(rembourse).toBeCloseTo(garde, 0);
  });

  it('should report succession separately from the running tax bill', () => {
    const result = runSimulation({
      ...baseRequest,
      structures: [
        {
          ...baseRequest.structures[0],
          associes: [
            associe({ nom: 'Florian', partsPercent: 0.5, relation: 'SELF' }),
            associe({ nom: 'Enfant', partsPercent: 0.5, relation: 'CHILD' }),
          ],
          assets: [richAsset],
        },
      ],
    });

    expect(parseFloat(result.summary.successionCost)).toBeGreaterThan(0);
    // Adding the death duties into the yearly tax total would double-count them.
    const yearlyTax = result.yearlyData.reduce(
      (acc, y) =>
        acc +
        Object.values(y.entities).reduce((a, e) => a + parseFloat(e.tax), 0) +
        Object.values(y.associes).reduce((a, x) => a + parseFloat(x.irTax) + parseFloat(x.psTax), 0) +
        parseFloat(y.ifiTax),
      0,
    );
    expect(parseFloat(result.summary.totalTaxPaid)).toBeCloseTo(yearlyTax, 0);
  });
});

describe('runSimulation — succession', () => {
  const familyRequest = (associes: AssocieInput[], over: Partial<SimulationRequest['params']> = {}): SimulationRequest => ({
    ...baseRequest,
    structures: [
      {
        ...baseRequest.structures[0],
        associes,
        assets: [{ ...baseRequest.structures[0].assets[0], annualRent: '20000.00' }],
      },
    ],
    params: { ...baseRequest.params, horizonYears: 30, ...over },
  });

  it('should produce a succession estimate wired to the associes', () => {
    const result = runSimulation(
      familyRequest([
        associe({ nom: 'Florian', partsPercent: 1, relation: 'SELF', birthDate: '1980-01-01T00:00:00.000Z' }),
      ]),
    );

    // No co-associe: the estate goes to the declared children.
    expect(result.succession.heritiers).toHaveLength(2);
    expect(parseFloat(result.succession.navTotal)).toBeGreaterThan(0);
    expect(parseFloat(result.summary.successionCost)).toBe(parseFloat(result.succession.total));
  });

  it('should lower the succession cost when children already hold parts', () => {
    // The core argument for an SCI: parts given early are out of the estate.
    const solo = runSimulation(
      familyRequest([associe({ nom: 'Florian', partsPercent: 1, relation: 'SELF' })]),
    );
    const partage = runSimulation(
      familyRequest([
        associe({ nom: 'Florian', partsPercent: 0.4, relation: 'SELF' }),
        associe({ nom: 'Enfant 1', partsPercent: 0.3, relation: 'CHILD' }),
        associe({ nom: 'Enfant 2', partsPercent: 0.3, relation: 'CHILD' }),
      ]),
    );

    expect(parseFloat(partage.succession.total)).toBeLessThan(parseFloat(solo.succession.total));
  });

  it('should exempt a surviving spouse entirely', () => {
    const result = runSimulation(
      familyRequest([
        associe({ nom: 'Florian', partsPercent: 0.5, relation: 'SELF' }),
        associe({ nom: 'Marie', partsPercent: 0.5, relation: 'SPOUSE' }),
      ]),
    );
    expect(parseFloat(result.succession.total)).toBe(0);
  });

  it('should apply the illiquidity discount to the shares', () => {
    const associes = [
      associe({ nom: 'Florian', partsPercent: 0.5, relation: 'SELF' }),
      associe({ nom: 'Enfant', partsPercent: 0.5, relation: 'CHILD' }),
    ];
    const sansDecote = runSimulation(familyRequest(associes, { illiquidityDiscount: 0 }));
    const avecDecote = runSimulation(familyRequest(associes, { illiquidityDiscount: 0.2 }));

    expect(parseFloat(avecDecote.succession.valeurPartsDefunt)).toBeLessThan(
      parseFloat(sansDecote.succession.valeurPartsDefunt),
    );
    expect(parseFloat(avecDecote.succession.total)).toBeLessThan(
      parseFloat(sansDecote.succession.total),
    );
  });

  it('should lower the transmitted base when only the nue-propriete passes', () => {
    const associes = [
      associe({ nom: 'Florian', partsPercent: 0.5, relation: 'SELF', birthDate: '1980-01-01T00:00:00.000Z' }),
      associe({ nom: 'Enfant', partsPercent: 0.5, relation: 'CHILD' }),
    ];
    const pleine = runSimulation(familyRequest(associes, { demembrement: false }));
    const demembre = runSimulation(familyRequest(associes, { demembrement: true }));

    expect(parseFloat(demembre.succession.baseTransmise)).toBeLessThan(
      parseFloat(pleine.succession.baseTransmise),
    );
  });

  it('should add the deceased compte courant to the estate at face value', () => {
    const associes = (cca: string) => [
      associe({ nom: 'Florian', partsPercent: 0.5, relation: 'SELF', apportCompteCourant: cca }),
      associe({ nom: 'Enfant', partsPercent: 0.5, relation: 'CHILD' }),
    ];
    const sansCCA = runSimulation(familyRequest(associes('0.00')));
    const avecCCA = runSimulation(familyRequest(associes('80000.00')));

    expect(parseFloat(avecCCA.succession.ccaDefunt)).toBe(80000);
    expect(parseFloat(avecCCA.succession.baseTransmise)).toBeGreaterThan(
      parseFloat(sansCCA.succession.baseTransmise),
    );
  });

  it('should return an empty estimate when no SELF associe is declared', () => {
    const result = runSimulation(
      familyRequest([associe({ nom: 'Indivisaire', partsPercent: 1, relation: 'OTHER' })]),
    );
    expect(result.succession.heritiers).toHaveLength(0);
    expect(parseFloat(result.succession.total)).toBe(0);
  });
});

describe('runSimulation — traceable detail', () => {
  it('should break the rent down to the same total', () => {
    const result = runSimulation(baseRequest);
    const e = yearOf(result, 3).entities['SCI Alpha'];
    expect(parseFloat(e.detail.loyerNu)).toBeCloseTo(parseFloat(e.grossRevenue), 2);
  });

  it('should split the charges into copro and taxe fonciere', () => {
    const result = runSimulation(baseRequest);
    const e = yearOf(result, 1).entities['SCI Alpha'];
    // Year 1 is unindexed: 2 400 of copro, 1 200 of taxe fonciere.
    expect(parseFloat(e.detail.chargesCopro)).toBeCloseTo(2400, 2);
    expect(parseFloat(e.detail.taxeFonciere)).toBeCloseTo(1200, 2);
    expect(parseFloat(e.detail.chargesCopro) + parseFloat(e.detail.taxeFonciere)).toBeCloseTo(
      parseFloat(e.charges),
      2,
    );
  });

  it('should split the loan cost into interest and insurance', () => {
    const result = runSimulation(baseRequest);
    for (const year of [1, 10, 20]) {
      const e = yearOf(result, year).entities['SCI Alpha'];
      expect(parseFloat(e.detail.interets) + parseFloat(e.detail.assurance)).toBeCloseTo(
        parseFloat(e.loanInterest),
        2,
      );
    }
  });

  it('should leave every detail line at zero on year 0', () => {
    const result = runSimulation(baseRequest);
    const detail = yearOf(result, 0).entities['SCI Alpha'].detail;
    for (const value of Object.values(detail)) {
      expect(parseFloat(value)).toBe(0);
    }
  });

  it('should reconcile the gross revenue from the seasonal buckets', () => {
    const saisonnier = {
      gestion: 'SOI_MEME' as const,
      hauteSaison: { tauxOccupation: 0.9, caPeriode: '15000.00' },
      moyenneSaison: { tauxOccupation: 0.6, caPeriode: '8000.00' },
      basseSaison: { tauxOccupation: 0.2, caPeriode: '2000.00' },
      commissionPlateforme: 0.15,
      fraisMenageLingeAnnuel: '1800.00',
      fraisConciergeriePercent: 0.2,
    };
    const result = runSimulation({
      ...baseRequest,
      structures: [
        {
          ...baseRequest.structures[0],
          assets: [{ ...baseRequest.structures[0].assets[0], saisonnier }],
        },
      ],
      params: { ...baseRequest.params, horizonYears: 2, rentGrowthRate: 0 },
    } as typeof baseRequest);

    const e = yearOf(result, 1).entities['SCI Alpha'];
    const { caHauteSaison, caMoyenneSaison, caBasseSaison } = e.detail;

    expect(parseFloat(caHauteSaison)).toBeCloseTo(15000, 2);
    expect(parseFloat(caMoyenneSaison)).toBeCloseTo(8000, 2);
    expect(parseFloat(caBasseSaison)).toBeCloseTo(2000, 2);
    // The tooltip's whole promise: the parts add up to the headline figure.
    expect(
      parseFloat(caHauteSaison) + parseFloat(caMoyenneSaison) + parseFloat(caBasseSaison),
    ).toBeCloseTo(parseFloat(e.grossRevenue), 2);
    // 15 % of 25 000 in platform commission, plus the flat cleaning fee.
    expect(parseFloat(e.detail.commissionPlateforme)).toBeCloseTo(3750, 2);
    expect(parseFloat(e.detail.fraisMenageLinge)).toBeCloseTo(1800, 2);
    expect(parseFloat(e.detail.fraisConciergerie)).toBe(0);
  });
});

describe('runSimulation — financing', () => {
  it('should report what the acquisition needs versus what was declared', () => {
    const result = runSimulation({
      ...baseRequest,
      structures: [
        {
          ...baseRequest.structures[0],
          associes: [associe({ nom: 'Moi', partsPercent: 1, apportCapital: '1000.00' })],
          costs: NO_COSTS,
        },
      ],
    });
    const f = result.summary.financement;

    // 200 000 + 16 000 + 30 000 − 180 000 borrowed, no setup costs.
    expect(parseFloat(f.coutAcquisition)).toBe(246000);
    expect(parseFloat(f.emprunt)).toBe(180000);
    expect(parseFloat(f.apportRequis)).toBe(66000);
    expect(parseFloat(f.apportDeclare)).toBe(1000);
    expect(parseFloat(f.ecart)).toBe(65000);
  });

  it('should charge the whole apport against year 0', () => {
    const result = runSimulation(baseRequest);
    expect(parseFloat(yearOf(result, 0).totalNetCashFlow)).toBeCloseTo(
      -parseFloat(result.summary.financement.apportRequis),
      2,
    );
  });

  it('should stop the down payment appearing from nowhere', () => {
    // Regression: the asset used to exist at full value with only the loan
    // against it, so the apport inflated net wealth by its own amount.
    const petitApport = runSimulation({
      ...baseRequest,
      structures: [
        {
          ...baseRequest.structures[0],
          assets: [
            {
              ...baseRequest.structures[0].assets[0],
              loan: { ...baseRequest.structures[0].assets[0].loan!, principal: '180000.00' },
            },
          ],
        },
      ],
      params: { ...baseRequest.params, horizonYears: 1 },
    });
    const grosApport = runSimulation({
      ...baseRequest,
      structures: [
        {
          ...baseRequest.structures[0],
          assets: [
            {
              ...baseRequest.structures[0].assets[0],
              loan: { ...baseRequest.structures[0].assets[0].loan!, principal: '100000.00' },
            },
          ],
        },
      ],
      params: { ...baseRequest.params, horizonYears: 1 },
    });

    // Borrowing less means paying more up front, not being richer for it.
    expect(parseFloat(grosApport.summary.financement.apportRequis)).toBeGreaterThan(
      parseFloat(petitApport.summary.financement.apportRequis),
    );
    expect(parseFloat(grosApport.summary.totalNetWealth)).toBeGreaterThan(
      parseFloat(petitApport.summary.totalNetWealth) - 1,
    );
  });

  it('should leave year-0 wealth at minus the works and the setup costs', () => {
    // Everything else nets out: the apport buys equity of equal value. Only the
    // works and the incorporation fees create no asset.
    const avecTravaux = runSimulation({ ...baseRequest, params: { ...baseRequest.params, horizonYears: 1 } });
    const sansTravaux = runSimulation({
      ...baseRequest,
      structures: [
        {
          ...baseRequest.structures[0],
          assets: [{ ...baseRequest.structures[0].assets[0], renovationCosts: '0.00' }],
        },
      ],
      params: { ...baseRequest.params, horizonYears: 1 },
    });

    expect(
      parseFloat(sansTravaux.summary.totalNetWealth) - parseFloat(avecTravaux.summary.totalNetWealth),
    ).toBeCloseTo(30000, 0);
  });
});

describe('runSimulation — IRR', () => {
  const at = (horizon: number) =>
    parseFloat(
      runSimulation({ ...baseRequest, params: { ...baseRequest.params, horizonYears: horizon } })
        .summary.irr!,
    );

  it('should discount every euro once and only once', () => {
    // The guard that matters. The series used to be built on
    // `totalNetCashFlow`, which counts cash retained inside the company — cash
    // the terminal value already holds. Every euro was therefore discounted
    // twice, and the apport three times. This ties the series back to the
    // wealth figure: they must describe the same operation.
    const result = runSimulation(baseRequest);
    const flows = result.yearlyData.map((y) => parseFloat(y.fluxFamille));
    const somme = flows.reduce((a, f) => a + f, 0);
    const navBrute = parseFloat(result.summary.totalNetWealth) - somme;

    // Net wealth is what the family put in plus what it got back plus what it
    // still holds. Nothing else may appear in the series.
    expect(somme + navBrute).toBeCloseTo(parseFloat(result.summary.totalNetWealth), 2);

    // And the reported rate must actually zero that series. The rate is
    // published rounded to four decimals, so the root is checked to bracket
    // zero across that rounding interval rather than against an absolute
    // euro threshold, which would depend on the size of the operation.
    const serie = [...flows];
    serie[serie.length - 1] += navBrute;
    const npvAt = (taux: number) =>
      serie.reduce((acc, f, year) => acc + f / (1 + taux) ** year, 0);

    const taux = parseFloat(result.summary.irr!);
    expect(npvAt(taux - 0.00005) * npvAt(taux + 0.00005)).toBeLessThanOrEqual(0);
  });

  it('should charge the apport once, at year 0', () => {
    // `totalNetWealth` is a wealth-created figure, already net of the apport.
    // Adding it as a terminal value on top of a t0 outflow charged it twice.
    const result = runSimulation(baseRequest);
    expect(parseFloat(result.yearlyData[0].fluxFamille)).toBeCloseTo(
      -parseFloat(result.summary.financement.apportRequis),
      2,
    );
  });

  it('should peak around the loan maturity, then dilute', () => {
    // Leverage builds the rate up to the last instalment; past it the idle
    // treasury earns nothing while the property grows slowly, so the rate
    // drifts back down. The loan runs 20 years.
    expect(at(10)).toBeGreaterThan(0);
    expect(at(20)).toBeGreaterThan(at(10));
    expect(at(30)).toBeLessThan(at(20));
    expect(at(30)).toBeGreaterThan(0);
  });

  it('should reward a better rent with a better rate', () => {
    const withRent = (annualRent: string) =>
      parseFloat(
        runSimulation({
          ...baseRequest,
          structures: [
            {
              ...baseRequest.structures[0],
              assets: [{ ...baseRequest.structures[0].assets[0], annualRent }],
            },
          ],
        }).summary.irr!,
      );

    expect(withRent('24000.00')).toBeGreaterThan(withRent('12000.00'));
  });

  it('should report null rather than 0 when there is no meaningful rate', () => {
    // A property that never earns anything: money only ever goes out.
    const result = runSimulation({
      ...baseRequest,
      structures: [
        {
          ...baseRequest.structures[0],
          costs: NO_COSTS,
          assets: [
            {
              ...baseRequest.structures[0].assets[0],
              purchasePrice: '0.01',
              notaryFees: '0.00',
              renovationCosts: '0.00',
              annualRent: '0.00',
              chargesYearly: '5000.00',
              propertyTax: '0.00',
              loan: undefined,
            },
          ],
        },
      ],
      params: { ...baseRequest.params, horizonYears: 5, propertyGrowth: 0 },
    });
    expect(result.summary.irr).toBeNull();
  });
});

describe('runSimulation — selling at the horizon', () => {
  const withRegime = (type: 'SCI_IS' | 'SCI_IR', taxRegime: 'IS' | 'IR'): SimulationRequest => ({
    ...baseRequest,
    structures: [{ ...baseRequest.structures[0], type, taxRegime, costs: NO_COSTS }],
  });

  it('should measure the IS gain against the depreciated book value', () => {
    const s = runSimulation(withRegime('SCI_IS', 'IS')).summary.sortie;

    expect(s.regime).toBe('IS');
    // 246 000 of basis less everything written off over 30 years.
    expect(parseFloat(s.valeurNetteComptable)).toBeLessThan(50000);
    expect(parseFloat(s.plusValueBrute)).toBeGreaterThan(parseFloat(s.prixVente) * 0.8);
    expect(parseFloat(s.impot)).toBeGreaterThan(0);
  });

  it('should exempt the IR gain entirely after 30 years', () => {
    const s = runSimulation(withRegime('SCI_IR', 'IR')).summary.sortie;

    expect(s.regime).toBe('IR');
    expect(parseFloat(s.impot)).toBe(0);
    expect(parseFloat(s.amortissementsRepris)).toBe(0);
  });

  it('should make the exit far more expensive at IS than at IR', () => {
    // The bias the whole feature exists to remove: twenty years of
    // depreciation is a bill deferred, not avoided.
    const is = parseFloat(runSimulation(withRegime('SCI_IS', 'IS')).summary.sortie.impot);
    const ir = parseFloat(runSimulation(withRegime('SCI_IR', 'IR')).summary.sortie.impot);
    expect(is).toBeGreaterThan(ir);
    expect(is).toBeGreaterThan(50000);
  });

  it('should report the gain that only exists because of depreciation', () => {
    const s = runSimulation(withRegime('SCI_IS', 'IS')).summary.sortie;
    const cumulAmortissements = runSimulation(withRegime('SCI_IS', 'IS')).yearlyData.reduce(
      (acc, y) => acc + parseFloat(y.entities['SCI Alpha'].depreciation),
      0,
    );
    expect(parseFloat(s.amortissementsRepris)).toBeCloseTo(cumulAmortissements, 0);
  });

  it('should lower the IRR once the exit tax is paid', () => {
    const r = runSimulation(withRegime('SCI_IS', 'IS'));
    expect(parseFloat(r.summary.irrNetDeRevente!)).toBeLessThan(parseFloat(r.summary.irr!));
  });

  it('should leave the IRR untouched when the exit is exempt', () => {
    const r = runSimulation(withRegime('SCI_IR', 'IR'));
    expect(r.summary.irrNetDeRevente).toBe(r.summary.irr);
  });

  it('should narrow the gap between the regimes once the sale is priced', () => {
    const is = runSimulation(withRegime('SCI_IS', 'IS')).summary;
    const ir = runSimulation(withRegime('SCI_IR', 'IR')).summary;

    const ecartAvant = parseFloat(is.irr!) - parseFloat(ir.irr!);
    const ecartApres = parseFloat(is.irrNetDeRevente!) - parseFloat(ir.irrNetDeRevente!);

    expect(ecartAvant).toBeGreaterThan(0);
    expect(ecartApres).toBeLessThan(ecartAvant);
  });

  it('should deduct the outstanding debt from the proceeds', () => {
    // Sold at year 10, the loan still has ten years to run.
    const r = runSimulation({
      ...withRegime('SCI_IS', 'IS'),
      params: { ...baseRequest.params, horizonYears: 10 },
    });
    const s = r.summary.sortie;
    expect(parseFloat(s.detteResiduelle)).toBeGreaterThan(0);
    expect(parseFloat(s.produitNet)).toBeCloseTo(
      parseFloat(s.prixVente) - parseFloat(s.impot) - parseFloat(s.detteResiduelle),
      2,
    );
  });
});

describe('runSimulation — objectif rendement', () => {
  const avecAssocies = (objectif: 'TRANSMISSION' | 'RENDEMENT'): SimulationRequest => ({
    ...baseRequest,
    structures: [
      {
        ...baseRequest.structures[0],
        costs: NO_COSTS,
        associes: [
          associe({ nom: 'Moi', partsPercent: 0.5, relation: 'SELF' }),
          associe({ nom: 'Enfant', partsPercent: 0.5, relation: 'CHILD' }),
        ],
      },
    ],
    params: { ...baseRequest.params, objectif },
  });

  it('should leave out the succession entirely', () => {
    const r = runSimulation(avecAssocies('RENDEMENT'));
    expect(r.succession.heritiers).toHaveLength(0);
    expect(parseFloat(r.summary.successionCost)).toBe(0);
  });

  it('should leave out the resale entirely', () => {
    const r = runSimulation(avecAssocies('RENDEMENT'));
    expect(parseFloat(r.summary.sortie.impot)).toBe(0);
    expect(parseFloat(r.summary.sortie.plusValueBrute)).toBe(0);
  });

  it('should still compute both under the transmission objective', () => {
    const r = runSimulation(avecAssocies('TRANSMISSION'));
    expect(r.succession.heritiers.length).toBeGreaterThan(0);
    expect(parseFloat(r.summary.sortie.impot)).toBeGreaterThan(0);
  });

  it('should echo the objective back so the UI follows what was computed', () => {
    expect(runSimulation(avecAssocies('RENDEMENT')).summary.objectif).toBe('RENDEMENT');
    expect(runSimulation(avecAssocies('TRANSMISSION')).summary.objectif).toBe('TRANSMISSION');
  });

  it('should leave the yearly figures untouched', () => {
    // The objective decides how the story ends, not how the years run.
    const rendement = runSimulation(avecAssocies('RENDEMENT'));
    const transmission = runSimulation(avecAssocies('TRANSMISSION'));

    for (const year of [1, 15, 30]) {
      expect(yearOf(rendement, year).totalNetCashFlow).toBe(
        yearOf(transmission, year).totalNetCashFlow,
      );
    }
    expect(rendement.summary.totalNetWealth).toBe(transmission.summary.totalNetWealth);
    expect(rendement.summary.irr).toBe(transmission.summary.irr);
  });

  it('should make the after-sale IRR equal the plain one, there being no sale', () => {
    const r = runSimulation(avecAssocies('RENDEMENT'));
    expect(r.summary.irrNetDeRevente).toBe(r.summary.irr);
  });

  it('should keep the running tax bill identical — only the end-of-life differs', () => {
    const rendement = runSimulation(avecAssocies('RENDEMENT'));
    const transmission = runSimulation(avecAssocies('TRANSMISSION'));
    expect(rendement.summary.totalTaxPaid).toBe(transmission.summary.totalTaxPaid);
  });

  it('should default to transmission when the objective is not given', () => {
    // Backwards compatible: an older payload keeps the behaviour it had.
    const { objectif: _o, ...paramsSansObjectif } = baseRequest.params;
    const r = runSimulation({
      ...baseRequest,
      params: paramsSansObjectif as typeof baseRequest.params,
    });
    expect(r.summary.objectif).toBe('TRANSMISSION');
  });
});

describe('runSimulation — what is left inside the company', () => {
  const avecCCA = (repaymentRate = 0, dividendRate = 0): SimulationRequest => ({
    ...baseRequest,
    structures: [
      {
        ...baseRequest.structures[0],
        costs: NO_COSTS,
        associes: [associe({ nom: 'Moi', partsPercent: 1, apportCompteCourant: '40000.00' })],
        assets: [{ ...baseRequest.structures[0].assets[0], annualRent: '30000.00' }],
      },
    ],
    params: {
      ...baseRequest.params,
      horizonYears: 15,
      ccaRepaymentRate: repaymentRate,
      dividendDistributionRate: dividendRate,
    },
  });

  it('should show the comptes courants funded at year 0', () => {
    const e = yearOf(runSimulation(avecCCA()), 0).entities['SCI Alpha'];
    expect(parseFloat(e.ccaSolde)).toBe(40000);
    expect(parseFloat(e.tresorerie)).toBe(0);
  });

  it('should accumulate the cash flow into the treasury', () => {
    // The answer to "where does the net cash flow go": it stays here.
    //
    // Asserted year over year rather than cumulatively, and to the nearest few
    // cents: the treasury is rounded independently each year, so the difference
    // of two rounded balances cannot match a rounded flow exactly. A cent of
    // that is arithmetic, not a defect.
    const r = runSimulation(avecCCA());
    for (const y of r.yearlyData.filter((y) => y.year > 0)) {
      const precedent = yearOf(r, y.year - 1).entities['SCI Alpha'];
      const courant = y.entities['SCI Alpha'];
      expect(parseFloat(courant.tresorerie) - parseFloat(precedent.tresorerie)).toBeCloseTo(
        parseFloat(courant.netCashFlow),
        1,
      );
    }
  });

  it('should draw the compte courant down as it is repaid', () => {
    const r = runSimulation(avecCCA(0.5));
    const solde = (year: number) => parseFloat(yearOf(r, year).entities['SCI Alpha'].ccaSolde);
    expect(solde(0)).toBe(40000);
    expect(solde(15)).toBeLessThan(solde(1));
  });

  it('should tie each repayment to the fall in the balance', () => {
    const r = runSimulation(avecCCA(0.5));
    for (const year of [1, 5, 10]) {
      const avant = parseFloat(yearOf(r, year - 1).entities['SCI Alpha'].ccaSolde);
      const apres = parseFloat(yearOf(r, year).entities['SCI Alpha'].ccaSolde);
      const rembourse = parseFloat(yearOf(r, year).entities['SCI Alpha'].ccaRembourse);
      expect(avant - apres).toBeCloseTo(rembourse, 2);
    }
  });

  it('should report the dividend that actually left the company', () => {
    const sans = runSimulation(avecCCA(0, 0));
    const avec = runSimulation(avecCCA(0, 0.5));
    const verse = (r: SimulationResult, y: number) =>
      parseFloat(yearOf(r, y).entities['SCI Alpha'].dividendeVerse);

    expect(verse(sans, 10)).toBe(0);
    expect(verse(avec, 10)).toBeGreaterThan(0);
  });

  it('should leave less in the treasury once dividends are paid out', () => {
    const capitalise = runSimulation(avecCCA(0, 0));
    const distribue = runSimulation(avecCCA(0, 0.5));
    const tresorerie = (r: SimulationResult) =>
      parseFloat(yearOf(r, 15).entities['SCI Alpha'].tresorerie);

    expect(tresorerie(distribue)).toBeLessThan(tresorerie(capitalise));
  });

  it('should balance: assets minus debts equals what the shares are worth', () => {
    // The identity the balance-sheet card states, and the same figure the
    // succession values the parts against.
    const r = runSimulation(avecCCA(0.3, 0.2));
    const e = yearOf(r, 15).entities['SCI Alpha'];

    const actif = parseFloat(e.assetMarketValue) + parseFloat(e.tresorerie);
    const passif = parseFloat(e.remainingDebt) + parseFloat(e.ccaSolde);
    const situationNette = actif - passif;

    expect(situationNette).toBeCloseTo(parseFloat(r.succession.navTotal), 0);
  });
});

describe('runSimulation — the treasury adds up', () => {
  it('should account for every euro the company generated', () => {
    // The identity the "where did the cash go" panel draws: what the company
    // had to dispose of is either handed back, distributed, or still there.
    const r = runSimulation({
      ...baseRequest,
      structures: [
        {
          ...baseRequest.structures[0],
          costs: NO_COSTS,
          associes: [associe({ nom: 'Moi', partsPercent: 1, apportCompteCourant: '40000.00' })],
          assets: [{ ...baseRequest.structures[0].assets[0], annualRent: '30000.00' }],
        },
      ],
      params: {
        ...baseRequest.params,
        horizonYears: 20,
        ccaRepaymentRate: 0.3,
        dividendDistributionRate: 0.2,
      },
    });

    for (const y of r.yearlyData.filter((y) => y.year > 0)) {
      const e = y.entities['SCI Alpha'];
      const precedent = yearOf(r, y.year - 1).entities['SCI Alpha'];

      // netCashFlow already has the repayment taken out; add it back to get
      // what the company actually had in hand.
      const disponible = parseFloat(e.netCashFlow) + parseFloat(e.ccaRembourse);
      const emplois =
        parseFloat(e.ccaRembourse) +
        parseFloat(e.dividendeVerse) +
        (parseFloat(e.tresorerie) - parseFloat(precedent.tresorerie));

      expect(disponible).toBeCloseTo(emplois, 1);
    }
  });

  it('should not confuse the company cash flow with the family one', () => {
    // They differ by the associes' personal tax and the IFI. Using the family
    // figure to explain the treasury leaves a hole exactly that size.
    const r = runSimulation({
      ...baseRequest,
      structures: [
        {
          ...baseRequest.structures[0],
          type: 'SCI_IR',
          taxRegime: 'IR',
          costs: NO_COSTS,
          associes: [associe({ nom: 'Moi', partsPercent: 1, autresRevenus: '90000.00' })],
          assets: [{ ...baseRequest.structures[0].assets[0], annualRent: '30000.00' }],
        },
      ],
      params: { ...baseRequest.params, horizonYears: 5 },
    });

    const y = yearOf(r, 3);
    const societe = parseFloat(y.entities['SCI Alpha'].netCashFlow);
    const famille = parseFloat(y.totalNetCashFlow);
    const impotAssocies = Object.values(y.associes).reduce(
      (acc, a) => acc + parseFloat(a.irTax) + parseFloat(a.psTax),
      0,
    );

    expect(famille).not.toBeCloseTo(societe, 0);
    expect(societe - impotAssocies - parseFloat(y.ifiTax)).toBeCloseTo(famille, 1);
  });
});

describe('runSimulation — deficit reportable a l\'IS', () => {
  it('should only charge IS once the cumulative result has turned positive', () => {
    // With an unlimited carry-forward, no euro of IS is due while the running
    // fiscal result is still negative. The imputation used to be capped at
    // 1 M EUR but not at the profit of the year, so a small profit absorbed a
    // much larger carried deficit, the excess was destroyed, and the SCI paid
    // IS on years it should have sheltered.
    const result = runSimulation(baseRequest);

    let cumul = 0;
    for (const y of result.yearlyData) {
      const entite = y.entities['SCI Alpha'];
      if (!entite) continue;
      cumul += parseFloat(entite.taxableProfit);
      if (parseFloat(entite.tax) > 0) {
        expect(cumul).toBeGreaterThan(0);
      }
    }
  });

  it('should shelter later profits with an early loss', () => {
    // Same operation, one with a heavy first-year charge. The extra deficit
    // must lower the total IS by real money, not vanish.
    const withLoss = (renovationCosts: string) =>
      parseFloat(
        runSimulation({
          ...baseRequest,
          structures: [
            {
              ...baseRequest.structures[0],
              assets: [{ ...baseRequest.structures[0].assets[0], renovationCosts }],
            },
          ],
        }).summary.totalTaxPaid,
      );

    expect(withLoss('90000.00')).toBeLessThan(withLoss('30000.00'));
  });
});

describe('runSimulation — dividendes imposes chez chaque associe', () => {
  const avecAssocie = (autresRevenus: string) => ({
    ...baseRequest,
    structures: [
      {
        ...baseRequest.structures[0],
        costs: NO_COSTS,
        associes: [
          associe({
            nom: 'Moi',
            partsPercent: 1,
            maritalStatus: 'MARRIED' as const,
            childrenCount: 2,
            autresRevenus,
            socialChargeRegime: 'SWISS_EXEMPT' as const,
          }),
        ],
        assets: [{ ...baseRequest.structures[0].assets[0], annualRent: '40000.00' }],
      },
    ],
    params: { ...baseRequest.params, horizonYears: 15, dividendDistributionRate: 0.8 },
  });

  it('should tax the same dividend more heavily in a higher bracket', () => {
    // Regression: the arbitrage passed a zero other income, so the bareme won
    // almost every time and the tax was the same whatever the household.
    const modeste = runSimulation(avecAssocie('0.00'));
    const aise = runSimulation(avecAssocie('150000.00'));

    const impot = (r: typeof modeste) =>
      r.yearlyData.reduce((acc, y) => acc + parseFloat(y.dividendTax), 0);

    expect(impot(aise)).toBeGreaterThan(impot(modeste));
    expect(parseFloat(aise.summary.totalNetWealth)).toBeLessThan(
      parseFloat(modeste.summary.totalNetWealth),
    );
  });

  it('should never retain more than the PFU — it is the fallback option', () => {
    // The associe picks the cheaper of the two, so the retained tax is capped
    // at the flat rate: 12,8 % + 7,5 % for a Swiss-affiliated associe.
    const r = runSimulation(avecAssocie('150000.00'));
    for (const y of r.yearlyData) {
      const brut = parseFloat(y.userNetDividend) + parseFloat(y.dividendTax);
      if (brut > 0) {
        expect(parseFloat(y.dividendTax)).toBeLessThanOrEqual(brut * 0.203 + 0.01);
      }
    }
  });

  it('should attribute the dividend to the associe who received it', () => {
    const r = runSimulation(avecAssocie('90000.00'));
    const y = r.yearlyData.find((row) => parseFloat(row.userNetDividend) > 0)!;
    expect(parseFloat(y.associes['Moi'].dividendeNet)).toBeCloseTo(
      parseFloat(y.userNetDividend),
      2,
    );
  });
});

describe('runSimulation — travaux et prix d\'acquisition', () => {
  it('should count the works in the acquisition price at IR', () => {
    // Regression: the works were in the depreciable basis but not in the IR
    // acquisition price, so they never reduced the taxable gain.
    const r = runSimulation({
      ...baseRequest,
      structures: [
        {
          ...baseRequest.structures[0],
          type: 'SCI_IR',
          taxRegime: 'IR',
          costs: NO_COSTS,
          associes: [associe({ nom: 'Moi', partsPercent: 1 })],
        },
      ],
    });
    // 200 000 + 16 000 de frais + 30 000 de travaux.
    expect(parseFloat(r.summary.sortie.prixAcquisition)).toBeCloseTo(246000, 2);
  });

  it('should lower the exit tax at IR when works were carried out', () => {
    const withWorks = (renovationCosts: string) =>
      parseFloat(
        runSimulation({
          ...baseRequest,
          structures: [
            {
              ...baseRequest.structures[0],
              type: 'SCI_IR',
              taxRegime: 'IR',
              costs: NO_COSTS,
              associes: [associe({ nom: 'Moi', partsPercent: 1 })],
              assets: [{ ...baseRequest.structures[0].assets[0], renovationCosts }],
            },
          ],
          // Before the 30-year mark the social charges still bite, so the
          // works have a visible effect.
          params: { ...baseRequest.params, horizonYears: 20 },
        }).summary.sortie.impot,
      );

    expect(withWorks('60000.00')).toBeLessThan(withWorks('0.00'));
  });
});

describe('runSimulation — flux famille', () => {
  it('should carry the repaid compte courant into the family flow', () => {
    // Regression: the repayment left the company but was never added back on
    // the family side, so the IRR series lost it altogether.
    const withCCA = (ccaRepaymentRate: number) =>
      runSimulation({
        ...baseRequest,
        structures: [
          {
            ...baseRequest.structures[0],
            costs: NO_COSTS,
            associes: [
              associe({ nom: 'Moi', partsPercent: 1, apportCompteCourant: '50000.00' }),
            ],
            assets: [{ ...baseRequest.structures[0].assets[0], annualRent: '40000.00' }],
          },
        ],
        params: { ...baseRequest.params, horizonYears: 15, ccaRepaymentRate },
      });

    const garde = withCCA(0);
    const rembourse = withCCA(1);

    const flux = (r: typeof garde) =>
      r.yearlyData.slice(1).reduce((acc, y) => acc + parseFloat(y.fluxFamille), 0);

    // Repaying moves cash out of the company and into the associe's pocket.
    expect(flux(rembourse)).toBeGreaterThan(flux(garde));
    // And it stays wealth-neutral: what left the company arrived somewhere.
    expect(parseFloat(rembourse.summary.totalNetWealth)).toBeCloseTo(
      parseFloat(garde.summary.totalNetWealth),
      0,
    );
  });
});

describe('runSimulation — IFI sur la part du foyer', () => {
  const grosPatrimoine = {
    ...baseRequest.structures[0].assets[0],
    purchasePrice: '2000000.00',
    notaryFees: '160000.00',
    annualRent: '80000.00',
    loan: {
      ...baseRequest.structures[0].assets[0].loan!,
      principal: '500000.00',
    },
  };

  const avec = (associes: AssocieInput[]) =>
    runSimulation({
      ...baseRequest,
      structures: [
        { ...baseRequest.structures[0], costs: NO_COSTS, associes, assets: [grosPatrimoine] },
      ],
      params: { ...baseRequest.params, horizonYears: 3 },
    });

  it('should reach the whole value when the foyer owns everything', () => {
    const r = avec([associe({ nom: 'Moi', partsPercent: 1, relation: 'SELF' })]);
    expect(parseFloat(yearOf(r, 1).ifiTax)).toBeGreaterThan(0);
  });

  it('should count the spouse inside the same foyer', () => {
    const seul = avec([associe({ nom: 'Moi', partsPercent: 1, relation: 'SELF' })]);
    const couple = avec([
      associe({ nom: 'Moi', partsPercent: 0.5, relation: 'SELF' }),
      associe({ nom: 'Conjoint', partsPercent: 0.5, relation: 'SPOUSE' }),
    ]);
    // Spouses are taxed together, so splitting the parts between them changes
    // nothing at all.
    expect(parseFloat(yearOf(couple, 1).ifiTax)).toBeCloseTo(
      parseFloat(yearOf(seul, 1).ifiTax),
      2,
    );
  });

  it('should drop the base when parts have been given to a child', () => {
    // Regression: the IFI used to be assessed on the whole building whoever
    // owned it, which over-stated it exactly when the transmission scenario
    // starts to pay off. Half of this patrimony sits below the threshold.
    const donne = avec([
      associe({ nom: 'Moi', partsPercent: 0.5, relation: 'SELF' }),
      associe({ nom: 'Enfant', partsPercent: 0.5, relation: 'CHILD' }),
    ]);
    expect(parseFloat(yearOf(donne, 1).ifiTax)).toBe(0);
  });
});

describe('runSimulation — quote-part mere-fille', () => {
  const holdingAvecCouts = (montantAnnuel: string): SimulationRequest => ({
    userProfile: baseRequest.userProfile,
    structures: [
      {
        name: 'Holding',
        type: 'HOLDING',
        taxRegime: 'IS',
        ownershipShare: 1.0,
        tauxCotisationsSocialesLMP: 0.35,
        cotisationsMinimalesLMP: '1200.00',
        associes: [],
        costs: {
          mode: 'SOI_MEME',
          constitution: [{ label: 'Aucun', montant: '0.00' }],
          annuel: [{ label: 'Frais', montant: montantAnnuel }],
        },
        assets: [],
        subsidiaries: [
          {
            ...baseRequest.structures[0],
            name: 'SCI Fille',
            assets: [{ ...baseRequest.structures[0].assets[0], annualRent: '30000.00' }],
          },
        ],
      },
    ],
    params: { ...baseRequest.params, horizonYears: 10 },
  });

  it('should shelter the quote-part with the holding own deficit', () => {
    // Regression: the 5 % quote-part used to be taxed on its own, beside the
    // parent's result. It could not be absorbed by the holding's deficit, and
    // it got a second run at the 15 % band the parent had already used.
    const chere = runSimulation(holdingAvecCouts('8000.00'));
    for (const y of chere.yearlyData) {
      const holding = y.entities['Holding'];
      if (holding) expect(parseFloat(holding.tax)).toBe(0);
    }
  });

  it('should tax the quote-part once the holding is in profit', () => {
    const gratuite = runSimulation(holdingAvecCouts('0.00'));
    const taxee = gratuite.yearlyData.some((y) => parseFloat(y.entities['Holding'].tax) > 0);
    expect(taxee).toBe(true);
  });

  it('should reconcile the total tax with the yearly lines', () => {
    // Every euro of totalTaxPaid must show up in a row somewhere, the
    // quote-part included.
    const r = runSimulation(holdingAvecCouts('0.00'));
    const cumul = r.yearlyData.reduce(
      (acc, y) =>
        acc +
        Object.values(y.entities).reduce((a, e) => a + parseFloat(e.tax), 0) +
        Object.values(y.associes).reduce(
          (a, x) => a + parseFloat(x.irTax) + parseFloat(x.psTax) + parseFloat(x.ccaInterestTax),
          0,
        ) +
        parseFloat(y.ifiTax) +
        parseFloat(y.dividendTax),
      0,
    );
    expect(parseFloat(r.summary.totalTaxPaid)).toBeCloseTo(cumul, 0);
  });
});
