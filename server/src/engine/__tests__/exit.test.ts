import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import type { AssocieInput } from '@shared/schemas.js';
import { computeExitIS, computeExitIR, computeExitLMP, type ExitParams } from '../exit.js';

/** 216 000 bought, 30 000 of works, sold 340 000 after 30 years. */
const base = (over: Partial<ExitParams> = {}): ExitParams => ({
  prixVente: new Decimal('340000'),
  prixAcquisition: new Decimal('216000'),
  prixAchat: new Decimal('200000'),
  travauxReels: new Decimal('30000'),
  baseAmortissable: new Decimal('246000'),
  cumulAmortissements: new Decimal('0'),
  detteResiduelle: new Decimal('0'),
  dureeDetention: 30,
  regimeSocial: 'STANDARD',
  capitalSocial: new Decimal('1000'),
  ...over,
});

const associe = (over: Partial<AssocieInput> = {}): AssocieInput => ({
  nom: 'Moi',
  partsPercent: 1,
  relation: 'SELF',
  maritalStatus: 'MARRIED',
  childrenCount: 2,
  autresRevenus: '90000.00',
  socialChargeRegime: 'STANDARD',
  apportCapital: '0.00',
  apportCompteCourant: '0.00',
  tauxInteretCCA: 0,
  ...over,
});

describe('computeExitIS', () => {
  it('should measure the gain against the book value, not the purchase price', () => {
    // 200 000 depreciated: book value falls to 46 000, gain is 294 000.
    const r = computeExitIS(base({ cumulAmortissements: new Decimal('200000') }));
    expect(r.valeurNetteComptable.toNumber()).toBe(46000);
    expect(r.plusValueBrute.toNumber()).toBe(294000);
  });

  it('should tax more the more was depreciated', () => {
    const peu = computeExitIS(base({ cumulAmortissements: new Decimal('50000') }));
    const beaucoup = computeExitIS(base({ cumulAmortissements: new Decimal('200000') }));
    expect(beaucoup.impot.gt(peu.impot)).toBe(true);
  });

  it('should report how much of the gain is depreciation coming back', () => {
    const r = computeExitIS(base({ cumulAmortissements: new Decimal('200000') }));
    expect(r.amortissementsRepris.toNumber()).toBe(200000);
  });

  it('should never let the recapture exceed the gain itself', () => {
    // Sold barely above book value: only that sliver is taxable.
    const r = computeExitIS(
      base({ prixVente: new Decimal('60000'), cumulAmortissements: new Decimal('200000') }),
    );
    expect(r.plusValueBrute.toNumber()).toBe(14000);
    expect(r.amortissementsRepris.toNumber()).toBe(14000);
  });

  it('should charge nothing when sold below book value', () => {
    const r = computeExitIS(base({ prixVente: new Decimal('100000') }));
    expect(r.impot.toNumber()).toBe(0);
    expect(r.plusValueBrute.toNumber()).toBe(0);
  });

  it('should deduct the tax and the outstanding debt from the proceeds', () => {
    const r = computeExitIS(
      base({ cumulAmortissements: new Decimal('200000'), detteResiduelle: new Decimal('50000') }),
    );
    expect(r.produitNet.toNumber()).toBeCloseTo(340000 - r.impot.toNumber() - 50000, 2);
  });
});

describe('computeExitIR', () => {
  it('should exempt the income-tax share after 22 years', () => {
    const r = computeExitIR(base({ dureeDetention: 25 }));
    // Only social charges remain, and they are abated too.
    expect(r.plusValueBrute.toNumber()).toBe(124000);
    expect(r.impot.lt(r.plusValueBrute.mul('0.1'))).toBe(true);
  });

  it('should exempt everything after 30 years', () => {
    expect(computeExitIR(base({ dureeDetention: 30 })).impot.toNumber()).toBe(0);
  });

  it('should tax a short holding period heavily', () => {
    const court = computeExitIR(base({ dureeDetention: 3 }));
    const long = computeExitIR(base({ dureeDetention: 25 }));
    expect(court.impot.gt(long.impot)).toBe(true);
  });

  it('should never add depreciation back — there is none at IR', () => {
    const r = computeExitIR(base({ dureeDetention: 5, cumulAmortissements: new Decimal('200000') }));
    expect(r.amortissementsRepris.toNumber()).toBe(0);
  });

  it('should charge less to a Swiss-affiliated seller', () => {
    const standard = computeExitIR(base({ dureeDetention: 10, regimeSocial: 'STANDARD' }));
    const suisse = computeExitIR(base({ dureeDetention: 10, regimeSocial: 'SWISS_EXEMPT' }));
    expect(suisse.impot.lt(standard.impot)).toBe(true);
  });
});

describe('computeExitLMP', () => {
  const tns = new Decimal('0.35');

  it('should split the gain between recaptured depreciation and the rest', () => {
    const r = computeExitLMP(
      base({ cumulAmortissements: new Decimal('200000') }),
      associe(),
      tns,
    );
    expect(r.plusValueBrute.toNumber()).toBe(294000);
    expect(r.amortissementsRepris.toNumber()).toBe(200000);
  });

  it('should charge TNS contributions on the recaptured part', () => {
    const avecAmortissements = computeExitLMP(
      base({ cumulAmortissements: new Decimal('200000') }),
      associe(),
      tns,
    );
    const sansAmortissements = computeExitLMP(base(), associe(), tns);
    // Same sale price, but depreciation makes the exit far more expensive.
    expect(avecAmortissements.impot.gt(sansAmortissements.impot)).toBe(true);
  });

  it('should tax a higher-bracket operator more on the short-term part', () => {
    const modeste = computeExitLMP(
      base({ cumulAmortissements: new Decimal('200000') }),
      associe({ autresRevenus: '15000.00' }),
      tns,
    );
    const aise = computeExitLMP(
      base({ cumulAmortissements: new Decimal('200000') }),
      associe({ autresRevenus: '250000.00' }),
      tns,
    );
    expect(aise.impot.gt(modeste.impot)).toBe(true);
  });

  it('should charge nothing when sold below book value', () => {
    const r = computeExitLMP(base({ prixVente: new Decimal('100000') }), associe(), tns);
    expect(r.impot.toNumber()).toBe(0);
  });
});

