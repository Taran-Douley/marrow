import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EVENT_TYPES } from '../src/channels';
import { createKit, type Kit } from '../src/kit';
import { takeoffWindow, toRealSeconds, windowMs, type Level } from '../src/level';
import type { Attempt } from '../src/log';
import type { Run } from '../src/run';
import type { SemanticEvent, Speed } from '../src/types';
import { seedArb } from './helpers/arbitraries';

function makeKit(): Kit {
  const kit = createKit();
  kit.defineObstacle('grave', { width: [0.16, 0.3] });
  kit.defineObstacle('fence', { width: [0.12, 0.24] });
  return kit;
}

interface Harness {
  run: Run;
  level: Level;
  kit: Kit;
  emitted: { event: SemanticEvent; now: number }[];
  attempts: Attempt[];
  restarts: number[];
  /** Real clock, ms. */
  clock: number;
  /** Step the real clock forward by ms, advancing the run each 5 ms. */
  tick(ms: number): void;
  /** Step until running time reaches t (or the run stops playing). */
  until(t: number): void;
  press(): void;
  /** Real ms per running second. */
  msPerRunning: number;
}

function harness(seed: number, speed: Speed = 'slow', opts: { picture?: boolean } = {}): Harness {
  const kit = makeKit();
  const level = kit.generate(seed);
  const emitted: Harness['emitted'] = [];
  const attempts: Attempt[] = [];
  const restarts: number[] = [];
  const h = { clock: 1000 } as Harness;
  const run = kit.run({
    level,
    speed,
    picture: opts.picture ?? true,
    startReal: h.clock,
    emit: (event, now) => emitted.push({ event, now }),
    onAttempt: (a) => attempts.push(a),
    onRestart: (t) => restarts.push(t),
  });
  Object.assign(h, {
    run,
    level,
    kit,
    emitted,
    attempts,
    restarts,
    msPerRunning: 1000 / kit.timing.rates[speed],
    tick(ms: number) {
      for (let spent = 0; spent < ms; spent += 5) {
        h.clock += 5;
        run.advance(h.clock);
      }
    },
    until(t: number) {
      let guard = 0;
      while (run.snapshot().t < t && run.snapshot().phase === 'play' && guard++ < 100000) h.tick(5);
    },
    press() {
      run.press(h.clock);
    },
  });
  return h;
}

/** Play every obstacle with a press at the given offset (running s) from the fourth beat. */
function playAll(h: Harness, offsetFromBeat: number): void {
  const { timing } = h.kit;
  let guard = 0;
  while (h.run.snapshot().phase === 'play' && guard++ < 200000) {
    const i = h.run.snapshot().obstacle;
    const o = h.level.obstacles[i]!;
    const { a, b } = takeoffWindow(o, timing);
    h.until((a + b) / 2 + offsetFromBeat);
    h.press();
    h.tick(5);
  }
}

const types = (h: Harness) => h.emitted.map((e) => e.event.type);

