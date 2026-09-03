import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  computeIS,
  computeIR,
  computeQuotientParts,
  computePFU,
  computeIFI,
  computeMereFilleQuotePart,
  getSocialChargeRate,
  computeYearlyDepreciation,
  applyISDeficit,
} from '../tax.js';

describe('computeIS', () => {
  it('should return 0 for negative profit', () => {
    expect(computeIS(new Decimal('-5000')).toNumber()).toBe(0);
  });

  it('should apply 15% rate for profit under 42,500', () => {
    const tax = computeIS(new Decimal('30000'));
    expect(tax.toNumber()).toBeCloseTo(4500, 2);
  });

  it('should apply 15% + 25% for profit above 42,500', () => {
    const tax = computeIS(new Decimal('100000'));
    // 42500 * 0.15 + 57500 * 0.25 = 6375 + 14375 = 20750
    expect(tax.toNumber()).toBeCloseTo(20750, 2);
  });
});

describe('computeQuotientParts', () => {
  it('single no children = 1 part', () => {
    expect(computeQuotientParts('SINGLE', 0).toNumber()).toBe(1);
  });

  it('married 2 children = 3 parts', () => {
    expect(computeQuotientParts('MARRIED', 2).toNumber()).toBe(3);
  });

  it('married 3 children = 4 parts', () => {
    expect(computeQuotientParts('MARRIED', 3).toNumber()).toBe(4);
  });
});

describe('computeIR', () => {
  it('should return 0 for income below first bracket', () => {
    const tax = computeIR(new Decimal('10000'), 'SINGLE', 0);
    expect(tax.toNumber()).toBe(0);
  });

  it('should compute tax for a single person at 50k', () => {
    const tax = computeIR(new Decimal('50000'), 'SINGLE', 0);
    // Bracket 1: 11294 * 0% = 0
    // Bracket 2: (28797-11294) * 11% = 1925.33
    // Bracket 3: (50000-28797) * 30% = 6360.90
    // Total ~ 8286.23
    expect(tax.toNumber()).toBeGreaterThan(8000);
    expect(tax.toNumber()).toBeLessThan(8500);
  });

  it('should reduce tax for married couple vs single (same income)', () => {
    const taxSingle = computeIR(new Decimal('80000'), 'SINGLE', 0);
    const taxMarried = computeIR(new Decimal('80000'), 'MARRIED', 0);
    expect(taxMarried.lt(taxSingle)).toBe(true);
  });
});

describe('computePFU', () => {
  it('should compute standard PFU at 31.4%', () => {
    const tax = computePFU(new Decimal('10000'), 'STANDARD');
    expect(tax.toNumber()).toBeCloseTo(3140, 2);
  });

  it('should compute Swiss-exempt PFU at 20.3%', () => {
    const tax = computePFU(new Decimal('10000'), 'SWISS_EXEMPT');
    expect(tax.toNumber()).toBeCloseTo(2030, 2);
  });
});

describe('getSocialChargeRate', () => {
  it('should return 17.2% for standard', () => {
    expect(getSocialChargeRate('STANDARD').toNumber()).toBe(0.172);
  });

  it('should return 7.5% for Swiss-exempt', () => {
    expect(getSocialChargeRate('SWISS_EXEMPT').toNumber()).toBe(0.075);
  });
});

describe('computeIFI', () => {
  it('should return 0 below 1.3M threshold', () => {
    expect(computeIFI(new Decimal('1200000')).toNumber()).toBe(0);
  });

  it('should compute IFI for 2M patrimony', () => {
    const tax = computeIFI(new Decimal('2000000'));
    // 0-800k: 0, 800k-1.3M: 2500, 1.3M-2M: 4900
    expect(tax.toNumber()).toBeGreaterThan(7000);
    expect(tax.toNumber()).toBeLessThan(8000);
  });
});

describe('computeMereFilleQuotePart', () => {
  it('should return 5% of dividend', () => {
    const qp = computeMereFilleQuotePart(new Decimal('100000'));
    expect(qp.toNumber()).toBe(5000);
  });
});

describe('computeYearlyDepreciation', () => {
  it('should compute building + renovation depreciation', () => {
    const dep = computeYearlyDepreciation({
      purchasePrice: new Decimal('200000'),
      notaryFees: new Decimal('16000'),
      renovationCosts: new Decimal('30000'),
      landRatio: new Decimal('0.15'),
    });
    // Building: (200000 + 16000) * 0.85 / 25 = 7344
    // Renovation: 30000 / 15 = 2000
    expect(dep.building.toNumber()).toBeCloseTo(7344, 0);
    expect(dep.renovation.toNumber()).toBeCloseTo(2000, 0);
    expect(dep.total.toNumber()).toBeCloseTo(9344, 0);
  });
});

describe('applyISDeficit', () => {
  it('should accumulate deficit when profit is negative', () => {
    const result = applyISDeficit(new Decimal('-10000'), new Decimal('5000'));
    expect(result.taxableAfterOffset.toNumber()).toBe(0);
    expect(result.remainingDeficit.toNumber()).toBe(15000);
  });

  it('should offset profit with carried deficit', () => {
    const result = applyISDeficit(new Decimal('50000'), new Decimal('30000'));
    expect(result.taxableAfterOffset.toNumber()).toBe(20000);
    expect(result.remainingDeficit.toNumber()).toBe(0);
  });

  it('should never impute more than the profit of the year', () => {
    // Regression: the imputation was capped at 1 M EUR but not at the profit,
    // so the taxable result went negative and the unused deficit was wiped
    // out. The SCI then paid IS on years it should have sheltered.
    const result = applyISDeficit(new Decimal('10000'), new Decimal('50000'));
    expect(result.taxableAfterOffset.toNumber()).toBe(0);
    expect(result.remainingDeficit.toNumber()).toBe(40000);
  });

  it('should carry the untouched remainder to the following year', () => {
    const first = applyISDeficit(new Decimal('10000'), new Decimal('50000'));
    const second = applyISDeficit(new Decimal('15000'), first.remainingDeficit);
    expect(second.taxableAfterOffset.toNumber()).toBe(0);
    expect(second.remainingDeficit.toNumber()).toBe(25000);
  });

  it('should still cap a very large deficit at 1M + 50% beyond', () => {
    // 3 M of profit: 1 M plus half of the 2 M above it = 2 M imputable.
    const result = applyISDeficit(new Decimal('3000000'), new Decimal('5000000'));
    expect(result.taxableAfterOffset.toNumber()).toBe(1000000);
    expect(result.remainingDeficit.toNumber()).toBe(3000000);
  });
});
