import Decimal from 'decimal.js';
import { MICRO_FONCIER_ABATTEMENT, MICRO_FONCIER_SEUIL } from './baremes.js';

/**
 * Micro-foncier: a flat 30 % allowance on gross rents stands for every charge,
 * interest included. No deficit is possible. Judged on the year's own gross
 * rents, per foyer fiscal: an owner in indivision counts their share.
 */
export interface MicroFoncierResult {
  /** False above the ceiling: the reel applies that year. */
  eligible: boolean;
  abattement: Decimal;
  revenuNet: Decimal;
}

export function computeMicroFoncier(recettesBrutes: Decimal): MicroFoncierResult {
  const brutes = Decimal.max(recettesBrutes, 0);
  const abattement = brutes.mul(MICRO_FONCIER_ABATTEMENT);
  return {
    eligible: brutes.lte(MICRO_FONCIER_SEUIL),
    abattement,
    revenuNet: brutes.minus(abattement),
  };
}
