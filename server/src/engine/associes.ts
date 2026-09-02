import Decimal from 'decimal.js';
import type { AssocieInput } from '@shared/schemas.js';
import { computeIR, getSocialChargeRate } from './tax.js';

/**
 * Per-associe taxation of an SCI at IR.
 *
 * An SCI at IR is fiscally translucent: it pays no tax itself. Its result is
 * split pro-rata among the associes, and each of them declares their share on
 * top of their own income, under their own quotient familial. Two associes in
 * the same SCI can therefore pay very different amounts on the same euro.
 */

// ─── Result splitting ────────────────────────────────────────────────────────

/** Splits a yearly foncier result pro-rata by parts. Negative results split too. */
export function splitResultatFoncier(
  resultat: Decimal,
  associes: AssocieInput[],
): Map<string, Decimal> {
  const parts = new Map<string, Decimal>();
  for (const a of associes) {
    parts.set(a.nom, resultat.mul(a.partsPercent));
  }
  return parts;
}

// ─── Deficit foncier ─────────────────────────────────────────────────────────

/** Yearly cap on the foncier deficit chargeable against global income. */
const PLAFOND_IMPUTATION_GLOBALE = new Decimal('10700');
/** A carried foncier deficit expires after 10 years. */
const DUREE_REPORT_ANNEES = 10;

export interface DeficitVintage {
  /** Year the deficit was created — drives the 10-year expiry. */
  year: number;
  montant: Decimal;
}

export interface DeficitResult {
  /** Foncier income remaining taxable after absorbing carried deficits. */
  revenuFoncierNet: Decimal;
  /** Part of this year's deficit charged against the associe's global income. */
  imputationRevenuGlobal: Decimal;
  /** Deficits still carried forward, expired vintages dropped. */
  vintages: DeficitVintage[];
}

/**
 * Applies the French foncier deficit rules for one associe, one year.
 *
 * Simplification: the law splits the deficit between its interest part (only
 * chargeable against future foncier income) and the rest (chargeable against
 * global income up to the cap). We apply the cap to the whole deficit without
 * that split, which slightly favours the IR scenario in heavily-leveraged
 * early years.
 */
export function applyDeficitFoncier(
  quotePart: Decimal,
  carried: DeficitVintage[],
  year: number,
): DeficitResult {
  // Drop vintages past their 10-year life. A deficit born in year N is
  // chargeable against the foncier income of years N+1 to N+10 inclusive, so
  // the comparison is inclusive too — a strict `<` cost a full year of report.
  let vintages = carried.filter((v) => year - v.year <= DUREE_REPORT_ANNEES);

  if (quotePart.lt(0)) {
    const deficit = quotePart.abs();
    const imputation = Decimal.min(deficit, PLAFOND_IMPUTATION_GLOBALE);
    const reste = deficit.minus(imputation);

    if (reste.gt(0)) {
      vintages = [...vintages, { year, montant: reste }];
    }

    return {
      revenuFoncierNet: new Decimal(0),
      imputationRevenuGlobal: imputation,
      vintages,
    };
  }

  // Positive result: absorb the oldest carried deficits first.
  let restant = quotePart;
  const remaining: DeficitVintage[] = [];

  for (const v of [...vintages].sort((a, b) => a.year - b.year)) {
    if (restant.lte(0)) {
      remaining.push(v);
      continue;
    }
    const absorbe = Decimal.min(v.montant, restant);
    restant = restant.minus(absorbe);
    const solde = v.montant.minus(absorbe);
    if (solde.gt(0)) remaining.push({ year: v.year, montant: solde });
  }

  return {
    revenuFoncierNet: restant,
    imputationRevenuGlobal: new Decimal(0),
    vintages: remaining,
  };
}

// ─── Per-associe income tax ──────────────────────────────────────────────────

export interface AssocieTaxResult {
  /** IR attributable to the SCI. Negative when a deficit lowers the tax bill. */
  ir: Decimal;
  /** Prelevements sociaux — on positive foncier income only. */
  ps: Decimal;
  total: Decimal;
}

/**
 * Computes the tax an associe actually owes because of the SCI.
 *
 * This is a DIFFERENTIAL: tax with the SCI minus tax without it. Taxing the
 * quote-part in isolation would ignore the associe's other income and land it
 * in the wrong bracket — the same mistake `computeDividendBareme` avoids in
 * tax.ts.
 */
export function computeAssocieIR(
  associe: AssocieInput,
  deficit: DeficitResult,
): AssocieTaxResult {
  const autresRevenus = new Decimal(associe.autresRevenus);
  const { revenuFoncierNet, imputationRevenuGlobal } = deficit;

  const revenuSansSCI = autresRevenus;
  const revenuAvecSCI = Decimal.max(new Decimal(0), autresRevenus.minus(imputationRevenuGlobal)).plus(
    revenuFoncierNet,
  );

  const irAvec = computeIR(revenuAvecSCI, associe.maritalStatus, associe.childrenCount);
  const irSans = computeIR(revenuSansSCI, associe.maritalStatus, associe.childrenCount);
  const ir = irAvec.minus(irSans);

  const psRate = getSocialChargeRate(associe.socialChargeRegime);
  const ps = revenuFoncierNet.mul(psRate);

  return { ir, ps, total: ir.plus(ps) };
}

