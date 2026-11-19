import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EVENT_TYPES } from '../src/channels';
import { createKit, type Kit } from '../src/kit';
import { generateLevel, idealPress, isSolid, takeoffWindow, type Level } from '../src/level';
import { lessonPools, type Lesson } from '../src/lesson';
import { createSessionLog, type Attempt } from '../src/log';
import { defaultProfile, mergeProfile } from '../src/profile';
import { cuesAudible, lessonProperty, prove } from '../src/proof';
import { createRegistry } from '../src/registry';
import { maxScore, rankOf, resolveRunSettings } from '../src/run';
import type { OutputCommand, SemanticEvent } from '../src/types';
import { seedArb } from './helpers/arbitraries';

const threes: Lesson = {
  title: 'Threes',
  prompt: 'Jump on every multiple of three.',
  values: [1, 36],
  isTarget: (v) => v % 3 === 0,
  explainWrong: (v) => `${v} is not a multiple of 3.`,
  explainMiss: (v) => `${v} is a multiple of 3: ${v / 3} times 3.`,
};

function makeKit(config: Parameters<typeof createKit>[0] = {}): Kit {
  const kit = createKit({ lesson: threes, ...config });
  kit.defineObstacle('stone', { width: [0.16, 0.3] });
  return kit;
}

type Cmd = OutputCommand;
const speech = (cmds: readonly Cmd[]) => cmds.flatMap((c) => (c.channel === 'speech' ? [c.text] : []));
const captions = (cmds: readonly Cmd[]) => cmds.flatMap((c) => (c.channel === 'captions' ? [c.text] : []));
const sounds = (cmds: readonly Cmd[]) => cmds.filter((c): c is Extract<Cmd, { channel: 'sound' }> => c.channel === 'sound');

/** A level made by hand: [value, solid] for each obstacle, spaced out. */
function handmade(items: [number, boolean][]): Level {
  return {
    seed: 1,
    obstacles: items.map(([value, solid], index) => ({ index, kind: 'stone', start: 10 + index * 3, width: 0.2, value, solid })),
  };
}

/**
 * Play a level. `plan(i)` is the offset from the fourth beat, in running seconds, at which to press
 * for obstacle i, or null to let it pass.
 */
function drive(kit: Kit, level: Level, plan: (i: number) => number | null, speed: 'slow' | 'medium' | 'fast' = 'slow') {
  const emitted: SemanticEvent[] = [];
  const attempts: Attempt[] = [];
  const run = kit.run({
    level,
    speed,
    startReal: 0,
    emit: (e) => emitted.push(e),
    onAttempt: (a) => attempts.push(a),
  });
  let clock = 0;
  let guard = 0;
  let pressedFor = -1;
  while (run.snapshot().phase === 'play' && guard++ < 400000) {
    clock += 2;
    run.advance(clock);
    const i = run.snapshot().obstacle;
    const o = level.obstacles[i];
    const offset = o ? plan(i) : null;
    if (!o || offset === null || pressedFor === i) continue;
    if (run.snapshot().t >= idealPress(o, kit.timing) + offset) {
      pressedFor = i;
      run.press(clock);
    }
  }
  return { run, emitted, attempts, clock };
}

const ofType = (events: SemanticEvent[], type: string) => events.filter((e) => e.type === type);
const data = (e: SemanticEvent) => e.data as Record<string, unknown>;

describe('generating a lesson level', () => {
  const kit = makeKit();

  it('gives every obstacle a number in range, solid exactly when it is a target', () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const o of kit.generate(seed).obstacles) {
        expect(o.value).toBeGreaterThanOrEqual(1);
        expect(o.value).toBeLessThanOrEqual(36);
        expect(isSolid(o)).toBe(threes.isTarget(o.value!));
      }
    }
  });

  it('is repeatable: the same seed gives the same questions', () => {
    expect(kit.generate(7)).toEqual(kit.generate(7));
  });

  it('mixes targets and distractors about evenly, and honours your own share', () => {
    const share = (k: Kit) => {
      let jump = 0;
      let total = 0;
      for (let seed = 1; seed <= 120; seed++) {
        for (const o of k.generate(seed).obstacles) {
          total++;
          if (isSolid(o)) jump++;
        }
      }
      return jump / total;
    };
    expect(share(kit)).toBeGreaterThan(0.42);
    expect(share(kit)).toBeLessThan(0.58);
    expect(share(makeKit({ lesson: { ...threes, targetShare: 0.8 } }))).toBeGreaterThan(0.7);
  });

  it('a game with no lesson has no numbers', () => {
    const plain = createKit();
    plain.defineObstacle('grave', { width: 0.2 });
    expect(plain.generate(3).obstacles.every((o) => o.value === undefined && o.solid === undefined)).toBe(true);
  });

  it('refuses a lesson that cannot work, in plain words, before any game starts', () => {
    expect(() => lessonPools({ ...threes, values: [1.5, 9] })).toThrow('needs whole numbers');
    expect(() => lessonPools({ ...threes, isTarget: () => false })).toThrow('at least one target and one distractor');
    expect(() => lessonPools({ ...threes, targetShare: 0.99 })).toThrow('targetShare');
    expect(() => createKit({ lesson: { ...threes, values: [1, 2] } })).toThrow(/at least one target/);
  });
});

