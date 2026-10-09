import { describe, it, expect } from 'vitest';
import { capaciteEmprunt, comparerDurees, mensualite, simulerCredit } from '@shared/outils/credit.js';

describe('mensualite', () => {
  it('should match the textbook payment: 200 000 at 3.5 % over 25 years', () => {
    expect(mensualite(200000, 0.035, 300).toFixed(2)).toBe('1001.25');
  });

  it('should split the capital evenly at a zero rate', () => {
    expect(mensualite(120000, 0, 240).toFixed(2)).toBe('500.00');
  });
});

describe('simulerCredit', () => {
  const base = { prix: 200000, typeBien: 'ANCIEN' as const, apport: 15000, taux: 0.035, annees: 25, tauxAssurance: 0.003 };

  it('should borrow price + notary fees − apport and cost interest + insurance', () => {
    const r = simulerCredit(base);
    expect(r.fraisNotaire.toFixed(2)).toBe('15000.00');
    expect(r.capital.toFixed(2)).toBe('200000.00');
    expect(r.mensualiteHorsAssurance.toFixed(2)).toBe('1001.25');
    expect(r.assuranceMensuelle.toFixed(2)).toBe('50.00');
    // 1 001.25 is the rounded payment: 300 exact payments come to ~100 374.5 of interest.
    expect(r.coutInterets.toNumber()).toBeCloseTo(100374.5, 0);
    expect(r.coutAssurance.toFixed(2)).toBe('15000.00');
  });

  it('should flag a debt ratio above 35 %', () => {
    const r = simulerCredit({ ...base, revenus: 2500, chargesCredits: 0 });
    expect(r.tauxEndettement!.toNumber()).toBeCloseTo(1051.25 / 2500, 4);
    expect(r.alertes.some((a) => a.includes('35 %'))).toBe(true);
  });

  it('should borrow nothing when the apport covers the project', () => {
    const r = simulerCredit({ ...base, apport: 300000 });
    expect(r.capital.isZero()).toBe(true);
    expect(r.coutTotal.isZero()).toBe(true);
  });

  it('should compare durations each at its own rate', () => {
    const [a, b] = comparerDurees(base, [{ annees: 15, taux: 0.03 }, { annees: 25, taux: 0.035 }]);
    expect(a.mensualiteTotale.gt(b.mensualiteTotale)).toBe(true);
    expect(a.coutTotal.lt(b.coutTotal)).toBe(true);
  });
});

describe('capaciteEmprunt', () => {
  it('should turn 35 % of income back into the capital it repays, insurance included', () => {
    const r = capaciteEmprunt({ revenus: 4000, taux: 0.035, tauxAssurance: 0.003, annees: 25, typeBien: 'ANCIEN', apport: 20000 });
    expect(r.mensualiteMax.toFixed(2)).toBe('1400.00');
    // The capital found pays exactly 1 400 a month, insurance included.
    const check = simulerCredit({ prix: r.capitalMax, typeBien: 'NEUF', tauxNotaire: 0, taux: 0.035, annees: 25, tauxAssurance: 0.003 });
    expect(check.mensualiteTotale.toFixed(2)).toBe('1400.00');
    expect(r.prixMax.mul(1.075).toFixed(0)).toBe(r.budget.toFixed(0));
    expect(r.resteAVivre.toFixed(2)).toBe('2600.00');
  });

  it('should leave nothing to borrow when running loans fill the ratio', () => {
    const r = capaciteEmprunt({ revenus: 3000, chargesCredits: 1200, taux: 0.035, annees: 20, typeBien: 'ANCIEN' });
    expect(r.capitalMax.isZero()).toBe(true);
    expect(r.alertes).toHaveLength(1);
  });
});
