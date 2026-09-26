import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { FrontalierRequestSchema, type FrontalierRequest, type FrontalierRequestInput } from '@shared/frontalier.js';
import {
  codeTarifParDefaut,
  computeAssiettes,
  computeTest90,
  impotBaseIcc,
  impotBaseIccSplitting,
  impotIfdBareme,
  simulateFrontalier,
} from '../frontalierGe.js';
import { IFD_BAREME_MARIES, IFD_BAREME_SEUL } from '../baremesGeneve.js';

function baseParams(overrides: Partial<FrontalierRequestInput> = {}): FrontalierRequest {
  return FrontalierRequestSchema.parse({
    annee: 2026,
    etatCivil: 'CELIBATAIRE',
    communeTravail: 'GENEVE',
    tauxChangeEurChf: '0.93',
    contribuable: {
      prenom: 'Alex',
      activite: 'SUISSE',
      salaireBrut: '100000.00',
      cotisationsSociales: '6400.00',
      lppOrdinaire: '5000.00',
      codeTarifIS: 'A0',
    },
    deductions: {},
    ...overrides,
  });
}

const ligne = (req: FrontalierRequest, code: string) =>
  computeAssiettes(req).lignes.find((l) => l.code === code);

describe('impotBaseIcc — bareme art. 41 LIPP 2026', () => {
  it('should not tax the first tranche', () => {
    expect(impotBaseIcc(new Decimal('18700')).toNumber()).toBe(0);
  });

  it('should tax each tranche at its own rate', () => {
    // (22 530 − 18 700) × 7,3 % + (24 784 − 22 530) × 8,2 %
    expect(impotBaseIcc(new Decimal('24784')).toNumber()).toBeCloseTo(279.59 + 184.828, 2);
  });

  it('should apply the rate of half the income with splitting', () => {
    const r = new Decimal('100000');
    expect(impotBaseIccSplitting(r, true).toNumber()).toBeCloseTo(impotBaseIcc(new Decimal('50000')).mul(2).toNumber(), 6);
    expect(impotBaseIccSplitting(r, true).lt(impotBaseIcc(r))).toBe(true);
  });
});

describe('impotIfdBareme — bareme 2026 publie par l\'AFC', () => {
  it('should match the published table for a single person', () => {
    expect(impotIfdBareme(new Decimal('100000'), IFD_BAREME_SEUL).toNumber()).toBe(2684.35);
    expect(impotIfdBareme(new Decimal('33000'), IFD_BAREME_SEUL).toNumber()).toBe(137.06);
    expect(impotIfdBareme(new Decimal('185000'), IFD_BAREME_SEUL).toNumber()).toBe(10925.55);
  });

  it('should match the published table for married persons', () => {
    expect(impotIfdBareme(new Decimal('100000'), IFD_BAREME_MARIES).toNumber()).toBe(1816);
    expect(impotIfdBareme(new Decimal('155000'), IFD_BAREME_MARIES).toNumber()).toBe(6030);
  });

  it('should drop fractions under CHF 100', () => {
    expect(impotIfdBareme(new Decimal('100099'), IFD_BAREME_SEUL).toNumber()).toBe(2684.35);
  });

  it('should reach the flat 11.5 % on very high incomes', () => {
    expect(impotIfdBareme(new Decimal('1000000'), IFD_BAREME_SEUL).toNumber()).toBe(115000);
  });
});

describe('computeTest90 — statut de quasi-resident', () => {
  it('should pass when all income is Swiss', () => {
    const t = computeTest90(baseParams());
    expect(t.ratio).toBe(1);
    expect(t.eligible).toBe(true);
  });

  it('should count the spouse\'s French salary in the worldwide income', () => {
    const t = computeTest90(
      baseParams({
        etatCivil: 'MARIE',
        conjoint: { activite: 'FRANCE', revenuFranceBrutEur: '30000.00', revenuFranceNetEur: '24000.00' },
      }),
    );
    // 100 000 / (100 000 + 30 000 × 0,93)
    expect(t.ratio).toBeCloseTo(100000 / 127900, 4);
    expect(t.eligible).toBe(false);
  });

  it('should count French rents gross, before any charge', () => {
    const t = computeTest90(
      baseParams({ biensFrance: [{ usage: 'LOCATIF', loyersBrutsEur: '10000.00', interetsEmpruntEur: '9000.00' }] }),
    );
    expect(t.revenusMondiaux).toBe('109300.00');
    expect(t.eligible).toBe(true);
  });

  it('should ignore a partner when the household is not married', () => {
    const t = computeTest90(
      baseParams({ conjoint: { activite: 'FRANCE', revenuFranceBrutEur: '80000.00' } }),
    );
    expect(t.eligible).toBe(true);
  });
});

