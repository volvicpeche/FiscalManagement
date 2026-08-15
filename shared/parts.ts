/**
 * Splitting the parts sociales of an SCI.
 *
 * A dead-even split leaves nobody able to carry a vote, so the default
 * distribution always leaves one associe with the largest share:
 *
 *   2 associes -> 51 / 49
 *   3 associes -> 34 / 33 / 33
 *   4 associes -> 26 / 25 / 25 / 24
 *
 * Whole percentage points are used so the numbers stay readable in the form;
 * they always add up to exactly 100 %.
 */

/**
 * Returns the share of each associe as a fraction of 1, in declaration order.
 * `majorityIndex` designates who gets the largest share.
 */
export function distributeParts(count: number, majorityIndex = 0): number[] {
  if (count <= 0) return [];
  if (count === 1) return [1];

  const major = Math.min(Math.max(majorityIndex, 0), count - 1);
  const base = Math.floor(100 / count);
  const points = new Array<number>(count).fill(base);

  // Whatever does not divide evenly goes to the majority holder.
  points[major] += 100 - base * count;

  // An exact split (2, 4, 5, 10 associes...) leaves nobody in charge:
  // shave a point off the last of the others.
  const isStrictlyLargest = points.every((p, i) => i === major || p < points[major]);
  if (!isStrictlyLargest) {
    const donor = major === count - 1 ? count - 2 : count - 1;
    points[donor] -= 1;
    points[major] += 1;
  }

  return points.map((p) => p / 100);
}

/** Applies `distributeParts` to a list, keeping every other field untouched. */
export function redistributeParts<T extends { partsPercent: number }>(
  associes: T[],
  majorityIndex = 0,
): T[] {
  const parts = distributeParts(associes.length, majorityIndex);
  return associes.map((a, i) => ({ ...a, partsPercent: parts[i] }));
}