describe('the run (Req 12)', () => {
  it('(PBT) a perfect player clears every obstacle of every level and finishes', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const h = harness(seed, 'slow');
        playAll(h, 0);
        expect(h.run.snapshot().phase).toBe('done');
        expect(h.attempts).toHaveLength(12);
        expect(h.attempts.every((a) => a.result === 'cleared')).toBe(true);
        expect(types(h).filter((t) => t === EVENT_TYPES.cleared)).toHaveLength(12);
        expect(types(h).filter((t) => t === EVENT_TYPES.levelComplete)).toHaveLength(1);
        expect(types(h).filter((t) => t === EVENT_TYPES.fallReason)).toHaveLength(0);
      }),
      { numRuns: 30 },
    );
  });

  it('(PBT) the same holds at every speed, within a few ms of the beat', () => {
    for (const speed of ['slow', 'medium', 'fast'] as const) {
      const h = harness(3, speed);
      playAll(h, 0);
      expect(h.run.snapshot().phase).toBe('done');
      expect(h.attempts.every((a) => a.result === 'cleared' && Math.abs(a.offsetMs!) < 30)).toBe(true);
    }
  });

  it('emits the countdown events in time order and never more than the lookahead early', () => {
    const h = harness(5);
    playAll(h, 0);
    const countdown = h.emitted.filter((e) => e.event.type === EVENT_TYPES.beat);
    expect(countdown).toHaveLength(48);
    for (const { event, now } of countdown) {
      expect(now).toBeGreaterThanOrEqual(event.at - 0.25 - 1e-9);
    }
    const ats = countdown.map((e) => e.event.at);
    expect(ats).toEqual([...ats].sort((x, y) => x - y));
  });

  it('records offset from the fourth beat in real ms, and the window', () => {
    const h = harness(2, 'slow');
    playAll(h, 0.1); // 0.1 running s late = 166.7 ms at Slow
    const first = h.attempts[0]!;
    expect(first.result).toBe('cleared');
    expect(first.offsetMs).toBeGreaterThan(160);
    expect(first.offsetMs).toBeLessThan(175);
    expect(first.windowMs).toBeCloseTo(windowMs(h.level.obstacles[0]!, 'slow'), 6);
    expect(first.picture).toBe(true);
    expect(first.level).toBe(2);
    expect(first.obstacle).toBe(1);
  });

  it('logs picture off when the player is playing by sound', () => {
    const h = harness(2, 'slow', { picture: false });
    playAll(h, 0);
    expect(h.attempts.every((a) => a.picture === false)).toBe(true);
  });
});

describe('gentle failure (Req 12.1-12.3)', () => {
  it('a press that is too early falls with "early", then rests, then restarts before that obstacle', () => {
    const h = harness(4);
    const o = h.level.obstacles[0]!;
    const { a } = takeoffWindow(o, h.kit.timing);
    h.until(a - 0.3);
    h.press();

    expect(h.run.snapshot().phase).toBe('recover');
    expect(h.attempts).toMatchObject([{ result: 'early', obstacle: 1 }]);
    const fall = h.emitted.find((e) => e.event.type === EVENT_TYPES.fallReason)!;
    expect(fall.event.data).toMatchObject({ reason: 'early', index: 0 });

    h.tick(1900);
    expect(h.run.snapshot().phase).toBe('recover'); // still resting: 2 s pause
    h.tick(200);
    expect(h.run.snapshot().phase).toBe('play');
    expect(h.restarts).toHaveLength(1);
    expect(h.run.snapshot().obstacle).toBe(0);
    expect(h.restarts[0]!).toBeLessThan(a); // before the obstacle
  });

  it('a press just after the window closes falls with "late"', () => {
    const h = harness(4);
    const { b } = takeoffWindow(h.level.obstacles[0]!, h.kit.timing);
    h.until(b + 0.2);
    h.press();
    expect(h.attempts).toMatchObject([{ result: 'late' }]);
    expect(h.emitted.find((e) => e.event.type === EVENT_TYPES.fallReason)!.event.data).toMatchObject({ reason: 'late' });
  });

  it('no press at all falls with "none", once the grace is over', () => {
    const h = harness(4);
    const { b } = takeoffWindow(h.level.obstacles[0]!, h.kit.timing);
    h.until(b + 0.3);
    expect(h.run.snapshot().phase).toBe('play'); // still within the 0.6 s grace
    h.until(b + 0.7);
    expect(h.run.snapshot().phase).toBe('recover');
    expect(h.attempts).toMatchObject([{ result: 'none', offsetMs: null }]);
  });

  it('a press before the countdown is a harmless hop, not a fall', () => {
    const h = harness(4);
    h.until(1);
    h.press();
    expect(h.attempts).toEqual([]);
    expect(h.run.snapshot().phase).toBe('play');
    expect(types(h)).not.toContain(EVENT_TYPES.fallReason);
  });

  it('only the first press of a jump counts: one press, one jump', () => {
    const h = harness(4);
    const { a, b } = takeoffWindow(h.level.obstacles[0]!, h.kit.timing);
    h.until((a + b) / 2);
    h.press();
    h.tick(100);
    h.press();
    h.press();
    expect(h.attempts).toHaveLength(1);
    expect(h.attempts[0]!.result).toBe('cleared');
  });

  it('ignores presses while resting after a fall', () => {
    const h = harness(4);
    const { a } = takeoffWindow(h.level.obstacles[0]!, h.kit.timing);
    h.until(a - 0.3);
    h.press();
    h.tick(300);
    h.press();
    expect(h.attempts).toHaveLength(1);
  });

  it('after a fall at obstacle 4 it never replays the earlier obstacles', () => {
    const h = harness(6);
    // Clear the first three perfectly.
    const { timing } = h.kit;
    for (let i = 0; i < 3; i++) {
      const { a, b } = takeoffWindow(h.level.obstacles[i]!, timing);
      h.until((a + b) / 2);
      h.press();
      h.tick(5);
    }
    // Fall on the fourth by not pressing.
    const { b } = takeoffWindow(h.level.obstacles[3]!, timing);
    h.until(b + 0.7);
    expect(h.attempts.at(-1)).toMatchObject({ result: 'none', obstacle: 4 });
    const before = h.emitted.length;
    h.tick(5000); // 2 s rest, then play until the countdown for obstacle 4 starts again
    // The wind and pad carry no obstacle; every countdown event after the restart is for obstacle 4.
    const after = h.emitted
      .slice(before)
      .map((e) => e.event)
      .filter((e) => e.type !== EVENT_TYPES.atmosphere);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((e) => (e.data as { index?: number } | undefined)?.index === 3)).toBe(true);
    expect(h.run.snapshot().obstacle).toBe(3);
  });

  it('can always be finished after falling: fall once, then play perfectly', () => {
    const h = harness(9);
    const { a } = takeoffWindow(h.level.obstacles[0]!, h.kit.timing);
    h.until(a - 0.3);
    h.press(); // early fall
    h.tick(2100);
    playAll(h, 0);
    expect(h.run.snapshot().phase).toBe('done');
    expect(h.attempts.map((x) => x.result).slice(0, 2)).toEqual(['early', 'cleared']);
  });
});