describe('computeAssiettes — plafonds', () => {
  it('should cap the 3a at CHF 7 258 for an LPP member', () => {
    const req = baseParams();
    req.contribuable.pilier3a = '9000.00';
    expect(ligne(req, 'PILIER_3A')!.icc.toNumber()).toBe(7258);
  });

  it('should allow 20 % of net earnings in 3a without a pension fund', () => {
    const req = baseParams();
    req.contribuable.affilieLpp = false;
    req.contribuable.lppOrdinaire = '0.00';
    req.contribuable.pilier3a = '30000.00';
    // (100 000 − 6 400) × 20 %
    expect(ligne(req, 'PILIER_3A')!.icc.toNumber()).toBe(18720);
  });

  it('should limit passive interest to investment income plus 50 000', () => {
    const req = baseParams({ deductions: { interetsPassifs: '60000.00', rendementFortune: '2000.00' } });
    expect(ligne(req, 'INTERETS_PASSIFS')!.icc.toNumber()).toBe(52000);
  });

  it('should clamp the ICC flat professional costs to the 2026 maximum', () => {
    // 3 % × 88 600 = 2 658 → plafond 1 817 ; IFD : 2 658 entre 2 000 et 4 000
    const l = ligne(baseParams(), 'FRAIS_PRO')!;
    expect(l.icc.toNumber()).toBe(1817);
    expect(l.ifd.toNumber()).toBe(2658);
  });

  it('should add real commuting costs up to each ceiling', () => {
    const req = baseParams();
    req.contribuable.fraisDeplacement = '5000.00';
    req.contribuable.repas = 'COMPLET';
    const l = ligne(req, 'FRAIS_PRO')!;
    expect(l.icc.toNumber()).toBe(1817); // 536 de deplacement < forfait
    expect(l.ifd.toNumber()).toBe(3300 + 3200 + 2658);
  });

  it('should reduce the ICC family charge when childcare is deducted', () => {
    const req = baseParams({ enfants: [{ age: 4, fraisGarde: '30000.00' }, { age: 16, fraisGarde: '0.00' }] });
    expect(ligne(req, 'CHARGES_FAMILLE')!.icc.toNumber()).toBe(10536 + 13698);
    expect(ligne(req, 'FRAIS_GARDE')!.icc.toNumber()).toBe(26392);
    expect(ligne(req, 'FRAIS_GARDE')!.ifd.toNumber()).toBe(25800);
  });

  it('should grant the IFD two-earner deduction on a spouse working in France', () => {
    const req = baseParams({
      etatCivil: 'MARIE',
      conjoint: { activite: 'FRANCE', revenuFranceBrutEur: '12000.00', revenuFranceNetEur: '10000.00' },
    });
    // 50 % de 9 300 < 8 600 → le minimum de 8 600
    expect(ligne(req, 'DOUBLE_REVENU')!.ifd.toNumber()).toBe(8600);
    expect(ligne(req, 'DOUBLE_REVENU')!.icc.toNumber()).toBe(0);
  });
});

