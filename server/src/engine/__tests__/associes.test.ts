import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import type { AssocieInput } from '@shared/schemas.js';
import {
  splitResultatFoncier,
  applyDeficitFoncier,
  computeAssocieIR,
  computeAssocieLMP,
  computeCCAYear,
  findSelf,
  totalCapitalSocial,
  totalComptesCourants,
} from '../associes.js';
import { computeIR } from '../tax.js';

function associe(over: Partial<AssocieInput> = {}): AssocieInput {
  return {
    nom: 'Associe',
    partsPercent: 1,
    relation: 'SELF',
    maritalStatus: 'SINGLE',
    childrenCount: 0,
    autresRevenus: '0.00',
    socialChargeRegime: 'STANDARD',
    apportCapital: '0.00',
    apportCompteCourant: '0.00',
    tauxInteretCCA: 0,
    ...over,
  };
}

/** No carried deficit, all of the quote-part is taxable. */
function plainResult(quotePart: string) {
  return {
    revenuFoncierNet: new Decimal(quotePart),
    imputationRevenuGlobal: new Decimal(0),
    vintages: [],
  };
}

describe('splitResultatFoncier', () => {
  it('should split pro-rata by parts', () => {
    const parts = splitResultatFoncier(new Decimal('30000'), [
      associe({ nom: 'A', partsPercent: 0.6 }),
      associe({ nom: 'B', partsPercent: 0.3 }),
      associe({ nom: 'C', partsPercent: 0.1 }),
    ]);

    expect(parts.get('A')!.toNumber()).toBe(18000);
    expect(parts.get('B')!.toNumber()).toBe(9000);
    expect(parts.get('C')!.toNumber()).toBe(3000);
  });

  it('should split a deficit as well as a profit', () => {
    const parts = splitResultatFoncier(new Decimal('-10000'), [
      associe({ nom: 'A', partsPercent: 0.5 }),
      associe({ nom: 'B', partsPercent: 0.5 }),
    ]);
    expect(parts.get('A')!.toNumber()).toBe(-5000);
    expect(parts.get('B')!.toNumber()).toBe(-5000);
  });

  it('should conserve the total', () => {
    const associes = [
      associe({ nom: 'A', partsPercent: 0.34 }),
      associe({ nom: 'B', partsPercent: 0.33 }),
      associe({ nom: 'C', partsPercent: 0.33 }),
    ];
    const parts = splitResultatFoncier(new Decimal('12345.67'), associes);
    const total = [...parts.values()].reduce((a, b) => a.plus(b), new Decimal(0));
    expect(total.toNumber()).toBeCloseTo(12345.67, 2);
  });
});

