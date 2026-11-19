import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EVENT_TYPES } from '../src/channels/events';
import { trackNotes } from '../src/channels/track';
import { createKit } from '../src/kit';
import { cueTimes, idealPress, resolveTiming, type Level } from '../src/level';
import type { Lesson } from '../src/lesson';
import { defaultProfile } from '../src/profile';
import { gateWordsInTime, gatesHaveOneRightLane, portalsGiveWarning, restsAreRests } from '../src/proof';
import { createRun } from '../src/run';
import { levelEvents } from '../src/schedule';
import { generateSong, moveAt, sideBefore, type Song } from '../src/song';
import type { SemanticEvent } from '../src/types';

const threes: Lesson = {
  title: 'Threes',
  prompt: 'Jump on multiples of 3.',
  values: [1, 36],
  isTarget: (v) => v % 3 === 0,
  explainWrong: (v) => `${v} is not a multiple of 3.`,
  explainMiss: (v) => `${v} is a multiple of 3.`,
};

const SONG: Song = {
  name: 'Test song',
  sections: [
    { name: 'intro', bars: 4, feel: 'rest' },
    { name: 'build', bars: 8, feel: 'calm' },
    { name: 'drop', bars: 8, feel: 'busy' },
    { name: 'flip', bars: 8, feel: 'busy', move: 'flip', kinds: ['spike'] },
    { name: 'breakdown', bars: 2, feel: 'rest' },
    { name: 'gates', bars: 8, feel: 'calm', move: 'switch', kinds: ['gate'] },
    { name: 'outro', bars: 6, feel: 'busy', move: 'jump' },
  ],
};

function songKit(beat = 0.4, lesson: Lesson | undefined = threes) {
  const kit = createKit({ song: SONG, timing: { beat }, ...(lesson ? { lesson } : {}) });
  kit.defineObstacle('grave', { width: [0.16, 0.3] });
  kit.defineObstacle('fence', { width: [0.12, 0.24] });
  kit.defineObstacle('spike', { width: [0.12, 0.2] });
  kit.defineObstacle('gate', { width: [0.12, 0.18] });
  return kit;
}

describe('levels built from a song', () => {
  it('the same seed always gives the same level', () => {
    const kit = songKit();
    expect(kit.generate(42)).toEqual(kit.generate(42));
    expect(kit.generate(42)).not.toEqual(kit.generate(43));
  });

  it('every level passes every proof, songs included, at three tempos (property-based, 200 seeds each)', () => {
    for (const beat of [0.36, 0.4, 0.44]) {
      const kit = songKit(beat);
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1_000_000 }), (seed) => {
          const level = kit.generate(seed);
          const failing = kit.prove(level, `Level ${seed}`).filter((r) => !r.pass);
          expect(failing.map((f) => f.counterexample)).toEqual([]);
          expect(level.obstacles.length).toBeGreaterThan(10);
        }),
        { numRuns: 200 },
      );
    }
  });

  it('rests have nothing in them, each part uses its own move and kinds, and every press is on the beat', () => {
    const kit = songKit();
    const timing = kit.timing;
    for (let seed = 1; seed <= 50; seed++) {
      const level = kit.generate(seed);
      for (const s of level.sections!) {
        const inside = level.obstacles.filter((o) => o.start >= s.from && o.start < s.to);
        if (s.feel === 'rest') expect(inside, `${s.name}`).toEqual([]);
        for (const o of inside) {
          expect(o.move ?? 'jump').toBe(s.move);
          if (s.name === 'flip') expect(o.kind).toBe('spike');
          if (s.name === 'gates') expect(o.kind).toBe('gate');
          if (s.name === 'build' || s.name === 'drop' || s.name === 'outro') expect(['grave', 'fence']).toContain(o.kind);
        }
      }
      for (const o of level.obstacles) {
        const beats = idealPress(o, timing) / timing.beat;
        expect(Math.abs(beats - Math.round(beats))).toBeLessThan(1e-6);
      }
    }
  });

  it('busy parts are closer together than calm parts', () => {
    const kit = songKit();
    let busy = 0;
    let calm = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const level = kit.generate(seed);
      const count = (name: string) => {
        const s = level.sections!.find((x) => x.name === name)!;
        return level.obstacles.filter((o) => o.start >= s.from && o.start < s.to).length;
      };
      busy += count('drop');
      calm += count('build');
    }
    expect(busy).toBeGreaterThan(calm);
  });

  it('portals sit where the move changes, and every gate has one right lane', () => {
    const level = songKit().generate(7);
    expect(level.portals!.map((p) => p.move)).toEqual(['flip', 'switch', 'jump']); // the breakdown keeps the flip; the gates bring their own move
    for (const o of level.obstacles.filter((x) => x.move === 'switch')) {
      expect(o.gate).toBeDefined();
      expect(threes.isTarget(o.value!)).not.toBe(threes.isTarget(o.gate!.here));
      expect(o.solid).toBe(threes.isTarget(o.value!));
    }
    const flip = level.obstacles.find((o) => o.move === 'flip')!;
    expect(moveAt(level, cueTimes(flip, resolveTiming())[0])).toBe('flip');
  });

  it('refuses a song with gates but no lesson, in plain words', () => {
    expect(() => createKit({ song: SONG })).toThrow(/number gates, which need a lesson/);
  });

  it('a level with no song is generated exactly as before', () => {
    const plain = createKit();
    plain.defineObstacle('grave', { width: [0.16, 0.3] });
    const level = plain.generate(5);
    expect(level.sections).toBeUndefined();
    expect(level.obstacles.every((o) => o.move === undefined)).toBe(true);
  });
});

