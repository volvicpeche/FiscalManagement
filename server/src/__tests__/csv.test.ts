import { describe, it, expect } from 'vitest';
import type { SimulationRequest } from '@shared/schemas.js';
import { runSimulation } from '../engine/simulator.js';
import { buildCsv, exportSimulationCsv, AVERTISSEMENTS } from '../../../client/src/lib/csv.js';

/**
 * The CSV builder is client-side and the client has no test runner, so it is
 * exercised here against real engine output.
 */

const request: SimulationRequest = {
  userProfile: { maritalStatus: 'MARRIED', childrenCount: 2, socialChargeRegime: 'SWISS_EXEMPT' },
  structures: [
    {
      name: 'SCI (IR)', type: 'SCI_IR', taxRegime: 'IR', ownershipShare: 1,
      tauxCotisationsSocialesLMP: 0.35,
      associes: [
        {
          nom: 'Moi; le "gerant"', partsPercent: 0.51, relation: 'SELF', maritalStatus: 'MARRIED',
          childrenCount: 2, autresRevenus: '90000.00', socialChargeRegime: 'SWISS_EXEMPT',
          apportCapital: '500.00', apportCompteCourant: '40000.00', tauxInteretCCA: 0,
        },
        {
          nom: 'Conjoint(e)', partsPercent: 0.49, relation: 'SPOUSE', maritalStatus: 'MARRIED',
          childrenCount: 2, autresRevenus: '35000.00', socialChargeRegime: 'STANDARD',
          apportCapital: '500.00', apportCompteCourant: '0.00', tauxInteretCCA: 0,
        },
      ],
      costs: { mode: 'EN_LIGNE', constitution: [], annuel: [] },
      assets: [
        {
          type: 'REAL_ESTATE', label: 'Bien', purchasePrice: '200000.00', notaryFees: '16000.00',
          renovationCosts: '30000.00', acquisitionDate: '2026-01-01T00:00:00.000Z',
          annualRent: '12000.00', chargesYearly: '2400.00', propertyTax: '1200.00',
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
    chargesGrowthRate: 0.02, propertyTaxGrowthRate: 0.02, dividendDistributionRate: 0,
    ccaRepaymentRate: 0.3, illiquidityDiscount: 0.1, demembrement: false,
    objectif: 'TRANSMISSION',
  },
} as unknown as SimulationRequest;

const csv = exportSimulationCsv(request, runSimulation(request), 'SCI a l IR');
const lignes = csv.split('\r\n');

/**
 * Splits a CSV row respecting quotes. Splitting on the separator alone counts
 * an escaped field as several — which is precisely what escaping exists to
 * prevent, so the check has to honour it.
 */
function champs(ligne: string): string[] {
  const out: string[] = [];
  let courant = '';
  let dansGuillemets = false;

  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      if (dansGuillemets && ligne[i + 1] === '"') { courant += '"'; i++; }
      else dansGuillemets = !dansGuillemets;
    } else if (c === ';' && !dansGuillemets) {
      out.push(courant);
      courant = '';
    } else {
      courant += c;
    }
  }
  out.push(courant);
  return out;
}

/** Index of a section's header row, found rather than assumed. */
function enteteDe(titre: string): number {
  const debut = lignes.indexOf('# ' + titre);
  let i = debut + 1;
  while (lignes[i] !== undefined && lignes[i].startsWith('#')) i++;
  return i;
}


describe('buildCsv — escaping', () => {
  it('should leave a plain field alone', () => {
    const out = buildCsv([], [{ titre: 'T', entetes: ['a'], lignes: [['simple']] }]);
    expect(out).toContain('simple');
    expect(out).not.toContain('"simple"');
  });

  it('should quote a field containing the separator', () => {
    const out = buildCsv([], [{ titre: 'T', entetes: ['a'], lignes: [['a;b']] }]);
    expect(out).toContain('"a;b"');
  });

  it('should double the quotes inside a quoted field', () => {
    const out = buildCsv([], [{ titre: 'T', entetes: ['a'], lignes: [['dit "bonjour"']] }]);
    expect(out).toContain('"dit ""bonjour"""');
  });

  it('should quote a field containing a newline', () => {
    const out = buildCsv([], [{ titre: 'T', entetes: ['a'], lignes: [['deux\nlignes']] }]);
    expect(out).toContain('"deux\nlignes"');
  });

  it('should render null and undefined as empty rather than as words', () => {
    const out = buildCsv([], [{ titre: 'T', entetes: ['a', 'b'], lignes: [[null as never, undefined as never]] }]);
    expect(out).not.toContain('null');
    expect(out).not.toContain('undefined');
  });
});

describe('exportSimulationCsv — what a reader needs to verify anything', () => {
  it('should carry the hypotheses, not only the results', () => {
    // A column of numbers cannot be checked without the inputs behind it.
    expect(csv).toContain('# HYPOTHESES');
    expect(csv).toContain('Bien - prix d achat;200000.00');
    expect(csv).toContain('Pret - capital emprunte;180000.00');
    expect(csv).toContain('Horizon (annees);30');
  });

  it('should carry every section a check would need', () => {
    for (const titre of [
      'HYPOTHESES', 'ASSOCIES', 'SYNTHESE', 'PROJECTION ANNUELLE',
      'DETAIL PAR ENTITE ET PAR ANNEE', 'PAR ASSOCIE ET PAR ANNEE',
      'SORTIE (revente estimee au terme)', 'SUCCESSION',
    ]) {
      expect(csv).toContain(`# ${titre}`);
    }
  });

  it('should state the caveats up front', () => {
    // A model handed only figures would vouch for arithmetic it cannot see.
    const preambule = csv.slice(0, csv.indexOf('# HYPOTHESES'));
    expect(preambule).toContain('151 septies');
    expect(preambule).toContain('revente n est pas simulee');
    expect(preambule).toContain('Baremes fiscaux 2026 figes');
    expect(AVERTISSEMENTS.length).toBeGreaterThanOrEqual(8);
  });

  it('should escape an associe name containing a separator and quotes', () => {
    expect(csv).toContain('"Moi; le ""gerant"""');
  });

  it('should give one projection row per year, year 0 included', () => {
    const entete = enteteDe('PROJECTION ANNUELLE');
    expect(lignes[entete].startsWith('Annee;')).toBe(true);
    expect(champs(lignes[entete + 1])[0]).toBe('0');
    expect(champs(lignes[entete + 31])[0]).toBe('30');
  });

  it('should keep every row the same width as its header', () => {
    // A ragged row is what makes a parser silently misalign columns.
    let largeur: number | null = null;
    for (const ligne of lignes) {
      if (ligne.startsWith('#') || ligne === '') { largeur = null; continue; }
      const cellules = champs(ligne);
      if (largeur === null) largeur = cellules.length;
      else expect(cellules.length).toBe(largeur);
    }
  });

  it('should use a dot decimal so a comma locale cannot corrupt it', () => {
    expect(csv).toContain('200000.00');
    expect(csv).not.toMatch(/;\d+,\d{2};/);
  });
});
