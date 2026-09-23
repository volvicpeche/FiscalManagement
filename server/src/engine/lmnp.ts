import Decimal from 'decimal.js';
import type { AssocieInput } from '@shared/schemas.js';
import { computeIR, getSocialChargeRate } from './tax.js';
import type { DeficitVintage } from './associes.js';
import {
  LMNP_DUREE_REPORT_DEFICIT,
  MICRO_BIC_ABATTEMENT_MEUBLE,
  MICRO_BIC_ABATTEMENT_MINIMUM,
  MICRO_BIC_ABATTEMENT_TOURISME_NON_CLASSE,
  MICRO_BIC_SEUIL_MEUBLE,
  MICRO_BIC_SEUIL_TOURISME_NON_CLASSE,
} from './baremes.js';

/**
 * LMNP — Loueur en Meuble Non Professionnel.
 *
 * The same BIC as an LMP, taxed under very different rules:
 *  - At the reel, depreciation may never create or deepen a deficit (art.
 *    39 C II CGI). What cannot be used is not lost: it is deferred with no
 *    time limit and absorbs later profits. This is what keeps an LMNP at
 *    zero tax for fifteen or twenty years.
 *  - A deficit made of real charges does NOT reduce the global income, unlike
 *    an LMP or a deficit foncier: it only offsets non-professional BIC over the
 *    next ten years.
 *  - The social levy is the prelevements sociaux on capital income, not TNS
 *    contributions.
 *  - Or the micro-BIC: a flat allowance on the gross receipts, no charge, no
 *    depreciation, no deficit.
 */

// ─── Reel ────────────────────────────────────────────────────────────────────

export interface LMNPReelInput {
  /** Receipts less every deductible charge, interest included — depreciation excluded. */
  resultatAvantAmortissements: Decimal;
  /** Depreciation computed for the year, before the art. 39 C cap. */
  amortissementsExercice: Decimal;
  /** Deficits carried from previous years, with their vintage. */
  deficits: DeficitVintage[];
  /** Deferred depreciation (ARD) carried from previous years. */
  amortissementsDifferes: Decimal;
  year: number;
}

export interface LMNPReelResult {
  /** What the associes are taxed on. Never negative. */
  resultatImposable: Decimal;
  /** Depreciation actually deducted this year, deferred stock included. */
  amortissementsDeduits: Decimal;
  amortissementsDifferes: Decimal;
  deficits: DeficitVintage[];
}

/**
 * One year of an LMNP at the reel.
 *
 * Order of imputation: the year's own depreciation, capped at the result
 * before depreciation; then the carried deficits, oldest first, because they
 * expire; then the deferred depreciation, which does not.
 */
export function applyLMNPReel(input: LMNPReelInput): LMNPReelResult {
  const { resultatAvantAmortissements: resultat, amortissementsExercice, year } = input;

  // A deficit born in year N offsets the results of years N+1 to N+10.
  const deficits = input.deficits.filter((v) => year - v.year <= LMNP_DUREE_REPORT_DEFICIT);

  if (resultat.lte(0)) {
    // No room for any depreciation: all of it is deferred, and the loss made
    // of real charges joins the carried deficits.
    return {
      resultatImposable: new Decimal(0),
      amortissementsDeduits: new Decimal(0),
      amortissementsDifferes: input.amortissementsDifferes.plus(amortissementsExercice),
      deficits: resultat.lt(0) ? [...deficits, { year, montant: resultat.abs() }] : deficits,
    };
  }

  // 1. The year's own depreciation, never beyond the result.
  const amortUtilise = Decimal.min(resultat, amortissementsExercice);
  let restant = resultat.minus(amortUtilise);
  let differes = input.amortissementsDifferes.plus(amortissementsExercice.minus(amortUtilise));

  // 2. Carried deficits, oldest first.
  const remaining: DeficitVintage[] = [];
  for (const v of [...deficits].sort((a, b) => a.year - b.year)) {
    const absorbe = Decimal.min(v.montant, restant);
    restant = restant.minus(absorbe);
    const solde = v.montant.minus(absorbe);
    if (solde.gt(0)) remaining.push({ year: v.year, montant: solde });
  }

  // 3. Deferred depreciation.
  const differesUtilises = Decimal.min(restant, differes);
  restant = restant.minus(differesUtilises);
  differes = differes.minus(differesUtilises);

  return {
    resultatImposable: restant,
    amortissementsDeduits: amortUtilise.plus(differesUtilises),
    amortissementsDifferes: differes,
    deficits: remaining,
  };
}

