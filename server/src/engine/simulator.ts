import Decimal from 'decimal.js';
import type {
  SimulationRequest,
  SimulationResult,
  YearlyData,
  StructureInput,
  AssetInput,
  LoanInput,
} from '@shared/schemas.js';
import { generateAmortizationSchedule, getYearlyLoanSummary } from './mortgage.js';
import {
  computeIS,
  computeIR,
  computePFU,
  computeDividendBareme,
  computeIFI,
  computeMereFilleQuotePart,
  computeYearlyDepreciation,
  getSocialChargeRate,
  applyISDeficit,
} from './tax.js';

// ─── Internal types for simulation state ─────────────────────────────────────

interface AssetState {
  label: string;
  purchasePrice: Decimal;
  notaryFees: Decimal;
  renovationCosts: Decimal;
  annualRent: Decimal;
  chargesYearly: Decimal;
  propertyTax: Decimal;
  marketValue: Decimal;
  yearlyDepreciation: Decimal;
  buildingDepreciationYearsLeft: number;
  renovationDepreciationYearsLeft: number;
  buildingDepreciationPerYear: Decimal;
  renovationDepreciationPerYear: Decimal;
  loanYearlySummary: {
    year: number;
    totalPayment: Decimal;
    totalInterest: Decimal;
    totalInsurance: Decimal;
    totalPrincipal: Decimal;
    remainingPrincipal: Decimal;
  }[];
}