describe('the proof for a lesson', () => {
  it('(PBT) every generated lesson level passes all the timing properties and the lesson check', () => {
    const kit = makeKit();
    fc.assert(
      fc.property(seedArb, (seed) => {
        const results = kit.prove(kit.generate(seed));
        expect(results.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 101]);
        expect(results.filter((r) => !r.pass).map((r) => r.counterexample)).toEqual([]);
      }),
      { numRuns: 200 },
    );
  });

  it('an obstacle to let pass needs no take-off window, however wide it is', () => {
    const reg = createRegistry();
    reg.define('stone', { width: 0.2 });
    const level: Level = {
      seed: 1,
      obstacles: [
        { index: 0, kind: 'stone', start: 10, width: 0.2, value: 3, solid: true },
        { index: 1, kind: 'stone', start: 14, width: 5, value: 4, solid: false },
      ],
    };
    const results = prove(level, { objects: reg });
    for (const id of [1, 2, 5, 6]) expect(results.find((r) => r.id === id)!.pass).toBe(true);
  });

  const reg = createRegistry();
  reg.define('stone', { width: 0.2 });
  const check = lessonProperty(threes);

  it('catches a number that is a target but sits on an obstacle to let pass', () => {
    const level = handmade([[12, false], [4, false], [5, true], [6, true]]);
    const r = check(level, { objects: reg });
    expect(r.pass).toBe(false);
    expect(r.counterexamples).toContain('Level 1, obstacle 1 (stone): 12 is a target, but the obstacle is one to let pass.');
    expect(r.counterexamples).toContain('Level 1, obstacle 3 (stone): 5 is not a target, but the obstacle is one to jump.');
  });

  it('catches a missing number and a number out of range', () => {
    const level: Level = {
      seed: 1,
      obstacles: [
        { index: 0, kind: 'stone', start: 10, width: 0.2 },
        { index: 1, kind: 'stone', start: 13, width: 0.2, value: 99, solid: true },
      ],
    };
    const r = check(level, { objects: reg });
    expect(r.counterexamples).toContain('Level 1, obstacle 1 (stone): it has no number, so the player cannot decide what to do.');
    expect(r.counterexamples).toContain('Level 1, obstacle 2 (stone): the number 99 is outside 1 to 36.');
  });

  it('catches a lesson that is not a decision: all jump, none to let pass', () => {
    const r = check(handmade([[3, true], [6, true], [9, true], [12, true]]), { objects: reg });
    expect(r.pass).toBe(false);
    expect(r.counterexample).toBe('Level 1: only 4 to jump and 0 to let pass. A lesson needs at least two of each.');
  });
});

describe('judging the timing (Perfect, Good, Ok)', () => {
  const kit = makeKit();
  const single = handmade([[12, true]]);
  const half = (() => {
    const { a, b } = takeoffWindow(single.obstacles[0]!, kit.timing);
    return (b - a) / 2;
  })();
  const judged = (offset: number) => {
    const { emitted, attempts } = drive(kit, single, () => offset);
    return { event: ofType(emitted, EVENT_TYPES.judged)[0]!, attempts };
  };

  it('on the beat is Perfect, near it is Good, anywhere else in the window is Ok', () => {
    expect(data(judged(0).event)).toMatchObject({ grade: 'perfect', points: 110, streak: 1, score: 110 });
    expect(data(judged(half * 0.5).event)).toMatchObject({ grade: 'good', points: 66 });
    expect(data(judged(-half * 0.5).event)).toMatchObject({ grade: 'good' });
    expect(data(judged(half * 0.9).event)).toMatchObject({ grade: 'ok', points: 33 });
  });

  it('all three are still clears in the log, and the offset is recorded', () => {
    const { attempts } = judged(half * 0.5);
    expect(attempts).toMatchObject([{ result: 'cleared' }]);
    expect(attempts[0]!.offsetMs).toBeGreaterThan(0);
  });

  it('uses your own thresholds and points', () => {
    const custom = makeKit({ run: { scoring: { perfectAt: 0.9, streakBonus: 0, points: { perfect: 7 } } } });
    const { emitted } = drive(custom, single, () => half * 0.8);
    expect(data(ofType(emitted, EVENT_TYPES.judged)[0]!)).toMatchObject({ grade: 'perfect', points: 7 });
  });
});

