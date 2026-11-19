import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RUN_LINES,
  RUN_BAND,
  RUN_PROFILES,
  estimateRunMs,
  exploreHouse,
  lineMs,
  proveMaze,
  type SemanticEvent,
} from '@marrow/skeleton';
import { MABEL, ROOM_STYLES, WHISPERS } from '../src/content';
import { createSeanceKit } from '../src/kit';
import {
  CATCHES_KEY,
  CATCH_LIMIT,
  HOUSE_SIZES,
  RELIC_COUNT,
  RUN_KEY,
  STANDARD_SIZE,
  caughtEndCaption,
  caughtEndLine,
  readCatchesEnd,
  readRunCounter,
  runFacts,
  serveHouse,
  type RunEnd,
  type Skipped,
} from '../src/runs';

const end = (over: Partial<RunEnd> = {}): RunEnd => ({ how: 'caught', relicsFound: 2, relicsTotal: 3, rooms: 14, ms: 372_000, catches: 3, ...over });

describe('every run is a new house, proven before it is served', () => {
  it('serves a house that passes 201 to 207, and logs the houses it skipped', () => {
    const skips: Skipped[] = [];
    const served = serveHouse(1, STANDARD_SIZE, (s) => skips.push(s))!;
    expect(served).not.toBeNull();
    expect(served.lengthProven).toBe(true);
    expect(served.maze.relics).toHaveLength(RELIC_COUNT);
    expect(served.maze.width).toBe(HOUSE_SIZES.medium.width);
    expect(served.skipped).toEqual(skips);
    expect(served.seed).toBe(1 + skips.length); // every seed before it was skipped, in order
    const results = proveMaze(served.maze, `House ${served.seed}`, { runLength: true });
    expect(results.map((r) => r.id)).toEqual([201, 202, 203, 204, 205, 206, 207]);
    expect(results.every((r) => r.pass)).toBe(true);
  });

  it('a house that fails is skipped, never served, and the skip says why', () => {
    const skips: Skipped[] = [];
    let counter = 1;
    for (let run = 0; run < 10; run++) {
      const served = serveHouse(counter, STANDARD_SIZE, (s) => skips.push(s))!;
      expect(skips.some((s) => s.seed === served.seed)).toBe(false);
      counter = served.seed + 1;
    }
    expect(skips.length).toBeGreaterThan(0);
    for (const s of skips) expect(s.reason).toMatch(/^(207 Run length fits: House \d+: at |20[1-6] |Could not)/);
  });

  it('the next run is the next house: serving from the saved counter never repeats a house', () => {
    const seen = new Set<number>();
    let counter = 1;
    for (let run = 0; run < 12; run++) {
      const served = serveHouse(counter, STANDARD_SIZE)!;
      expect(seen.has(served.seed)).toBe(false);
      seen.add(served.seed);
      counter = served.seed + 1;
    }
    expect(seen.size).toBe(12);
  });

  it('every house served is 5 to 8 minutes at every speed and dwell, by the explorer', () => {
    let counter = 1;
    for (let run = 0; run < 25; run++) {
      const served = serveHouse(counter, STANDARD_SIZE)!;
      counter = served.seed + 1;
      for (const p of RUN_PROFILES) {
        const ms = estimateRunMs(served.maze, p);
        expect(ms, `house ${served.seed} ${p.speed}/${p.dwellMs}`).toBeGreaterThanOrEqual(RUN_BAND.minMs);
        expect(ms, `house ${served.seed} ${p.speed}/${p.dwellMs}`).toBeLessThanOrEqual(RUN_BAND.maxMs);
      }
    }
  });

  it('the small and large houses are the player\'s choice of a shorter or longer run: still proven safe, not held to 5 to 8 minutes', () => {
    for (const size of ['small', 'large'] as const) {
      const served = serveHouse(1, size)!;
      expect(served.lengthProven).toBe(false);
      expect(proveMaze(served.maze).every((r) => r.pass)).toBe(true);
    }
    const small = exploreHouse(serveHouse(1, 'small')!.maze, { speed: 'medium', dwellMs: 2200 }).ms;
    const large = exploreHouse(serveHouse(1, 'large')!.maze, { speed: 'medium', dwellMs: 2200 }).ms;
    expect(small).toBeLessThan(RUN_BAND.minMs);
    expect(large).toBeGreaterThan(RUN_BAND.maxMs);
  });

  it('the estimate uses the game\'s own words: the default lines are within a quarter of the real lines', () => {
    const kit = createSeanceKit();
    const said = (event: SemanticEvent): string =>
      kit
        .render(event)
        .filter((c) => c.channel === 'speech')
        .map((c) => ('text' in c ? c.text : ''))
        .join(' ');
    const near = (actual: number, expected: number): void => {
      expect(actual / expected, `${actual} vs ${expected}`).toBeGreaterThan(0.75);
      expect(actual / expected, `${actual} vs ${expected}`).toBeLessThan(1.25);
    };
    near(lineMs(said({ type: 'intro', at: 0, data: { line: MABEL.intro } })), DEFAULT_RUN_LINES.intro);
    // A first visit: the name, plus Mabel's word on a kind of room (about a third of rooms) and a whisper (five rooms in a house of about twenty-five).
    const names = Object.values(ROOM_STYLES).map((s) => lineMs(`The ${s.name}.`));
    const meanName = names.reduce((a, b) => a + b, 0) / names.length;
    const asides = Object.values(MABEL.rooms).map((l) => lineMs(`Mabel: ${l}`));
    const meanAside = asides.reduce((a, b) => a + b, 0) / asides.length;
    const meanWhisper = WHISPERS.map((w) => lineMs(`A whisper: ${w}`)).reduce((a, b) => a + b, 0) / WHISPERS.length;
    near(meanName + 0.33 * meanAside + 0.2 * meanWhisper, DEFAULT_RUN_LINES.roomFirst);
    near(meanName, DEFAULT_RUN_LINES.roomAgain);
    near(lineMs(said({ type: 'walk-relic', at: 0, data: { line: MABEL.relic('The Silver Candle', 1, 3), relic: 'The Silver Candle', found: 1, total: 3 } })), DEFAULT_RUN_LINES.relic);
    near(lineMs(said({ type: 'walk-ritual', at: 0, data: { line: MABEL.ritual } })), DEFAULT_RUN_LINES.ritual);
    near(lineMs(said({ type: 'walk-sealed', at: 0, data: { line: MABEL.sealed(2), left: 2 } })), DEFAULT_RUN_LINES.sealed);
  });
});