describe('the song proofs find broken levels and say why', () => {
  const timing = resolveTiming();
  const base = (): Level => ({
    seed: 9,
    obstacles: [{ index: 0, kind: 'grave', start: 8, width: 0.2 }],
    sections: [
      { name: 'intro', from: 0, to: 6.4, feel: 'calm', energy: 0.5, move: 'jump' },
      { name: 'breather', from: 6.4, to: 12.8, feel: 'rest', energy: 0.15, move: 'jump' },
    ],
    portals: [],
  });

  it('property 15: a countdown inside a rest', () => {
    const r = restsAreRests(base(), { objects: { names: () => [], get: () => undefined }, timing });
    expect(r.pass).toBe(false);
    expect(r.counterexample).toMatch(/Level 9, obstacle 1 \(grave\): its countdown runs .* inside the rest 'breather'/);
  });

  it('property 16: a countdown on top of a portal, and an obstacle asking for the wrong move', () => {
    const level: Level = { ...base(), sections: [], portals: [{ at: 7.5, move: 'flip' }] };
    const r = portalsGiveWarning(level, { objects: { names: () => [], get: () => undefined }, timing });
    expect(r.pass).toBe(false);
    expect(r.counterexamples!.join(' ')).toMatch(/runs into the portal to flip mode at 7.50 s/);
    const wrong: Level = { ...base(), sections: [], portals: [{ at: 0, move: 'flip' }] };
    expect(portalsGiveWarning(wrong, { objects: { names: () => [], get: () => undefined }, timing }).counterexample).toMatch(
      /asks the player to jump, but when its countdown starts a press would flip/,
    );
  });

  it('property 104: gate words too long to say before the fourth beat', () => {
    const level: Level = { seed: 4, obstacles: [{ index: 0, kind: 'gate', start: 8, width: 0.15, move: 'switch', value: 123456, solid: true, gate: { here: 654321 } }] };
    const r = gateWordsInTime(level, { objects: { names: () => [], get: () => undefined }, timing: resolveTiming({ beat: 0.25 }) });
    expect(r.pass).toBe(false);
    expect(r.counterexample).toMatch(/^Level 4, gate 1 \(gate\): "654321 or 123456\?" takes about \d+ ms to say, but the countdown at fast is 750 ms/);
  });

  it('property 103: a gate where both lanes are right', () => {
    const level: Level = { seed: 3, obstacles: [{ index: 0, kind: 'gate', start: 8, width: 0.15, move: 'switch', value: 9, solid: true, gate: { here: 12 } }] };
    const r = gatesHaveOneRightLane(threes)(level, { objects: { names: () => [], get: () => undefined }, timing });
    expect(r.pass).toBe(false);
    expect(r.counterexample).toBe('Level 3, gate 1 (gate): 12 and 9 both fit the rule, so there is not exactly one right lane.');
  });
});

