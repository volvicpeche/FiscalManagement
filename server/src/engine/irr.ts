import Decimal from 'decimal.js';

/**
 * Internal rate of return of a series of yearly cash flows.
 *
 * The rate that makes the net present value zero — what the operation yields
 * per year once every euro in and out is accounted for at the moment it moves.
 * It is what makes a property comparable to a financial investment: a 4 % IRR
 * on twenty years of effort is worse than a life-insurance fund.
 *
 * Solved by bisection rather than Newton-Raphson: it cannot diverge, and a
 * cash-flow series with an unusual shape only costs a few more iterations.
 */

const MAX_ITERATIONS = 200;
/**
 * Convergence is measured on the rate interval, not on the NPV.
 *
 * A euro-denominated NPV threshold would make precision depend on the size of
 * the cash flows: the same threshold that is strict on a 1 000 EUR series stops
 * far too early on a 10 M EUR one.
 */
const RATE_TOLERANCE = new Decimal('1e-12');
const RATE_MIN = new Decimal('-0.9999');
const RATE_MAX = new Decimal('10');

/** Net present value of `flows` (index = year, 0 = today) at a given rate. */
export function netPresentValue(flows: Decimal[], rate: Decimal): Decimal {
  const onePlusRate = rate.plus(1);
  return flows.reduce(
    (acc, flow, year) => acc.plus(flow.div(onePlusRate.pow(year))),
    new Decimal(0),
  );
}

/**
 * Returns the IRR, or null when the series has none.
 *
 * A series that never changes sign has no rate that zeroes it: money that only
 * ever goes out, or only ever comes in, has no return to speak of. Reporting
 * null there is honest; reporting 0 would read as "breaks even".
 */
export function computeIRR(flows: Decimal[]): Decimal | null {
  if (flows.length < 2) return null;

  const hasPositive = flows.some((f) => f.gt(0));
  const hasNegative = flows.some((f) => f.lt(0));
  if (!hasPositive || !hasNegative) return null;

  let low = RATE_MIN;
  let high = RATE_MAX;
  let npvLow = netPresentValue(flows, low);
  let npvHigh = netPresentValue(flows, high);

  // Bisection needs the root to be bracketed.
  if (npvLow.isZero()) return low;
  if (npvHigh.isZero()) return high;
  if (npvLow.gt(0) === npvHigh.gt(0)) return null;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const mid = low.plus(high).div(2);
    const npvMid = netPresentValue(flows, mid);

    if (npvMid.isZero() || high.minus(low).lt(RATE_TOLERANCE)) return mid;

    if (npvMid.gt(0) === npvLow.gt(0)) {
      low = mid;
      npvLow = npvMid;
    } else {
      high = mid;
      npvHigh = npvMid;
    }
  }

  return low.plus(high).div(2);
}
