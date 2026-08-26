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

describe('SimulationRequestSchema — LMP saisonnier', () => {
  const saisonnierPayload = (over: Record<string, unknown> = {}) => ({
    userProfile: { maritalStatus: 'SINGLE', childrenCount: 0 },
    structures: [
      {
        name: 'LMP Provence',
        type: 'LMP',
        associes: [],
        assets: [
          {
            label: 'Mas',
            purchasePrice: '400000.00',
            notaryFees: '32000.00',
            renovationCosts: '0.00',
            acquisitionDate: '2026-01-01T00:00:00.000Z',
            chargesYearly: '3000.00',
            propertyTax: '1500.00',
            saisonnier: {
              hauteSaison: { tauxOccupation: 0.9, caPeriode: '18000.00' },
              moyenneSaison: { tauxOccupation: 0.6, caPeriode: '9000.00' },
              basseSaison: { tauxOccupation: 0.3, caPeriode: '3000.00' },
              ...(over.saisonnier as object),
            },
          },
        ],
      },
    ],
  });

  it('should accept the LMP structure type', () => {
    expect(SimulationRequestSchema.safeParse(saisonnierPayload()).success).toBe(true);
  });

  it('should default annualRent to 0.00 when saisonnier params are provided instead', () => {
    const result = SimulationRequestSchema.parse(saisonnierPayload());
    expect(result.structures[0].assets[0].annualRent).toBe('0.00');
  });

  it('should default gestion to SOI_MEME and fill the fee defaults', () => {
    const result = SimulationRequestSchema.parse(saisonnierPayload());
    const s = result.structures[0].assets[0].saisonnier!;
    expect(s.gestion).toBe('SOI_MEME');
    expect(s.commissionPlateforme).toBe(0.15);
    expect(s.fraisConciergeriePercent).toBe(0.25);
  });

  it('should default the LMP social contribution rate', () => {
    const result = SimulationRequestSchema.parse(saisonnierPayload());
    expect(result.structures[0].tauxCotisationsSocialesLMP).toBe(0.35);
  });

  it('should reject an out-of-range occupation rate', () => {
    const result = SimulationRequestSchema.safeParse(
      saisonnierPayload({ saisonnier: { hauteSaison: { tauxOccupation: 1.2, caPeriode: '18000.00' } } }),
    );
    expect(result.success).toBe(false);
  });
});