describe('letting the wrong ones pass, and the streak', () => {
  const kit = makeKit();

  it('a right decision to do nothing earns points and a "passed" event', () => {
    const level = handmade([[4, false], [12, true], [5, false]]);
    const { emitted, attempts, run } = drive(kit, level, (i) => (level.obstacles[i]!.solid ? 0 : null));
    expect(attempts.map((a) => a.result)).toEqual(['passed', 'cleared', 'passed']);
    expect(ofType(emitted, EVENT_TYPES.passed).map((e) => data(e).points)).toEqual([55, 65]);
    // 55 (streak 1) + 120 (perfect, streak 2) + 65 (streak 3)
    expect(run.snapshot()).toMatchObject({ phase: 'done', score: 240, streak: 3, bestStreak: 3 });
  });

  it('a perfect player on a whole generated level finishes with the best possible score and rank S', () => {
    const level = kit.generate(5);
    const { run, attempts } = drive(kit, level, (i) => (isSolid(level.obstacles[i]!) ? 0 : null));
    expect(run.snapshot().phase).toBe('done');
    expect(attempts.every((a) => a.result === 'cleared' || a.result === 'passed')).toBe(true);
    expect(run.snapshot().bestStreak).toBe(12);
    const { rank, fraction, best } = kit.rank(level, run.snapshot().score);
    expect(best).toBe(maxScore(level));
    expect(fraction).toBeCloseTo(1, 1);
    expect(rank).toBe('S');
  });

  it('the log counts a correct pass as a success', () => {
    const log = createSessionLog();
    const base: Attempt = { level: 1, obstacle: 1, kind: 'stone', result: 'passed', offsetMs: null, windowMs: 700, speed: 'slow', picture: true };
    log.record(base);
    log.record({ ...base, result: 'cleared', offsetMs: 10 });
    log.record({ ...base, result: 'wrong', offsetMs: 120 });
    expect(log.summary()).toMatchObject({ attempts: 3, cleared: 2, falls: 1 });
  });
});

describe('mistakes teach', () => {
  const kit = makeKit();
  const level = handmade([[12, true], [11, false], [9, true]]);

  it('pressing on a distractor says why, in the lesson\'s own words, and resets the streak', () => {
    const { emitted, attempts, run } = drive(kit, level, (i) => (i === 1 ? -0.3 : level.obstacles[i]!.solid ? 0 : null));
    const fall = ofType(emitted, EVENT_TYPES.fallReason)[0]!;
    expect(data(fall)).toMatchObject({ reason: 'wrong', index: 1, value: 11, explain: '11 is not a multiple of 3.' });
    expect(attempts.at(-1)).toMatchObject({ result: 'wrong', obstacle: 2 });
    expect(run.snapshot()).toMatchObject({ phase: 'recover', streak: 0 });
    const said = speech(kit.render(fall));
    expect(said).toEqual(['Not that one. 11 is not a multiple of 3.']);
    expect(captions(kit.render(fall))).toEqual(['Not that one. 11 is not a multiple of 3.']);
  });

  it('letting a target go by says it was one, and shows the sum', () => {
    const { emitted, attempts } = drive(kit, level, (i) => (i === 0 ? null : level.obstacles[i]!.solid ? 0 : null));
    const fall = ofType(emitted, EVENT_TYPES.fallReason)[0]!;
    expect(data(fall)).toMatchObject({ reason: 'none', value: 12, explain: '12 is a multiple of 3: 4 times 3.' });
    expect(attempts[0]).toMatchObject({ result: 'none', offsetMs: null });
    expect(speech(kit.render(fall))).toEqual(['No press. 12 is a multiple of 3: 4 times 3.']);
  });

  it('a timing miss gives only the timing reason: there is nothing to teach about the maths', () => {
    const { emitted } = drive(kit, level, (i) => (i === 0 ? -0.6 : null));
    const fall = ofType(emitted, EVENT_TYPES.fallReason)[0]!;
    expect(data(fall)).toMatchObject({ reason: 'early', value: 12 });
    expect(data(fall).explain).toBeUndefined();
    expect(speech(kit.render(fall))).toEqual(['Pressed a little early.']);
  });

  it('after a mistake play restarts at the same question, and can then be finished', () => {
    const first = drive(kit, level, (i) => (i === 1 ? -0.3 : level.obstacles[i]!.solid ? 0 : null));
    expect(first.run.snapshot().obstacle).toBe(1);
    let clock = first.clock;
    let guard = 0;
    while (first.run.snapshot().phase !== 'done' && guard++ < 400000) {
      clock += 2;
      first.run.advance(clock);
      const snap = first.run.snapshot();
      const o = level.obstacles[snap.obstacle];
      if (snap.phase === 'play' && o && o.solid && snap.t >= idealPress(o, kit.timing) && snap.jumpedAt === null) first.run.press(clock);
    }
    expect(first.run.snapshot().phase).toBe('done');
  });

  it('a game without a lesson explains nothing extra', () => {
    const plain = createKit();
    plain.defineObstacle('grave', { width: 0.2 });
    const lv: Level = { seed: 1, obstacles: [{ index: 0, kind: 'grave', start: 10, width: 0.2 }] };
    const { emitted } = drive(plain, lv, () => null);
    expect(data(ofType(emitted, EVENT_TYPES.fallReason)[0]!).explain).toBeUndefined();
  });
});

