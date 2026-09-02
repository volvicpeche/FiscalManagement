import Decimal from 'decimal.js';
import type { MaritalStatus, SocialChargeRegime } from '@shared/schemas.js';
import {
  IR_BRACKETS,
  PLAFOND_DEMI_PART,
  PLAFOND_PARENT_ISOLE,
  DECOTE_SEUIL_CELIBATAIRE,
  DECOTE_SEUIL_COUPLE,
  DECOTE_TAUX,
  IS_SEUIL_TAUX_REDUIT,
  IS_TAUX_REDUIT,
  IS_TAUX_NORMAL,
  IS_DEFICIT_PLAFOND_FIXE,
  IS_DEFICIT_PART_VARIABLE,
  PS_PATRIMOINE,
  PS_SOLIDARITE_SEULE,
  PS_PFU,
  PFU_TAUX_IR,
  PV_TAUX_IR,
  IFI_SEUIL_ENTREE,
  IFI_BRACKETS,
  DUREE_AMORTISSEMENT_IMMEUBLE,
  DUREE_AMORTISSEMENT_TRAVAUX,
} from './baremes.js';

// ─── Social Charges ──────────────────────────────────────────────────────────

/**
 * PS rate on revenus du patrimoine — foncier income and real-estate gains.
 *
 * SWISS_EXEMPT: affiliated to a foreign social security scheme, so exempt from
 * CSG and CRDS; only the prelevement de solidarite remains.
 */
export function getSocialChargeRate(regime: SocialChargeRegime): Decimal {
  return regime === 'SWISS_EXEMPT' ? PS_SOLIDARITE_SEULE : PS_PATRIMOINE;
}

/**
 * PS rate applied inside the PFU. Deliberately higher than the rate above:
 * see the note on PS_PFU in baremes.ts — it is a forward assumption of the
 * project, not the rate in force.
 */
export function getPfuSocialChargeRate(regime: SocialChargeRegime): Decimal {
  return regime === 'SWISS_EXEMPT' ? PS_SOLIDARITE_SEULE : PS_PFU;
}

// ─── IS (Corporate Tax) ─────────────────────────────────────────────────────

/** Computes IS (Impot sur les Societes) for a given taxable profit. */
export function computeIS(taxableProfit: Decimal): Decimal {
  if (taxableProfit.lte(0)) return new Decimal(0);

  if (taxableProfit.lte(IS_SEUIL_TAUX_REDUIT)) {
    return taxableProfit.mul(IS_TAUX_REDUIT);
  }

  return IS_SEUIL_TAUX_REDUIT.mul(IS_TAUX_REDUIT).plus(
    taxableProfit.minus(IS_SEUIL_TAUX_REDUIT).mul(IS_TAUX_NORMAL),
  );
}

// ─── IS Deficit Carry-Forward ────────────────────────────────────────────────

/**
 * Applies IS deficit carry-forward rules.
 * Returns { taxableAfterOffset, remainingDeficit }.
 */
export function applyISDeficit(
  profit: Decimal,
  carriedDeficit: Decimal,
): { taxableAfterOffset: Decimal; remainingDeficit: Decimal } {
  if (profit.lte(0)) {
    return {
      taxableAfterOffset: new Decimal(0),
      remainingDeficit: carriedDeficit.plus(profit.abs()),
    };
  }

  if (carriedDeficit.lte(0)) {
    return { taxableAfterOffset: profit, remainingDeficit: new Decimal(0) };
  }

  // Legal cap: 1,000,000 + 50% of the profit beyond 1,000,000.
  const plafondLegal = Decimal.max(IS_DEFICIT_PLAFOND_FIXE, profit)
    .minus(IS_DEFICIT_PLAFOND_FIXE)
    .mul(IS_DEFICIT_PART_VARIABLE)
    .plus(IS_DEFICIT_PLAFOND_FIXE);

  // The imputation can never exceed the profit of the year either. Without
  // this bound the taxable result went negative and the unused deficit was
  // wiped out instead of staying reportable — the SCI then paid IS on later
  // years it should have sheltered.
  const offset = Decimal.min(carriedDeficit, plafondLegal, profit);

  return {
    taxableAfterOffset: profit.minus(offset),
    remainingDeficit: carriedDeficit.minus(offset),
  };
}

// ─── IR (Income Tax — Bareme Progressif) ─────────────────────────────────────

/** A single person raising children alone gets an extra half-part (case T). */
export function isParentIsole(maritalStatus: MaritalStatus, childrenCount: number): boolean {
  return maritalStatus === 'SINGLE' && childrenCount > 0;
}

