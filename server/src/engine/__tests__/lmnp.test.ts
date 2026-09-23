import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import type { AssocieInput } from '@shared/schemas.js';
import { applyLMNPReel, computeAssocieLMNP, computeMicroBIC } from '../lmnp.js';
import { computeExitIR, computeExitLMNP, type ExitParams } from '../exit.js';

const d = (v: number | string) => new Decimal(v);

const associe = (over: Partial<AssocieInput> = {}): AssocieInput => ({
  nom: 'Moi',
  partsPercent: 1,
  relation: 'SELF',
  maritalStatus: 'SINGLE',
  childrenCount: 0,
  autresRevenus: '40000.00',
  socialChargeRegime: 'STANDARD',
  apportCapital: '0.00',
  apportCompteCourant: '0.00',
  tauxInteretCCA: 0,
  ...over,
});

describe('applyLMNPReel — art. 39 C cap', () => {
  it('should never let depreciation create a deficit, deferring the excess', () => {
    const r = applyLMNPReel({
      resultatAvantAmortissements: d(6000),
      amortissementsExercice: d(10000),
      deficits: [],
      amortissementsDifferes: d(0),
      year: 1,
    });
    expect(r.resultatImposable.toNumber()).toBe(0);
    expect(r.amortissementsDeduits.toNumber()).toBe(6000);
    expect(r.amortissementsDifferes.toNumber()).toBe(4000);
    expect(r.deficits).toEqual([]);
  });

  it('should carry a real-charge deficit and defer the whole year of depreciation', () => {
    const r = applyLMNPReel({
      resultatAvantAmortissements: d(-3000),
      amortissementsExercice: d(8000),
      deficits: [],
      amortissementsDifferes: d(1000),
      year: 2,
    });
    expect(r.resultatImposable.toNumber()).toBe(0);
    expect(r.amortissementsDeduits.toNumber()).toBe(0);
    expect(r.amortissementsDifferes.toNumber()).toBe(9000);
    expect(r.deficits).toEqual([{ year: 2, montant: d(3000) }]);
  });

  it('should absorb the year depreciation, then the deficits, then the deferred stock', () => {
    const r = applyLMNPReel({
      resultatAvantAmortissements: d(20000),
      amortissementsExercice: d(8000),
      deficits: [{ year: 3, montant: d(5000) }],
      amortissementsDifferes: d(4000),
      year: 5,
    });
    // 20 000 - 8 000 (year) - 5 000 (deficit) - 4 000 (deferred) = 3 000.
    expect(r.resultatImposable.toNumber()).toBe(3000);
    expect(r.amortissementsDeduits.toNumber()).toBe(12000);
    expect(r.amortissementsDifferes.toNumber()).toBe(0);
    expect(r.deficits).toEqual([]);
  });

  it('should drop a deficit after ten years but keep deferred depreciation forever', () => {
    const r = applyLMNPReel({
      resultatAvantAmortissements: d(10000),
      amortissementsExercice: d(0),
      deficits: [{ year: 1, montant: d(5000) }],
      amortissementsDifferes: d(2000),
      year: 12,
    });
    expect(r.resultatImposable.toNumber()).toBe(8000);
    expect(r.amortissementsDeduits.toNumber()).toBe(2000);
  });

  it('should still use a deficit in its tenth year', () => {
    const r = applyLMNPReel({
      resultatAvantAmortissements: d(10000),
      amortissementsExercice: d(0),
      deficits: [{ year: 1, montant: d(5000) }],
      amortissementsDifferes: d(0),
      year: 11,
    });
    expect(r.resultatImposable.toNumber()).toBe(5000);
  });
});

describe('computeMicroBIC', () => {
  it('should apply 50 % up to 77 700 EUR for a long-term or classified letting', () => {
    const r = computeMicroBIC(d(30000), false);
    expect(r.eligible).toBe(true);
    expect(r.resultatImposable.toNumber()).toBe(15000);
    expect(computeMicroBIC(d(80000), false).eligible).toBe(false);
  });

  it('should apply 30 % up to 15 000 EUR for an unclassified tourist letting', () => {
    const r = computeMicroBIC(d(12000), true);
    expect(r.eligible).toBe(true);
    expect(r.resultatImposable.toNumber()).toBe(8400);
    expect(computeMicroBIC(d(16000), true).eligible).toBe(false);
  });

  it('should grant at least the 305 EUR minimum allowance', () => {
    expect(computeMicroBIC(d(400), true).abattement.toNumber()).toBe(305);
    expect(computeMicroBIC(d(200), true).resultatImposable.toNumber()).toBe(0);
  });
});

describe('computeAssocieLMNP', () => {
  it('should levy the prelevements sociaux on capital income, not TNS contributions', () => {
    expect(computeAssocieLMNP(associe(), d(10000)).ps.toNumber()).toBeCloseTo(1720, 2);
    expect(
      computeAssocieLMNP(associe({ socialChargeRegime: 'SWISS_EXEMPT' }), d(10000)).ps.toNumber(),
    ).toBeCloseTo(750, 2);
  });

  it('should tax differentially on top of the other income', () => {
    const modeste = computeAssocieLMNP(associe({ autresRevenus: '15000.00' }), d(10000));
    const aise = computeAssocieLMNP(associe({ autresRevenus: '150000.00' }), d(10000));
    expect(aise.ir.gt(modeste.ir)).toBe(true);
  });

  it('should never lower the global income tax — no deficit reaches it', () => {
    const r = computeAssocieLMNP(associe(), d(-5000));
    expect(r.ir.toNumber()).toBe(0);
    expect(r.ps.toNumber()).toBe(0);
  });
});

describe('computeExitLMNP — reintegration LF 2025', () => {
  const base = (over: Partial<ExitParams> = {}): ExitParams => ({
    prixVente: d(340000),
    prixAcquisition: d(216000),
    prixAchat: d(200000),
    travauxReels: d(30000),
    baseAmortissable: d(246000),
    cumulAmortissements: d(0),
    detteResiduelle: d(0),
    dureeDetention: 10,
    regimeSocial: 'STANDARD',
    capitalSocial: d(0),
    ...over,
  });

  it('should match a private gain when nothing was deducted (micro-BIC)', () => {
    const lmnp = computeExitLMNP(base(), d(0));
    const ir = computeExitIR(base());
    expect(lmnp.regime).toBe('LMNP');
    expect(lmnp.impot.toNumber()).toBeCloseTo(ir.impot.toNumber(), 2);
  });

  it('should add the deducted depreciation back to the gain', () => {
    const sans = computeExitLMNP(base(), d(0));
    const avec = computeExitLMNP(base(), d(60000));
    expect(avec.plusValueBrute.minus(sans.plusValueBrute).toNumber()).toBeCloseTo(60000, 2);
    expect(avec.impot.gt(sans.impot)).toBe(true);
    expect(avec.amortissementsRepris.toNumber()).toBe(60000);
  });

  it('should still be income-tax exempt past 22 years, depreciation or not', () => {
    const r = computeExitLMNP(base({ dureeDetention: 30 }), d(60000));
    expect(r.impot.toNumber()).toBe(0);
  });
});
