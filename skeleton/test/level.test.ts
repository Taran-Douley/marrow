import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  BEAT,
  DEFAULT_KINDS,
  FIRST_START,
  GAP,
  M,
  OBSTACLES_PER_LEVEL,
  T,
  cueTimes,
  generateLevel,
  idealPress,
  mulberry32,
  takeoffWindow,
  windowMs,
} from '../src/level';
import { seedArb } from './helpers/arbitraries';

const EPS = 1e-9;
const N = 200; // Requirement 13.5: at least 200 generated levels

describe('mulberry32', () => {
  it('(PBT) stays in [0, 1) and repeats for the same seed', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const a = mulberry32(seed);
        const b = mulberry32(seed);
        for (let i = 0; i < 50; i++) {
          const x = a();
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(1);
          expect(b()).toBe(x);
        }
      }),
      { numRuns: N },
    );
  });
});

describe('generateLevel (Req 7)', () => {
  it('(PBT) the same seed gives an identical level (7.2)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        expect(generateLevel(seed)).toEqual(generateLevel(seed));
      }),
      { numRuns: N },
    );
  });

  it('(PBT) places the first obstacle at the start time and makes 12 (7.3)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const level = generateLevel(seed);
        expect(level.obstacles).toHaveLength(OBSTACLES_PER_LEVEL);
        expect(level.obstacles[0]!.start).toBe(FIRST_START);
      }),
      { numRuns: N },
    );
  });

  it('(PBT) spaces obstacles by a gap inside the GAP range (7.4)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const { obstacles } = generateLevel(seed);
        for (let i = 1; i < obstacles.length; i++) {
          const prev = obstacles[i - 1]!;
          const gap = obstacles[i]!.start - (prev.start + prev.width);
          expect(gap).toBeGreaterThanOrEqual(GAP[0] - EPS);
          expect(gap).toBeLessThanOrEqual(GAP[1] + EPS);
        }
      }),
      { numRuns: N },
    );
  });

  it('(PBT) draws each width from its kind range (7.5)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        for (const o of generateLevel(seed).obstacles) {
          const kind = DEFAULT_KINDS.find((k) => k.name === o.kind)!;
          expect(o.width).toBeGreaterThanOrEqual(kind.width[0] - EPS);
          expect(o.width).toBeLessThanOrEqual(kind.width[1] + EPS);
        }
      }),
      { numRuns: N },
    );
  });

  it('uses both default kinds across many seeds', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      for (const o of generateLevel(seed).obstacles) seen.add(o.kind);
    }
    expect([...seen].sort()).toEqual(['fence', 'grave']);
  });

  it('accepts custom kinds and counts, and rejects an empty kind list', () => {
    const level = generateLevel(1, { kinds: [{ name: 'crypt', width: [0.4, 0.5] }], count: 3 });
    expect(level.obstacles.map((o) => o.kind)).toEqual(['crypt', 'crypt', 'crypt']);
    expect(() => generateLevel(1, { kinds: [] })).toThrow();
  });
});

describe('timing model (tech.md)', () => {
  it('window and ideal press follow the formulas', () => {
    const o = { start: 10, width: 0.2 };
    const w = takeoffWindow(o);
    expect(w.a).toBeCloseTo(10 + 0.2 + M - T, 12);
    expect(w.b).toBeCloseTo(10 - M, 12);
    expect(idealPress(o)).toBeCloseTo((w.a + w.b) / 2, 12);
  });

  it('beeps fall at J-3, J-2 and J-1 beats', () => {
    const o = { start: 10, width: 0.2 };
    const j = idealPress(o);
    const [c1, c2, c3] = cueTimes(o);
    expect(c1).toBeCloseTo(j - 3 * BEAT, 12);
    expect(c2).toBeCloseTo(j - 2 * BEAT, 12);
    expect(c3).toBeCloseTo(j - BEAT, 12);
  });

  it('matches the prototype minimum windows: 717 ms Slow, 538 ms Medium, 430 ms Fast', () => {
    // Widest grave is 0.30 s: window = T - d - 2M = 0.43 running seconds.
    const widest = { start: 10, width: 0.3 };
    expect(windowMs(widest, 'slow')).toBeCloseTo(716.67, 1);
    expect(windowMs(widest, 'medium')).toBeCloseTo(537.5, 1);
    expect(windowMs(widest, 'fast')).toBeCloseTo(430, 1);
  });

  it('a crypt 1.00 s wide has no take-off point (the demo counterexample)', () => {
    const w = takeoffWindow({ start: 10, width: 1.0 });
    expect(w.b).toBeLessThan(w.a);
    // One jump covers T - 2M running seconds.
    expect(T - 2 * M).toBeCloseTo(0.73, 12);
  });
});