// ─── LMP (BIC reel) ──────────────────────────────────────────────────────────

export interface AssocieLMPResult {
  /** IR attributable to the LMP activity. Negative when a deficit lowers the bill. */
  ir: Decimal;
  /** TNS (SSI) contributions — not the CSG/PS rate used for passive foncier income. */
  cotisationsSociales: Decimal;
  total: Decimal;
}

/**
 * Per-associe taxation of an LMP (Loueur Meuble Professionnel) BIC result.
 *
 * Three things set this apart from `computeAssocieIR`:
 *  - A BIC pro deficit imputes in full against the associe's global income —
 *    unlike a foncier deficit there is no 10 700 EUR/year cap.
 *  - The social levy is TNS (SSI) contributions on the professional result,
 *    not CSG/CRDS/PS on passive income, so it uses its own rate rather than
 *    `getSocialChargeRate`.
 *  - Those contributions are themselves a deductible charge of the BIC
 *    result, so income tax bites on what is left after them. Taxing the gross
 *    result over-stated the IR by roughly a third of the contributions.
 *
 * @param cotisationsMinimales - Floor the SSI charges whatever the result,
 *   including in deficit. An indicative yearly amount, overridable like every
 *   other cost in the model.
 */
export function computeAssocieLMP(
  associe: AssocieInput,
  quotePart: Decimal,
  tauxCotisationsSocialesTNS: Decimal,
  cotisationsMinimales: Decimal = new Decimal(0),
): AssocieLMPResult {
  const autresRevenus = new Decimal(associe.autresRevenus);

  // Contributions are due on a positive result, and never fall below the
  // SSI floor — a loss-making year still costs the operator their minimum.
  const proportionnelles = quotePart.gt(0)
    ? quotePart.mul(tauxCotisationsSocialesTNS)
    : new Decimal(0);
  const cotisationsSociales = Decimal.max(proportionnelles, cotisationsMinimales);

  // What income tax actually sees, once the contributions are deducted.
  const resultatImposable = quotePart.minus(cotisationsSociales);
  const revenuAvecLMP = Decimal.max(new Decimal(0), autresRevenus.plus(resultatImposable));

  const irAvec = computeIR(revenuAvecLMP, associe.maritalStatus, associe.childrenCount);
  const irSans = computeIR(autresRevenus, associe.maritalStatus, associe.childrenCount);
  const ir = irAvec.minus(irSans);

  return { ir, cotisationsSociales, total: ir.plus(cotisationsSociales) };
}

// ─── Compte courant d'associe ────────────────────────────────────────────────

export interface CCAYearResult {
  /** Interest owed to the associe — deductible for the SCI, RCM for them. */
  interets: Decimal;
  /** Capital repaid this year — cash out of the SCI, not taxable. */
  remboursement: Decimal;
  soldeRestant: Decimal;
}

/**
 * One year of a compte courant d'associe.
 *
 * The CCA is a plain debt of the SCI towards its associe. Repaying it moves
 * cash out of the company entirely tax-free, which is the main reason to fund
 * an SCI this way rather than through share capital.
 */
export function computeCCAYear(
  solde: Decimal,
  tauxInteret: Decimal,
  cashDisponible: Decimal,
  repaymentRate: Decimal,
): CCAYearResult {
  if (solde.lte(0)) {
    return { interets: new Decimal(0), remboursement: new Decimal(0), soldeRestant: new Decimal(0) };
  }

  const interets = solde.mul(tauxInteret);
  const cashPourRemboursement = Decimal.max(new Decimal(0), cashDisponible).mul(repaymentRate);
  const remboursement = Decimal.min(solde, cashPourRemboursement);

  return {
    interets,
    remboursement,
    soldeRestant: solde.minus(remboursement),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** The associe whose death drives the succession estimate, if declared. */
export function findSelf(associes: AssocieInput[]): AssocieInput | undefined {
  return associes.find((a) => a.relation === 'SELF');
}

/** Total capital subscribed by the associes of a structure. */
export function totalCapitalSocial(associes: AssocieInput[]): Decimal {
  return associes.reduce((acc, a) => acc.plus(new Decimal(a.apportCapital)), new Decimal(0));
}

/** Total funds lent to the structure through comptes courants. */
export function totalComptesCourants(associes: AssocieInput[]): Decimal {
  return associes.reduce((acc, a) => acc.plus(new Decimal(a.apportCompteCourant)), new Decimal(0));
}
