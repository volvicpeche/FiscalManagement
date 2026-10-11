import type { AssocieInput } from '@shared/schemas.js';

/** Sum of the parts, as a fraction. */
export function partsTotal(associes: AssocieInput[]): number {
  return associes.reduce((sum, a) => sum + a.partsPercent, 0);
}

/** Parts must total exactly 100 %: the engine refuses anything else. */
export function partsAreValid(associes: AssocieInput[]): boolean {
  if (associes.length === 0) return true;
  return Math.abs(partsTotal(associes) - 1) < 1e-6;
}