describe('what the player hears, sees and feels', () => {
  const kit = songKit();
  const profile = defaultProfile();
  const level = kit.generate(11);
  const events = levelEvents(level, kit.timing);

  it('a portal is a sweep, words, a caption, a marker and a buzz', () => {
    const portal = events.find((e) => e.type === EVENT_TYPES.portal && e.data?.move === 'flip')!;
    const out = kit.render(portal, profile);
    expect(out.find((c) => c.channel === 'speech')).toMatchObject({ text: 'Flip mode. Press to flip.' });
    expect(out.find((c) => c.channel === 'captions')).toMatchObject({ text: 'Flip mode. Press to flip.' });
    expect(out.some((c) => c.channel === 'sound' && c.role === 'effect')).toBe(true);
    expect(out.some((c) => c.channel === 'indicator')).toBe(true);
    expect(out.some((c) => c.channel === 'haptics')).toBe(true);
  });

  it('a gate says both numbers, yours first, and shows them on every beep', () => {
    const gate = level.obstacles.find((o) => o.move === 'switch')!;
    const approach = events.find((e) => e.type === EVENT_TYPES.approaching && e.data?.index === gate.index)!;
    expect(kit.render(approach, profile).find((c) => c.channel === 'speech')).toMatchObject({ text: `${gate.gate!.here} or ${gate.value}?` });
    const text = `Stay ${gate.gate!.here} · Switch ${gate.value}`;
    const beep = events.find((e) => e.type === EVENT_TYPES.beat && e.data?.index === gate.index && e.data?.beat === 2)!;
    expect(kit.render(beep, profile).find((c) => c.channel === 'captions')).toMatchObject({ text, pip: 2 });
  });

  it('the band follows the song: no drums in a breakdown, everything in the drop', () => {
    const rest = events.find((e) => e.type === EVENT_TYPES.atmosphere && e.data?.part === 'breakdown')!;
    const drop = events.find((e) => e.type === EVENT_TYPES.atmosphere && e.data?.part === 'drop')!;
    expect(rest.data?.energy).toBeLessThan(0.3);
    expect(drop.data?.energy).toBe(1);
    const spec = { name: 't', rootHz: 80, scale: [0, 2, 4, 5, 7, 9, 11, 12], bass: ['0-------'], melody: ['0.2.4.5.'], kick: ['X...X...'], hat: ['x.x.x.x.'] };
    const kicks = (energy: number) =>
      trackNotes(spec, { from: 0, to: 3.2, tension: 0.5, level: 1, mono: false, slot: 0.2, energy }).filter((n) => n.channel === 'sound' && n.hz === 150).length;
    expect(kicks(0.15)).toBe(0);
    expect(kicks(1)).toBeGreaterThan(0);
  });

  it('kit proves every event, portals included, reaches two senses', () => {
    expect(kit.proveEvents(profile).pass).toBe(true);
  });

  it('sideBefore follows right flips and resets at a portal', () => {
    const flips = level.obstacles.filter((o) => o.move === 'flip');
    const firstFlip = flips[0]!;
    expect(sideBefore(level, firstFlip.index)).toBe('down');
    const solidFlip = flips.find((o) => o.solid !== false);
    if (solidFlip && flips.at(-1)!.index > solidFlip.index) expect(sideBefore(level, solidFlip.index + 1)).toBe('up');
    const firstOutro = level.obstacles.find((o, i) => i > 0 && o.move === 'jump' && level.obstacles[i - 1]!.move === 'switch');
    if (firstOutro) expect(sideBefore(level, firstOutro.index)).toBe('down');
  });
});

