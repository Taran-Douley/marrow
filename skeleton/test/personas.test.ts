import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createKit, normalCdf, obstacleChances, personaReport, playOnce, simulatePersona, aimTimes, type PersonaSpec } from '../src';
import { DEFAULT_TIMING, generateLevel, idealPress, mulberry32 } from '../src/level';
import type { Speed } from '../src/types';
import { seedArb } from './helpers/arbitraries';

const SPEEDS: Speed[] = ['slow', 'medium', 'fast'];
const levels = (n: number) => Array.from({ length: n }, (_, i) => generateLevel(i + 1));

describe('personas', () => {
  it('the normal curve is right', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1)).toBeCloseTo(0.1587, 3);
  });

  it('a perfect player clears every jump, at every speed, on 200 levels', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const level = generateLevel(seed);
        for (const speed of SPEEDS) {
          for (const c of obstacleChances(level, { kind: 'perfect' }, speed)) expect(c.chance).toBe(1);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('an audio-only player, given only the cue events, aims at exactly the fourth beat', () => {
    for (const level of levels(10)) {
      const aims = aimTimes(level, { kind: 'audio-only' });
      level.obstacles.forEach((o, i) => expect(aims[i]).toBeCloseTo(idealPress(o), 9));
    }
  });

  it('more timing error means more falls, and a slower speed forgives more', () => {
    const ls = levels(50);
    const rate = (sigmaMs: number, speed: Speed): number => simulatePersona(ls, { kind: 'noisy', sigmaMs }, speed).meanClearRate;
    expect(rate(100, 'slow')).toBeGreaterThan(rate(150, 'slow'));
    expect(rate(150, 'slow')).toBeGreaterThan(rate(250, 'slow'));
    for (const sigma of [100, 150, 250]) {
      expect(rate(sigma, 'slow')).toBeGreaterThan(rate(sigma, 'medium'));
      expect(rate(sigma, 'medium')).toBeGreaterThan(rate(sigma, 'fast'));
    }
    // A 150 ms player at Slow is likely to do well; at Fast, much less so.
    expect(rate(150, 'slow')).toBeGreaterThan(0.85);
  });

  it('the exact chances match many simulated plays', () => {
    const level = generateLevel(7);
    const spec: PersonaSpec = { kind: 'noisy', sigmaMs: 250 };
    const exact = obstacleChances(level, spec, 'fast');
    const rand = mulberry32(99);
    const runs = 6000;
    const wins = exact.map(() => 0);
    for (let r = 0; r < runs; r++) playOnce(level, spec, 'fast', rand).forEach((ok, i) => (wins[i] = wins[i]! + (ok ? 1 : 0)));
    exact.forEach((c, i) => expect(wins[i]! / runs, `obstacle ${i}`).toBeCloseTo(c.chance, 1));
  });

  it('lets distractors pass: only the stones to jump are at risk', () => {
    const kit = createKit({
      lesson: { title: 'Evens', prompt: 'p', values: [1, 30], isTarget: (v) => v % 2 === 0 },
    });
    kit.defineObstacle('stone', { width: [0.16, 0.3] });
    const level = kit.generate(3);
    const jumps = level.obstacles.filter((o) => o.solid !== false).length;
    expect(jumps).toBeLessThan(level.obstacles.length);
    expect(obstacleChances(level, { kind: 'perfect' }, 'slow')).toHaveLength(jumps);
  });

  it('reports every persona at every speed, with the hardest obstacle in plain words', () => {
    const report = personaReport(levels(20), [{ kind: 'perfect' }, { kind: 'noisy', sigmaMs: 250 }, { kind: 'audio-only' }]);
    expect(report).toHaveLength(9);
    const hard = report.find((r) => r.persona.includes('250') && r.speed === 'fast')!;
    expect(hard.hardest).toMatch(/^Level \d+, obstacle \d+ \(\w+\): \d+% on the first try\. The take-off window is \d+ ms\.$/);
    expect(hard.cleanLevelRate).toBeLessThan(hard.meanClearRate);
    expect(report.find((r) => r.persona === 'perfect one-switch')!.meanClearRate).toBe(1);
  });

  it('runs with no screen and no audio, using only the timing it is given', () => {
    const slowJump = { ...DEFAULT_TIMING, airtime: 1.2 };
    const level = generateLevel(4, { timing: slowJump });
    expect(simulatePersona([level], { kind: 'perfect' }, 'slow', slowJump).meanClearRate).toBe(1);
  });
});
