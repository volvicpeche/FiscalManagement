import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { computeIRR, netPresentValue } from '../irr.js';

const d = (values: (string | number)[]) => values.map((v) => new Decimal(v));

describe('netPresentValue', () => {
  it('should leave a single present flow untouched', () => {
    expect(netPresentValue(d([1000]), new Decimal('0.1')).toNumber()).toBe(1000);
  });

  it('should discount a future flow', () => {
    // 110 in a year at 10 % is worth 100 today.
    expect(netPresentValue(d([0, 110]), new Decimal('0.1')).toNumber()).toBeCloseTo(100, 6);
  });

  it('should be zero at the IRR by construction', () => {
    const flows = d([-1000, 400, 400, 400]);
    const irr = computeIRR(flows)!;
    expect(netPresentValue(flows, irr).abs().toNumber()).toBeLessThan(0.01);
  });
});

describe('computeIRR', () => {
  it('should return the exact rate on a one-year doubling', () => {
    // -100 today, 110 in a year -> 10 %
    expect(computeIRR(d([-100, 110]))!.toNumber()).toBeCloseTo(0.1, 6);
  });

  it('should match a known textbook series', () => {
    // -1000 then 500, 400, 300, 100. Reference value cross-checked against an
    // independent bisection: 0.14488844.
    expect(computeIRR(d([-1000, 500, 400, 300, 100]))!.toNumber()).toBeCloseTo(0.1448884, 6);
  });

  it('should return zero when the money simply comes back', () => {
    expect(computeIRR(d([-1000, 500, 500]))!.toNumber()).toBeCloseTo(0, 5);
  });

  it('should return a negative rate on a loss-making series', () => {
    const irr = computeIRR(d([-1000, 300, 300, 300]))!;
    expect(irr.lt(0)).toBe(true);
    expect(irr.toNumber()).toBeCloseTo(-0.0508854, 6);
  });

  it('should handle the shape of a rental operation: years of effort, then a sale', () => {
    // 60 000 of apport, 20 years of -3 000, then 300 000 on exit.
    const flows = [new Decimal('-60000'), ...Array(19).fill(new Decimal('-3000')), new Decimal('300000')];
    const irr = computeIRR(flows)!;
    expect(irr.gt(0)).toBe(true);
    expect(netPresentValue(flows, irr).abs().toNumber()).toBeLessThan(0.01);
  });

  it('should return null when money only ever goes out', () => {
    expect(computeIRR(d([-1000, -200, -200]))).toBeNull();
  });

  it('should return null when money only ever comes in', () => {
    expect(computeIRR(d([1000, 200, 200]))).toBeNull();
  });

  it('should return null on a series too short to have a rate', () => {
    expect(computeIRR(d([-1000]))).toBeNull();
    expect(computeIRR([])).toBeNull();
  });

  it('should not be fooled into reporting 0 for a hopeless series', () => {
    // Zero would read as "breaks even" — null says "no meaningful rate".
    expect(computeIRR(d([-100000, -1000, -1000]))).toBeNull();
  });

  it('should stay stable on a long flat series', () => {
    const flows = [new Decimal('-100000'), ...Array(30).fill(new Decimal('6000'))];
    const irr = computeIRR(flows)!;
    // 100 000 out, 6 000 a year for 30 years -> 4,31 %/an.
    expect(irr.toNumber()).toBeCloseTo(0.0430631, 6);
  });
});
