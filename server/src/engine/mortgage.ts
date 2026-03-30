import Decimal from 'decimal.js';
import type { LoanType } from '@shared/schemas.js';

export interface AmortizationRow {
  month: number;
  payment: Decimal;
  principalRepayment: Decimal;
  interest: Decimal;
  insurance: Decimal;
  remainingPrincipal: Decimal;
}

/**
 * Generates a full amortization schedule for a mortgage.
 *
 * @param principal - Loan amount
 * @param annualRate - Nominal annual interest rate (e.g., 0.035 for 3.5%)
 * @param annualInsuranceRate - Annual insurance rate on initial capital (e.g., 0.0035)
 * @param months - Loan duration in months
 * @param type - AMORTISSABLE (constant payment) or INFINE (interest-only, balloon)
 */
export function generateAmortizationSchedule(
  principal: Decimal,
  annualRate: Decimal,
  annualInsuranceRate: Decimal,
  months: number,
  type: LoanType,
): AmortizationRow[] {
  const monthlyRate = annualRate.div(12);
  const monthlyInsurance = principal.mul(annualInsuranceRate).div(12);
  const schedule: AmortizationRow[] = [];

  if (type === 'AMORTISSABLE') {
    // Constant payment: P * r / (1 - (1 + r)^-n)
    const monthlyPayment = monthlyRate.isZero()
      ? principal.div(months)
      : principal.mul(monthlyRate).div(
          new Decimal(1).minus(monthlyRate.plus(1).pow(-months)),
        );

    let remaining = principal;

    for (let m = 1; m <= months; m++) {
      const interest = remaining.mul(monthlyRate);
      const principalRepayment = monthlyPayment.minus(interest);
      remaining = remaining.minus(principalRepayment);

      // Clamp to zero on final month to avoid floating point dust
      if (m === months) remaining = new Decimal(0);

      schedule.push({
        month: m,
        payment: monthlyPayment.plus(monthlyInsurance),
        principalRepayment,
        interest,
        insurance: monthlyInsurance,
        remainingPrincipal: remaining,
      });
    }
  } else {
    // IN FINE: interest + insurance each month, principal repaid at end
    const interest = principal.mul(monthlyRate);

    for (let m = 1; m <= months; m++) {
      const isLastMonth = m === months;
      const principalRepayment = isLastMonth ? principal : new Decimal(0);
      const remaining = isLastMonth ? new Decimal(0) : principal;

      schedule.push({
        month: m,
        payment: interest.plus(monthlyInsurance).plus(principalRepayment),
        principalRepayment,
        interest,
        insurance: monthlyInsurance,
        remainingPrincipal: remaining,
      });
    }
  }

  return schedule;
}

/**
 * Returns yearly aggregates from an amortization schedule.
 * Useful for the 30-year simulation loop.
 */
export function getYearlyLoanSummary(schedule: AmortizationRow[]) {
  const years: {
    year: number;
    totalPayment: Decimal;
    totalInterest: Decimal;
    totalInsurance: Decimal;
    totalPrincipal: Decimal;
    remainingPrincipal: Decimal;
  }[] = [];

  for (let y = 0; y * 12 < schedule.length; y++) {
    const yearRows = schedule.slice(y * 12, (y + 1) * 12);
    if (yearRows.length === 0) break;

    years.push({
      year: y + 1,
      totalPayment: yearRows.reduce((s, r) => s.plus(r.payment), new Decimal(0)),
      totalInterest: yearRows.reduce((s, r) => s.plus(r.interest), new Decimal(0)),
      totalInsurance: yearRows.reduce((s, r) => s.plus(r.insurance), new Decimal(0)),
      totalPrincipal: yearRows.reduce((s, r) => s.plus(r.principalRepayment), new Decimal(0)),
      remainingPrincipal: yearRows[yearRows.length - 1].remainingPrincipal,
    });
  }

  return years;
}