describe('words are heard in full before a countdown', () => {
  const kit = songKit();
  const level = kit.generate(2);
  const timing = kit.timing;
  const first = level.obstacles[0]!;
  const beepsAt = (hold: (run: ReturnType<typeof createRun>) => void) => {
    const out: { real: number; e: SemanticEvent }[] = [];
    let real = 0;
    const run = createRun({ level, timing, speed: 'fast', events: levelEvents(level, timing), startReal: 0, emit: (e) => out.push({ real, e }) });
    hold(run);
    for (real = 0; real <= 20_000; real += 10) run.advance(real);
    return out.find((x) => x.e.type === EVENT_TYPES.beat && x.e.data?.index === 0)!.real;
  };

  it('a long introduction holds the first countdown until it is said', () => {
    const plain = beepsAt(() => undefined);
    expect(plain).toBeCloseTo((cueTimes(first, timing)[0] - 0.25) * 1000, -2); // events go out a little early
    const held = beepsAt((run) => run.holdForWords(0, 9000));
    expect(held).toBeGreaterThanOrEqual(9000 - 300);
    // It never makes a countdown come sooner.
    expect(beepsAt((run) => run.holdForWords(0, 10))).toBe(plain);
  });

  it('after a fall, the restart waits until the reason and lesson are said', () => {
    const out: { real: number; e: SemanticEvent }[] = [];
    let real = 0;
    const run = createRun({ level, timing, speed: 'fast', events: levelEvents(level, timing), startReal: 0, emit: (e) => out.push({ real, e }) });
    let fellAt = -1;
    for (real = 0; real <= 40_000; real += 10) {
      run.advance(real);
      if (fellAt < 0 && out.some((x) => x.e.type === EVENT_TYPES.fallReason)) {
        fellAt = real;
        run.holdForWords(real, 8000);
      }
    }
    const firstFall = out.findIndex((x) => x.e.type === EVENT_TYPES.fallReason);
    const nextBeep = out.slice(firstFall).find((x) => x.e.type === EVENT_TYPES.beat && x.e.data?.beat === 1)!;
    expect(nextBeep.real - fellAt).toBeGreaterThanOrEqual(8000 - 300);
  });
});

describe('timing help', () => {
  const kit = songKit();
  const level = kit.generate(3);
  const timing = kit.timing;
  const firstSolid = level.obstacles.find((o) => o.solid !== false)!;
  const firstPass = level.obstacles.find((o) => o.solid === false)!;

  function play(assist: boolean, pressAt: (index: number) => number | null) {
    const out: SemanticEvent[] = [];
    const run = createRun({ level, timing, speed: 'fast', events: levelEvents(level, timing), startReal: 0, emit: (e) => out.push(e), settings: { assist } });
    const presses = level.obstacles.map((o) => pressAt(o.index)).filter((t): t is number => t !== null);
    let p = 0;
    for (let ms = 0; ms <= 120_000 && run.snapshot().phase !== 'done'; ms += 10) {
      while (p < presses.length && presses[p]! * 1000 <= ms) {
        run.press(presses[p]! * 1000);
        p++;
      }
      run.advance(ms);
      if (run.snapshot().phase === 'recover') break;
    }
    return { out, run };
  }

  it('a press on the first beep is made on the fourth beat, graded Good', () => {
    const { out } = play(true, (i) => (i === firstSolid.index ? cueTimes(firstSolid, timing)[0] + 0.01 : null));
    const jumped = out.find((e) => e.type === EVENT_TYPES.jumped)!;
    expect(jumped.at).toBeCloseTo(idealPress(firstSolid, timing), 6);
    expect(out.find((e) => e.type === EVENT_TYPES.judged)?.data?.grade).toBe('good');
  });

  it('without help the same early press is a fall', () => {
    const { out } = play(false, (i) => (i === firstSolid.index ? cueTimes(firstSolid, timing)[0] + 0.01 : null));
    expect(out.find((e) => e.type === EVENT_TYPES.fallReason)?.data?.reason).toBe('early');
  });

  it('the choice is still the player\'s: a press on one to let pass is still a mistake', () => {
    const { out } = play(true, (i) => {
      if (i < firstPass.index) {
        const o = level.obstacles[i]!;
        return o.solid === false ? null : idealPress(o, timing);
      }
      return i === firstPass.index ? idealPress(firstPass, timing) : null;
    });
    expect(out.find((e) => e.type === EVENT_TYPES.fallReason)?.data?.reason).toBe('wrong');
  });

  it('a flip or a switch says which move was made', () => {
    const flip = level.obstacles.find((o) => o.move === 'flip' && o.solid !== false)!;
    const { out } = play(false, (i) => {
      const o = level.obstacles[i]!;
      return o.solid === false ? null : idealPress(o, timing);
    });
    const made = out.filter((e) => e.type === EVENT_TYPES.jumped && e.data?.index === flip.index);
    expect(made[0]?.data?.move).toBe('flip');
  });
});
