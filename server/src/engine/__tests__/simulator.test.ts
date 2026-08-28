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
  },
  structures: [
    {
      name: 'SCI Alpha',
      type: 'SCI_IS',
      taxRegime: 'IS',
      ownershipShare: 1.0,
      tauxCotisationsSocialesLMP: 0.35,
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
