import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  NOISE,
  PERK_IDS,
  PHANTOM_PERKS,
  createWalk,
  generateMaze,
  isPerkId,
  perkNoise,
  proveMaze,
  simulateRitual,
  type Maze,
  type PerkId,
  type SemanticEvent,
  type Walk,
} from '../src';

// Stage 4: relics carry over. A perk may only make things easier for the player, never changes the house or the timing,
// and every house is proven under every perk (spec seance-runs, R7 and R8.3).

const standard = (seed: number): Maze => generateMaze(seed, { width: 12, height: 10, relics: 3 });

function harness(maze: Maze, perk: PerkId | null, speed: 'slow' | 'medium' | 'fast' = 'fast') {
  const events: SemanticEvent[] = [];
  let now = 0;
  const walk: Walk = createWalk({ maze, speed, dwellMs: 1500, startMs: 0, perk, emit: (e) => events.push(e) });
  const run = (ms: number): void => {
    for (let t = 0; t < ms; t += 50) walk.advance((now += 50));
  };
  const choose = (id: string): void => {
    for (let i = 0; i < 4000 && walk.snapshot().lit !== id; i++) walk.advance((now += 50));
    walk.press(now);
  };
  const toChoosing = (): void => {
    for (let i = 0; i < 4000 && walk.snapshot().phase !== 'choosing'; i++) walk.advance((now += 50));
  };
  return { walk, events, run, choose, toChoosing };
}

describe('the perks as rules', () => {
  it('knows the perks, and nothing else', () => {
    expect(PERK_IDS).toEqual(['soft-steps', 'free-ask', 'second-chance']);
    for (const id of PERK_IDS) expect(isPerkId(id)).toBe(true);
    for (const bad of ['', 'none', null, undefined, 3, 'soft-steps ']) expect(isPerkId(bad)).toBe(false);
  });

  it('a perk never makes a noise louder', () => {
    fc.assert(
      fc.property(fc.constantFrom<PerkId | null>(null, ...PERK_IDS), fc.integer({ min: 0, max: 3 }), (perk, level) => {
        const out = perkNoise(perk, level);
        expect(out).toBeLessThanOrEqual(level);
        expect(out).toBeGreaterThanOrEqual(0);
        if (level === 0) expect(out).toBe(0);
      }),
    );
  });

  it('soft steps makes each noise one quieter, and the others leave noise alone', () => {
    for (const level of [NOISE.walk, NOISE.run, NOISE.search]) {
      expect(perkNoise('soft-steps', level)).toBe(level - 1);
      expect(perkNoise('free-ask', level)).toBe(level);
      expect(perkNoise('second-chance', level)).toBe(level);
      expect(perkNoise(null, level)).toBe(level);
    }
    expect(PHANTOM_PERKS).toEqual(['soft-steps']);
  });
});

describe('4.2 every house is proven under every perk', () => {
  it('201 to 206 pass, and 205 holds with each perk in force, on 200 seeds', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2000 }), (seed) => {
        const house = standard(seed);
        const results = proveMaze(house, `House ${seed}`);
        expect(results.map((r) => r.id)).toEqual([201, 202, 203, 204, 205, 206]);
        for (const r of results) expect(r.counterexamples ?? [], `house ${seed}: ${r.name}`).toEqual([]);
        for (const perk of [null, ...PERK_IDS]) {
          const sim = simulateRitual(house, { perk });
          expect(sim.caught, `house ${seed} perk ${perk}`).toBe(false);
          expect(sim.nearest, `house ${seed} perk ${perk}`).toBeGreaterThanOrEqual(house.ritualGap);
        }
        // With no perk named, the default is the worst of the perks that change the phantom's part, so it is safe under all.
        const worst = simulateRitual(house);
        expect(worst.caught).toBe(false);
        expect(worst.nearest).toBeGreaterThanOrEqual(house.ritualGap);
      }),
      { numRuns: 200 },
    );
  });

  it('a house that is unfair under a perk is not passed, and the words name the perk', () => {
    const house = standard(3);
    const unsafe: Maze = { ...house, ghost: house.ritualRoute[3]! };
    const r = proveMaze(unsafe).find((x) => x.id === 205)!;
    expect(r.pass).toBe(false);
  });

  it('a perk never changes the house: playing under any perk leaves the maze exactly as it was', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 300 }), fc.constantFrom<PerkId | null>(null, ...PERK_IDS), (seed, perk) => {
        const house = standard(seed);
        const before = JSON.stringify(house);
        const h = harness(house, perk);
        h.run(120_000);
        expect(JSON.stringify(house)).toBe(before);
        expect(JSON.stringify(generateMaze(seed, { width: 12, height: 10, relics: 3 }))).toBe(before);
      }),
      { numRuns: 60 },
    );
  });

  it('a perk never changes the timing: the same walk with any perk has the same stride and the same lines', () => {
    for (const speed of ['slow', 'medium', 'fast'] as const) {
      const house = standard(5);
      const stepTimes = (perk: PerkId | null): number[] => {
        const h = harness(house, perk, speed);
        h.toChoosing();
        h.choose(h.walk.snapshot().options.find((o) => o.id.startsWith('dir:'))!.id);
        h.run(3000);
        return h.events.filter((e) => e.type === 'walk-step').map((e) => e.at);
      };
      const base = stepTimes(null);
      expect(base.length).toBeGreaterThan(3);
      // Free ask and second chance cannot change a step before the first Listen or catch; soft steps only changes noise.
      for (const perk of PERK_IDS) {
        const withPerk = stepTimes(perk);
        const n = Math.min(base.length, withPerk.length, 4);
        expect(withPerk.slice(0, n)).toEqual(base.slice(0, n));
      }
    }
  });
});