interface EntityState {
  name: string;
  type: StructureInput['type'];
  taxRegime: 'IS' | 'IR';
  ownershipShare: Decimal;
  assets: AssetState[];
  carriedDeficit: Decimal;
  accumulatedCash: Decimal;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function d(val: string | number): Decimal {
  return new Decimal(val);
}

function buildAssetState(asset: AssetInput, structureType: StructureInput['type']): AssetState {
  const purchasePrice = d(asset.purchasePrice);
  const notaryFees = d(asset.notaryFees);
  const renovationCosts = d(asset.renovationCosts);

  const landRatio = d('0.15');
  const depParams = { purchasePrice, notaryFees, renovationCosts, landRatio };
  const dep = computeYearlyDepreciation(depParams);

  let loanYearlySummary: AssetState['loanYearlySummary'] = [];
  if (asset.loan) {
    const schedule = generateAmortizationSchedule(
      d(asset.loan.principal),
      d(asset.loan.interestRate),
      d(asset.loan.insuranceRate),
      asset.loan.durationMonths,
      asset.loan.type ?? 'AMORTISSABLE',
    );
    loanYearlySummary = getYearlyLoanSummary(schedule);
  }

  return {
    label: asset.label,
    purchasePrice,
    notaryFees,
    renovationCosts,
    annualRent: d(asset.annualRent),
    chargesYearly: d(asset.chargesYearly),
    propertyTax: d(asset.propertyTax),
    marketValue: purchasePrice.plus(notaryFees),
    yearlyDepreciation: (structureType === 'SCI_IS' || structureType === 'HOLDING') ? dep.total : d(0),
    buildingDepreciationYearsLeft: 25,
    renovationDepreciationYearsLeft: 15,
    buildingDepreciationPerYear: dep.building,
    renovationDepreciationPerYear: dep.renovation,
    loanYearlySummary,
  };
}

function flattenStructures(structures: StructureInput[]): { entity: StructureInput; parent?: string }[] {
  const result: { entity: StructureInput; parent?: string }[] = [];

  function walk(structs: StructureInput[], parentName?: string) {
    for (const s of structs) {
      result.push({ entity: s, parent: parentName });
      if (s.subsidiaries && s.subsidiaries.length > 0) {
        walk(s.subsidiaries as StructureInput[], s.name);
      }
    }
  }

  walk(structures);
  return result;
}

// ─── Main simulation ─────────────────────────────────────────────────────────

export function runSimulation(request: SimulationRequest): SimulationResult {
  const { userProfile, structures, params } = request;
  const horizon = params.horizonYears ?? 30;
  const rentGrowth = d(params.rentGrowthRate ?? 0.02);
  const chargesGrowth = d(params.chargesGrowthRate ?? 0.02);
  const propTaxGrowth = d(params.propertyTaxGrowthRate ?? 0.02);
  const propertyGrowth = d(params.propertyGrowth ?? 0.015);

  // Flatten the structure tree
  const flatEntities = flattenStructures(structures);

  // Build entity states
  const entityStates: Map<string, EntityState> = new Map();
  for (const { entity } of flatEntities) {
    const assets = entity.assets.map(a => buildAssetState(a, entity.type));
    entityStates.set(entity.name, {
      name: entity.name,
      type: entity.type,
      taxRegime: (entity.type === 'SCI_IR' || entity.type === 'INDIVIDUAL') ? 'IR' : 'IS',
      ownershipShare: d(entity.ownershipShare ?? 1),
      assets,
      carriedDeficit: d(0),
      accumulatedCash: d(0),
    });
  }

  // Track parent relationships for dividend flow
  const parentMap = new Map<string, string>();
  for (const { entity, parent } of flatEntities) {
    if (parent) parentMap.set(entity.name, parent);
  }

  const yearlyData: YearlyData[] = [];
  let totalTaxPaid = d(0);

  // ─── 30-year loop ────────────────────────────────────────────────────────

  for (let year = 1; year <= horizon; year++) {
    const growthMultiplier = (rate: Decimal) => rate.plus(1).pow(year - 1);
    const entitiesResult: YearlyData['entities'] = {};
    let totalRealEstateMarketValue = d(0);
    let totalRemainingDebt = d(0);
    let yearTotalNetCashFlow = d(0);
    let yearIRFoncierIncome = d(0); // for IR entities, accumulate for user-level tax

    // ── Step 1-6: Process each entity ──────────────────────────────────────

    for (const [name, state] of entityStates) {
      let entityGrossRevenue = d(0);
      let entityLoanPayment = d(0);
      let entityDepreciation = d(0);
      let entityInterest = d(0);
      let entityInsurance = d(0);
      let entityCharges = d(0);
      let entityPropertyTax = d(0);
      let entityRemainingDebt = d(0);
      let entityMarketValue = d(0);

      for (const asset of state.assets) {
        // 1. Gross revenue with rent growth
        const rent = asset.annualRent.mul(growthMultiplier(rentGrowth));
        entityGrossRevenue = entityGrossRevenue.plus(rent);

        // Charges & property tax with growth
        const charges = asset.chargesYearly.mul(growthMultiplier(chargesGrowth));
        const propTax = asset.propertyTax.mul(growthMultiplier(propTaxGrowth));
        entityCharges = entityCharges.plus(charges);
        entityPropertyTax = entityPropertyTax.plus(propTax);

        // 2. Loan payments
        const loanYear = asset.loanYearlySummary.find(l => l.year === year);
        if (loanYear) {
          entityLoanPayment = entityLoanPayment.plus(loanYear.totalPayment);
          entityInterest = entityInterest.plus(loanYear.totalInterest);
          entityInsurance = entityInsurance.plus(loanYear.totalInsurance);
          entityRemainingDebt = entityRemainingDebt.plus(loanYear.remainingPrincipal);
        } else if (asset.loanYearlySummary.length > 0) {
          // Loan finished, no more debt
          entityRemainingDebt = entityRemainingDebt.plus(d(0));
        }

        // 3. Depreciation (IS only)
        let yearDep = d(0);
        if (state.taxRegime === 'IS') {
          if (asset.buildingDepreciationYearsLeft > 0) {
            yearDep = yearDep.plus(asset.buildingDepreciationPerYear);
            asset.buildingDepreciationYearsLeft--;
          }
          if (asset.renovationDepreciationYearsLeft > 0) {
            yearDep = yearDep.plus(asset.renovationDepreciationPerYear);
            asset.renovationDepreciationYearsLeft--;
          }
        }
        entityDepreciation = entityDepreciation.plus(yearDep);

        // 8. Update market value
        asset.marketValue = asset.marketValue.mul(propertyGrowth.plus(1));
        entityMarketValue = entityMarketValue.plus(asset.marketValue);
      }

      // 4. Taxable profit
      const netRents = entityGrossRevenue.minus(entityCharges).minus(entityPropertyTax);
      let taxableProfit: Decimal;

      if (state.taxRegime === 'IS') {
        taxableProfit = netRents.minus(entityInterest).minus(entityInsurance).minus(entityDepreciation);
      } else {
        // IR: no depreciation
        taxableProfit = netRents.minus(entityInterest).minus(entityInsurance);
      }

      // 5. Apply tax
      let entityTax = d(0);

      if (state.taxRegime === 'IS') {
        // Apply deficit carry-forward
        const deficitResult = applyISDeficit(taxableProfit, state.carriedDeficit);
        state.carriedDeficit = deficitResult.remainingDeficit;
        const adjustedProfit = deficitResult.taxableAfterOffset;

        entityTax = computeIS(adjustedProfit);

        // Add Mere-Fille quote-part if entity received dividends from subsidiaries
        // (handled in step 7 from previous year's accumulated cash)
      } else {
        // IR: tax is computed at user level, accumulate income
        yearIRFoncierIncome = yearIRFoncierIncome.plus(
          taxableProfit.mul(state.ownershipShare),
        );
      }

      // 6. Net cash flow for entity
      const entityNetCashFlow = netRents
        .minus(entityLoanPayment)
        .minus(entityTax);

      state.accumulatedCash = state.accumulatedCash.plus(entityNetCashFlow);

      totalTaxPaid = totalTaxPaid.plus(entityTax);
      totalRealEstateMarketValue = totalRealEstateMarketValue.plus(entityMarketValue);
      totalRemainingDebt = totalRemainingDebt.plus(entityRemainingDebt);

      entitiesResult[name] = {
        grossRevenue: entityGrossRevenue.toFixed(2),
        loanPayment: entityLoanPayment.toFixed(2),
        depreciation: entityDepreciation.toFixed(2),
        taxableProfit: taxableProfit.toFixed(2),
        tax: entityTax.toFixed(2),
        netCashFlow: entityNetCashFlow.toFixed(2),
        remainingDebt: entityRemainingDebt.toFixed(2),
        assetMarketValue: entityMarketValue.toFixed(2),
      };

      yearTotalNetCashFlow = yearTotalNetCashFlow.plus(entityNetCashFlow);
    }

    // ── Step 7: Intra-group dividends (SCI -> Holding) ───────────────────────
    // Simplified: SCI distributes all positive cash to parent Holding
    for (const [name, state] of entityStates) {
      const parentName = parentMap.get(name);
      if (parentName && state.accumulatedCash.gt(0)) {
        const parentState = entityStates.get(parentName);
        if (parentState && parentState.taxRegime === 'IS') {
          const dividend = state.accumulatedCash;
          const quotePart = computeMereFilleQuotePart(dividend);
          // Quote-part taxed at IS in the parent
          const qpTax = computeIS(quotePart);
          parentState.accumulatedCash = parentState.accumulatedCash.plus(dividend).minus(qpTax);
          totalTaxPaid = totalTaxPaid.plus(qpTax);
          state.accumulatedCash = d(0);
        }
      }
    }

    // ── IFI (user level) ─────────────────────────────────────────────────────
    const netRealEstate = totalRealEstateMarketValue.minus(totalRemainingDebt);
    const ifiTax = computeIFI(netRealEstate);
    totalTaxPaid = totalTaxPaid.plus(ifiTax);

    // ── IR on foncier income (user level, for IR entities) ───────────────────
    let userIRTax = d(0);
    let userPSTax = d(0);
    if (yearIRFoncierIncome.gt(0)) {
      userIRTax = computeIR(
        yearIRFoncierIncome,
        userProfile.maritalStatus,
        userProfile.childrenCount,
      );
      const psRate = getSocialChargeRate(userProfile.socialChargeRegime ?? 'STANDARD');
      userPSTax = yearIRFoncierIncome.mul(psRate);
      totalTaxPaid = totalTaxPaid.plus(userIRTax).plus(userPSTax);
    }

    // ── User net dividend (simplified: no distribution in this version) ──────
    // TODO: Add dividend distribution slider logic
    const userNetDividend = d(0);

    yearTotalNetCashFlow = yearTotalNetCashFlow
      .minus(ifiTax)
      .minus(userIRTax)
      .minus(userPSTax);

    yearlyData.push({
      year,
      entities: entitiesResult,
      userNetDividend: userNetDividend.toFixed(2),
      ifiTax: ifiTax.toFixed(2),
      totalNetCashFlow: yearTotalNetCashFlow.toFixed(2),
    });
  }

  // ── Summary ──────────────────────────────────────────────────────────────────

  // Total net wealth = sum of all entity market values - debt + accumulated cash
  let totalWealth = d(0);
  for (const [, state] of entityStates) {
    for (const asset of state.assets) {
      totalWealth = totalWealth.plus(asset.marketValue);
      // Subtract remaining debt
      const lastLoanYear = asset.loanYearlySummary[asset.loanYearlySummary.length - 1];
      if (lastLoanYear) {
        totalWealth = totalWealth.minus(lastLoanYear.remainingPrincipal);
      }
    }
    totalWealth = totalWealth.plus(state.accumulatedCash);
  }

  return {
    summary: {
      totalNetWealth: totalWealth.toFixed(2),
      totalTaxPaid: totalTaxPaid.toFixed(2),
      irr: '0.00', // TODO: implement IRR calculation
    },
    yearlyData,
  };
}