describe('simulateFrontalier — reserve de progression', () => {
  it('should tax only Swiss income, at the rate of worldwide income', () => {
    const seul = simulateFrontalier(baseParams());
    const avecBien = simulateFrontalier(
      baseParams({ biensFrance: [{ usage: 'LOCATIF', loyersBrutsEur: '20000.00' }] }),
    );
    expect(avecBien.icc.revenuImposable).toBe(seul.icc.revenuImposable);
    expect(new Decimal(avecBien.icc.total).gt(seul.icc.total)).toBe(true);
    expect(new Decimal(avecBien.ifd.total).gt(seul.ifd.total)).toBe(true);
  });

  it('should let French property charges lower the rate', () => {
    const brut = simulateFrontalier(baseParams({ biensFrance: [{ usage: 'LOCATIF', loyersBrutsEur: '20000.00' }] }));
    const net = simulateFrontalier(
      baseParams({ biensFrance: [{ usage: 'LOCATIF', loyersBrutsEur: '20000.00', chargesCoproEur: '3000.00', travauxEur: '5000.00' }] }),
    );
    expect(new Decimal(net.totalTou).lt(brut.totalTou)).toBe(true);
    expect(net.impacts.some((i) => i.code === 'CHARGES_BIENS_FRANCE')).toBe(true);
  });

  it('should split the ICC into cantonal, 12 % reduction and communal parts', () => {
    const r = simulateFrontalier(baseParams());
    const base = new Decimal(r.icc.impotBase);
    const cantonal = base.mul(1.485);
    const attendu = cantonal.minus(cantonal.mul(0.12)).plus(base.mul(0.4549));
    expect(new Decimal(r.icc.total).toNumber()).toBeCloseTo(attendu.toNumber(), 1);
  });

  it('should tax less in a commune with fewer centimes', () => {
    const geneve = simulateFrontalier(baseParams());
    const cologny = simulateFrontalier(baseParams({ communeTravail: 'COLOGNY' }));
    expect(new Decimal(cologny.icc.total).lt(geneve.icc.total)).toBe(true);
  });
});

describe('simulateFrontalier — comparaison avec l\'impot a la source', () => {
  it('should compare the TOU with the tax actually withheld', () => {
    const req = baseParams();
    req.contribuable.impotSourceRetenu = '15000.00';
    const r = simulateFrontalier(req);
    expect(r.totalIsRetenu).toBe('15000.00');
    expect(new Decimal(r.gainTou).toNumber()).toBeCloseTo(15000 - Number(r.totalTou), 2);
  });

  it('should fall back on the tariff when nothing withheld is given', () => {
    const r = simulateFrontalier(baseParams());
    expect(r.totalIsTheorique).toBe(r.impotSource[0].impotTheorique);
    expect(new Decimal(r.gainTou).toNumber()).toBeCloseTo(Number(r.totalIsTheorique) - Number(r.totalTou), 2);
  });

  it('should rank the deductions by the tax they save', () => {
    const req = baseParams();
    req.contribuable.pilier3a = '7258.00';
    const r = simulateFrontalier(req);
    const economies = r.impacts.map((i) => Number(i.economie));
    expect(economies).toEqual([...economies].sort((a, b) => b - a));
    expect(r.impacts.find((i) => i.code === 'PILIER_3A')).toBeDefined();
  });

  it('should warn when the 90 % test fails', () => {
    const r = simulateFrontalier(
      baseParams({ etatCivil: 'MARIE', conjoint: { activite: 'FRANCE', revenuFranceBrutEur: '60000.00' } }),
    );
    expect(r.test90.eligible).toBe(false);
    expect(r.avertissements[0]).toMatch(/90 %/);
  });
});

describe('codeTarifParDefaut', () => {
  it('should pick the code from the household', () => {
    expect(codeTarifParDefaut(baseParams())).toBe('A0');
    expect(codeTarifParDefaut(baseParams({ enfants: [{ age: 3 }] }))).toBe('H1');
    expect(codeTarifParDefaut(baseParams({ etatCivil: 'MARIE', conjoint: { activite: 'AUCUNE' } }))).toBe('B0');
    expect(
      codeTarifParDefaut(
        baseParams({ etatCivil: 'MARIE', conjoint: { activite: 'FRANCE', revenuFranceBrutEur: '1000.00' }, enfants: [{ age: 1 }, { age: 2 }] }),
      ),
    ).toBe('C2');
  });
});