// ─── Micro-BIC ───────────────────────────────────────────────────────────────

export interface MicroBICResult {
  /** False when receipts exceed the threshold — the reel then applies. */
  eligible: boolean;
  seuil: Decimal;
  tauxAbattement: Decimal;
  abattement: Decimal;
  resultatImposable: Decimal;
}

/**
 * Micro-BIC on gross receipts.
 *
 * @param tourismeNonClasse - Furnished tourist letting without a classement:
 *   15 000 EUR threshold and a 30 % allowance since 2025. Classified tourist
 *   lettings and ordinary furnished lettings keep 77 700 EUR and 50 %.
 */
export function computeMicroBIC(recettes: Decimal, tourismeNonClasse: boolean): MicroBICResult {
  const seuil = tourismeNonClasse ? MICRO_BIC_SEUIL_TOURISME_NON_CLASSE : MICRO_BIC_SEUIL_MEUBLE;
  const taux = tourismeNonClasse
    ? MICRO_BIC_ABATTEMENT_TOURISME_NON_CLASSE
    : MICRO_BIC_ABATTEMENT_MEUBLE;

  const abattement = Decimal.min(
    recettes,
    Decimal.max(recettes.mul(taux), MICRO_BIC_ABATTEMENT_MINIMUM),
  );

  return {
    eligible: recettes.lte(seuil),
    seuil,
    tauxAbattement: taux,
    abattement,
    resultatImposable: Decimal.max(new Decimal(0), recettes.minus(abattement)),
  };
}

// ─── Per-associe taxation ────────────────────────────────────────────────────

export interface AssocieLMNPResult {
  ir: Decimal;
  /** Prelevements sociaux on capital income. Zero once the associe is affiliated to the SSI. */
  ps: Decimal;
  /** SSI contributions of a seasonal letting above 23 000 EUR. Zero otherwise. */
  cotisationsSociales: Decimal;
  total: Decimal;
}

/**
 * SSI contributions an LMNP owes on a meuble de tourisme above 23 000 EUR of
 * receipts (art. L613-1 CSS). The tax status stays LMNP; only the social levy
 * changes.
 */
export interface CotisationsSSI {
  /** Indicative flat rate on the BIC result. */
  taux: Decimal;
  /** Floor due once affiliated, whatever the result. */
  minimum: Decimal;
  /**
   * At the reel the contributions are a charge of the activity and lower the
   * income tax base. At the micro-BIC the flat allowance already stands for
   * every charge, so they are not deducted a second time.
   */
  deductibles: boolean;
}

/**
 * Tax owed by one associe on their share of the LMNP result.
 *
 * A DIFFERENTIAL, like every translucent regime in the engine. The quote-part
 * is never negative here: an LMNP deficit stays inside the activity and never
 * reaches the global income, which is exactly what sets it apart from an LMP.
 *
 * Simplification: at the reel, contributions beyond the result (the SSI floor
 * in a year sheltered by depreciation) do not create a deficit — the income
 * tax base just stops at zero.
 */
export function computeAssocieLMNP(
  associe: AssocieInput,
  quotePart: Decimal,
  ssi?: CotisationsSSI,
): AssocieLMNPResult {
  const base = Decimal.max(new Decimal(0), quotePart);
  const autresRevenus = new Decimal(associe.autresRevenus);

  // Affiliated: contributions replace the prelevements sociaux entirely —
  // CSG and CRDS are already part of them.
  const cotisationsSociales = ssi
    ? Decimal.max(base.mul(ssi.taux), ssi.minimum)
    : new Decimal(0);
  const ps = ssi ? new Decimal(0) : base.mul(getSocialChargeRate(associe.socialChargeRegime));

  const baseIR = ssi?.deductibles
    ? Decimal.max(new Decimal(0), base.minus(cotisationsSociales))
    : base;
  const ir = computeIR(autresRevenus.plus(baseIR), associe.maritalStatus, associe.childrenCount).minus(
    computeIR(autresRevenus, associe.maritalStatus, associe.childrenCount),
  );

  return { ir, ps, cotisationsSociales, total: ir.plus(ps).plus(cotisationsSociales) };
}
