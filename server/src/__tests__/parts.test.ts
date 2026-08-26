import { describe, it, expect } from 'vitest';
import { distributeParts, redistributeParts } from '@shared/parts.js';

const pct = (parts: number[]) => parts.map((p) => Math.round(p * 100));

describe('distributeParts', () => {
  it('should give everything to a sole associe', () => {
    expect(distributeParts(1)).toEqual([1]);
  });

  it('should split two associes 51/49 rather than 50/50', () => {
    expect(pct(distributeParts(2))).toEqual([51, 49]);
  });

  it('should split three associes 34/33/33', () => {
    expect(pct(distributeParts(3))).toEqual([34, 33, 33]);
  });

  it('should break the tie on an evenly divisible count', () => {
    expect(pct(distributeParts(4))).toEqual([26, 25, 25, 24]);
    expect(pct(distributeParts(5))).toEqual([21, 20, 20, 20, 19]);
  });

  it('should hand the indivisible remainder to the majority holder', () => {
    expect(pct(distributeParts(6))).toEqual([20, 16, 16, 16, 16, 16]);
    expect(pct(distributeParts(7))).toEqual([16, 14, 14, 14, 14, 14, 14]);
  });

  it('should always total exactly 100%', () => {
    for (let n = 1; n <= 20; n++) {
      const total = distributeParts(n).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 9);
    }
  });

  it('should always leave exactly one strictly largest share', () => {
    for (let n = 2; n <= 20; n++) {
      const parts = distributeParts(n);
      const max = Math.max(...parts);
      expect(parts.filter((p) => p === max)).toHaveLength(1);
    }
  });

  it('should place the majority on the designated associe', () => {
    expect(pct(distributeParts(3, 2))).toEqual([33, 33, 34]);
    expect(pct(distributeParts(4, 1))).toEqual([25, 26, 25, 24]);
  });

  it('should still find a donor when the majority holder is last', () => {
    const parts = distributeParts(2, 1);
    expect(pct(parts)).toEqual([49, 51]);
  });

  it('should clamp an out-of-range majority index', () => {
    expect(pct(distributeParts(3, 99))).toEqual([33, 33, 34]);
    expect(pct(distributeParts(3, -5))).toEqual([34, 33, 33]);
  });

  it('should return nothing for an empty list', () => {
    expect(distributeParts(0)).toEqual([]);
  });
});

describe('redistributeParts', () => {
  it('should rewrite the parts and leave every other field alone', () => {
    const associes = [
      { nom: 'A', partsPercent: 0.9, autresRevenus: '90000.00' },
      { nom: 'B', partsPercent: 0.1, autresRevenus: '30000.00' },
    ];
    const result = redistributeParts(associes);

    expect(pct(result.map((a) => a.partsPercent))).toEqual([51, 49]);
    expect(result[0].autresRevenus).toBe('90000.00');
    expect(result[1].nom).toBe('B');
  });
});