describe('run settings are the developer\'s to change', () => {
  it('uses your own pause and restart lead', () => {
    const kit = createKit({ run: { fallPause: 0.5, restartLead: 0.3 } });
    kit.defineObstacle('grave', { width: [0.16, 0.3] });
    const level = kit.generate(1);
    const restarts: number[] = [];
    let clock = 0;
    const run = kit.run({ level, speed: 'slow', startReal: 0, emit: () => undefined, onRestart: (t) => restarts.push(t) });
    const { b } = takeoffWindow(level.obstacles[0]!, kit.timing);
    // Wait for the fall. The clock stops once play stops, so wait on the phase, not on time.
    let guard = 0;
    while (run.snapshot().phase === 'play' && guard++ < 100000) run.advance((clock += 5));
    expect(run.snapshot().t).toBeGreaterThan(b);
    expect(run.snapshot().phase).toBe('recover');
    const fellAt = clock;
    while (run.snapshot().phase === 'recover') run.advance((clock += 5));
    expect(clock - fellAt).toBeGreaterThanOrEqual(500);
    expect(clock - fellAt).toBeLessThan(520);
    expect(restarts).toHaveLength(1);
  });

  it('a level with no obstacles is complete at once', () => {
    const kit = createKit();
    const emitted: string[] = [];
    const run = kit.run({
      level: { seed: 1, obstacles: [] },
      speed: 'slow',
      startReal: 0,
      emit: (e) => emitted.push(e.type),
    });
    expect(run.snapshot().phase).toBe('done');
    expect(emitted).toEqual([EVENT_TYPES.levelComplete]);
  });

  it('real time maps to running time through the speed', () => {
    const h = harness(1, 'medium');
    h.tick(1000);
    expect(h.run.snapshot().t).toBeCloseTo(toRealSeconds(1, 'medium', h.kit.timing) ** -1, 2);
  });
});