/** Computes the number of quotient familial parts. */
export function computeQuotientParts(
  maritalStatus: MaritalStatus,
  childrenCount: number,
): Decimal {
  let parts = maritalStatus === 'SINGLE' ? new Decimal(1) : new Decimal(2);

  const firstTwo = Math.min(childrenCount, 2);
  const beyond = Math.max(childrenCount - 2, 0);
  parts = parts.plus(new Decimal(firstTwo).mul('0.5')).plus(beyond);

  // Case T: raising a child alone is worth an additional half-part, so the
  // first child brings a full part rather than a half. Leaving it out taxed
  // every single parent as if they had a partner to share the burden with.
  if (isParentIsole(maritalStatus, childrenCount)) {
    parts = parts.plus('0.5');
  }

  return parts;
}

/** Computes raw IR tax for a given income per part (before plafonnement/decote). */
function computeTaxPerPart(incomePerPart: Decimal): Decimal {
  let tax = new Decimal(0);
  let previousThreshold = new Decimal(0);

  for (const bracket of IR_BRACKETS) {
    if (incomePerPart.lte(previousThreshold)) break;

    const taxableInBracket = Decimal.min(incomePerPart, bracket.threshold).minus(previousThreshold);
    tax = tax.plus(taxableInBracket.mul(bracket.rate));
    previousThreshold = bracket.threshold;
  }

  return tax;
}

/**
 * Full IR computation with quotient familial, plafonnement, and decote.
 * Returns the final IR amount (before social charges).
 */
export function computeIR(
  revenuNetImposable: Decimal,
  maritalStatus: MaritalStatus,
  childrenCount: number,
): Decimal {
  if (revenuNetImposable.lte(0)) return new Decimal(0);

  const parts = computeQuotientParts(maritalStatus, childrenCount);
  const baseParts = maritalStatus === 'SINGLE' ? new Decimal(1) : new Decimal(2);

  // Tax with quotient familial
  const incomePerPart = revenuNetImposable.div(parts);
  const taxPerPart = computeTaxPerPart(incomePerPart);
  const taxWithQF = taxPerPart.mul(parts);

  // Tax without quotient familial (base parts only) for plafonnement
  const incomePerBasePart = revenuNetImposable.div(baseParts);
  const taxPerBasePart = computeTaxPerPart(incomePerBasePart);
  const taxWithoutQF = taxPerBasePart.mul(baseParts);

  // Plafonnement: cap the advantage of the extra half-parts. A parent isole
  // gets a full part for their first child, capped on its own and far higher
  // than an ordinary half-part; anything beyond follows the common ceiling.
  const extraHalfParts = parts.minus(baseParts).mul(2); // number of half-parts
  const maxReduction = isParentIsole(maritalStatus, childrenCount)
    ? PLAFOND_PARENT_ISOLE.plus(
        Decimal.max(new Decimal(0), extraHalfParts.minus(2)).mul(PLAFOND_DEMI_PART),
      )
    : PLAFOND_DEMI_PART.mul(extraHalfParts);
  const actualReduction = taxWithoutQF.minus(taxWithQF);

  let grossTax: Decimal;
  if (actualReduction.gt(maxReduction)) {
    grossTax = taxWithoutQF.minus(maxReduction);
  } else {
    grossTax = taxWithQF;
  }

  // Decote
  const isCouple = maritalStatus !== 'SINGLE';
  const decoteThreshold = isCouple ? DECOTE_SEUIL_COUPLE : DECOTE_SEUIL_CELIBATAIRE;

  if (grossTax.lt(decoteThreshold)) {
    const decote = decoteThreshold.minus(grossTax.mul(DECOTE_TAUX));
    grossTax = Decimal.max(new Decimal(0), grossTax.minus(decote));
  }

  return grossTax;
}

// ─── PFU (Flat Tax on Dividends) ─────────────────────────────────────────────

/**
 * Computes dividend tax under PFU (flat tax) option.
 * PFU = 12.8% IR + PS rate (18.6% standard or 7.5% Swiss-exempt).
 */
export function computePFU(grossDividend: Decimal, regime: SocialChargeRegime): Decimal {
  const psRate = getPfuSocialChargeRate(regime);
  return grossDividend.mul(PFU_TAUX_IR.plus(psRate));
}

/**
 * Computes dividend tax under Bareme option.
 * 40% abatement on gross, then IR bareme + PS on full gross.
 */
