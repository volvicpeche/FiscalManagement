import { describe, it, expect } from 'vitest';
import { projeterEpargne } from '@shared/outils/interetsComposes.js';

describe('projeterEpargne', () => {
  it('should compound a lump sum yearly: 10 000 at 5 % over 10 years', () => {
    const r = projeterEpargne({ capitalInitial: 10000, tauxAnnuel: 0.05, annees: 10, capitalisation: 'ANNUELLE' });
    expect(r.capitalFinal.toFixed(2)).toBe('16288.95');
    expect(r.interets.toFixed(2)).toBe('6288.95');
    expect(r.lignes).toHaveLength(10);
  });

  it('should compound monthly at rate/12', () => {
    const r = projeterEpargne({ capitalInitial: 10000, tauxAnnuel: 0.06, annees: 1, capitalisation: 'MENSUELLE' });
    expect(r.capitalFinal.toFixed(2)).toBe('10616.78');
  });

  it('should add deposits and count them as paid in, not earned', () => {
    const r = projeterEpargne({ capitalInitial: 0, versementMensuel: 100, tauxAnnuel: 0, annees: 2, capitalisation: 'MENSUELLE' });
    expect(r.capitalFinal.toFixed(2)).toBe('2400.00');
    expect(r.interets.isZero()).toBe(true);
    expect(r.anneesDoublement).toBeNull();
  });

  it('should credit a deposit pro rata of the months it stayed, at yearly capitalisation', () => {
    // 100 a month at 12 %: (11 + 10 + ... + 0) / 12 × 12 % × 100 = 66
    const r = projeterEpargne({ capitalInitial: 0, versementMensuel: 100, tauxAnnuel: 0.12, annees: 1, capitalisation: 'ANNUELLE' });
    expect(r.interets.toFixed(2)).toBe('66.00');
  });

  it('should express the final amount in today’s euros and give the doubling time', () => {
    const r = projeterEpargne({ capitalInitial: 1000, tauxAnnuel: 0.07, annees: 10, capitalisation: 'ANNUELLE', inflation: 0.02 });
    expect(r.capitalFinalReel.toFixed(2)).toBe(r.capitalFinal.div(1.02 ** 10).toFixed(2));
    expect(r.anneesDoublement!.toFixed(1)).toBe('10.2');
  });
});
