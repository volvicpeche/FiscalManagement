import Decimal from 'decimal.js';
import type { AssetInput } from './schemas.js';

/**
 * Rental yields of a property.
 *
 * Three figures, because the headline one is the least useful:
 *
 *   brute            loyer / prix d'achat            — the agency's number
 *   bruteCoutTotal   loyer / cout d'acquisition      — what you actually paid
 *   nette            loyer net de charges / cout     — what the walls really return
 *
 * All three are BEFORE financing and BEFORE tax: they measure the property, not
 * the deal. What is left after IS or IR depends on the montage and is reported
 * per scenario in the simulation results.
 */

export interface AssetYields {
  /** Purchase price + notary fees + renovation. */
  coutTotal: Decimal;
  loyerAnnuel: Decimal;
  /** Recurring charges borne by the owner: charges + taxe fonciere. */
  chargesTotales: Decimal;
  loyerNet: Decimal;
  /** Fractions of 1 — multiply by 100 to display. */
  brute: Decimal;
  bruteCoutTotal: Decimal;
  nette: Decimal;
}

const ZERO = new Decimal(0);

function ratio(numerator: Decimal, denominator: Decimal): Decimal {
  if (denominator.lte(0)) return ZERO;
  return numerator.div(denominator);
}

export function computeAssetYields(
  asset: Pick<
    AssetInput,
    'purchasePrice' | 'notaryFees' | 'renovationCosts' | 'annualRent' | 'chargesYearly' | 'propertyTax'
  >,
): AssetYields {
  const purchasePrice = new Decimal(asset.purchasePrice);
  const coutTotal = purchasePrice
    .plus(asset.notaryFees)
    .plus(asset.renovationCosts);

  const loyerAnnuel = new Decimal(asset.annualRent);
  const chargesTotales = new Decimal(asset.chargesYearly).plus(asset.propertyTax);
  const loyerNet = loyerAnnuel.minus(chargesTotales);

  return {
    coutTotal,
    loyerAnnuel,
    chargesTotales,
    loyerNet,
    brute: ratio(loyerAnnuel, purchasePrice),
    bruteCoutTotal: ratio(loyerAnnuel, coutTotal),
    nette: ratio(loyerNet, coutTotal),
  };
}