export function computeDividendBareme(
  grossDividend: Decimal,
  otherIncome: Decimal,
  maritalStatus: MaritalStatus,
  childrenCount: number,
  regime: SocialChargeRegime,
): Decimal {
  const psRate = getPfuSocialChargeRate(regime);
  const ps = grossDividend.mul(psRate);

  // 40% abatement for bareme
  const taxableDiv = grossDividend.mul('0.6');
  const totalIncome = otherIncome.plus(taxableDiv);

  // IR on total income vs. IR on other income only
  const irTotal = computeIR(totalIncome, maritalStatus, childrenCount);
  const irBase = computeIR(otherIncome, maritalStatus, childrenCount);
  const irOnDiv = irTotal.minus(irBase);

  return irOnDiv.plus(ps);
}

// ─── Mere-Fille (SCI -> Holding Dividend) ────────────────────────────────────

/**
 * Under Regime Mere-Fille, 95% of the dividend from SCI to Holding is exempt.
 * Only 5% (quote-part de frais et charges) is added to Holding's taxable profit.
 */
export function computeMereFilleQuotePart(dividend: Decimal): Decimal {
  return dividend.mul('0.05');
}

// ─── IFI (Impot sur la Fortune Immobiliere) ──────────────────────────────────

/** Computes IFI for a given net real estate patrimony value. */
export function computeIFI(netTaxableBase: Decimal): Decimal {
  if (netTaxableBase.lt(IFI_SEUIL_ENTREE)) return new Decimal(0);

  let tax = new Decimal(0);
  let previousThreshold = new Decimal(0);

  for (const bracket of IFI_BRACKETS) {
    if (netTaxableBase.lte(previousThreshold)) break;

    const taxableInBracket = Decimal.min(netTaxableBase, bracket.threshold).minus(previousThreshold);
    tax = tax.plus(taxableInBracket.mul(bracket.rate));
    previousThreshold = bracket.threshold;
  }

  // Decote: smoothing between 1.3M and 1.4M
  if (netTaxableBase.gte('1300000') && netTaxableBase.lte('1400000')) {
    const decote = new Decimal('17500').minus(netTaxableBase.mul('0.0125'));
    if (decote.gt(0)) {
      tax = tax.minus(decote);
    }
  }

  return Decimal.max(new Decimal(0), tax);
}

// ─── Depreciation (Amortissement SCI IS) ─────────────────────────────────────

export interface DepreciationParams {
  purchasePrice: Decimal;
  notaryFees: Decimal;
  renovationCosts: Decimal;
  landRatio: Decimal; // e.g., 0.15 to 0.20
}

export interface YearlyDepreciation {
  building: Decimal;
  renovation: Decimal;
  total: Decimal;
}

/** Computes yearly depreciation for an asset under SCI IS regime. */
export function computeYearlyDepreciation(params: DepreciationParams): YearlyDepreciation {
  const base = params.purchasePrice.plus(params.notaryFees);
  const buildingValue = base.mul(new Decimal(1).minus(params.landRatio));

  // Building: linear over 25 years (4%/year)
  const buildingDepreciation = buildingValue.div(DUREE_AMORTISSEMENT_IMMEUBLE);

  // Renovation: linear over 15 years
  const renovationDepreciation = params.renovationCosts.div(DUREE_AMORTISSEMENT_TRAVAUX);

  return {
    building: buildingDepreciation,
    renovation: renovationDepreciation,
    total: buildingDepreciation.plus(renovationDepreciation),
  };
}

// ─── Capital Gains (Plus-Values) ─────────────────────────────────────────────

/** SCI IS: Taxable gain = Sale Price - VNC (net book value). Taxed at IS rate. */
export function computeCapitalGainIS(
  salePrice: Decimal,
  netBookValue: Decimal,
): { taxableGain: Decimal; tax: Decimal } {
  const gain = salePrice.minus(netBookValue);
  if (gain.lte(0)) return { taxableGain: new Decimal(0), tax: new Decimal(0) };
  return { taxableGain: gain, tax: computeIS(gain) };
}

// ─── Surtaxe sur les plus-values immobilieres elevees (art. 1609 nonies G) ───

/**
 * Bands of the surtaxe, with the smoothing term the law applies at the foot
 * of each rate step. The coefficients are what make the schedule continuous
 * from 100 000 EUR upwards: at 100 000 the 2 % band gives 2 000, and the 3 %
 * band with its correction gives the same figure a euro later.
 */