describe('applyDeficitFoncier', () => {
  it('should charge a small deficit fully against global income', () => {
    const r = applyDeficitFoncier(new Decimal('-5000'), [], 1);
    expect(r.imputationRevenuGlobal.toNumber()).toBe(5000);
    expect(r.revenuFoncierNet.toNumber()).toBe(0);
    expect(r.vintages).toHaveLength(0);
  });

  it('should cap the global charge at 10,700 and carry the excess', () => {
    const r = applyDeficitFoncier(new Decimal('-18000'), [], 1);
    expect(r.imputationRevenuGlobal.toNumber()).toBe(10700);
    expect(r.vintages).toHaveLength(1);
    expect(r.vintages[0].montant.toNumber()).toBe(7300);
  });

  it('should absorb a carried deficit against later foncier income', () => {
    const r = applyDeficitFoncier(new Decimal('5000'), [{ year: 1, montant: new Decimal('7300') }], 3);
    expect(r.revenuFoncierNet.toNumber()).toBe(0);
    expect(r.vintages[0].montant.toNumber()).toBe(2300);
  });

  it('should tax only the surplus once the carried deficit is exhausted', () => {
    const r = applyDeficitFoncier(new Decimal('10000'), [{ year: 1, montant: new Decimal('7300') }], 3);
    expect(r.revenuFoncierNet.toNumber()).toBe(2700);
    expect(r.vintages).toHaveLength(0);
  });

  it('should consume the oldest vintages first', () => {
    const r = applyDeficitFoncier(
      new Decimal('3000'),
      [
        { year: 5, montant: new Decimal('2000') },
        { year: 2, montant: new Decimal('2000') },
      ],
      6,
    );
    // 2000 from the year-2 vintage, then 1000 from the year-5 one.
    expect(r.vintages).toHaveLength(1);
    expect(r.vintages[0].year).toBe(5);
    expect(r.vintages[0].montant.toNumber()).toBe(1000);
  });

  it('should drop vintages past the tenth year that follows', () => {
    // A deficit born in year 1 is chargeable against the foncier income of
    // years 2 to 11. In year 12 it is gone.
    const r = applyDeficitFoncier(new Decimal('5000'), [{ year: 1, montant: new Decimal('4000') }], 12);
    expect(r.revenuFoncierNet.toNumber()).toBe(5000);
    expect(r.vintages).toHaveLength(0);
  });

  it('should still charge a vintage on its tenth and last year', () => {
    // Regression: a strict comparison dropped it one year early, costing a
    // full year of report.
    const r = applyDeficitFoncier(new Decimal('5000'), [{ year: 1, montant: new Decimal('4000') }], 11);
    expect(r.revenuFoncierNet.toNumber()).toBe(1000);
    expect(r.vintages).toHaveLength(0);
  });

  it('should keep a vintage that is exactly 9 years old', () => {
    const r = applyDeficitFoncier(new Decimal('0'), [{ year: 1, montant: new Decimal('4000') }], 10);
    expect(r.vintages).toHaveLength(1);
  });
});

describe('computeAssocieIR — differential taxation', () => {
  it('should tax the quote-part at the marginal rate set by other income', () => {
    // Same 10k quote-part, two very different households.
    const modeste = computeAssocieIR(associe({ autresRevenus: '15000.00' }), plainResult('10000'));
    const aise = computeAssocieIR(associe({ autresRevenus: '150000.00' }), plainResult('10000'));

    expect(aise.ir.gt(modeste.ir)).toBe(true);
  });

  it('should differ from taxing the quote-part in isolation', () => {
    // This is the bug the module exists to fix.
    const a = associe({ autresRevenus: '80000.00' });
    const differential = computeAssocieIR(a, plainResult('10000')).ir;
    const isolated = computeIR(new Decimal('10000'), a.maritalStatus, a.childrenCount);

    expect(differential.gt(isolated)).toBe(true);
  });

  it('should make three associes at different brackets pay different amounts', () => {
    const quotePart = plainResult('10000');
    const results = [
      computeAssocieIR(associe({ nom: 'A', autresRevenus: '0.00' }), quotePart),
      computeAssocieIR(associe({ nom: 'B', autresRevenus: '45000.00' }), quotePart),
      computeAssocieIR(associe({ nom: 'C', autresRevenus: '200000.00' }), quotePart),
    ];
    const irs = results.map((r) => r.ir.toNumber());

    expect(new Set(irs).size).toBe(3);
    expect(irs[0]).toBeLessThan(irs[1]);
    expect(irs[1]).toBeLessThan(irs[2]);
  });

  it('should apply the quotient familial of each associe, not a shared one', () => {
    const celibataire = computeAssocieIR(
      associe({ autresRevenus: '60000.00', maritalStatus: 'SINGLE', childrenCount: 0 }),
      plainResult('10000'),
    );
    const famille = computeAssocieIR(
      associe({ autresRevenus: '60000.00', maritalStatus: 'MARRIED', childrenCount: 3 }),
      plainResult('10000'),
    );
    expect(celibataire.ir.gt(famille.ir)).toBe(true);
  });

  it('should exempt a Swiss-affiliated associe from CSG/CRDS', () => {
    const standard = computeAssocieIR(associe({ socialChargeRegime: 'STANDARD' }), plainResult('10000'));
    const suisse = computeAssocieIR(associe({ socialChargeRegime: 'SWISS_EXEMPT' }), plainResult('10000'));

    expect(standard.ps.toNumber()).toBeCloseTo(1720, 2);
    expect(suisse.ps.toNumber()).toBeCloseTo(750, 2);
  });

  it('should mix regimes within a single SCI', () => {
    // The whole point of per-associe profiles.
    const quotePart = plainResult('20000');
    const suisse = computeAssocieIR(associe({ socialChargeRegime: 'SWISS_EXEMPT' }), quotePart);
    const francais = computeAssocieIR(associe({ socialChargeRegime: 'STANDARD' }), quotePart);
    expect(suisse.ps.lt(francais.ps)).toBe(true);
  });

  it('should produce a negative IR when a deficit lowers the associe tax bill', () => {
    const deficit = {
      revenuFoncierNet: new Decimal(0),
      imputationRevenuGlobal: new Decimal('10700'),
      vintages: [],
    };
    const r = computeAssocieIR(associe({ autresRevenus: '80000.00' }), deficit);

    expect(r.ir.lt(0)).toBe(true);
    expect(r.ps.toNumber()).toBe(0);
  });

  it('should charge no PS on a year with no positive foncier income', () => {
    const deficit = {
      revenuFoncierNet: new Decimal(0),
      imputationRevenuGlobal: new Decimal('3000'),
      vintages: [],
    };
    expect(computeAssocieIR(associe(), deficit).ps.toNumber()).toBe(0);
  });
});