describe('the regimes compared at the exit', () => {
  it('should make the IS the most expensive to leave after heavy depreciation', () => {
    // The whole point: twenty years of depreciation is a bill deferred, not
    // a bill avoided.
    const p = base({ cumulAmortissements: new Decimal('200000'), dureeDetention: 30 });
    const is = computeExitIS(p);
    const ir = computeExitIR(p);

    expect(is.impot.gt(ir.impot)).toBe(true);
    // At 30 years the IR exit is entirely exempt.
    expect(ir.impot.toNumber()).toBe(0);
    expect(is.impot.toNumber()).toBeGreaterThan(50000);
  });
});

describe('computeExitIR — forfait travaux', () => {
  it('should value the works at 15% of the price when the invoices fall short', () => {
    // Past five years the seller may take the flat 15 % instead of the real
    // works. With no works at all, the forfait alone lowers the gain.
    const sansTravaux = computeExitIR(
      base({ dureeDetention: 10, travauxReels: new Decimal('0'), prixAcquisition: new Decimal('216000') }),
    );
    // 216 000 + 15 % de 200 000.
    expect(sansTravaux.prixAcquisition.toNumber()).toBeCloseTo(246000, 2);
  });

  it('should keep the real works when they exceed the forfait', () => {
    const grosTravaux = computeExitIR(
      base({
        dureeDetention: 10,
        travauxReels: new Decimal('80000'),
        prixAcquisition: new Decimal('296000'),
      }),
    );
    expect(grosTravaux.prixAcquisition.toNumber()).toBeCloseTo(296000, 2);
  });

  it('should not offer the forfait before five years of holding', () => {
    const court = computeExitIR(
      base({ dureeDetention: 4, travauxReels: new Decimal('0'), prixAcquisition: new Decimal('216000') }),
    );
    expect(court.prixAcquisition.toNumber()).toBeCloseTo(216000, 2);
  });
});

describe('computeExitLMP — abattement 151 septies B', () => {
  const tns = new Decimal('0.35');

  it('should exempt the long-term share entirely after fifteen years', () => {
    // No depreciation taken, so the whole gain is long term.
    const r = computeExitLMP(base({ dureeDetention: 15, cumulAmortissements: new Decimal('0') }), associe(), tns);
    expect(r.impot.toNumber()).toBe(0);
  });

  it('should abate the long-term share by 10% per year past the fifth', () => {
    const dix = computeExitLMP(base({ dureeDetention: 10, cumulAmortissements: new Decimal('0') }), associe(), tns);
    const six = computeExitLMP(base({ dureeDetention: 6, cumulAmortissements: new Decimal('0') }), associe(), tns);
    // 50 % abated at ten years against 10 % at six.
    expect(dix.impot.lt(six.impot)).toBe(true);
    expect(dix.impot.gt(0)).toBe(true);
  });

  it('should leave the recaptured depreciation fully taxable', () => {
    // The abatement reaches the long-term share only: the short-term part is
    // the depreciation coming back, and it is taxed in full whatever the age.
    const r = computeExitLMP(
      base({ dureeDetention: 30, cumulAmortissements: new Decimal('200000') }),
      associe(),
      tns,
    );
    expect(r.amortissementsRepris.toNumber()).toBe(200000);
    expect(r.impot.gt(new Decimal('70000'))).toBe(true);
  });
});

describe('computeExitIS — les deux etages', () => {
  it('should add the associes tax on top of the corporate one', () => {
    const r = computeExitIS(base({ cumulAmortissements: new Decimal('200000') }));
    expect(r.impotSociete.gt(0)).toBe(true);
    expect(r.impotAssocies.gt(0)).toBe(true);
    expect(r.impot.toNumber()).toBeCloseTo(
      r.impotSociete.plus(r.impotAssocies).toNumber(),
      2,
    );
  });

  it('should hand the share capital back untaxed', () => {
    // The boni is what is left once the associes have recovered their capital.
    const petit = computeExitIS(base({ capitalSocial: new Decimal('1000') }));
    const gros = computeExitIS(base({ capitalSocial: new Decimal('100000') }));

    expect(gros.boniLiquidation.lt(petit.boniLiquidation)).toBe(true);
    expect(gros.impotAssocies.lt(petit.impotAssocies)).toBe(true);
    // The corporate floor does not care who put the capital in.
    expect(gros.impotSociete.toNumber()).toBe(petit.impotSociete.toNumber());
  });

  it('should exempt a Swiss-affiliated associe from the CSG on the boni', () => {
    const standard = computeExitIS(base({ regimeSocial: 'STANDARD' }));
    const suisse = computeExitIS(base({ regimeSocial: 'SWISS_EXEMPT' }));
    expect(suisse.impotAssocies.lt(standard.impotAssocies)).toBe(true);
    expect(suisse.impotSociete.toNumber()).toBe(standard.impotSociete.toNumber());
  });

  it('should leave the IR exit a single, personal floor', () => {
    const r = computeExitIR(base({ dureeDetention: 10 }));
    expect(r.impotSociete.toNumber()).toBe(0);
    expect(r.impotAssocies.toNumber()).toBe(r.impot.toNumber());
  });
});
