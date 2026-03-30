import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { generateAmortizationSchedule, getYearlyLoanSummary } from '../mortgage.js';

describe('generateAmortizationSchedule', () => {
  describe('AMORTISSABLE', () => {
    it('should generate correct number of rows', () => {
      const schedule = generateAmortizationSchedule(
        new Decimal('200000'),
        new Decimal('0.035'),
        new Decimal('0.0035'),
        240,
        'AMORTISSABLE',
      );
      expect(schedule).toHaveLength(240);
    });

    it('should have zero remaining principal at end', () => {
      const schedule = generateAmortizationSchedule(
        new Decimal('200000'),
        new Decimal('0.035'),
        new Decimal('0.0035'),
        240,
        'AMORTISSABLE',
      );
      expect(schedule[239].remainingPrincipal.toNumber()).toBe(0);
    });

    it('should compute a reasonable monthly payment for 200k at 3.5% over 20 years', () => {
      const schedule = generateAmortizationSchedule(
        new Decimal('200000'),
        new Decimal('0.035'),
        new Decimal('0.0035'),
        240,
        'AMORTISSABLE',
      );
      // Expected constant payment (principal + interest) ~1159.92 EUR + insurance ~58.33
      const payment = schedule[0].payment;
      expect(payment.toNumber()).toBeGreaterThan(1200);
      expect(payment.toNumber()).toBeLessThan(1250);
    });

    it('should have decreasing interest and increasing principal over time', () => {
      const schedule = generateAmortizationSchedule(
        new Decimal('200000'),
        new Decimal('0.035'),
        new Decimal('0.0035'),
        240,
        'AMORTISSABLE',
      );
      expect(schedule[0].interest.gt(schedule[239].interest)).toBe(true);
      expect(schedule[0].principalRepayment.lt(schedule[239].principalRepayment)).toBe(true);
    });
  });

  describe('INFINE', () => {
    it('should repay full principal only on last month', () => {
      const schedule = generateAmortizationSchedule(
        new Decimal('200000'),
        new Decimal('0.035'),
        new Decimal('0.0035'),
        240,
        'INFINE',
      );
      expect(schedule).toHaveLength(240);
      expect(schedule[0].principalRepayment.toNumber()).toBe(0);
      expect(schedule[238].principalRepayment.toNumber()).toBe(0);
      expect(schedule[239].principalRepayment.toNumber()).toBe(200000);
      expect(schedule[239].remainingPrincipal.toNumber()).toBe(0);
    });

    it('should have constant interest payments throughout', () => {
      const schedule = generateAmortizationSchedule(
        new Decimal('200000'),
        new Decimal('0.035'),
        new Decimal('0.0035'),
        240,
        'INFINE',
      );
      expect(schedule[0].interest.eq(schedule[100].interest)).toBe(true);
    });
  });
});

describe('getYearlyLoanSummary', () => {
  it('should aggregate 240 months into 20 years', () => {
    const schedule = generateAmortizationSchedule(
      new Decimal('200000'),
      new Decimal('0.035'),
      new Decimal('0.0035'),
      240,
      'AMORTISSABLE',
    );
    const yearly = getYearlyLoanSummary(schedule);
    expect(yearly).toHaveLength(20);
    expect(yearly[19].remainingPrincipal.toNumber()).toBe(0);
  });
});