describe('computeAssocieLMP — BIC differential taxation', () => {
  it('should tax the quote-part at the marginal rate set by other income, like computeAssocieIR', () => {
    const modeste = computeAssocieLMP(associe({ autresRevenus: '15000.00' }), new Decimal('10000'), new Decimal('0.35'));
    const aise = computeAssocieLMP(associe({ autresRevenus: '150000.00' }), new Decimal('10000'), new Decimal('0.35'));

    expect(aise.ir.gt(modeste.ir)).toBe(true);
  });

  it('should charge TNS contributions on a positive result, not the foncier PS rate', () => {
    const r = computeAssocieLMP(associe({ socialChargeRegime: 'STANDARD' }), new Decimal('10000'), new Decimal('0.35'));
    expect(r.cotisationsSociales.toNumber()).toBe(3500);
  });

  it('should charge no TNS contributions on a deficit year', () => {
    const r = computeAssocieLMP(associe(), new Decimal('-5000'), new Decimal('0.35'));
    expect(r.cotisationsSociales.toNumber()).toBe(0);
  });

  it('should impute a BIC deficit against global income with no 10 700 EUR cap, unlike foncier', () => {
    // A 20000 EUR deficit fully offsets 20000 EUR of other income — the
    // foncier path would cap the offset at 10700 and carry the rest forward.
    const withDeficit = computeAssocieLMP(associe({ autresRevenus: '80000.00' }), new Decimal('-20000'), new Decimal('0.35'));
    const withoutLMP = new Decimal(0); // IR on 80000 minus IR on 80000 = 0 baseline
    expect(withDeficit.ir.lt(withoutLMP)).toBe(true);

    const noSci = computeAssocieLMP(associe({ autresRevenus: '80000.00' }), new Decimal(0), new Decimal('0.35')).ir;
    expect(noSci.toNumber()).toBe(0);
  });

  it('should never let the deficit push net taxable income below zero', () => {
    const r = computeAssocieLMP(associe({ autresRevenus: '5000.00' }), new Decimal('-20000'), new Decimal('0.35'));
    // IR without the LMP (on 5000) is already 0, so the differential floors at 0 too.
    expect(r.ir.toNumber()).toBe(0);
  });
});

