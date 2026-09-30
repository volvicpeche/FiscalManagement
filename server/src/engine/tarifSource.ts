import Decimal from 'decimal.js';
import { TARIF_SOURCE as TARIF_SOURCE_GE } from './tarifs/tarifSourceGe2026.js';

/**
 * A cantonal source-tax tariff, per code: the points where the rate changes,
 * [monthly salary from, in centimes ; rate in basis points]. Each canton has
 * its own AFC file (tar26ge.txt, tar26zh.txt...), turned into this shape by
 * server/scripts/generate-tarif-source.mjs.
 */
export type TableTarifSource = Record<string, [number, number][]>;

export { TARIF_SOURCE_GE };

/**
 * Rate of a cantonal source-tax tariff for a monthly salary, Geneva's by
 * default.
 *
 * The AFC file is a monthly table in CHF 50 steps; the table keeps only
 * the points where the rate changes, so the applicable row is the last one
 * starting at or below the salary.
 */
export function tauxImpotSource(
  code: string,
  salaireMensuel: Decimal,
  table: TableTarifSource = TARIF_SOURCE_GE,
): Decimal {
  const rows = table[code];
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
 * the annual check-up by the cantonal administration does not correct either.
 */
export function impotSourceAnnuel(
  code: string,
  salaireAnnuel: Decimal,
  table: TableTarifSource = TARIF_SOURCE_GE,
): { taux: Decimal; impot: Decimal } {
  const taux = tauxImpotSource(code, salaireAnnuel.div(12), table);
  return { taux, impot: salaireAnnuel.mul(taux).toDecimalPlaces(2) };
}

export function codeTarifConnu(code: string, table: TableTarifSource = TARIF_SOURCE_GE): boolean {
  return code in table;
}