describe('the question never gives away the answer', () => {
  const kit = makeKit();

  it('the countdown events carry the number but never whether to jump', () => {
    const level = kit.generate(9);
    for (const e of kit.levelEvents(level).filter((x) => x.type !== EVENT_TYPES.atmosphere)) {
      expect(JSON.stringify(e)).not.toContain('solid');
      expect(typeof data(e).value).toBe('number');
    }
  });

  it('a target and a distractor sound and feel the same until the player decides', () => {
    const level = handmade([[12, true], [11, false]]);
    const cmds = (i: number) =>
      kit
        .levelEvents(level)
        .filter((e) => data(e).index === i && e.type !== EVENT_TYPES.approaching)
        .flatMap((e) => kit.render(e))
        .map((c) => ({ ...c, at: 0, ...(c.channel === 'captions' ? { text: '' } : {}) }));
    expect(cmds(0)).toEqual(cmds(1));
  });

  it('the number is spoken and shown every time, and the fourth beat says "your move", not "press now"', () => {
    const approaching = (first: boolean) =>
      kit.render({ type: EVENT_TYPES.approaching, at: 0, data: { object: 'stone', first, value: 12, span: 1.2 } });
    expect(speech(approaching(true))).toEqual(['12']);
    expect(speech(approaching(false))).toEqual(['12']); // not only the first time
    expect(captions(approaching(false))).toEqual(['12']);
    const beat = (n: number) => kit.render({ type: EVENT_TYPES.beat, at: 0, data: { object: 'stone', beat: n, value: 12 } });
    expect(captions(beat(2))).toEqual(['12']);
    expect(captions(beat(4))).toEqual(['Your move']);
  });
});

describe('judgement sounds, words and touch', () => {
  const kit = makeKit();
  const judged = (grade: string, streak = 1) =>
    kit.render({ type: EVENT_TYPES.judged, at: 0, data: { grade, streak, score: 0, points: 0 } });

  it('Perfect is a bright pair of notes, a word, a caption and a ripple you can feel', () => {
    const cmds = judged('perfect');
    expect(sounds(cmds).map((s) => s.role)).toEqual(['reward', 'reward']);
    expect(speech(cmds)).toEqual(['Perfect']);
    expect(captions(cmds)).toEqual(['Perfect']);
    expect(cmds.filter((c) => c.channel === 'haptics')).toMatchObject([{ pattern: [30, 30, 30] }]);
  });

  it('Good is one note and a caption, with no speech to talk over the next countdown', () => {
    const cmds = judged('good');
    expect(sounds(cmds)).toHaveLength(1);
    expect(speech(cmds)).toEqual([]);
    expect(captions(cmds)).toEqual(['Good']);
  });

  it('Ok is only a soft tick', () => {
    const [tick] = sounds(judged('ok'));
    expect(tick).toMatchObject({ role: 'effect', hz: 300 });
  });

  it('each right decision in a row climbs a step of the scale, so a streak is a tune', () => {
    const hz = (streak: number) => sounds(judged('good', streak))[0]!.hz;
    expect(hz(1)).toBeCloseTo(523.25, 2);
    expect(hz(2) / hz(1)).toBeCloseTo(2 ** (2 / 12), 6);
    expect(hz(4) / hz(1)).toBeCloseTo(2 ** (7 / 12), 6);
    expect(hz(40)).toBe(hz(11)); // the scale tops out after two octaves
    expect(hz(11) / hz(1)).toBeCloseTo(4, 6);
  });

  it('a streak of five is called out by voice', () => {
    expect(speech(judged('good', 5))).toEqual(['5 in a row']);
    expect(speech(judged('perfect', 10))).toEqual(['10 in a row']);
    expect(speech(judged('good', 4))).toEqual([]);
  });

  it('letting one pass is a soft brush and a flicker of the marker, not a word', () => {
    const cmds = kit.render({ type: EVENT_TYPES.passed, at: 0, data: { object: 'stone', value: 4, streak: 1, score: 55, points: 55 } });
    expect(sounds(cmds)).toMatchObject([{ role: 'effect', shape: { noise: true } }]);
    expect(speech(cmds)).toEqual([]);
    expect(cmds.some((c) => c.channel === 'indicator')).toBe(true);
  });

  it('the player can turn effects off and still read every judgement', () => {
    const quiet = makeKit({ audio: { effects: false } });
    const cmds = quiet.render({ type: EVENT_TYPES.judged, at: 0, data: { grade: 'perfect', streak: 1 } });
    expect(sounds(cmds)).toEqual([]);
    expect(captions(cmds)).toEqual(['Perfect']);
  });

  it('every one of these events reaches at least two senses', () => {
    expect(kit.proveEvents().pass).toBe(true);
  });
});