const SURTAXE_PALIERS: { plafond: Decimal; taux: Decimal; lissage: Decimal | null }[] = [
  { plafond: new Decimal('60000'), taux: new Decimal('0.02'), lissage: new Decimal('0.05') },
  { plafond: new Decimal('100000'), taux: new Decimal('0.02'), lissage: null },
  { plafond: new Decimal('110000'), taux: new Decimal('0.03'), lissage: new Decimal('0.10') },
  { plafond: new Decimal('150000'), taux: new Decimal('0.03'), lissage: null },
  { plafond: new Decimal('160000'), taux: new Decimal('0.04'), lissage: new Decimal('0.15') },
  { plafond: new Decimal('200000'), taux: new Decimal('0.04'), lissage: null },
  { plafond: new Decimal('210000'), taux: new Decimal('0.05'), lissage: new Decimal('0.20') },
  { plafond: new Decimal('250000'), taux: new Decimal('0.05'), lissage: null },
  { plafond: new Decimal('260000'), taux: new Decimal('0.06'), lissage: new Decimal('0.25') },
  { plafond: new Decimal('Infinity'), taux: new Decimal('0.06'), lissage: null },
];

/**
 * Surtaxe due on a real-estate gain above 50 000 EUR, on top of the 19 % and
 * the social charges. It applies to individuals and to an SCI at IR, never to
 * a company taxed at IS.
 *
 * Simplification: the 50 000 EUR threshold is legally assessed on each
 * associe's own share of the gain. Applying it to the whole gain over-states
 * the surtaxe when several associes split a mid-sized operation.
 */
export function computeSurtaxePlusValue(pvImposable: Decimal): Decimal {
  if (pvImposable.lte(50000)) return new Decimal(0);

  for (const palier of SURTAXE_PALIERS) {
    if (pvImposable.lte(palier.plafond)) {
      const brut = pvImposable.mul(palier.taux);
      const correction = palier.lissage
        ? palier.plafond.minus(pvImposable).mul(palier.lissage)
        : new Decimal(0);
      return Decimal.max(new Decimal(0), brut.minus(correction));
    }
  }

  return pvImposable.mul('0.06');
}

/**
 * SCI IR: Taxable gain = Sale Price - Purchase Price, with duration abatements.
 * IR abatement: full exemption after 22 years.
 * PS abatement: full exemption after 30 years.
 */
export function computeCapitalGainIR(
  salePrice: Decimal,
  purchasePrice: Decimal,
  holdingYears: number,
  regime: SocialChargeRegime,
): { taxableGain: Decimal; irTax: Decimal; psTax: Decimal; surtaxe: Decimal; total: Decimal } {
  const rawGain = salePrice.minus(purchasePrice);
  if (rawGain.lte(0)) {
    return {
      taxableGain: new Decimal(0),
      irTax: new Decimal(0),
      psTax: new Decimal(0),
      surtaxe: new Decimal(0),
      total: new Decimal(0),
    };
  }

  // IR abatement schedule
  let irAbatement: Decimal;
  if (holdingYears >= 22) {
    irAbatement = new Decimal(1); // 100% exempt
  } else if (holdingYears <= 5) {
    irAbatement = new Decimal(0);
  } else if (holdingYears <= 21) {
    // 6% per year from year 6 to 21
    irAbatement = new Decimal(holdingYears - 5).mul('0.06');
  } else {
    // Year 22: 4%
    irAbatement = new Decimal('0.96').plus('0.04');
  }

  // PS abatement schedule
  let psAbatement: Decimal;
  if (holdingYears >= 30) {
    psAbatement = new Decimal(1); // 100% exempt
  } else if (holdingYears <= 5) {
    psAbatement = new Decimal(0);
  } else if (holdingYears <= 21) {
    // 1.65% per year from year 6 to 21
    psAbatement = new Decimal(holdingYears - 5).mul('0.0165');
  } else if (holdingYears <= 22) {
    // Year 22: 1.60%
    psAbatement = new Decimal(16).mul('0.0165').plus('0.016');
  } else {
    // 9% per year from year 23 to 30
    const base = new Decimal(16).mul('0.0165').plus('0.016');
    psAbatement = base.plus(new Decimal(holdingYears - 22).mul('0.09'));
  }

  irAbatement = Decimal.min(irAbatement, new Decimal(1));
  psAbatement = Decimal.min(psAbatement, new Decimal(1));

  const taxableForIR = rawGain.mul(new Decimal(1).minus(irAbatement));
  const taxableForPS = rawGain.mul(new Decimal(1).minus(psAbatement));

  const irTax = taxableForIR.mul(PV_TAUX_IR);
  const psRate = getSocialChargeRate(regime);
  const psTax = taxableForPS.mul(psRate);
  // The surtaxe bites on the gain left after the duration abatements.
  const surtaxe = computeSurtaxePlusValue(taxableForIR);

  return {
    taxableGain: rawGain,
    irTax,
    psTax,
    surtaxe,
    total: irTax.plus(psTax).plus(surtaxe),
  };
}
