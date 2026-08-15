import { describe, it, expect } from 'vitest';
import { computeAssetYields } from '@shared/yield.js';

const asset = (over: Partial<Parameters<typeof computeAssetYields>[0]> = {}) => ({
  purchasePrice: '200000.00',
  notaryFees: '16000.00',
  renovationCosts: '30000.00',
  annualRent: '12000.00',
  chargesYearly: '2400.00',
  propertyTax: '1200.00',
  ...over,
});

const pct = (d: { toNumber(): number }) => d.toNumber() * 100;

describe('computeAssetYields', () => {
  it('should compute the gross yield on the purchase price', () => {
    // 12 000 / 200 000
    expect(pct(computeAssetYields(asset()).brute)).toBeCloseTo(6, 6);
  });

  it('should compute the gross yield on the full acquisition cost', () => {
    // 12 000 / 246 000 — notary fees and renovation are real money spent
    expect(pct(computeAssetYields(asset()).bruteCoutTotal)).toBeCloseTo(4.878, 3);
  });

  it('should compute the net yield after owner charges', () => {
    // (12 000 − 2 400 − 1 200) / 246 000
    expect(pct(computeAssetYields(asset()).nette)).toBeCloseTo(3.415, 3);
  });

  it('should always rank gross >= gross-on-cost >= net', () => {
    const y = computeAssetYields(asset());
    expect(y.brute.gte(y.bruteCoutTotal)).toBe(true);
    expect(y.bruteCoutTotal.gte(y.nette)).toBe(true);
  });

  it('should total the acquisition cost and the owner charges', () => {
    const y = computeAssetYields(asset());
    expect(y.coutTotal.toNumber()).toBe(246000);
    expect(y.chargesTotales.toNumber()).toBe(3600);
    expect(y.loyerNet.toNumber()).toBe(8400);
  });

  it('should collapse gross and gross-on-cost when there are no acquisition fees', () => {
    const y = computeAssetYields(asset({ notaryFees: '0.00', renovationCosts: '0.00' }));
    expect(y.brute.toNumber()).toBe(y.bruteCoutTotal.toNumber());
  });

  it('should return a negative net yield when charges exceed the rent', () => {
    const y = computeAssetYields(asset({ annualRent: '2000.00' }));
    expect(y.nette.lt(0)).toBe(true);
    expect(y.loyerNet.toNumber()).toBe(-1600);
  });

  it('should not divide by zero on a price-less asset', () => {
    const y = computeAssetYields(
      asset({ purchasePrice: '0.00', notaryFees: '0.00', renovationCosts: '0.00' }),
    );
    expect(y.brute.toNumber()).toBe(0);
    expect(y.bruteCoutTotal.toNumber()).toBe(0);
    expect(y.nette.toNumber()).toBe(0);
  });

  it('should stay exact on values that break binary floats', () => {
    // 0.1 + 0.2 territory: decimal.js must not drift.
    const y = computeAssetYields(
      asset({ purchasePrice: '100000.00', notaryFees: '0.10', renovationCosts: '0.20' }),
    );
    expect(y.coutTotal.toFixed(2)).toBe('100000.30');
  });
});