describe('three catches end a run, told gently', () => {
  it('the limit is three', () => {
    expect(CATCH_LIMIT).toBe(3);
  });

  it('says the house lets you go, with the relics, and never says game over', () => {
    const line = caughtEndLine(end());
    expect(line).toMatch(/^The house lets you go\. You found 2 of 3 relics\./);
    expect(line).toMatch(/14 rooms in 6 minutes 12 seconds/);
    expect(line).toMatch(/caught 3 times/);
    expect(line).toMatch(/Press any key to enter a new house/);
    for (const text of [line, caughtEndCaption(end()), MABEL.lastCatch]) expect(text).not.toMatch(/game over|you lose|you died|failed/i);
  });

  it('is told by sound, caption and speech, so two senses at least', () => {
    const cmds = createSeanceKit().render({ type: 'run-end', at: 0, data: { line: caughtEndLine(end()), caption: caughtEndCaption(end()) } });
    expect(cmds.some((c) => c.channel === 'sound')).toBe(true);
    expect(cmds.some((c) => c.channel === 'captions')).toBe(true);
    expect(cmds.some((c) => c.channel === 'speech')).toBe(true);
  });

  it('the escape summary has the facts too, and also points to the next house', () => {
    const cmds = createSeanceKit().render({
      type: 'summary',
      at: 0,
      data: { facts: runFacts(end({ how: 'escaped', relicsFound: 3, catches: 1 })), time: '6 minutes', rank: 'A', score: 900, catches: 1, whispers: 2, whisperTotal: 5 },
    });
    const spoken = cmds.filter((c) => c.channel === 'speech').map((c) => ('text' in c ? c.text : '')).join(' ');
    expect(spoken).toMatch(/You found 3 of 3 relics\./);
    expect(spoken).toMatch(/caught once/);
    expect(spoken).toMatch(/enter a new house/);
  });

  it('every event, the new ones too, reaches two senses', () => {
    expect(createSeanceKit().proveEvents().counterexamples ?? []).toEqual([]);
  });
});

describe('saved choices', () => {
  const store = (values: Record<string, string>) => (key: string): string | null => values[key] ?? null;

  it('the run counter starts at 1 and ignores nonsense', () => {
    expect(readRunCounter(store({}))).toBe(1);
    expect(readRunCounter(store({ [RUN_KEY]: '41' }))).toBe(41);
    for (const bad of ['', 'x', '0', '-3', 'NaN']) expect(readRunCounter(store({ [RUN_KEY]: bad }))).toBe(1);
  });

  it('catches end a run unless the player turned it off', () => {
    expect(readCatchesEnd(store({}))).toBe(true);
    expect(readCatchesEnd(store({ [CATCHES_KEY]: 'on' }))).toBe(true);
    expect(readCatchesEnd(store({ [CATCHES_KEY]: 'off' }))).toBe(false);
  });

  it('a page that cannot save still works: the saved value is simply not there', () => {
    const broken = (): string | null => null;
    expect(readRunCounter(broken)).toBe(1);
    expect(readCatchesEnd(broken)).toBe(true);
  });
});
