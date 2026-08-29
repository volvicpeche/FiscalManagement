import { describe, it, expect } from 'vitest';
import type { SimulationRequest } from '@shared/schemas.js';
import { runSimulation } from '../engine/simulator.js';
import {
  COLUMNS,
  FLUX_AGGREGATE,
  collapsedColumn,
  columnValue,
  explainCell,
  toRows,
  visibleColumns,
  type Flux,
  type Row,
} from '../../../client/src/features/dashboard/projectionColumns.js';

/**
 * The projection table's column model lives in the client, which has no test
 * runner of its own. It is pure data and pure functions, so it is exercised
 * here against real engine output rather than left unchecked.
 */

const request: SimulationRequest = {
  userProfile: { maritalStatus: 'MARRIED', childrenCount: 2, socialChargeRegime: 'SWISS_EXEMPT' },
  structures: [
    {
      name: 'SCI',
      type: 'SCI_IS',
      taxRegime: 'IS',
      ownershipShare: 1,
      tauxCotisationsSocialesLMP: 0.35,
      associes: [
        {
          nom: 'Moi', partsPercent: 1, relation: 'SELF', maritalStatus: 'MARRIED',
          childrenCount: 2, autresRevenus: '90000.00', socialChargeRegime: 'SWISS_EXEMPT',
          apportCapital: '1000.00', apportCompteCourant: '40000.00', tauxInteretCCA: 0,
        },
      ],
      costs: { mode: 'EN_LIGNE', constitution: [], annuel: [] },
      assets: [
        {
          type: 'REAL_ESTATE', label: 'B', purchasePrice: '200000.00', notaryFees: '16000.00',
          renovationCosts: '30000.00', acquisitionDate: '2026-01-01T00:00:00.000Z',
          annualRent: '30000.00', chargesYearly: '2400.00', propertyTax: '1200.00',
          loan: {
            principal: '180000.00', interestRate: 0.035, insuranceRate: 0.0035,
            durationMonths: 240, startDate: '2026-01-01T00:00:00.000Z', type: 'AMORTISSABLE',
          },
        },
      ],
      subsidiaries: [],
    },
  ],
  params: {
    horizonYears: 30, inflationRate: 0.02, propertyGrowth: 0.015, rentGrowthRate: 0.02,
    chargesGrowthRate: 0.02, propertyTaxGrowthRate: 0.02, dividendDistributionRate: 0.2,
    ccaRepaymentRate: 0.3, illiquidityDiscount: 0.1, demembrement: false,
    objectif: 'TRANSMISSION',
  },
} as unknown as SimulationRequest;

const rows: Row[] = toRows(runSimulation(request));
const cols = visibleColumns(rows);
const an12 = rows.find((r) => r.year === 12)!;
const membres = (flux: Flux) => cols.filter((c) => c.flux === flux);

describe('collapsedColumn — SORTIES', () => {
  it('should show the sum, every column being money leaving', () => {
    const col = collapsedColumn('SORTIES', membres('SORTIES'));
    const somme = membres('SORTIES').reduce((t, c) => t + columnValue(c, an12), 0);
    expect(columnValue(col, an12)).toBeCloseTo(somme, 2);
  });

  it('should stay summable in the totals row', () => {
    expect(FLUX_AGGREGATE.SORTIES.cumulable).toBe(true);
    expect(FLUX_AGGREGATE.SORTIES.somme).toBe(true);
  });
});

describe('collapsedColumn — the bands a sum would break', () => {
  it('should show the taxable result, not it plus its own depreciation', () => {
    // Amortissement is already deducted inside Resultat imposable.
    const col = collapsedColumn('FISCAL', membres('FISCAL'));
    expect(columnValue(col, an12)).toBe(an12.resultatImposable);
    expect(columnValue(col, an12)).not.toBeCloseTo(
      an12.resultatImposable + an12.amortissement,
      2,
    );
  });

  it('should show the cash flow, not it plus its own restatement', () => {
    // Effort reel is Cash-flow net read differently; transfers are not income.
    const col = collapsedColumn('SOLDE', membres('SOLDE'));
    expect(columnValue(col, an12)).toBe(an12.cashFlow);
  });

  it('should show the net position, not the sum of its own components', () => {
    const col = collapsedColumn('BILAN', membres('BILAN'));
    expect(columnValue(col, an12)).toBe(an12.situationNette);
    expect(columnValue(col, an12)).toBeLessThan(
      an12.valeurBien + an12.tresorerie + an12.detteRestante + an12.ccaSolde,
    );
  });

  it('should not present a balance as cumulable', () => {
    expect(FLUX_AGGREGATE.BILAN.cumulable).toBe(false);
  });
});

describe('collapsedColumn — the detail survives folding', () => {
  it('should carry every non-zero member into the tooltip', () => {
    const membresSorties = membres('SORTIES');
    const col = collapsedColumn('SORTIES', membresSorties);
    const lignes = col.decompose!(an12);

    expect(lignes.length).toBeGreaterThan(0);
    expect(lignes.length).toBeLessThanOrEqual(membresSorties.length);
    for (const l of lignes) {
      expect(membresSorties.some((c) => c.label === l.label)).toBe(true);
    }
  });

  it('should report the folded figure as the tooltip total, not the raw field', () => {
    // A regression guard: explainCell used to read row[col.key], which for a
    // summed band is one of the members rather than the total.
    const col = collapsedColumn('SORTIES', membres('SORTIES'));
    expect(explainCell(col, an12).total).toBeCloseTo(columnValue(col, an12), 2);
    expect(explainCell(col, an12).total).not.toBe(an12.chargesBien);
  });
});

describe('columnValue', () => {
  it('should read a plain column straight off the row', () => {
    const col = COLUMNS.find((c) => c.key === 'loyers')!;
    expect(columnValue(col, an12)).toBe(an12.loyers);
  });

  it('should let a computed column override the field', () => {
    const col = collapsedColumn('SORTIES', membres('SORTIES'));
    expect(columnValue(col, an12)).not.toBe(an12[col.key]);
  });
});
