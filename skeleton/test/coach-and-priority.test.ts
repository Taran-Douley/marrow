import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EVENT_TYPES } from '../src/channels/events';
import { createKit } from '../src/kit';
import { cueTimes } from '../src/level';
import { mergeProfile, parseProfile, defaultProfile } from '../src/profile';
import { coachInTime } from '../src/proof';
import { coachTimes } from '../src/run';
import type { SemanticEvent } from '../src/types';

function coachKit(coach = true) {
  const kit = createKit({ coach, events: { tip: { say: 'A tip.', caption: 'Tip', priority: 'information' }, lore: { say: 'Long ago.', caption: 'Lore', priority: 'ambient' }, danger: { say: 'Behind you!', caption: 'Behind you', priority: 'critical' } } });
  kit.defineObstacle('grave', { width: [0.16, 0.3] });
  return kit;
}

function play(kit: ReturnType<typeof coachKit>, coachLeadMs: number) {
  const level = kit.generate(4);
  const out: SemanticEvent[] = [];
  const run = kit.run({ level, speed: 'slow', startReal: 0, emit: (e) => out.push(e), coachLeadMs });
  for (let ms = 0; ms < 8000; ms += 10) {
    run.advance(ms);
    if (run.snapshot().phase !== 'play') break;
  }
  return { level, out };
}

describe('the coach', () => {
  it('is off unless the game offers it and the player turns it on', () => {
    expect(play(coachKit(false), 2000).out.some((e) => e.type === EVENT_TYPES.coach)).toBe(false);
    expect(play(coachKit(true), 0).out.some((e) => e.type === EVENT_TYPES.coach)).toBe(false);
    expect(defaultProfile().coachLeadMs).toBe(0);
  });

  it('says what is coming before the first beep, in words and a caption', () => {
    const kit = coachKit();
    const { level, out } = play(kit, 2000);
    const line = out.find((e) => e.type === EVENT_TYPES.coach)!;
    expect(line.at).toBeLessThan(cueTimes(level.obstacles[0]!, kit.timing)[0]);
    const words = kit.render(line);
    expect(words.find((c) => c.channel === 'speech')).toMatchObject({ text: 'Grave coming. Get ready to jump.' });
    expect(words.some((c) => c.channel === 'captions')).toBe(true);
    expect(kit.lineScript().some((l) => l.text === '{what} coming. Get ready to {move}.')).toBe(true);
  });

  it('in a lesson it never gives the answer away', () => {
    const kit = createKit({ coach: true, lesson: { title: 'T', prompt: 'P', values: [1, 20], isTarget: (v) => v % 2 === 0 } });
    expect(kit.render({ type: EVENT_TYPES.coach, at: 0, data: { object: 'x', move: 'jump', value: 7 } }).find((c) => c.channel === 'speech')).toMatchObject({
      text: '7 coming. Get ready to decide.',
    });
  });

  it('property 17: every coach line is after the landing and before the beeps, at every speed and lead (property-based)', () => {
    const kit = coachKit();
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), fc.constantFrom('slow', 'medium', 'fast' as const), fc.constantFrom(1000, 2000, 3000), (seed, speed, lead) => {
        const r = coachInTime(kit.generate(seed), { timing: kit.timing }, speed, lead);
        expect(r.counterexamples ?? []).toEqual([]);
      }),
      { numRuns: 150 },
    );
  });

  it('a lead too long for the level is shortened to the longest that fits, and said so in plain words', () => {
    const kit = coachKit();
    const r = coachInTime(kit.generate(9), { timing: kit.timing }, 'fast', 3000);
    expect(r.pass).toBe(true);
    expect(r.shortened.length).toBeGreaterThan(0);
    expect(r.shortened[0]).toMatch(/^Level 9, obstacle \d+ \(grave\): the coach could start only \d\.\d s before the beeps, not 3\.0 s\.$/);
    expect(coachTimes(kit.generate(9), kit.timing, 'fast', 3000)[0]!.gotMs).toBeCloseTo(3000, 0); // the first has all the room it wants
  });
});

describe('announce levels and priority', () => {
  const kit = coachKit();
  const at = (announce: 'minimal' | 'normal' | 'detailed', type: string) =>
    kit.render({ type, at: 0 }, mergeProfile(defaultProfile(), { announce })).filter((c) => c.channel === 'speech' || c.channel === 'captions').length;

  it('minimal keeps what matters now; detailed adds the lore', () => {
    expect([at('minimal', 'tip'), at('normal', 'tip'), at('detailed', 'tip')]).toEqual([0, 2, 2]);
    expect([at('minimal', 'lore'), at('normal', 'lore'), at('detailed', 'lore')]).toEqual([0, 0, 2]);
    expect([at('minimal', 'danger'), at('normal', 'danger'), at('detailed', 'danger')]).toEqual([2, 2, 2]);
  });

  it('a critical line cuts in', () => {
    expect(kit.render({ type: 'danger', at: 0 }).find((c) => c.channel === 'speech')).toMatchObject({ mode: 'cut-in' });
  });

  it('the profile keeps both settings, and refuses nonsense', () => {
    expect(parseProfile(JSON.stringify({ coachLeadMs: 2000, announce: 'detailed' }))).toMatchObject({ coachLeadMs: 2000, announce: 'detailed' });
    expect(parseProfile(JSON.stringify({ coachLeadMs: 99999, announce: 'loud' }))).toMatchObject({ coachLeadMs: 3000, announce: 'normal' }); // too long is held to the longest
  });
});
