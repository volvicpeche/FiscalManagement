import Decimal from 'decimal.js';
import { TARIF_SOURCE } from './tarifs/tarifSourceGe2026.js';

/**
 * Rate of the Geneva source-tax tariff for a monthly salary.
 *
 * The AFC file is a monthly table in CHF 50 steps; `TARIF_SOURCE` keeps only
 * the points where the rate changes, so the applicable row is the last one
 * starting at or below the salary.
 */
export function tauxImpotSource(code: string, salaireMensuel: Decimal): Decimal {
  const rows = TARIF_SOURCE[code];
  if (!rows) throw new Error(`Bareme d'impot a la source inconnu : ${code}`);

  const centimes = salaireMensuel.mul(100).floor().toNumber();
  let lo = 0;
  let hi = rows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (rows[mid][0] <= centimes) lo = mid;
    else hi = mid - 1;
  }
  return new Decimal(rows[lo][1]).div(10000);
}

/**
 * Source tax on a year of salary, applying the monthly tariff to the average
 * month. Exact when the salary is paid in twelve equal months; a 13th salary
 * or a bonus paid in one month is taxed at a higher rate that month, which
 * the annual check-up by the AFC-GE does not correct either.
 */
export function impotSourceAnnuel(code: string, salaireAnnuel: Decimal): { taux: Decimal; impot: Decimal } {
  const taux = tauxImpotSource(code, salaireAnnuel.div(12));
  return { taux, impot: salaireAnnuel.mul(taux).toDecimalPlaces(2) };
}

export function codeTarifConnu(code: string): boolean {
  return code in TARIF_SOURCE;
}
