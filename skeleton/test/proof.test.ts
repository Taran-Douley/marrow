import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { M, T, generateLevel, type Level, type Obstacle } from '../src/level';
import { LevelRefused, prove, refuseIfFailing } from '../src/proof';
import type { ObjectSource } from '../src/proof';
import { createRegistry, type Registry } from '../src/registry';
import { seedArb } from './helpers/arbitraries';

const N = 200; // Requirement 13.5

function graveyard(): Registry {
  const reg = createRegistry();
  reg.define('grave', { width: [0.16, 0.3] });
  reg.define('fence', { width: [0.12, 0.24] });
  return reg;
}

const byId = (results: ReturnType<typeof prove>, id: number) => results.find((r) => r.id === id)!;

/** A hand-built level for checking that a property can fail. */
function levelOf(seed: number, obstacles: Pick<Obstacle, 'kind' | 'start' | 'width'>[]): Level {
  return { seed, obstacles: obstacles.map((o, index) => ({ index, ...o })) };
}

describe('the six properties hold for every generated level (Req 13.1, 13.5)', () => {
  const reg = graveyard();
  const check = (id: number) =>
    fc.assert(
      fc.property(seedArb, (seed) => {
        const level = generateLevel(seed, { kinds: reg.kinds() });
        const r = byId(prove(level, { objects: reg }), id);
        expect(r.counterexample).toBeUndefined();
        expect(r.pass).toBe(true);
      }),
      { numRuns: N },
    );

  it('(PBT) 1 Jumpable', () => check(1));
  it('(PBT) 2 Reachable', () => check(2));
  it('(PBT) 3 Unambiguous cues', () => check(3));
  it('(PBT) 4 Multisensory', () => check(4));
  it('(PBT) 5 Window floor', () => check(5));
  it('(PBT) 6 Fourth beat clears', () => check(6));

  it('(PBT) refuseIfFailing returns the same level when everything passes', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const level = generateLevel(seed, { kinds: reg.kinds() });
        expect(refuseIfFailing(level, { objects: reg })).toBe(level);
      }),
      { numRuns: N },
    );
  });
});

describe('the broken-crypt demo (Req 8.8, 8.9)', () => {
  const reg = graveyard();
  reg.define('crypt', { width: [0.9, 1.0] });

  /** Level 17 with obstacle 4 swapped for a crypt 1.00 s wide. */
  function brokenLevel(): Level {
    const level = generateLevel(17, { kinds: graveyard().kinds() });
    const obstacles = level.obstacles.map((o) => (o.index === 3 ? { ...o, kind: 'crypt', width: 1.0 } : o));
    return { ...level, obstacles };
  }

  it('fails Jumpable with the plain-English counterexample', () => {
    const r = byId(prove(brokenLevel(), { objects: reg }), 1);
    expect(r.pass).toBe(false);
    expect(r.counterexample).toBe(
      'Level 17, obstacle 4 (crypt, 1.00 s wide): no take-off point clears it. One jump covers only 0.73 s.',
    );
  });

  it('also fails Fourth beat clears and the window floor', () => {
    const results = prove(brokenLevel(), { objects: reg });
    expect(byId(results, 6).pass).toBe(false);
    expect(byId(results, 5).pass).toBe(false);
    expect(byId(results, 6).counterexample).toMatch(/misses the take-off window/);
  });

  it('refuses to serve the level and carries the reason', () => {
    expect(() => refuseIfFailing(brokenLevel(), { objects: reg })).toThrow(LevelRefused);
    try {
      refuseIfFailing(brokenLevel(), { objects: reg });
    } catch (e) {
      const refused = e as LevelRefused;
      expect(refused.failures.length).toBeGreaterThanOrEqual(3);
      expect(refused.message).toContain('no take-off point clears it');
    }
  });

  it('turns green once the width is fixed', () => {
    const fixed = graveyard();
    fixed.define('crypt', { width: [0.2, 0.3] });
    const level = generateLevel(17, { kinds: fixed.kinds() });
    expect(() => refuseIfFailing(level, { objects: fixed })).not.toThrow();
  });

  it('uses a custom label when given', () => {
    const r = byId(prove(brokenLevel(), { objects: reg, label: 'Level 17 (Slow)' }), 1);
    expect(r.counterexample).toMatch(/^Level 17 \(Slow\), obstacle 4/);
  });
});

