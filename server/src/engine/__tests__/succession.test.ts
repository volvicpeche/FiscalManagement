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
