import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PERK_IDS, RUN_PROFILES, estimateRunMs, proveMaze, proveRunLength, simulateRitual, RUN_BAND } from '@marrow/skeleton';
import { RELICS } from '../src/content';
import {
  PERK_KEY,
  PERK_START_MS,
  PERK_TABLE,
  perkChoiceIntro,
  perkChosen,
  perkOffer,
  perkOptionLabel,
  perkStartLine,
  perksFor,
  readPerk,
  wordsFor,
} from '../src/perks';
import { PERK_RUN_LINES, caughtEndLine, serveHouse } from '../src/runs';

// Stage 4 in the game: which relic gives which perk, how it is said, saved and applied, and the proof of every served house.

describe('4.1 relics give perks', () => {
  it('every perk has exactly one relic, every relic one perk, and each is said in plain words', () => {
    expect(PERK_TABLE.map((p) => p.id)).toEqual([...PERK_IDS]);
    expect(PERK_TABLE.map((p) => p.relic)).toEqual(RELICS.map((_, i) => i));
    PERK_TABLE.forEach((p) => {
      expect(p.relicName).toBe(RELICS[p.relic]!.name);
      expect(p.does.length).toBeGreaterThan(20);
      expect(perkOptionLabel(p)).toContain(p.name);
      expect(perkOptionLabel(p)).toContain(p.does);
    });
  });

  it('the perks offered come from the relics found', () => {
    expect(perksFor([])).toEqual([]);
    expect(perksFor([1]).map((p) => p.id)).toEqual(['free-ask']);
    expect(perksFor([2, 0]).map((p) => p.id)).toEqual(['soft-steps', 'second-chance']);
    expect(perksFor([0, 1, 2])).toHaveLength(3);
  });

  it('with no relics there is no perk, said gently', () => {
    const none = perkOffer(0);
    expect(none).toMatch(/no relics/i);
    expect(none).not.toMatch(/game over|failed|lose/i);
    expect(perkOffer(1)).toMatch(/choose a perk/);
    expect(perkOffer(3)).toMatch(/3 relics/);
  });

  it('the run end says a perk is coming, and keeps its one-press next run', () => {
    const end = { how: 'caught' as const, relicsFound: 2, relicsTotal: 3, rooms: 10, ms: 300_000, catches: 3 };
    expect(caughtEndLine(end)).toMatch(/choose a perk/);
    expect(caughtEndLine(end)).toMatch(/Press any key to enter a new house/);
    expect(caughtEndLine({ ...end, relicsFound: 0 })).toMatch(/no relics/i);
  });

  it('the choice and the result are told in words, with no time limit mentioned as a rush', () => {
    expect(perkChoiceIntro(2)).toMatch(/as long as you like/);
    expect(perkChosen(wordsFor('soft-steps'))).toMatch(/next house only/);
    expect(perkChosen(null)).toMatch(/No perk/);
    for (const id of PERK_IDS) expect(perkStartLine(id)).toContain(wordsFor(id).name);
    expect(PERK_START_MS).toBeGreaterThan(0);
    expect(PERK_START_MS).toBeLessThan(12_000);
  });

  it('the saved perk is read safely: only a real perk, and anything else is none', () => {
    const store = (value: string | null) => (key: string) => (key === PERK_KEY ? value : null);
    for (const id of PERK_IDS) expect(readPerk(store(id))).toBe(id);
    for (const bad of [null, '', 'none', 'soft-steps2', '{}']) expect(readPerk(store(bad))).toBeNull();
    expect(readPerk(() => null)).toBeNull();
  });
});

describe('4.2 every served house is proven under every perk, speed and dwell', () => {
  it('201 to 207 pass, 205 holds with each perk, and the run fits 5 to 8 minutes with and without the perk line said (60 served houses, 9 profiles)', () => {
    let seed = 1;
    for (let n = 0; n < 60; n++) {
      const served = serveHouse(seed, 'medium');
      expect(served, `from seed ${seed}`).not.toBeNull();
      const house = served!.maze;
      seed = served!.seed + 1;
      const results = proveMaze(house, `House ${served!.seed}`, { runLength: true });
      expect(results.map((r) => r.id)).toEqual([201, 202, 203, 204, 205, 206, 207]);
      for (const r of results) expect(r.pass, `house ${served!.seed}: ${r.name} ${r.counterexample ?? ''}`).toBe(true);
      expect(proveRunLength(house, '', PERK_RUN_LINES).pass, `house ${served!.seed} with a perk line`).toBe(true);
      for (const perk of [null, ...PERK_IDS]) {
        const sim = simulateRitual(house, { perk });
        expect(sim.caught, `house ${served!.seed} perk ${perk}`).toBe(false);
        expect(sim.nearest, `house ${served!.seed} perk ${perk}`).toBeGreaterThanOrEqual(house.ritualGap);
      }
      for (const profile of RUN_PROFILES) {
        const ms = estimateRunMs(house, profile, PERK_RUN_LINES.lines);
        expect(ms, `house ${served!.seed} ${profile.speed} ${profile.dwellMs}`).toBeGreaterThanOrEqual(RUN_BAND.minMs);
        expect(ms, `house ${served!.seed} ${profile.speed} ${profile.dwellMs}`).toBeLessThanOrEqual(RUN_BAND.maxMs);
      }
    }
  });

  it('on 200 seeds, every served house is the same house whatever perk is chosen: serving takes no perk', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5000 }), (first) => {
        const a = serveHouse(first, 'medium');
        const b = serveHouse(first, 'medium');
        expect(a).not.toBeNull();
        expect(JSON.stringify(a!.maze)).toBe(JSON.stringify(b!.maze));
        for (const perk of PERK_IDS) expect(simulateRitual(a!.maze, { perk }).caught).toBe(false);
      }),
      { numRuns: 200 },
    );
  }, 600_000);
});