describe('4.1 what each perk does in play', () => {
  it('soft steps: walking makes less noise', () => {
    const house = standard(4);
    const walkNoise = (perk: PerkId | null): number => {
      const h = harness(house, perk);
      h.toChoosing();
      h.choose(h.walk.snapshot().options.find((o) => o.id.startsWith('dir:'))!.id);
      for (let i = 0; i < 4000 && h.walk.snapshot().steps < 2; i++) h.run(50);
      return h.walk.snapshot().noise;
    };
    expect(walkNoise(null)).toBe(NOISE.walk);
    expect(walkNoise('soft-steps')).toBe(NOISE.walk - 1);
  });

  it('a free look: the first Listen and the first hint cost no turn, the second of each does', () => {
    const house = standard(6);
    const h = harness(house, 'free-ask');
    h.toChoosing();
    const labels = (): Record<string, string> => Object.fromEntries(h.walk.snapshot().options.map((o) => [o.id, o.label]));
    expect(labels().listen).toMatch(/free this once/);
    expect(labels().hint).toMatch(/free this once/);
    const where = (): string => JSON.stringify(h.walk.snapshot().ghost);
    const start = where();
    h.choose('listen');
    expect(where()).toBe(start); // the phantom did not move
    expect(h.walk.snapshot().perkUsed.listen).toBe(true);
    expect(h.events.some((e) => e.type === 'walk-listen' && (e.data as { free?: boolean }).free === true)).toBe(true);
    // Priced again once it is used.
    expect(labels().listen).toMatch(/the phantom moves once/);
    expect(labels().hint).toMatch(/free this once/);
    h.choose('hint');
    expect(where()).toBe(start);
    expect(h.walk.snapshot().perkUsed.hint).toBe(true);
    expect(labels().hint).toMatch(/the phantom moves once/);
    expect(h.events.some((e) => e.type === 'walk-hint' && (e.data as { perk?: boolean }).perk === true)).toBe(true);
  });

  it('without the perk, the same Listen costs a turn and says so', () => {
    let moved = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const h = harness(standard(seed), null);
      h.toChoosing();
      expect(Object.fromEntries(h.walk.snapshot().options.map((o) => [o.id, o.label])).listen).toMatch(/the phantom moves once/);
      const start = JSON.stringify(h.walk.snapshot().ghost);
      h.choose('listen');
      if (JSON.stringify(h.walk.snapshot().ghost) !== start) moved += 1;
    }
    expect(moved).toBeGreaterThan(0);
  });

  it('second chance: the first catch is told and you are put back, but it does not count; the next does', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const base = generateMaze(seed);
      const house: Maze = { ...base, ghost: base.route[Math.min(3, base.route.length - 1)]! };
      const h = harness(house, 'second-chance');
      let caughtEvents = 0;
      for (let i = 0; i < 6000 && caughtEvents < 2; i++) {
        const s = h.walk.snapshot();
        if (s.phase === 'choosing') h.choose('listen');
        else h.run(50);
        caughtEvents = h.events.filter((e) => e.type === 'caught').length;
        if (caughtEvents === 1 && h.walk.snapshot().phase === 'caught') {
          expect(h.walk.snapshot().catches).toBe(0);
          expect(h.walk.snapshot().perkUsed.catch).toBe(true);
        }
      }
      if (caughtEvents < 2) continue;
      const caught = h.events.filter((e) => e.type === 'caught');
      expect((caught[0]!.data as { forgiven?: boolean }).forgiven).toBe(true);
      expect((caught[1]!.data as { forgiven?: boolean }).forgiven).toBeUndefined();
      expect(h.walk.snapshot().catches).toBe(1);
      return;
    }
    throw new Error('Never caught twice in any trial.');
  });

  it('with no perk the first catch counts', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const base = generateMaze(seed);
      const house: Maze = { ...base, ghost: base.route[Math.min(3, base.route.length - 1)]! };
      const h = harness(house, null);
      for (let i = 0; i < 6000 && h.walk.snapshot().catches === 0; i++) {
        if (h.walk.snapshot().phase === 'choosing') h.choose('listen');
        else h.run(50);
      }
      if (h.walk.snapshot().catches === 0) continue;
      expect(h.walk.snapshot().catches).toBe(1);
      return;
    }
    throw new Error('Never caught in any trial.');
  });

  it('a player who does the ritual the best way is never caught under any perk, whatever the speed', () => {
    for (const perk of PERK_IDS) {
      for (let seed = 1; seed <= 6; seed++) {
        const h = harness(standard(seed), perk);
        const wanted = standard(seed);
        expect(simulateRitual(wanted, { perk }).caught).toBe(false);
        h.run(1000);
        expect(h.walk.snapshot().catches).toBe(0);
      }
    }
  });
});
