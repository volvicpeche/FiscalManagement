import { describe, it, expect } from 'vitest';
import { SimulationRequestSchema } from '@shared/schemas.js';

/** Minimal valid payload; `associes` is filled in per test. */
function payload(associes: unknown[], name = 'SCI Familiale') {
  return {
    userProfile: { maritalStatus: 'MARRIED', childrenCount: 2 },
    structures: [
      {
        name,
        type: 'SCI_IR',
        taxRegime: 'IR',
        associes,
        assets: [],
      },
    ],
  };
}

const associe = (over: Record<string, unknown> = {}) => ({
  nom: 'Florian',
  partsPercent: 1,
  ...over,
});

describe('SimulationRequestSchema — associes', () => {
  it('should accept a structure with no associe declared', () => {
    expect(SimulationRequestSchema.safeParse(payload([])).success).toBe(true);
  });

  it('should accept parts totalling 100%', () => {
    const result = SimulationRequestSchema.safeParse(
      payload([
        associe({ nom: 'A', partsPercent: 0.6 }),
        associe({ nom: 'B', partsPercent: 0.4 }),
      ]),
    );
    expect(result.success).toBe(true);
  });

  it('should reject parts that do not total 100%', () => {
    const result = SimulationRequestSchema.safeParse(
      payload([
        associe({ nom: 'A', partsPercent: 0.6 }),
        associe({ nom: 'B', partsPercent: 0.3 }),
      ]),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain('100 %');
    expect(result.error?.issues[0].message).toContain('SCI Familiale');
  });

  it('should tolerate floating point drift on thirds', () => {
    const third = 1 / 3;
    const result = SimulationRequestSchema.safeParse(
      payload([
        associe({ nom: 'A', partsPercent: third }),
        associe({ nom: 'B', partsPercent: third }),
        associe({ nom: 'C', partsPercent: third }),
      ]),
    );
    expect(result.success).toBe(true);
  });

  it('should reject duplicate associe names', () => {
    const result = SimulationRequestSchema.safeParse(
      payload([
        associe({ nom: 'Florian', partsPercent: 0.5 }),
        associe({ nom: 'Florian', partsPercent: 0.5 }),
      ]),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message.includes('meme nom'))).toBe(true);
  });

  it('should reject more than one SELF associe', () => {
    const result = SimulationRequestSchema.safeParse(
      payload([
        associe({ nom: 'A', partsPercent: 0.5, relation: 'SELF' }),
        associe({ nom: 'B', partsPercent: 0.5, relation: 'SELF' }),
      ]),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message.includes('SELF'))).toBe(true);
  });

  it('should validate associes nested in a subsidiary', () => {
    const result = SimulationRequestSchema.safeParse({
      userProfile: { maritalStatus: 'SINGLE', childrenCount: 0 },
      structures: [
        {
          name: 'Holding',
          type: 'HOLDING',
          assets: [],
          subsidiaries: [
            {
              name: 'SCI Fille',
              type: 'SCI_IS',
              assets: [],
              associes: [associe({ nom: 'A', partsPercent: 0.8 })],
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain('SCI Fille');
  });

  it('should apply defaults to an associe declared with the bare minimum', () => {
    const result = SimulationRequestSchema.parse(payload([associe()]));
    const a = result.structures[0].associes[0];

    expect(a.relation).toBe('OTHER');
    expect(a.maritalStatus).toBe('SINGLE');
    expect(a.autresRevenus).toBe('0.00');
    expect(a.apportCompteCourant).toBe('0.00');
    expect(a.tauxInteretCCA).toBe(0);
  });

  it('should default the cost block to the online mode with no overrides', () => {
    const result = SimulationRequestSchema.parse(payload([]));
    expect(result.structures[0].costs).toEqual({ mode: 'EN_LIGNE', constitution: [], annuel: [] });
  });

  it('should default the new succession parameters', () => {
    const result = SimulationRequestSchema.parse(payload([]));
    expect(result.params.illiquidityDiscount).toBe(0.1);
    expect(result.params.demembrement).toBe(false);
    expect(result.params.ccaRepaymentRate).toBe(0);
  });
});