describe('Jumpable is exactly "width <= T - 2M" (the boundary)', () => {
  const reg = graveyard();
  it('(PBT) passes below the limit and fails above it', () => {
    const limit = T - 2 * M; // 0.73
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 150 }).map((n) => n / 100), (width) => {
        fc.pre(Math.abs(width - limit) > 1e-6);
        const level = levelOf(1, [{ kind: 'grave', start: 10, width }]);
        expect(byId(prove(level, { objects: reg }), 1).pass).toBe(width < limit);
      }),
    );
  });
});

describe('each property can actually fail', () => {
  const reg = graveyard();

  it('2 Reachable: next window closes before the player lands', () => {
    const level = levelOf(5, [
      { kind: 'grave', start: 10, width: 0.2 },
      { kind: 'fence', start: 10.25, width: 0.12 },
    ]);
    const r = byId(prove(level, { objects: reg }), 2);
    expect(r.pass).toBe(false);
    expect(r.counterexample).toMatch(/^Level 5, obstacle 2 \(fence\): after the earliest possible jump over obstacle 1, the player lands at/);
  });

  it('3 Unambiguous cues: countdown starts too soon after landing', () => {
    const level = levelOf(6, [
      { kind: 'grave', start: 10, width: 0.2 },
      { kind: 'fence', start: 12, width: 0.2 }, // gap 1.8 s, below the 2.3 s rule
    ]);
    const r = byId(prove(level, { objects: reg }), 3);
    expect(r.pass).toBe(false);
    expect(r.counterexample).toMatch(/the countdown starts .* the player lands from the jump over obstacle 1\. It needs at least 0\.25 s\./);
  });

  it('4 Multisensory: an object with no caption, and an undefined object type', () => {
    const noCaption: ObjectSource = {
      get: (n) => (n === 'grave' ? { name: 'grave', say: 'grave', sound: { hz: 294, wave: 'triangle' } } : undefined),
      names: () => ['grave'],
    };
    const level = levelOf(7, [
      { kind: 'grave', start: 10, width: 0.2 },
      { kind: 'ghoul', start: 13, width: 0.2 },
    ]);
    const r = byId(prove(level, { objects: noCaption }), 4);
    expect(r.pass).toBe(false);
    expect(r.failures).toBe(2);
    expect(r.counterexample).toBe("Level 7: object type 'grave' has no caption.");
  });

  it('5 Window floor: jumpable, but too tight at Slow and Fast', () => {
    const level = levelOf(8, [{ kind: 'grave', start: 10, width: 0.35 }]);
    const results = prove(level, { objects: reg });
    expect(byId(results, 1).pass).toBe(true);
    const r = byId(results, 5);
    expect(r.pass).toBe(false);
    expect(r.failures).toBe(2);
    expect(r.counterexample).toBe(
      'Level 8, obstacle 1 (grave, 0.35 s wide): the take-off window is only 633 ms at Slow. The floor is 650 ms.',
    );
  });

  it('6 Fourth beat clears: fails when the window is empty', () => {
    const level = levelOf(9, [{ kind: 'grave', start: 10, width: 0.9 }]);
    expect(byId(prove(level, { objects: reg }), 6).pass).toBe(false);
  });

  it('does not report an empty first window as unreachable too', () => {
    const level = levelOf(10, [{ kind: 'grave', start: 10, width: 0.9 }]);
    expect(byId(prove(level, { objects: reg }), 2).pass).toBe(true);
  });
});

describe('prove() output shape', () => {
  it('returns the six properties in order, with ids matching tech.md', () => {
    const reg = graveyard();
    const results = prove(generateLevel(1, { kinds: reg.kinds() }), { objects: reg });
    expect(results.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(results.map((r) => r.name)).toEqual([
      'Jumpable',
      'Reachable',
      'Unambiguous cues',
      'Multisensory',
      'Window floor',
      'Fourth beat clears',
    ]);
    expect(results.every((r) => r.pass && r.failures === 0)).toBe(true);
  });
});
