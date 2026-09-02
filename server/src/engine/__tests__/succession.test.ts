import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  computeSuccessionTax,
  computeSCIShareValue,
  getUsufruitSplit,
} from '../succession.js';

describe('computeSuccessionTax', () => {
  it('should return 0 for spouse', () => {
    const result = computeSuccessionTax(new Decimal('1000000'), 'SPOUSE');
    expect(result.tax.toNumber()).toBe(0);
  });

  it('should apply 100k abatement for child', () => {
    const result = computeSuccessionTax(new Decimal('100000'), 'CHILD');
    expect(result.tax.toNumber()).toBe(0);
  });

  it('should compute tax for child inheriting 300k', () => {
    const result = computeSuccessionTax(new Decimal('300000'), 'CHILD');
    // Taxable: 200000 after 100k abatement
    // 8072 * 5% + (12109-8072) * 10% + (15932-12109) * 15% + (200000-15932) * 20%
    expect(result.taxableBase.toNumber()).toBe(200000);
    expect(result.tax.toNumber()).toBeGreaterThan(38000);
    expect(result.tax.toNumber()).toBeLessThan(40000);
  });

  // Regression: the ligne directe table used to be applied to every heir, so a
  // brother was taxed as if he were a child. Only the abatements differed,
  // which made the estate look far cheaper to pass on to anyone but a child.
  it('should tax a grandchild on the ligne directe table', () => {
    const result = computeSuccessionTax(new Decimal('300000'), 'GRANDCHILD');
    expect(result.taxableBase.toNumber()).toBe(268135);
    expect(result.tax.toNumber()).toBeCloseTo(51821.35, 2);
  });

  it('should tax a sibling at 35% then 45%', () => {
    const result = computeSuccessionTax(new Decimal('300000'), 'SIBLING');
    expect(result.taxableBase.toNumber()).toBe(284068);
    // 24 430 a 35 %, puis le solde a 45 %.
    expect(result.tax.toNumber()).toBeCloseTo(125387.6, 2);
  });

  it('should tax a nephew at a flat 55%', () => {
    const result = computeSuccessionTax(new Decimal('300000'), 'NEPHEW_NIECE');
    expect(result.taxableBase.toNumber()).toBe(292033);
    expect(result.tax.toNumber()).toBeCloseTo(160618.15, 2);
  });

  it('should tax an unrelated heir at a flat 60%', () => {
    const result = computeSuccessionTax(new Decimal('300000'), 'OTHER');
    expect(result.taxableBase.toNumber()).toBe(298406);
    expect(result.tax.toNumber()).toBeCloseTo(179043.6, 2);
  });

  it('should cost a child far less than a sibling on the same estate', () => {
    const enfant = computeSuccessionTax(new Decimal('300000'), 'CHILD').tax;
    const frere = computeSuccessionTax(new Decimal('300000'), 'SIBLING').tax;
    expect(frere.toNumber()).toBeGreaterThan(enfant.mul(3).toNumber());
  });
});

describe('computeSCIShareValue', () => {
  it('should apply ownership share and illiquidity discount', () => {
    const value = computeSCIShareValue(
      new Decimal('1000000'),
      new Decimal('0.95'),
      new Decimal('0.10'),
    );
    // 1000000 * 0.95 * 0.90 = 855000
    expect(value.toNumber()).toBe(855000);
  });
});

describe('getUsufruitSplit', () => {
  it('should return 60/40 for age 45', () => {
    const split = getUsufruitSplit(45);
    expect(split.usufruit.toNumber()).toBe(0.6);
    expect(split.nuePropriete.toNumber()).toBe(0.4);
  });

  it('should return 40/60 for age 65', () => {
    const split = getUsufruitSplit(65);
    expect(split.usufruit.toNumber()).toBe(0.4);
    expect(split.nuePropriete.toNumber()).toBe(0.6);
  });
});
