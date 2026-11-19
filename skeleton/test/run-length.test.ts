import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  RUN_BAND,
  RUN_DWELLS,
  RUN_PROFILES,
  RUN_SPEEDS,
  estimateRunMs,
  exploreHouse,
  generateMaze,
  proveMaze,
  proveRunLength,
  runLengthWords,
  type Maze,
} from '../src';

// Property 207, "Run length fits": a clean run of a house takes 5 to 8 minutes at every speed and
// every scanning dwell. The explorer is a headless player who does not know the house.

/** The standard house of Séance Escape: 12 by 10 rooms, three relics. */
const standard = (seed: number): Maze => generateMaze(seed, { width: 12, height: 10, relics: 3 });
const SEEDS = 240;

describe('the explorer', () => {
  it('finds every relic, reaches the exit and counts a real length', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const house = standard(seed);
      const run = exploreHouse(house, { speed: 'medium', dwellMs: 2200 });
      expect(run.relicsFound, `house ${seed}`).toBe(3);
      expect(run.steps).toBeGreaterThanOrEqual(house.route.length - 1);
      expect(run.ms).toBeGreaterThan(60_000);
      expect(run.ms).toBe(run.parts.walking + run.parts.speaking + run.parts.choosing);
    }
  });

  it('the same house gives the same length every time', () => {
    const house = standard(5);
    expect(exploreHouse(house, { speed: 'slow', dwellMs: 4000 })).toEqual(exploreHouse(house, { speed: 'slow', dwellMs: 4000 }));
  });

  it('counts time by speed (strides) and by dwell (reading the ways out), and never changes the route', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 400 }), (seed) => {
        const house = standard(seed);
        const slow = exploreHouse(house, { speed: 'slow', dwellMs: 2200 });
        const medium = exploreHouse(house, { speed: 'medium', dwellMs: 2200 });
        const fast = exploreHouse(house, { speed: 'fast', dwellMs: 2200 });
        // Speed changes timing only: the same steps, the same rooms.
        expect(medium.steps).toBe(slow.steps);
        expect(fast.steps).toBe(slow.steps);
        expect(fast.stops).toBe(slow.stops);
        expect(slow.ms).toBeGreaterThan(medium.ms);
        expect(medium.ms).toBeGreaterThan(fast.ms);
        // A longer dwell is never quicker.
        const quick = exploreHouse(house, { speed: 'medium', dwellMs: 1500 });
        const slowDwell = exploreHouse(house, { speed: 'medium', dwellMs: 4000 });
        expect(slowDwell.ms).toBeGreaterThanOrEqual(medium.ms);
        expect(medium.ms).toBeGreaterThanOrEqual(quick.ms);
        expect(slowDwell.steps).toBe(quick.steps);
      }),
      { numRuns: 200 },
    );
  });

  it('longer spoken lines make a longer run', () => {
    const house = standard(7);
    const short = estimateRunMs(house, { speed: 'medium', dwellMs: 2200 }, { roomFirst: 1000 });
    const long = estimateRunMs(house, { speed: 'medium', dwellMs: 2200 }, { roomFirst: 6000 });
    expect(long).toBeGreaterThan(short);
  });
});

describe('207 Run length fits', () => {
  it('is only asked for when wanted: the first six properties stand alone', () => {
    expect(proveMaze(standard(2)).map((r) => r.id)).toEqual([201, 202, 203, 204, 205, 206]);
    expect(proveMaze(standard(2), 'House 2', { runLength: true }).map((r) => r.id)).toEqual([201, 202, 203, 204, 205, 206, 207]);
  });

  it('judges every speed and every dwell: 9 profiles, from 1500 to 4000 ms', () => {
    expect(RUN_SPEEDS).toEqual(['slow', 'medium', 'fast']);
    expect(RUN_DWELLS).toEqual([1500, 2200, 4000]);
    expect(RUN_PROFILES).toHaveLength(9);
    expect(RUN_BAND).toEqual({ minMs: 300_000, maxMs: 480_000 });
  });

  it('refuses a house that is too short, and says which profile and how long', () => {
    const small = generateMaze(3, { width: 8, height: 8, relics: 3 });
    const r = proveRunLength(small, 'House 3');
    expect(r.id).toBe(207);
    expect(r.pass).toBe(false);
    expect(r.counterexamples!.length).toBeGreaterThan(0);
    expect(r.counterexample).toMatch(/House 3: at (slow|medium|fast) speed with a (1500|2200|4000) ms dwell a clean run takes about .+ minutes?/);
    expect(r.counterexample).toMatch(/A run must take 5 minutes to 8 minutes/);
  });

  it('refuses a house that is too long', () => {
    const big = generateMaze(3, { width: 16, height: 16, relics: 3 });
    expect(proveRunLength(big, 'House 3').pass).toBe(false);
  });

  it('takes the game\'s own band, profiles and words', () => {
    const house = standard(4);
    const wide = proveRunLength(house, 'House 4', { band: { minMs: 60_000, maxMs: 1_800_000 } });
    expect(wide.pass).toBe(true);
    const one = proveRunLength(house, 'House 4', { band: { minMs: 1, maxMs: 2 }, profiles: [{ speed: 'fast', dwellMs: 1500 }] });
    expect(one.counterexamples).toHaveLength(1);
  });

  it('over many seeds: it passes exactly when every profile is inside 5 to 8 minutes, and a house it passes also passes 201 to 206', () => {
    let passed = 0;
    let tried = 0;
    fc.assert(
      fc.property(fc.integer({ min: 1, max: SEEDS }), (seed) => {
        const house = standard(seed);
        const results = proveMaze(house, `House ${seed}`, { runLength: true });
        const length = results.find((r) => r.id === 207)!;
        const inside = RUN_PROFILES.every((p) => {
          const ms = estimateRunMs(house, p);
          return ms >= RUN_BAND.minMs && ms <= RUN_BAND.maxMs;
        });
        expect(length.pass).toBe(inside);
        tried += 1;
        if (length.pass) {
          passed += 1;
          for (const r of results) expect(r.pass, `${seed}: ${r.name}`).toBe(true);
        }
      }),
      { numRuns: SEEDS },
    );
    // Some houses fit and most do not: the game skips the ones that do not.
    expect(tried).toBe(SEEDS);
    expect(passed).toBeGreaterThan(SEEDS / 20);
    expect(passed).toBeLessThan(SEEDS);
  });

  it('says a length in words', () => {
    expect(runLengthWords(300_000)).toBe('5 minutes');
    expect(runLengthWords(375_000)).toBe('6 minutes 15 seconds');
    expect(runLengthWords(45_000)).toBe('45 seconds');
    expect(runLengthWords(60_000)).toBe('1 minute');
  });
});
