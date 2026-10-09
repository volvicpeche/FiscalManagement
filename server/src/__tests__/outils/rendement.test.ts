import { describe, it, expect } from 'vitest';
import { rendementRapide } from '@shared/outils/rendement.js';

describe('rendementRapide', () => {
  const base = { prix: 150000, typeBien: 'ANCIEN' as const, loyerMensuel: 750, chargesAnnuelles: 900, taxeFonciere: 1100 };

  it('should give the agency yield on the price and the net one on the total cost', () => {
    const r = rendementRapide(base);
    expect(r.brute.toFixed(3)).toBe('0.060');
    expect(r.coutTotal.toFixed(2)).toBe('161250.00');
    // (9 000 − 2 000) / 161 250
    expect(r.nette.toFixed(4)).toBe('0.0434');
    expect(r.cashFlowMensuel.toFixed(2)).toBe(r.loyerNetMensuel.toFixed(2));
  });

  it('should cut the collected rent by the vacancy', () => {
    expect(rendementRapide({ ...base, vacanceMois: 1 }).loyerAnnuelEncaisse.toFixed(2)).toBe('8250.00');
  });

  it('should take the loan payment out of the monthly cash flow', () => {
    const r = rendementRapide({ ...base, credit: { apport: 11250, taux: 0.035, annees: 25 } });
    expect(r.capital.toFixed(2)).toBe('150000.00');
    expect(r.mensualiteCredit.toFixed(2)).toBe('750.94');
    expect(r.cashFlowMensuel.lt(0)).toBe(true);
  });
});
