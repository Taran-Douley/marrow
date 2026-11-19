import { describe, expect, it } from 'vitest';
import { createKit } from '../src/kit';
import { cueTimes, idealPress, resolveTiming, type Level } from '../src/level';
import { lockedToTheSong, pulsesGentle, retryDelays, retryInTime } from '../src/proof';
import { MAX_PULSES_PER_SECOND, PULSE_MAX_ALPHA, pulseAt, pulsesPerSecond } from '../src/pulse';
import { resolveRunSettings, wordsHoldMs } from '../src/run';
import type { Song } from '../src/song';

const song: Song = {
  name: 'Test',
  sections: [
    { name: 'Intro', bars: 2, feel: 'rest' },
    { name: 'Verse', bars: 8, feel: 'busy' },
  ],
};

function songKit(runSettings = {}) {
  const kit = createKit({ song, run: runSettings, timing: { beat: 0.42 } });
  kit.defineObstacle('grave', { width: [0.16, 0.3] });
  return kit;
}

describe('property 19: locked to the song', () => {
  it('a song level passes, on 60 seeds', () => {
    const kit = songKit();
    for (let seed = 1; seed <= 60; seed++) {
      const level = kit.generate(seed);
      expect(level.obstacles.length).toBeGreaterThan(0);
      expect(lockedToTheSong(level, { objects: kit.registry, timing: kit.timing }).counterexamples ?? []).toEqual([]);
    }
  });

  it('refuses a press off the beat, a countdown in a rest, and one that runs over the end of its part', () => {
    const kit = songKit();
    const level = kit.generate(4);
    const input = { objects: kit.registry, timing: kit.timing };
    const off: Level = { ...level, obstacles: level.obstacles.map((o, i) => (i === 0 ? { ...o, start: o.start + 0.1 } : o)) };
    expect(lockedToTheSong(off, input).counterexample).toMatch(/whole number of beats/);
    const tm = resolveTiming(kit.timing);
    const first = level.obstacles[0]!;
    const inRest: Level = { ...level, obstacles: [{ ...first, start: first.start - 2 * 4 * tm.beat }, ...level.obstacles.slice(1)] };
    expect(lockedToTheSong(inRest, input).pass).toBe(false);
    const last = level.obstacles.at(-1)!;
    const over: Level = { ...level, obstacles: [...level.obstacles.slice(0, -1), { ...last, start: level.sections!.at(-1)!.to }] };
    expect((lockedToTheSong(over, input).counterexamples ?? []).join(' ')).toMatch(/does not sit inside one part/);
    // Every press of a good level is on the beat.
    for (const o of level.obstacles) {
      const beats = idealPress(o, tm) / tm.beat;
      expect(Math.abs(beats - Math.round(beats))).toBeLessThan(1e-6);
      expect(cueTimes(o, tm)[0]).toBeGreaterThanOrEqual(level.sections![1]!.from - 1e-9);
    }
  });

  it('a level with no song has nothing to lock to', () => {
    const kit = createKit();
    kit.defineObstacle('grave', { width: [0.16, 0.3] });
    expect(lockedToTheSong(kit.generate(1), { objects: kit.registry }).pass).toBe(true);
  });
});

describe('property 21: gentle pulses', () => {
  it('pulses once a beat, softly, and never when motion is reduced', () => {
    const beat = 0.4;
    let peaks = 0;
    let before = 0;
    let top = 0;
    for (let t = 0; t < 8 * beat; t += beat / 100) {
      const p = pulseAt(t, beat);
      if (before < 0.5 && p >= 0.5) peaks++;
      before = p;
      top = Math.max(top, p);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
      expect(pulseAt(t, beat, true)).toBe(0);
    }
    expect(peaks).toBe(8);
    expect(top).toBeLessThanOrEqual(1);
    expect(pulseAt(-1, beat)).toBe(0);
    expect(pulseAt(1, 0)).toBe(0);
    expect(PULSE_MAX_ALPHA).toBeLessThan(0.1 + 1e-9);
  });

  it('passes for the stage tempos, and refuses a beat that would pulse more than 3 times a second', () => {
    expect(pulsesGentle([0.42, 0.4, 0.38, 0.36]).pass).toBe(true);
    expect(pulsesPerSecond(0.36, 1)).toBeLessThanOrEqual(MAX_PULSES_PER_SECOND);
    const fast = pulsesGentle([0.3]);
    expect(fast.pass).toBe(false);
    expect(fast.counterexample).toMatch(/3\.33 times a second/);
  });

  it('a song kit proves it with its presentation proofs', () => {
    const kit = songKit();
    expect(kit.provePresentation(kit.generate(1)).find((r) => r.id === 21)?.pass).toBe(true);
  });
});

describe('property 20: instant retry, and explain once', () => {
  it('with explainOnce a repeat fall says the short reason and the attempt, and the first says the sum', () => {
    const kit = createKit({
      run: { explainOnce: true },
      lesson: {
        title: 'Even',
        prompt: 'Jump on evens.',
        values: [1, 30],
        isTarget: (v) => v % 2 === 0,
        explainWrong: (v) => `${v} is odd.`,
      },
    });
    kit.defineObstacle('grave', { width: [0.16, 0.3] });
    const level = kit.generate(2);
    const events: { data?: Record<string, unknown> }[] = [];
    let clock = 0;
    const run = kit.run({ level, speed: 'fast', startReal: 0, emit: (e) => e.type === 'fall-reason' && events.push(e) });
    while (events.length < 3 && clock < 300_000) run.advance((clock += 5));
    expect(events[0]!.data).toMatchObject({ attempt: 2 });
    expect(events[0]!.data).not.toHaveProperty('again');
    expect(events[1]!.data).toMatchObject({ again: true, attempt: 3 });
    expect(events[2]!.data).toMatchObject({ again: true, attempt: 4 });
    expect(run.snapshot().falls).toBeGreaterThanOrEqual(3);
  });

  it('a short pause passes at every speed, and a long one is refused with the number', () => {
    const kit = songKit();
    const level = kit.generate(1);
    const input = { objects: kit.registry, timing: kit.timing };
    expect(retryInTime({ fallPause: 0.4, restartLead: 0.8 }, 0)(level, input).pass).toBe(true);
    const slow = retryInTime({ fallPause: 2 }, 0)(level, input);
    expect(slow.pass).toBe(false);
    expect(slow.counterexample).toMatch(/waits 2000 ms/);
    expect(retryInTime({ fallPause: 0.4 }, wordsHoldMs(2000))(level, input).pass).toBe(false);
  });

  it('the worst wait is the fall pause when there are no words, and never less', () => {
    const kit = songKit();
    const delays = retryDelays(kit.generate(1), resolveTiming(kit.timing), resolveRunSettings({ fallPause: 0.4 }), 0);
    for (const speed of ['slow', 'medium', 'fast'] as const) expect(delays[speed].ms).toBe(400);
  });

  it('words are held a fifth longer, and 300 ms more; none for no words', () => {
    expect(wordsHoldMs(0)).toBe(0);
    expect(wordsHoldMs(1000)).toBe(1500);
  });
});
