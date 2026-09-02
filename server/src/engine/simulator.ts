import Decimal from 'decimal.js';
import type {
  SimulationRequest,
  SimulationResult,
  YearlyData,
  EntityYear,
  AssocieYear,
  StructureInput,
  AssetInput,
  AssocieInput,
  UserProfile,
  SaisonnierParams,
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
import { resolveCosts, indexedAnnualCost, type ResolvedCosts } from './costs.js';
import {
  applyDeficitFoncier,
  computeAssocieIR,
  computeAssocieLMP,
  computeCCAYear,
  type DeficitVintage,
} from './associes.js';
import { computeSaisonnierRevenue } from './saisonnier.js';
import { computeSuccessionForAssocies } from './succession.js';
import { computeIRR } from './irr.js';
import { computeFinancement, type FinancementResult } from './financement.js';
import { computeExitIS, computeExitIR, computeExitLMP, type ExitResult } from './exit.js';

// ─── Internal types for simulation state ─────────────────────────────────────

interface AssetState {
  label: string;
  purchasePrice: Decimal;
  notaryFees: Decimal;
  renovationCosts: Decimal;
  annualRent: Decimal;
  /** When set, revenue for this asset comes from the seasonal engine instead of `annualRent`. */
  saisonnier?: SaisonnierParams;
  chargesYearly: Decimal;
  propertyTax: Decimal;
  marketValue: Decimal;
  /** Amount borrowed, before any repayment — the debt at incorporation. */
  loanPrincipalInitial: Decimal;
  /** Everything written off so far — drives the book value at the exit. */
  cumulAmortissements: Decimal;
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

interface AssocieState {
  input: AssocieInput;
  /** Foncier deficits carried forward, with their vintage year. */
  deficitVintages: DeficitVintage[];
  /** Outstanding compte courant balance owed by this entity to this associe. */
  ccaBalance: Decimal;
}

interface EntityState {
  name: string;
  type: StructureInput['type'];
  taxRegime: 'IS' | 'IR';
  ownershipShare: Decimal;
  assets: AssetState[];
  associes: AssocieState[];
  costs: ResolvedCosts;
  carriedDeficit: Decimal;
  /** Taxable result of the current year, after the deficit offset. */
  lastTaxableAfterOffset: Decimal;
  accumulatedCash: Decimal;
  /** Bank debt outstanding at the end of the last simulated year. */
  lastRemainingDebt: Decimal;
  /** What the acquisition needs versus what the associes declared. */
  financement: FinancementResult;
  /** LMP: BIC reel — depreciation applies and the per-associe tax uses TNS charges, not foncier PS. */
  isBic: boolean;
  tauxCotisationsSocialesLMP: Decimal;
  cotisationsMinimalesLMP: Decimal;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function d(val: string | number): Decimal {
  return new Decimal(val);
}

function zeroEntityYear(overrides: Partial<Record<keyof EntityYear, Decimal>> = {}): EntityYear {
  const z = d(0);
  const get = (k: keyof EntityYear) => (overrides[k] ?? z).toFixed(2);
  return {
    grossRevenue: get('grossRevenue'),
    charges: get('charges'),
    loanPayment: get('loanPayment'),
    loanInterest: get('loanInterest'),
    loanPrincipal: get('loanPrincipal'),
    depreciation: get('depreciation'),
    operatingCosts: get('operatingCosts'),
    taxableProfit: get('taxableProfit'),
    tax: get('tax'),
    netCashFlow: get('netCashFlow'),
    remainingDebt: get('remainingDebt'),
    assetMarketValue: get('assetMarketValue'),
    tresorerie: get('tresorerie'),
    ccaRembourse: get('ccaRembourse'),
    ccaSolde: get('ccaSolde'),
    dividendeVerse: get('dividendeVerse'),
    // Year 0 is incorporation: nothing has been earned or spent on the asset yet.
    detail: {
      loyerNu: '0.00', caHauteSaison: '0.00', caMoyenneSaison: '0.00', caBasseSaison: '0.00',
      chargesCopro: '0.00', taxeFonciere: '0.00',
      commissionPlateforme: '0.00', fraisMenageLinge: '0.00', fraisConciergerie: '0.00',
      interets: '0.00', assurance: '0.00',
    },
  };
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
    saisonnier: asset.saisonnier,
    chargesYearly: d(asset.chargesYearly),
    propertyTax: d(asset.propertyTax),
    marketValue: purchasePrice.plus(notaryFees),
    loanPrincipalInitial: asset.loan ? d(asset.loan.principal) : d(0),
    cumulAmortissements: d(0),
    yearlyDepreciation:
      (structureType === 'SCI_IS' || structureType === 'HOLDING' || structureType === 'LMP')
        ? dep.total
        : d(0),
    buildingDepreciationYearsLeft: 25,
    renovationDepreciationYearsLeft: 15,
    buildingDepreciationPerYear: dep.building,
    renovationDepreciationPerYear: dep.renovation,
    loanYearlySummary,
  };
}

/**
 * An SCI at IR must attribute its result to someone. When no associe is
 * declared, we fall back to a single implicit one carrying the declarant's
 * household and the structure's ownership share.
 */
function implicitAssocie(userProfile: UserProfile, ownershipShare: number): AssocieInput {
  return {
    nom: 'Vous',
    partsPercent: ownershipShare,
    relation: 'SELF',
    birthDate: userProfile.birthDate,
    maritalStatus: userProfile.maritalStatus,
    childrenCount: userProfile.childrenCount,
    autresRevenus: userProfile.autresRevenus ?? '0.00',
    socialChargeRegime: userProfile.socialChargeRegime ?? 'STANDARD',
    apportCapital: '0.00',
    apportCompteCourant: '0.00',
    tauxInteretCCA: 0,
  };
}

function buildAssocieStates(
  entity: StructureInput,
  taxRegime: 'IS' | 'IR',
  userProfile: UserProfile,
): AssocieState[] {
  const declared = entity.associes ?? [];

  const inputs: AssocieInput[] =
    declared.length > 0
      ? declared
      : taxRegime === 'IR'
        ? [implicitAssocie(userProfile, entity.ownershipShare ?? 1)]
        : [];

  return inputs.map((input) => ({
    input,
    deficitVintages: [],
    ccaBalance: d(input.apportCompteCourant),
  }));
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

/** Accumulates an associe's yearly figures across every entity they hold. */
function addAssocieYear(
  bucket: Map<string, AssocieYear>,
  nom: string,
  values: Partial<Record<keyof AssocieYear, Decimal>>,
): void {
  const current = bucket.get(nom) ?? {
    quotePart: '0.00',
    irTax: '0.00',
    psTax: '0.00',
    ccaInterest: '0.00',
    ccaInterestTax: '0.00',
    ccaRepayment: '0.00',
    ccaBalance: '0.00',
    dividendeNet: '0.00',
    netCashFlow: '0.00',
  };

  const merged: AssocieYear = { ...current };
  for (const key of Object.keys(values) as (keyof AssocieYear)[]) {
    const add = values[key];
    if (add) merged[key] = d(current[key]).plus(add).toFixed(2);
  }

  bucket.set(nom, merged);
}

// ─── Main simulation ─────────────────────────────────────────────────────────

export function runSimulation(request: SimulationRequest): SimulationResult {
  const { userProfile, structures, params } = request;
  const horizon = params.horizonYears ?? 30;
  const rentGrowth = d(params.rentGrowthRate ?? 0.02);
  const chargesGrowth = d(params.chargesGrowthRate ?? 0.02);
  const propTaxGrowth = d(params.propertyTaxGrowthRate ?? 0.02);
  const propertyGrowth = d(params.propertyGrowth ?? 0.015);
  const inflation = d(params.inflationRate ?? 0.02);
  const dividendRate = d(params.dividendDistributionRate ?? 0);
  const ccaRepaymentRate = d(params.ccaRepaymentRate ?? 0);

  // Flatten the structure tree
  const flatEntities = flattenStructures(structures);

  // Build entity states
  const entityStates: Map<string, EntityState> = new Map();
  for (const { entity } of flatEntities) {
    const taxRegime: 'IS' | 'IR' =
      entity.type === 'SCI_IR' || entity.type === 'INDIVIDUAL' || entity.type === 'LMP' ? 'IR' : 'IS';
    const assets = entity.assets.map(a => buildAssetState(a, entity.type));
    const costs = resolveCosts(entity.costs?.mode ?? 'EN_LIGNE', entity.type, entity.costs);

    entityStates.set(entity.name, {
      name: entity.name,
      type: entity.type,
      taxRegime,
      ownershipShare: d(entity.ownershipShare ?? 1),
      assets,
      associes: buildAssocieStates(entity, taxRegime, userProfile),
      costs,
      carriedDeficit: d(0),
      lastTaxableAfterOffset: d(0),
      // The apport covers the acquisition AND the setup costs exactly, so the
      // company opens at zero. Starting at -constitution would charge those
      // costs twice: once here and once inside apportRequis.
      accumulatedCash: d(0),
      lastRemainingDebt: d(0),
      financement: computeFinancement(entity.assets, entity.associes ?? [], costs.constitution),
      isBic: entity.type === 'LMP',
      tauxCotisationsSocialesLMP: d(entity.tauxCotisationsSocialesLMP ?? 0.35),
      cotisationsMinimalesLMP: d(entity.cotisationsMinimalesLMP ?? '1200.00'),
    });
  }

  // Track parent relationships for dividend flow
  const parentMap = new Map<string, string>();
  for (const { entity, parent } of flatEntities) {
    if (parent) parentMap.set(entity.name, parent);
  }

  /**
   * Share of the group held by the declarant's own foyer fiscal.
   *
   * The IFI is a personal tax on the taxpayer's share of the real estate, not
   * on the whole building. Charging the full value over-stated it as soon as
   * parts had been given away — which is the entire point of the transmission
   * scenario. The spouse sits in the same foyer, any other associe does not.
   */
  const foyerShare = (() => {
    const porteur =
      flatEntities.find((f) => !f.parent && (f.entity.associes?.length ?? 0) > 0) ??
      flatEntities.find((f) => (f.entity.associes?.length ?? 0) > 0);
    const associes = porteur?.entity.associes ?? [];
    if (associes.length === 0) return d(1);

    const foyer = associes.filter((a) => a.relation === 'SELF' || a.relation === 'SPOUSE');
    if (foyer.length === 0) return d(1);
    return foyer.reduce((acc, a) => acc.plus(a.partsPercent), d(0));
  })();

  const yearlyData: YearlyData[] = [];
  let totalTaxPaid = d(0);
  let totalOperatingCosts = d(0);
  let totalFraisConstitution = d(0);

  // What the associes hold personally, outside the companies. Without this the
  // regimes are not comparable: at IR the associes pay the tax out of their own
  // pocket while the SCI keeps its cash, and distributed dividends would simply
  // disappear from the wealth total.
  let personalWealth = d(0);

  // ─── Year 0: incorporation ───────────────────────────────────────────────
  // The company exists but has not traded yet: only setup costs are booked,
  // and the associes' contributions are recorded.

  {
    const entitiesResult: YearlyData['entities'] = {};
    const associesBucket = new Map<string, AssocieYear>();
    let constitutionTotal = d(0);
    let apportTotal = d(0);

    for (const [name, state] of entityStates) {
      // The debt at incorporation is the amount borrowed, not the balance after
      // a first year of repayments.
      const initialDebt = state.assets.reduce((acc, a) => acc.plus(a.loanPrincipalInitial), d(0));
      const initialValue = state.assets.reduce((acc, a) => acc.plus(a.marketValue), d(0));

      constitutionTotal = constitutionTotal.plus(state.costs.constitution);
      apportTotal = apportTotal.plus(state.financement.apportRequis);

      entitiesResult[name] = zeroEntityYear({
        operatingCosts: state.costs.constitution,
        // The comptes courants are funded at incorporation, before anything runs.
        ccaSolde: state.associes.reduce((acc, a) => acc.plus(a.ccaBalance), d(0)),
        // What year 0 really costs the family: the whole down payment, of
        // which the incorporation costs are one line.
        netCashFlow: state.financement.apportRequis.neg(),
        remainingDebt: initialDebt,
        assetMarketValue: initialValue,
      });

      for (const a of state.associes) {
        addAssocieYear(associesBucket, a.input.nom, { ccaBalance: a.ccaBalance });
      }
    }

    totalFraisConstitution = constitutionTotal;

    // The apport leaves the family's pocket to become equity in the company.
    // Without this debit the model let the down payment appear from nowhere and
    // over-stated net wealth by exactly that amount.
    for (const [, state] of entityStates) {
      personalWealth = personalWealth.minus(state.financement.apportRequis);
    }

    yearlyData.push({
      year: 0,
      entities: entitiesResult,
      associes: Object.fromEntries(associesBucket),
      userNetDividend: '0.00',
      dividendTax: '0.00',
      ifiTax: '0.00',
      operatingCosts: constitutionTotal.toFixed(2),
      totalNetCashFlow: apportTotal.neg().toFixed(2),
      // The apport is the family's only movement at incorporation.
      fluxFamille: apportTotal.neg().toFixed(2),
    });
  }

  // ─── 30-year loop ────────────────────────────────────────────────────────

  for (let year = 1; year <= horizon; year++) {
    // Everything that crosses into the associes' own pockets moves
    // personalWealth. Taking its delta over the year gives the family cash
    // flow without having to re-derive it from the entity lines.
    const personalWealthAtStart = personalWealth;
    const growthMultiplier = (rate: Decimal) => rate.plus(1).pow(year - 1);
    const entitiesResult: YearlyData['entities'] = {};
    const associesBucket = new Map<string, AssocieYear>();
    const dividendesVerses = new Map<string, Decimal>();
    let totalRealEstateMarketValue = d(0);
    let totalRemainingDebt = d(0);
    let yearTotalNetCashFlow = d(0);
    let yearOperatingCosts = d(0);
    let yearAssocieTax = d(0);

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
      // Kept alongside the totals so the table can show where each one comes from.
      const detail = {
        loyerNu: d(0), caHauteSaison: d(0), caMoyenneSaison: d(0), caBasseSaison: d(0),
        chargesCopro: d(0), taxeFonciere: d(0),
        commissionPlateforme: d(0), fraisMenageLinge: d(0), fraisConciergerie: d(0),
        interets: d(0), assurance: d(0),
      };

      for (const asset of state.assets) {
        // 1. Gross revenue with rent growth — seasonal assets go through the
        // saisonnier engine instead, and their operating fees (commission or
        // conciergerie) are folded into entityCharges alongside copro/taxe fonciere.
        if (asset.saisonnier) {
          const caGrowth = growthMultiplier(rentGrowth);
          const feeGrowth = growthMultiplier(chargesGrowth);
          const grown: SaisonnierParams = {
            ...asset.saisonnier,
            hauteSaison: {
              ...asset.saisonnier.hauteSaison,
              caPeriode: d(asset.saisonnier.hauteSaison.caPeriode).mul(caGrowth).toFixed(2),
            },
            moyenneSaison: {
              ...asset.saisonnier.moyenneSaison,
              caPeriode: d(asset.saisonnier.moyenneSaison.caPeriode).mul(caGrowth).toFixed(2),
            },
            basseSaison: {
              ...asset.saisonnier.basseSaison,
              caPeriode: d(asset.saisonnier.basseSaison.caPeriode).mul(caGrowth).toFixed(2),
            },
            fraisMenageLingeAnnuel: d(asset.saisonnier.fraisMenageLingeAnnuel).mul(feeGrowth).toFixed(2),
          };
          const revenue = computeSaisonnierRevenue(grown);
          entityGrossRevenue = entityGrossRevenue.plus(revenue.caAnnuelBrut);
          entityCharges = entityCharges.plus(revenue.totalFraisExploitation);

          detail.caHauteSaison = detail.caHauteSaison.plus(revenue.caParSaison.hauteSaison);
          detail.caMoyenneSaison = detail.caMoyenneSaison.plus(revenue.caParSaison.moyenneSaison);
          detail.caBasseSaison = detail.caBasseSaison.plus(revenue.caParSaison.basseSaison);
          detail.commissionPlateforme = detail.commissionPlateforme.plus(revenue.commissionPlateforme);
          detail.fraisMenageLinge = detail.fraisMenageLinge.plus(revenue.fraisMenageLinge);
          detail.fraisConciergerie = detail.fraisConciergerie.plus(revenue.fraisConciergerie);
        } else {
          const rent = asset.annualRent.mul(growthMultiplier(rentGrowth));
          entityGrossRevenue = entityGrossRevenue.plus(rent);
          detail.loyerNu = detail.loyerNu.plus(rent);
        }

        // Charges & property tax with growth
        const charges = asset.chargesYearly.mul(growthMultiplier(chargesGrowth));
        const propTax = asset.propertyTax.mul(growthMultiplier(propTaxGrowth));
        entityCharges = entityCharges.plus(charges);
        entityPropertyTax = entityPropertyTax.plus(propTax);
        detail.chargesCopro = detail.chargesCopro.plus(charges);
        detail.taxeFonciere = detail.taxeFonciere.plus(propTax);

        // 2. Loan payments
        const loanYear = asset.loanYearlySummary.find(l => l.year === year);
        if (loanYear) {
          entityLoanPayment = entityLoanPayment.plus(loanYear.totalPayment);
          entityInterest = entityInterest.plus(loanYear.totalInterest);
          entityInsurance = entityInsurance.plus(loanYear.totalInsurance);
          detail.interets = detail.interets.plus(loanYear.totalInterest);
          detail.assurance = detail.assurance.plus(loanYear.totalInsurance);
          entityRemainingDebt = entityRemainingDebt.plus(loanYear.remainingPrincipal);
        } else if (asset.loanYearlySummary.length > 0) {
          // Loan finished, no more debt
          entityRemainingDebt = entityRemainingDebt.plus(d(0));
        }

        // 3. Depreciation (IS and LMP/BIC reel — not SCI_IR/INDIVIDUAL foncier)
        let yearDep = d(0);
        if (state.taxRegime === 'IS' || state.isBic) {
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
        asset.cumulAmortissements = asset.cumulAmortissements.plus(yearDep);

        // 8. Update market value
        asset.marketValue = asset.marketValue.mul(propertyGrowth.plus(1));
        entityMarketValue = entityMarketValue.plus(asset.marketValue);
      }

      // 3b. Structure running costs — deductible under both regimes.
      const operatingCosts = indexedAnnualCost(state.costs.annuel, year, inflation);
      yearOperatingCosts = yearOperatingCosts.plus(operatingCosts);
      totalOperatingCosts = totalOperatingCosts.plus(operatingCosts);

      // 3c. Interest on comptes courants — a charge of the company.
      let ccaInterestTotal = d(0);
      for (const a of state.associes) {
        ccaInterestTotal = ccaInterestTotal.plus(a.ccaBalance.mul(a.input.tauxInteretCCA));
      }

      // 4. Taxable profit
      const netRents = entityGrossRevenue.minus(entityCharges).minus(entityPropertyTax);
      const chargesStructurelles = operatingCosts.plus(ccaInterestTotal);
      let taxableProfit: Decimal;

      if (state.taxRegime === 'IS' || state.isBic) {
        taxableProfit = netRents
          .minus(entityInterest)
          .minus(entityInsurance)
          .minus(entityDepreciation)
          .minus(chargesStructurelles);
      } else {
        // IR foncier (SCI_IR / INDIVIDUAL): no depreciation
        taxableProfit = netRents
          .minus(entityInterest)
          .minus(entityInsurance)
          .minus(chargesStructurelles);
      }

      // 5. Apply tax
      let entityTax = d(0);

      if (state.taxRegime === 'IS') {
        // Apply deficit carry-forward
        const deficitResult = applyISDeficit(taxableProfit, state.carriedDeficit);
        state.carriedDeficit = deficitResult.remainingDeficit;
        const adjustedProfit = deficitResult.taxableAfterOffset;
        state.lastTaxableAfterOffset = adjustedProfit;

        entityTax = computeIS(adjustedProfit);
      } else if (state.isBic) {
        // 5c. LMP: translucent like an SCI at IR, but the result is BIC — the
        // deficit imputes fully against global income (no foncier cap) and the
        // social levy is TNS (SSI) contributions on the professional result,
        // not the foncier PS rate.
        for (const a of state.associes) {
          const quotePart = taxableProfit.mul(a.input.partsPercent);
          const { ir, cotisationsSociales, total } = computeAssocieLMP(
            a.input,
            quotePart,
            state.tauxCotisationsSocialesLMP,
            state.cotisationsMinimalesLMP.mul(a.input.partsPercent),
          );
          yearAssocieTax = yearAssocieTax.plus(total);
          totalTaxPaid = totalTaxPaid.plus(total);
          personalWealth = personalWealth.minus(total);

          addAssocieYear(associesBucket, a.input.nom, {
            quotePart,
            irTax: ir,
            // Reusing the psTax slot for TNS contributions — see AssocieYear.
            psTax: cotisationsSociales,
            netCashFlow: total.neg(),
          });
        }
      } else {
        // 5b. IR foncier: the SCI is translucent — each associe is taxed on
        // their own quote-part, at their own marginal rate, on top of their
        // own income.
        for (const a of state.associes) {
          const quotePart = taxableProfit.mul(a.input.partsPercent);
          const deficit = applyDeficitFoncier(quotePart, a.deficitVintages, year);
          a.deficitVintages = deficit.vintages;

          const { ir, ps } = computeAssocieIR(a.input, deficit);
          yearAssocieTax = yearAssocieTax.plus(ir).plus(ps);
          totalTaxPaid = totalTaxPaid.plus(ir).plus(ps);
          personalWealth = personalWealth.minus(ir).minus(ps);

          addAssocieYear(associesBucket, a.input.nom, {
            quotePart,
            irTax: ir,
            psTax: ps,
            netCashFlow: ir.neg().minus(ps),
          });
        }
      }

      // 6. Net cash flow for entity, before repaying any compte courant
      let entityNetCashFlow = netRents
        .minus(entityLoanPayment)
        .minus(entityTax)
        .minus(chargesStructurelles);

      // 6b. Compte courant: interest paid out, then capital repaid from the
      // cash the entity has on hand. Repayment is a pure cash movement — no
      // tax on it. A holding repays out of the dividends it has banked, so the
      // envelope is the accumulated cash, not just this year's flow.
      const totalCCA = state.associes.reduce((acc, a) => acc.plus(a.ccaBalance), d(0));
      const cashDisponible = state.accumulatedCash.plus(entityNetCashFlow);
      let totalRemboursement = d(0);

      for (const a of state.associes) {
        // Split the repayment envelope pro-rata across the outstanding accounts.
        const quote = totalCCA.gt(0) ? a.ccaBalance.div(totalCCA) : d(0);
        const { interets, remboursement, soldeRestant } = computeCCAYear(
          a.ccaBalance,
          d(a.input.tauxInteretCCA),
          cashDisponible.mul(quote),
          ccaRepaymentRate,
        );
        a.ccaBalance = soldeRestant;
        totalRemboursement = totalRemboursement.plus(remboursement);

        // Interest on a compte courant is RCM in the associe's hands.
        const interetTax = interets.gt(0)
          ? computePFU(interets, a.input.socialChargeRegime)
          : d(0);
        totalTaxPaid = totalTaxPaid.plus(interetTax);
        // Cash leaving the company lands in the associe's hands, not thin air.
        personalWealth = personalWealth.plus(remboursement).plus(interets).minus(interetTax);

        addAssocieYear(associesBucket, a.input.nom, {
          ccaInterest: interets,
          ccaInterestTax: interetTax,
          ccaRepayment: remboursement,
          ccaBalance: soldeRestant,
          netCashFlow: remboursement.plus(interets).minus(interetTax),
        });
      }

      entityNetCashFlow = entityNetCashFlow.minus(totalRemboursement);

      state.accumulatedCash = state.accumulatedCash.plus(entityNetCashFlow);
      state.lastRemainingDebt = entityRemainingDebt;

      totalTaxPaid = totalTaxPaid.plus(entityTax);
      totalRealEstateMarketValue = totalRealEstateMarketValue.plus(entityMarketValue);
      totalRemainingDebt = totalRemainingDebt.plus(entityRemainingDebt);

      entitiesResult[name] = {
        grossRevenue: entityGrossRevenue.toFixed(2),
        charges: entityCharges.plus(entityPropertyTax).toFixed(2),
        loanPayment: entityLoanPayment.toFixed(2),
        loanInterest: entityInterest.plus(entityInsurance).toFixed(2),
        loanPrincipal: entityLoanPayment
          .minus(entityInterest)
          .minus(entityInsurance)
          .toFixed(2),
        depreciation: entityDepreciation.toFixed(2),
        operatingCosts: operatingCosts.toFixed(2),
        taxableProfit: taxableProfit.toFixed(2),
        tax: entityTax.toFixed(2),
        netCashFlow: entityNetCashFlow.toFixed(2),
        remainingDebt: entityRemainingDebt.toFixed(2),
        assetMarketValue: entityMarketValue.toFixed(2),
        // Provisional: dividends move cash after this loop, so tresorerie and
        // dividendeVerse are rewritten once every movement is known.
        tresorerie: state.accumulatedCash.toFixed(2),
        ccaRembourse: totalRemboursement.toFixed(2),
        ccaSolde: state.associes.reduce((acc, a) => acc.plus(a.ccaBalance), d(0)).toFixed(2),
        dividendeVerse: '0.00',
        detail: Object.fromEntries(
          Object.entries(detail).map(([k, v]) => [k, v.toFixed(2)]),
        ) as EntityYear['detail'],
      };

      yearTotalNetCashFlow = yearTotalNetCashFlow.plus(entityNetCashFlow);
    }

    // ── Step 7: Intra-group dividends (SCI -> Holding) ───────────────────────
    // The subsidiary distributes its cash; the parent only receives its share.
    for (const [name, state] of entityStates) {
      const parentName = parentMap.get(name);
      if (parentName && state.accumulatedCash.gt(0)) {
        const parentState = entityStates.get(parentName);
        if (parentState && parentState.taxRegime === 'IS') {
          const distribue = state.accumulatedCash;
          const dividend = distribue.mul(state.ownershipShare);
          dividendesVerses.set(name, (dividendesVerses.get(name) ?? d(0)).plus(distribue));
          // The 5 % quote-part de frais et charges is an ordinary piece of the
          // parent's own result: it absorbs the parent's carried deficit, and
          // it must not get a second run at the 15 % band the parent has
          // already used on its own profit. Hence a differential, computed on
          // top of the result taxed a moment ago rather than in isolation.
          const quotePart = computeMereFilleQuotePart(dividend);
          const qpDeficit = applyISDeficit(quotePart, parentState.carriedDeficit);
          parentState.carriedDeficit = qpDeficit.remainingDeficit;

          const socleTaxable = parentState.lastTaxableAfterOffset;
          const qpTax = computeIS(socleTaxable.plus(qpDeficit.taxableAfterOffset)).minus(
            computeIS(socleTaxable),
          );
          parentState.lastTaxableAfterOffset = socleTaxable.plus(qpDeficit.taxableAfterOffset);

          parentState.accumulatedCash = parentState.accumulatedCash.plus(dividend).minus(qpTax);
          totalTaxPaid = totalTaxPaid.plus(qpTax);

          // Report it on the parent's own tax line, otherwise totalTaxPaid no
          // longer reconciles with the yearly rows.
          const parentRow = entitiesResult[parentName];
          if (parentRow) {
            parentRow.tax = d(parentRow.tax).plus(qpTax).toFixed(2);
            parentRow.taxableProfit = d(parentRow.taxableProfit)
              .plus(qpDeficit.taxableAfterOffset)
              .toFixed(2);
          }
          // The minority share leaves the group with the other shareholders.
          state.accumulatedCash = d(0);
        }
      }
    }

    // ── IFI (user level) ─────────────────────────────────────────────────────
    // Only the foyer's own share of the net real estate enters their base.
    const netRealEstate = totalRealEstateMarketValue.minus(totalRemainingDebt).mul(foyerShare);
    const ifiTax = computeIFI(netRealEstate);
    totalTaxPaid = totalTaxPaid.plus(ifiTax);
    personalWealth = personalWealth.minus(ifiTax);

    // ── User net dividend (Holding -> User distribution) ────────────────────
    let userNetDividend = d(0);
    let dividendTax = d(0);

    if (dividendRate.gt(0)) {
      // Find top-level IS entities (Holdings or standalone SCI IS) with positive cash
      for (const [, state] of entityStates) {
        const isTopLevel = !parentMap.has(state.name);
        if (isTopLevel && state.taxRegime === 'IS' && state.accumulatedCash.gt(0)) {
          const grossDividend = state.accumulatedCash.mul(dividendRate);
          if (grossDividend.gt(0)) {
            // A dividend is taxed in the hands of each associe, pro-rata to
            // their parts, on their own household and on top of their own
            // income. Arbitrating PFU against bareme at a zero other income
            // made the bareme win almost every time and under-stated the tax
            // by more than half on a household in the upper brackets.
            const beneficiaires: AssocieInput[] =
              state.associes.length > 0
                ? state.associes.map((a) => a.input)
                : [implicitAssocie(userProfile, 1)];

            for (const benef of beneficiaires) {
              const part = grossDividend.mul(benef.partsPercent);
              if (part.lte(0)) continue;

              const regime = benef.socialChargeRegime ?? 'STANDARD';
              const pfuTax = computePFU(part, regime);
              const baremeTax = computeDividendBareme(
                part,
                d(benef.autresRevenus),
                benef.maritalStatus,
                benef.childrenCount,
                regime,
              );
              const bestTax = Decimal.min(pfuTax, baremeTax);
              const net = part.minus(bestTax);

              userNetDividend = userNetDividend.plus(net);
              dividendTax = dividendTax.plus(bestTax);

              addAssocieYear(associesBucket, benef.nom, {
                dividendeNet: net,
                netCashFlow: net,
              });
            }

            dividendesVerses.set(
              state.name,
              (dividendesVerses.get(state.name) ?? d(0)).plus(grossDividend),
            );
            state.accumulatedCash = state.accumulatedCash.minus(grossDividend);
          }
        }
      }
      totalTaxPaid = totalTaxPaid.plus(dividendTax);
      personalWealth = personalWealth.plus(userNetDividend);
    }

    yearTotalNetCashFlow = yearTotalNetCashFlow
      .minus(ifiTax)
      .minus(yearAssocieTax)
      .plus(userNetDividend);

    // Every movement is now known: write the closing balances.
    for (const [name, state] of entityStates) {
      const row = entitiesResult[name];
      if (!row) continue;
      row.tresorerie = state.accumulatedCash.toFixed(2);
      row.dividendeVerse = (dividendesVerses.get(name) ?? d(0)).toFixed(2);
    }

    yearlyData.push({
      year,
      entities: entitiesResult,
      associes: Object.fromEntries(associesBucket),
      userNetDividend: userNetDividend.toFixed(2),
      dividendTax: dividendTax.toFixed(2),
      ifiTax: ifiTax.toFixed(2),
      operatingCosts: yearOperatingCosts.toFixed(2),
      totalNetCashFlow: yearTotalNetCashFlow.toFixed(2),
      fluxFamille: personalWealth.minus(personalWealthAtStart).toFixed(2),
    });
  }

  // ── Summary ──────────────────────────────────────────────────────────────────

  // Total net wealth of the family: what the companies hold, plus what the
  // associes hold personally after tax.
  let totalWealth = personalWealth;
  // Company net asset value, which the shares are worth: also net of the
  // comptes courants, since those are a debt towards the associes.
  let navSocietes = d(0);
  const ccaBalances = new Map<string, Decimal>();

  for (const [, state] of entityStates) {
    const marketValue = state.assets.reduce((acc, a) => acc.plus(a.marketValue), d(0));
    const ccaTotal = state.associes.reduce((acc, a) => acc.plus(a.ccaBalance), d(0));

    totalWealth = totalWealth
      .plus(marketValue)
      .minus(state.lastRemainingDebt)
      .plus(state.accumulatedCash);

    navSocietes = navSocietes
      .plus(marketValue)
      .minus(state.lastRemainingDebt)
      .plus(state.accumulatedCash)
      .minus(ccaTotal);

    for (const a of state.associes) {
      ccaBalances.set(a.input.nom, (ccaBalances.get(a.input.nom) ?? d(0)).plus(a.ccaBalance));
    }
  }

  // ── Succession ───────────────────────────────────────────────────────────────
  // Estimated on the entity the associes actually hold: the top of the tree.

  const holder =
    [...entityStates.values()].find(s => !parentMap.has(s.name) && s.associes.length > 0) ??
    [...entityStates.values()].find(s => s.associes.length > 0);

  const selfAssocie = holder?.associes.find(a => a.input.relation === 'SELF')?.input;
  // Age reached by the deceased at the end of the horizon — drives the Art. 669
  // usufruit bareme when the shares are transmitted in nue-propriete only.
  const ageAuTerme = selfAssocie?.birthDate
    ? new Date().getFullYear() - new Date(selfAssocie.birthDate).getFullYear() + horizon
    : undefined;

  // A pure-yield simulation asks what the operation earns while it runs, not
  // what leaving it costs — so the end-of-life figures are not computed at all.
  const objectif = params.objectif ?? 'TRANSMISSION';
  const transmission = objectif === 'TRANSMISSION';

  const succession = !transmission
    ? {
        navTotal: navSocietes,
        valeurPartsDefunt: d(0),
        ccaDefunt: d(0),
        baseTransmise: d(0),
        heritiers: [],
        total: d(0),
      }
    : computeSuccessionForAssocies({
    nav: navSocietes,
    associes: holder?.associes.map(a => a.input) ?? [],
    ccaBalances,
    illiquidityDiscount: d(params.illiquidityDiscount ?? 0.1),
    demembrement: params.demembrement ?? false,
    ageAuTerme,
    fallbackChildren: userProfile.childrenCount,
  });

  // Succession is reported on its own line: it is a one-off event at death,
  // not part of the running tax bill.

  // ── IRR ──────────────────────────────────────────────────────────────────
  // From the family's point of view: the apport goes out at t0, each year
  // brings whatever actually crossed into the associes' pockets, and the
  // horizon returns the gross net asset value of the structures. Terminal
  // wealth stands in for a sale, so the rate ignores the capital-gains tax an
  // actual exit would trigger — `irrNetDeRevente` below prices that.
  //
  // The series must be built on `fluxFamille`, never on `totalNetCashFlow`:
  // the latter counts cash retained inside the company, which the terminal
  // value already holds, so each euro was discounted twice — once at its own
  // date and once at the horizon. The apport suffered the same fate, charged
  // at t0 and again inside `totalNetWealth`, which is a wealth-created figure
  // and therefore already net of it.
  const financementTotal = [...entityStates.values()].reduce(
    (acc, s) => ({
      coutAcquisition: acc.coutAcquisition.plus(s.financement.coutAcquisition),
      emprunt: acc.emprunt.plus(s.financement.emprunt),
      apportRequis: acc.apportRequis.plus(s.financement.apportRequis),
      apportDeclare: acc.apportDeclare.plus(s.financement.apportDeclare),
      ecart: acc.ecart.plus(s.financement.ecart),
    }),
    {
      coutAcquisition: d(0), emprunt: d(0),
      apportRequis: d(0), apportDeclare: d(0), ecart: d(0),
    },
  );

  // Gross value of what the family still owns through the companies. The
  // comptes courants are NOT deducted: they are owed to the associes, so from
  // the family's side they are part of the terminal position, and what has
  // already been repaid left as a flow in its own year.
  const navBrute = totalWealth.minus(personalWealth);

  const cashFlows: Decimal[] = yearlyData.map((y) => d(y.fluxFamille));
  cashFlows[cashFlows.length - 1] = cashFlows[cashFlows.length - 1].plus(navBrute);
  const irr = computeIRR(cashFlows);

  // ── Selling at the horizon ───────────────────────────────────────────────
  // Aggregated across the entity that actually holds the walls.
  const holders = [...entityStates.values()].filter((s) => s.assets.length > 0);
  const sortieParams = holders.reduce(
    (acc, s) => {
      for (const a of s.assets) {
        acc.prixVente = acc.prixVente.plus(a.marketValue);
        acc.prixAchat = acc.prixAchat.plus(a.purchasePrice);
        acc.travauxReels = acc.travauxReels.plus(a.renovationCosts);
        // Works count towards the acquisition price at IR: leaving them out
        // inflated the taxable gain by their whole amount.
        acc.prixAcquisition = acc.prixAcquisition
          .plus(a.purchasePrice)
          .plus(a.notaryFees)
          .plus(a.renovationCosts);
        acc.baseAmortissable = acc.baseAmortissable
          .plus(a.purchasePrice)
          .plus(a.notaryFees)
          .plus(a.renovationCosts);
        acc.cumulAmortissements = acc.cumulAmortissements.plus(a.cumulAmortissements);
      }
      acc.detteResiduelle = acc.detteResiduelle.plus(s.lastRemainingDebt);
      return acc;
    },
    {
      prixVente: d(0), prixAcquisition: d(0), baseAmortissable: d(0),
      prixAchat: d(0), travauxReels: d(0),
      cumulAmortissements: d(0), detteResiduelle: d(0),
      dureeDetention: horizon,
      regimeSocial: userProfile.socialChargeRegime ?? ('STANDARD' as const),
    },
  );

  const holderPrincipal = holders[0];
  const vendeur = holderPrincipal?.associes[0]?.input;

  let sortie: ExitResult;
  if (!transmission) {
    // Not sold and not transmitted: the operation simply keeps running.
    sortie = {
      regime: holderPrincipal?.taxRegime === 'IS' ? 'IS' : 'IR',
      prixVente: d(0), valeurNetteComptable: d(0), prixAcquisition: d(0),
      plusValueBrute: d(0), amortissementsRepris: d(0), impot: d(0),
      detteResiduelle: sortieParams.detteResiduelle, produitNet: d(0),
    };
  } else if (holderPrincipal?.isBic && vendeur) {
    sortie = computeExitLMP(sortieParams, vendeur, holderPrincipal.tauxCotisationsSocialesLMP);
  } else if (holderPrincipal?.taxRegime === 'IS') {
    sortie = computeExitIS(sortieParams);
  } else {
    sortie = computeExitIR(sortieParams);
  }

  // The rate over the whole cycle, sale included. This is the honest one: the
  // plain IRR above treats terminal wealth as if it were already cash.
  const cashFlowsApresRevente = [...cashFlows];
  const last = cashFlowsApresRevente.length - 1;
  cashFlowsApresRevente[last] = cashFlowsApresRevente[last].minus(sortie.impot);
  const irrNetDeRevente = computeIRR(cashFlowsApresRevente);

  return {
    summary: {
      totalNetWealth: totalWealth.toFixed(2),
      totalTaxPaid: totalTaxPaid.toFixed(2),
      irr: irr === null ? null : irr.toFixed(4),
      fraisConstitution: totalFraisConstitution.toFixed(2),
      totalOperatingCosts: totalOperatingCosts.toFixed(2),
      successionCost: succession.total.toFixed(2),
      objectif,
      sortie: {
        regime: sortie.regime,
        prixVente: sortie.prixVente.toFixed(2),
        valeurNetteComptable: sortie.valeurNetteComptable.toFixed(2),
        prixAcquisition: sortie.prixAcquisition.toFixed(2),
        plusValueBrute: sortie.plusValueBrute.toFixed(2),
        amortissementsRepris: sortie.amortissementsRepris.toFixed(2),
        impot: sortie.impot.toFixed(2),
        detteResiduelle: sortie.detteResiduelle.toFixed(2),
        produitNet: sortie.produitNet.toFixed(2),
      },
      irrNetDeRevente: irrNetDeRevente === null ? null : irrNetDeRevente.toFixed(4),
      financement: {
        coutAcquisition: financementTotal.coutAcquisition.toFixed(2),
        emprunt: financementTotal.emprunt.toFixed(2),
        apportRequis: financementTotal.apportRequis.toFixed(2),
        apportDeclare: financementTotal.apportDeclare.toFixed(2),
        ecart: financementTotal.ecart.toFixed(2),
      },
    },
    yearlyData,
    succession: {
      navTotal: succession.navTotal.toFixed(2),
      valeurPartsDefunt: succession.valeurPartsDefunt.toFixed(2),
      ccaDefunt: succession.ccaDefunt.toFixed(2),
      baseTransmise: succession.baseTransmise.toFixed(2),
      heritiers: succession.heritiers.map(h => ({
        nom: h.nom,
        relation: h.relation,
        partRecue: h.partRecue.toFixed(2),
        abattement: h.abattement.toFixed(2),
        baseTaxable: h.baseTaxable.toFixed(2),
        droits: h.droits.toFixed(2),
      })),
      total: succession.total.toFixed(2),
    },
  };
}