describe('the mix still holds, and the words are yours', () => {
  it('(PBT) beeps stay 6 dB over everything, with a lesson and any volumes', () => {
    const kit = makeKit();
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 1, max: 100 }), fc.integer({ min: 0, max: 100 }), (seed, cues, music) => {
        const profile = mergeProfile(defaultProfile(), { volume: { cues: cues / 100, music: music / 100 } });
        expect(cuesAudible(kit.renderLevel(kit.generate(seed), profile)).pass).toBe(true);
      }),
      { numRuns: 60 },
    );
  });

  it('rewords or translates the new lines, like any other', () => {
    const es = makeKit({
      strings: { fallWrong: 'Ese no.', yourMove: 'Tu turno', perfect: 'Perfecto', streak: '{streak} seguidos' },
    });
    expect(captions(es.render({ type: EVENT_TYPES.beat, at: 0, data: { object: 'stone', beat: 4, value: 12 } }))).toEqual(['Tu turno']);
    expect(speech(es.render({ type: EVENT_TYPES.fallReason, at: 0, data: { reason: 'wrong', explain: '11 no es múltiplo de 3.' } }))).toEqual([
      'Ese no. 11 no es múltiplo de 3.',
    ]);
    expect(speech(es.render({ type: EVENT_TYPES.judged, at: 0, data: { grade: 'good', streak: 5 } }))).toEqual(['5 seguidos']);
  });

  it('lists the lines to record for a lesson, including the ones filled in at play time', () => {
    const lines = makeKit().lineScript();
    expect(lines.find((l) => l.text === 'Not that one.')).toMatchObject({ template: false });
    expect(lines.find((l) => l.text === '{value}')).toMatchObject({ template: true });
    expect(lines.find((l) => l.text === '{streak} in a row')).toMatchObject({ template: true });
    expect(lines.map((l) => l.text)).toContain('Perfect');
  });
});

describe('ranks', () => {
  it('S, A, B and C by the share of the best score, with cut-offs of your own', () => {
    const s = resolveRunSettings();
    expect([0.95, 0.9, 0.8, 0.75, 0.6, 0.55, 0.3].map((f) => rankOf(f, s))).toEqual(['S', 'S', 'A', 'A', 'B', 'B', 'C']);
    const strict = resolveRunSettings({ scoring: { ranks: [0.99, 0.95, 0.9] } });
    expect(rankOf(0.96, strict)).toBe('A');
  });

  it('the best score is every jump Perfect and every pass right, with the streak growing', () => {
    const level = handmade([[4, false], [12, true], [5, false]]);
    expect(maxScore(level)).toBe(55 + 120 + 65);
  });

  it('a score of zero is rank C, and a level with nothing in it never divides by zero', () => {
    const kit = makeKit();
    expect(kit.rank(handmade([[3, true]]), 0).rank).toBe('C');
    expect(kit.rank({ seed: 1, obstacles: [] }, 0)).toMatchObject({ rank: 'C', fraction: 0, best: 0 });
  });
});

describe('level generation does not change for games without a lesson', () => {
  it('the old seeds still make the old levels', () => {
    const level = generateLevel(1);
    expect(level.obstacles[0]).toMatchObject({ index: 0, start: 6.5 });
    expect(level.obstacles).toHaveLength(12);
  });
});
