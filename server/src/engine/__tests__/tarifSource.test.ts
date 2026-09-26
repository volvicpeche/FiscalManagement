import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { codeTarifConnu, impotSourceAnnuel, tauxImpotSource } from '../tarifSource.js';

// Expected rates are read directly in the AFC file tar26ge.txt (lignes 06).

describe('tauxImpotSource — lecture du bareme AFC 2026', () => {
  it('should return the published rate at a step boundary', () => {
    expect(tauxImpotSource('A0', new Decimal('10000')).toNumber()).toBe(0.1556);
    expect(tauxImpotSource('A0', new Decimal('5000')).toNumber()).toBe(0.0762);
    expect(tauxImpotSource('C1', new Decimal('8000')).toNumber()).toBe(0.0969);
    expect(tauxImpotSource('B2', new Decimal('10000')).toNumber()).toBe(0.0253);
  });

  it('should keep the rate of the step for a salary inside it', () => {
    expect(tauxImpotSource('A0', new Decimal('10049.95')).toNumber()).toBe(0.1556);
  });

  it('should apply no tax below the first taxable step', () => {
    expect(tauxImpotSource('A0', new Decimal('2000')).toNumber()).toBe(0);
  });

  it('should reject an unknown tariff code', () => {
    expect(() => tauxImpotSource('Z9', new Decimal('5000'))).toThrow(/inconnu/);
    expect(codeTarifConnu('C1')).toBe(true);
    expect(codeTarifConnu('G9')).toBe(false);
  });
});

describe('impotSourceAnnuel — salaire annuel', () => {
  it('should apply the rate of the average month to the whole year', () => {
    const { taux, impot } = impotSourceAnnuel('A0', new Decimal('120000'));
    expect(taux.toNumber()).toBe(0.1556);
    expect(impot.toNumber()).toBe(18672);
  });
});