describe('computeCCAYear', () => {
  it('should return nothing when there is no compte courant', () => {
    const r = computeCCAYear(new Decimal(0), new Decimal('0.03'), new Decimal('50000'), new Decimal('1'));
    expect(r.interets.toNumber()).toBe(0);
    expect(r.remboursement.toNumber()).toBe(0);
  });

  it('should accrue no interest on a non-remunerated CCA', () => {
    const r = computeCCAYear(new Decimal('50000'), new Decimal(0), new Decimal('10000'), new Decimal('0.5'));
    expect(r.interets.toNumber()).toBe(0);
    expect(r.remboursement.toNumber()).toBe(5000);
  });

  it('should accrue interest on a remunerated CCA', () => {
    const r = computeCCAYear(new Decimal('50000'), new Decimal('0.03'), new Decimal(0), new Decimal(0));
    expect(r.interets.toNumber()).toBe(1500);
  });

  it('should never repay more than the outstanding balance', () => {
    const r = computeCCAYear(new Decimal('5000'), new Decimal(0), new Decimal('100000'), new Decimal('1'));
    expect(r.remboursement.toNumber()).toBe(5000);
    expect(r.soldeRestant.toNumber()).toBe(0);
  });

  it('should repay nothing when the year is cash-negative', () => {
    const r = computeCCAYear(new Decimal('50000'), new Decimal(0), new Decimal('-8000'), new Decimal('1'));
    expect(r.remboursement.toNumber()).toBe(0);
    expect(r.soldeRestant.toNumber()).toBe(50000);
  });
});

describe('helpers', () => {
  const associes = [
    associe({ nom: 'Florian', relation: 'SELF', partsPercent: 0.6, apportCapital: '600.00', apportCompteCourant: '40000.00' }),
    associe({ nom: 'Enfant', relation: 'CHILD', partsPercent: 0.4, apportCapital: '400.00', apportCompteCourant: '0.00' }),
  ];

  it('should find the SELF associe', () => {
    expect(findSelf(associes)?.nom).toBe('Florian');
  });

  it('should return undefined when no SELF is declared', () => {
    expect(findSelf([associe({ relation: 'CHILD' })])).toBeUndefined();
  });

  it('should total the share capital', () => {
    expect(totalCapitalSocial(associes).toNumber()).toBe(1000);
  });

  it('should total the comptes courants', () => {
    expect(totalComptesCourants(associes).toNumber()).toBe(40000);
  });
});

describe('computeAssocieLMP — cotisations et assiette', () => {
  it('should tax income on the result net of the contributions', () => {
    // Regression: IR used to bite on the gross BIC result. TNS charges are a
    // deductible charge of that result, so income tax sees what is left.
    const brut = new Decimal('40000');
    const taux = new Decimal('0.35');
    const r = computeAssocieLMP(associe({ autresRevenus: '30000.00' }), brut, taux);

    expect(r.cotisationsSociales.toNumber()).toBeCloseTo(14000, 2);

    // The IR charged must match a 26 000 EUR supplement, not a 40 000 one.
    const net = computeAssocieLMP(associe({ autresRevenus: '30000.00' }), new Decimal('26000'), new Decimal('0'));
    expect(r.ir.toNumber()).toBeCloseTo(net.ir.toNumber(), 2);
  });

  it('should floor the contributions even in a loss-making year', () => {
    const r = computeAssocieLMP(
      associe({ autresRevenus: '50000.00' }),
      new Decimal('-10000'),
      new Decimal('0.35'),
      new Decimal('1200'),
    );
    expect(r.cotisationsSociales.toNumber()).toBe(1200);
  });

  it('should deepen the deficit by the minimum contributions', () => {
    // The floor is a real charge: it makes the loss bigger, so it lowers the
    // income tax on the rest of the household a little further.
    const avecPlancher = computeAssocieLMP(
      associe({ autresRevenus: '50000.00' }),
      new Decimal('-10000'),
      new Decimal('0.35'),
      new Decimal('1200'),
    );
    const sansPlancher = computeAssocieLMP(
      associe({ autresRevenus: '50000.00' }),
      new Decimal('-10000'),
      new Decimal('0.35'),
    );
    expect(avecPlancher.ir.lt(sansPlancher.ir)).toBe(true);
  });

  it('should still charge the proportional rate when it exceeds the floor', () => {
    const r = computeAssocieLMP(
      associe(),
      new Decimal('40000'),
      new Decimal('0.35'),
      new Decimal('1200'),
    );
    expect(r.cotisationsSociales.toNumber()).toBeCloseTo(14000, 2);
  });
});
