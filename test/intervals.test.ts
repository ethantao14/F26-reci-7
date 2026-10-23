import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mergeIntervals, type Interval } from '../src/intervals';

// Recitation Part 2 (groups) and problem set Task 2.
// Read the spec in src/intervals/mergeIntervals.ts, then check your progress
// with `npm run mutants:intervals`.
//
// Label every property with its pattern, on the line above its `it(`:
//   // Pattern: invariant. The output is sorted.
// (invariant, algebraic, metamorphic, differential, or conditional)

// Valid by construction: pick a start and a non-negative length, so
// start <= end always holds. The range is small on purpose, so intervals
// often overlap, touch exactly (end === next start), or sit one apart.
const interval: fc.Arbitrary<Interval> = fc
  .tuple(fc.integer({ min: -20, max: 20 }), fc.nat(8))
  .map(([start, len]): Interval => [start, start + len]);
const intervalList = fc.array(interval, { maxLength: 8 });

// Targeted generator for already-disjoint input: walk left to right, leaving a
// gap of at least 1 between one interval's end and the next start (so they
// neither overlap nor touch), then shuffle the result.
const disjointSorted: fc.Arbitrary<Interval[]> = fc
  .tuple(
    fc.integer({ min: -20, max: 20 }),
    fc.array(fc.tuple(fc.integer({ min: 1, max: 4 }), fc.nat(4)), { maxLength: 6 }),
  )
  .map(([first, steps]) => {
    const out: Interval[] = [];
    let next = first;
    for (const [gap, len] of steps) {
      out.push([next, next + len]);
      next += len + gap;
    }
    return out;
  });

// Small helper oracle: is real point p inside some interval of xs?
const covers = (xs: readonly Interval[], p: number) => xs.some(([s, e]) => s <= p && p <= e);

const copy = (xs: readonly Interval[]): Interval[] => xs.map(([s, e]): Interval => [s, e]);

const shuffled = <T>(xs: T[]) =>
  fc.shuffledSubarray(xs, { minLength: xs.length, maxLength: xs.length });

describe('mergeIntervals', () => {
  // Pattern: invariant. Every input interval lies inside some output interval.
  it('every input interval lies inside some output interval', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        const uncovered = xs.filter(([s, e]) => !out.some(([a, b]) => a <= s && e <= b));
        expect(uncovered).toEqual([]);
      }),
    );
  });

  // Pattern: invariant. The output is valid, sorted by start, and consecutive
  // intervals neither overlap nor touch: out[i][1] < out[i + 1][0].
  it('returns sorted intervals that neither overlap nor touch', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        for (const [s, e] of out) expect(s).toBeLessThanOrEqual(e);
        for (let i = 0; i + 1 < out.length; i++) expect(out[i][1]).toBeLessThan(out[i + 1][0]);
      }),
    );
  });

  // Pattern: differential. Input and output cover exactly the same points,
  // checked with a tiny "is p covered?" oracle at every integer and
  // half-integer in range (half-integers catch gaps like 2 < x < 3).
  it('covers exactly the same points as the input', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        for (let p = -22; p <= 30; p += 0.5) expect(covers(out, p)).toBe(covers(xs, p));
      }),
    );
  });

  // Pattern: invariant. The input array and its intervals are not modified.
  it('does not modify its input', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const before = copy(xs);
        mergeIntervals(xs);
        expect(xs).toEqual(before);
      }),
    );
  });

  // Pattern: metamorphic. Shuffling the input (and adding duplicates) does not
  // change the output.
  it('ignores input order and duplicates', () => {
    const listAndVariant = intervalList.chain(xs =>
      fc
        .subarray(xs)
        .chain(extra => shuffled([...copy(xs), ...copy(extra)]))
        .map(variant => [xs, variant] as const),
    );
    fc.assert(
      fc.property(listAndVariant, ([xs, variant]) => {
        expect(mergeIntervals(variant)).toEqual(mergeIntervals(xs));
      }),
    );
  });

  // Pattern: algebraic. Merging is idempotent: merge(merge(xs)) = merge(xs).
  it('merging an already-merged list changes nothing', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const once = mergeIntervals(xs);
        expect(mergeIntervals(copy(once))).toEqual(once);
      }),
    );
  });

  // Pattern: algebraic. Merging two lists separately and then merging the
  // results equals merging their concatenation.
  it('merge(merge(a) ++ merge(b)) = merge(a ++ b)', () => {
    fc.assert(
      fc.property(intervalList, intervalList, (a, b) => {
        const parts = [...mergeIntervals(copy(a)), ...mergeIntervals(copy(b))];
        expect(mergeIntervals(parts)).toEqual(mergeIntervals([...a, ...b]));
      }),
    );
  });

  // Pattern: conditional. If the input intervals already neither overlap nor
  // touch, the output is the same intervals, sorted. Uses the targeted
  // generator disjointSorted, then shuffles it.
  it('leaves already-disjoint input unchanged apart from sorting', () => {
    const input = disjointSorted.chain(sorted =>
      shuffled(copy(sorted)).map(xs => [sorted, xs] as const),
    );
    fc.assert(
      fc.property(input, ([sorted, xs]) => {
        expect(mergeIntervals(xs)).toEqual(sorted);
      }),
    );
  });

  // Pattern: conditional. If two intervals touch at exactly one point, they
  // merge into one. Targeted generator: the second starts where the first ends.
  it('merges intervals that touch at an endpoint', () => {
    const touching = fc
      .tuple(fc.integer({ min: -20, max: 20 }), fc.nat(5), fc.nat(5))
      .map(([s, l1, l2]): [Interval, Interval] => [[s, s + l1], [s + l1, s + l1 + l2]]);
    fc.assert(
      fc.property(touching, fc.boolean(), ([a, b], flip) => {
        expect(mergeIntervals(flip ? [b, a] : [a, b])).toEqual([[a[0], b[1]]]);
      }),
    );
  });

  // Pattern: conditional. An interval with start > end, or a non-integer
  // endpoint, makes it throw a RangeError.
  it('rejects invalid intervals', () => {
    const bad: fc.Arbitrary<Interval> = fc.oneof(
      fc
        .tuple(fc.integer({ min: -20, max: 20 }), fc.integer({ min: 1, max: 5 }))
        .map(([s, d]): Interval => [s, s - d]),
      fc.integer({ min: -20, max: 20 }).map((s): Interval => [s + 0.5, s + 2]),
      fc.integer({ min: -20, max: 20 }).map((s): Interval => [s, s + 1.5]),
      fc.constantFrom<Interval>([0, NaN], [0, Infinity]),
    );
    fc.assert(
      fc.property(intervalList, bad, fc.nat(8), (xs, b, i) => {
        const input = [...xs];
        input.splice(i % (xs.length + 1), 0, b);
        expect(() => mergeIntervals(input)).toThrow(RangeError);
      }),
    );
  });

  // Example tests from the spec (don't count as properties).
  it('matches the examples in the spec', () => {
    expect(mergeIntervals([])).toEqual([]);
    expect(mergeIntervals([[1, 3], [3, 5]])).toEqual([[1, 5]]);
    expect(mergeIntervals([[1, 2], [3, 4]])).toEqual([[1, 2], [3, 4]]);
  });
});
