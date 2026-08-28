import Decimal from 'decimal.js';
import type { AssetInput, AssocieInput } from '@shared/schemas.js';

/**
 * How the acquisition is actually paid for.
 *
 * The simulation used to let the property simply exist: the asset appeared at
 * its purchase price with a loan against it, and the difference — the apport —
 * was never taken from anyone. That silently inflated the family's net wealth
 * by the whole down payment.
 *
 * Two figures matter, and they are not the same thing:
 *
 *   apportRequis   what the operation genuinely needs, from the purchase price,
 *                  the fees, the works and the incorporation costs, minus the
 *                  loan. This is what leaves the family's pocket.
 *   apportDeclare  what the associes said they were putting in, as share
 *                  capital and comptes courants.
 *
 * When the two disagree the model still needs the money to come from somewhere,
 * so the required amount is what gets debited. The gap is reported rather than
 * hidden: it means the declaration is incomplete, not that money appeared.
 */

export interface FinancementResult {
  coutAcquisition: Decimal;
  emprunt: Decimal;
  apportRequis: Decimal;
  apportDeclare: Decimal;
  /** Positive when the associes declared less than the operation needs. */
  ecart: Decimal;
}

export function computeApportRequis(
  assets: AssetInput[],
  fraisConstitution: Decimal,
): { coutAcquisition: Decimal; emprunt: Decimal; apportRequis: Decimal } {
  let coutAcquisition = new Decimal(0);
  let emprunt = new Decimal(0);

  for (const asset of assets) {
    coutAcquisition = coutAcquisition
      .plus(asset.purchasePrice)
      .plus(asset.notaryFees)
      .plus(asset.renovationCosts);
    if (asset.loan) emprunt = emprunt.plus(asset.loan.principal);
  }

  const apportRequis = Decimal.max(
    new Decimal(0),
    coutAcquisition.plus(fraisConstitution).minus(emprunt),
  );

  return { coutAcquisition, emprunt, apportRequis };
}

export function computeApportDeclare(associes: AssocieInput[]): Decimal {
  return associes.reduce(
    (acc, a) => acc.plus(a.apportCapital).plus(a.apportCompteCourant),
    new Decimal(0),
  );
}

export function computeFinancement(
  assets: AssetInput[],
  associes: AssocieInput[],
  fraisConstitution: Decimal,
): FinancementResult {
  const { coutAcquisition, emprunt, apportRequis } = computeApportRequis(assets, fraisConstitution);
  const apportDeclare = computeApportDeclare(associes);

  return {
    coutAcquisition,
    emprunt,
    apportRequis,
    apportDeclare,
    ecart: apportRequis.minus(apportDeclare),
  };
}
