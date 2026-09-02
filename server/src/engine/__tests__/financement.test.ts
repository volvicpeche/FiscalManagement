import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import type { AssetInput, AssocieInput } from '@shared/schemas.js';
import { computeApportRequis, computeApportDeclare, computeFinancement } from '../financement.js';

const asset = (over: Partial<AssetInput> = {}): AssetInput => ({
  type: 'REAL_ESTATE',
  label: 'Bien',
  purchasePrice: '200000.00',
  notaryFees: '16000.00',
  renovationCosts: '30000.00',
  acquisitionDate: '2026-01-01T00:00:00.000Z',
  annualRent: '12000.00',
  chargesYearly: '2400.00',
  propertyTax: '1200.00',
  landRatio: 0.15,
  loan: {
    principal: '180000.00',
    interestRate: 0.035,
    insuranceRate: 0.0035,
    durationMonths: 240,
    startDate: '2026-01-01T00:00:00.000Z',
    type: 'AMORTISSABLE',
  },
  ...over,
});

const associe = (capital: string, cca: string): AssocieInput => ({
  nom: 'A',
  partsPercent: 1,
  relation: 'SELF',
  maritalStatus: 'SINGLE',
  childrenCount: 0,
  autresRevenus: '0.00',
  socialChargeRegime: 'STANDARD',
  apportCapital: capital,
  apportCompteCourant: cca,
  tauxInteretCCA: 0,
});

describe('computeApportRequis', () => {
  it('should count price, fees and works, minus the loan', () => {
    // 200 000 + 16 000 + 30 000 + 500 of setup − 180 000 borrowed
    const r = computeApportRequis([asset()], new Decimal('500'));
    expect(r.coutAcquisition.toNumber()).toBe(246000);
    expect(r.emprunt.toNumber()).toBe(180000);
    expect(r.apportRequis.toNumber()).toBe(66500);
  });

  it('should require the whole cost when there is no loan', () => {
    const r = computeApportRequis([asset({ loan: undefined })], new Decimal(0));
    expect(r.apportRequis.toNumber()).toBe(246000);
  });

  it('should never go negative when the loan exceeds the cost', () => {
    // Over-financing does not hand you cash in this model.
    const r = computeApportRequis(
      [asset({ loan: { ...asset().loan!, principal: '400000.00' } })],
      new Decimal(0),
    );
    expect(r.apportRequis.toNumber()).toBe(0);
  });

  it('should add up across several assets', () => {
    const r = computeApportRequis([asset(), asset()], new Decimal(0));
    expect(r.coutAcquisition.toNumber()).toBe(492000);
    expect(r.apportRequis.toNumber()).toBe(132000);
  });

  it('should include the setup costs — they are cash out too', () => {
    const sans = computeApportRequis([asset()], new Decimal(0)).apportRequis;
    const avec = computeApportRequis([asset()], new Decimal('3000')).apportRequis;
    expect(avec.minus(sans).toNumber()).toBe(3000);
  });
});

describe('computeApportDeclare', () => {
  it('should add share capital and comptes courants', () => {
    expect(computeApportDeclare([associe('1000.00', '40000.00')]).toNumber()).toBe(41000);
  });

  it('should total across associes', () => {
    expect(
      computeApportDeclare([associe('500.00', '20000.00'), associe('500.00', '5000.00')]).toNumber(),
    ).toBe(26000);
  });

  it('should be zero when nobody declared anything', () => {
    expect(computeApportDeclare([]).toNumber()).toBe(0);
  });
});

describe('computeFinancement', () => {
  it('should report the gap when the associes declared too little', () => {
    // The default scenario: 66 500 needed, 41 000 declared.
    const r = computeFinancement([asset()], [associe('1000.00', '40000.00')], new Decimal('500'));
    expect(r.apportRequis.toNumber()).toBe(66500);
    expect(r.apportDeclare.toNumber()).toBe(41000);
    expect(r.ecart.toNumber()).toBe(25500);
  });

  it('should report no gap when the declaration matches', () => {
    const r = computeFinancement([asset()], [associe('1000.00', '65500.00')], new Decimal('500'));
    expect(r.ecart.toNumber()).toBe(0);
  });

  it('should report a negative gap when more was put in than needed', () => {
    const r = computeFinancement([asset()], [associe('1000.00', '99000.00')], new Decimal('500'));
    expect(r.ecart.toNumber()).toBe(-33500);
  });
});
