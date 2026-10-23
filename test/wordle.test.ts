import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { matchGuess } from '../src/wordle';

// Recitation Part 1: follow along with your TA, filling in the todos below.
// Problem set Task 1: keep adding properties until `npm run mutants:wordle`
// kills every mutant. Read the spec in src/wordle/matchGuess.ts.
//
// Label every property with its pattern, on the line above its `it(`:
//   // Pattern: invariant. The result always has exactly five colors.
// (invariant, algebraic, metamorphic, differential, or conditional)

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Step 1: a generator for five-letter uppercase words.
const wordFrom = (letters: string) =>
  fc.array(fc.constantFrom(...letters), { minLength: 5, maxLength: 5 }).map(cs => cs.join(''));
// Step 4 switches this from wordFrom(ALPHABET) to a tiny alphabet, so repeated
// letters show up in almost every pair.
//const word = wordFrom(ALPHABET);
const word = wordFrom('ABC');

// A small alphabet hides bugs that depend on which letters appear (e.g. code
// that only handles A-C, or treats all letters alike). Properties that don't
// need duplicates draw from both alphabets.
const anyWord = fc.oneof(wordFrom('ABC'), wordFrom(ALPHABET));

describe('matchGuess', () => {
  // Step 2: two invariants.

  // Pattern: invariant. The result always has exactly five colors.
  it('returns exactly five colors', () => {
    fc.assert(
      fc.property(word, word, (secret, guess) => {
        expect(matchGuess(secret, guess)).toHaveLength(5);
      }),
    );
  });

  // Pattern: invariant. Every color is G, Y, or B.
  it('only uses the colors G, Y, B', () => {
    fc.assert(
      fc.property(word, word, (secret, guess) => {
        for (const c of matchGuess(secret, guess)) expect(['G', 'Y', 'B']).toContain(c);
      }),
    );
  });

  // Step 3: a conditional property.

  // Pattern: conditional. If the guess is the secret, every color is green.
  it('guessing the secret gives all greens', () => {
    fc.assert(
      fc.property(word, w => {
        expect(matchGuess(w, w)).toEqual(['G', 'G', 'G', 'G', 'G']);
      }),
    );
  });

  // Pattern: invariant. A letter is never credited (G or Y) more times than the
  // secret contains it.
  it('never credits a letter more times than the secret contains it', () => {
    fc.assert(
      fc.property(word, word, (secret, guess) => {
        const result = matchGuess(secret, guess);
        for (const letter of new Set(guess)) {
          const credited = [...guess].filter((c, i) => c === letter && result[i] !== 'B').length;
          const inSecret = [...secret].filter(c => c === letter).length;
          expect(credited).toBeLessThanOrEqual(inSecret);
        }
      }),
    );
  });

  // Problem set Task 1.

  // Pattern: invariant. Position i is green exactly when guess[i] === secret[i].
  it('greens are exactly the positions where the letters match', () => {
    fc.assert(
      fc.property(word, word, (secret, guess) => {
        const result = matchGuess(secret, guess);
        for (let i = 0; i < 5; i++) expect(result[i] === 'G').toBe(guess[i] === secret[i]);
      }),
    );
  });

  // Pattern: invariant. Each letter is credited (G or Y) exactly
  // min(times in secret, times in guess) times, and its yellows go to its
  // leftmost non-green positions.
  it('credits each letter as often as possible, yellows left to right', () => {
    fc.assert(
      fc.property(word, word, (secret, guess) => {
        const result = matchGuess(secret, guess);
        for (const letter of new Set(guess)) {
          const inSecret = count(secret, letter);
          const inGuess = count(guess, letter);
          const greens = [...guess].filter((c, i) => c === letter && result[i] === 'G').length;
          const notGreen = [0, 1, 2, 3, 4].filter(i => guess[i] === letter && result[i] !== 'G');
          const yellows = Math.min(inSecret, inGuess) - greens;
          notGreen.forEach((i, k) => expect(result[i]).toBe(k < yellows ? 'Y' : 'B'));
        }
      }),
    );
  });

  // Pattern: conditional. If the guess is an anagram of the secret, no color
  // is black. Uses a targeted generator: the guess is built by shuffling the
  // secret, not by generating words and filtering.
  it('an anagram of the secret has no blacks', () => {
    const secretAndAnagram = anyWord.chain(secret =>
      fc
        .shuffledSubarray([...secret], { minLength: 5, maxLength: 5 })
        .map(cs => [secret, cs.join('')] as const),
    );
    fc.assert(
      fc.property(secretAndAnagram, ([secret, guess]) => {
        expect(matchGuess(secret, guess)).not.toContain('B');
      }),
    );
  });

  // Pattern: conditional. If the guess shares no letters with the secret,
  // every color is black. Uses a targeted generator: the alphabet is split in
  // two and each word draws from its own half.
  it('a guess sharing no letters with the secret is all black', () => {
    const disjointPair = fc
      .shuffledSubarray([...ALPHABET], { minLength: 26, maxLength: 26 })
      .chain(letters =>
        fc.tuple(wordFrom(letters.slice(0, 13).join('')), wordFrom(letters.slice(13).join(''))),
      );
    fc.assert(
      fc.property(disjointPair, ([secret, guess]) => {
        expect(matchGuess(secret, guess)).toEqual(['B', 'B', 'B', 'B', 'B']);
      }),
    );
  });

  // Pattern: metamorphic. Renaming letters consistently in both words (any
  // one-to-one relabeling of the alphabet) does not change the colors.
  it('consistently renaming letters does not change the result', () => {
    const relabel = fc
      .shuffledSubarray([...ALPHABET], { minLength: 26, maxLength: 26 })
      .map(perm => (w: string) => [...w].map(c => perm[ALPHABET.indexOf(c)]).join(''));
    fc.assert(
      fc.property(anyWord, anyWord, relabel, (secret, guess, f) => {
        expect(matchGuess(f(secret), f(guess))).toEqual(matchGuess(secret, guess));
      }),
    );
  });

  // Pattern: metamorphic. Swapping secret and guess keeps the greens in the
  // same places and the same number of credited (non-black) letters.
  it('swapping secret and guess keeps greens and the credited count', () => {
    fc.assert(
      fc.property(anyWord, anyWord, (secret, guess) => {
        const a = matchGuess(secret, guess);
        const b = matchGuess(guess, secret);
        expect(b.map(c => c === 'G')).toEqual(a.map(c => c === 'G'));
        expect(b.filter(c => c !== 'B').length).toBe(a.filter(c => c !== 'B').length);
      }),
    );
  });

  // Pattern: conditional. Inputs that are not five uppercase letters throw a
  // RangeError.
  it('rejects words that are not five uppercase letters', () => {
    const bad = fc.oneof(
      fc.string({ maxLength: 4 }),
      fc.string({ minLength: 6, maxLength: 8 }),
      anyWord.map(w => w.toLowerCase()),
      anyWord.chain(w => fc.nat(4).map(i => w.slice(0, i) + '1' + w.slice(i + 1))),
    );
    fc.assert(
      fc.property(anyWord, bad, (good, b) => {
        expect(() => matchGuess(good, b)).toThrow(RangeError);
        expect(() => matchGuess(b, good)).toThrow(RangeError);
      }),
    );
  });
});

function count(w: string, letter: string): number {
  return [...w].filter(c => c === letter).length;
}
