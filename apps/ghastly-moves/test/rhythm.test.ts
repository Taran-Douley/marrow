import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { pulseAt, totalSpokenMs, wordsHoldMs, type Run, type SemanticEvent, type Speed } from '@marrow/skeleton';
import { createGhastlyKit } from '../src/kit';
import { PUMPKIN_PATTERN, bossTells, patternByEar, tellsClearOfCountdowns, volleysOf, type BossPattern } from '../src/pattern';
import { farKey, parseFar, percentPassed, withFar } from '../src/progress';
import { STAGES } from '../src/stages';

// The Ghastly Moves rhythm spec (ghastly-rhythm-v2), Stage 1: locked to the song, instant retry, pulses,
// the Pumpkin King's pattern, and the best-so-far numbers.

const SEEDS = fc.integer({ min: 1, max: 1_000_000 });
const SPEEDS: Speed[] = ['slow', 'medium', 'fast'];

describe('property 19: locked to the song', () => {
  it('every press is a whole number of beats in, and every countdown is inside one non-rest part, for every stage song (250 seeds each)', () => {
    for (const s of STAGES) {
      const kit = createGhastlyKit(s);
      fc.assert(
        fc.property(SEEDS, (seed) => {
          const results = kit.prove(kit.generate(seed), `${s.name} ${seed}`);
          const locked = results.find((r) => r.id === 19)!;
          expect(locked, s.name).toBeDefined();
          expect(locked.counterexamples ?? [], `${s.name} ${seed}`).toEqual([]);
        }),
        { numRuns: 250 },
      );
    }
  });

  it('a press off the beat is refused, in plain words', () => {
    const kit = createGhastlyKit(STAGES[0]!);
    const level = kit.generate(3);
    const moved = { ...level, obstacles: level.obstacles.map((o, i) => (i === 2 ? { ...o, start: o.start + 0.1 } : o)) };
    const locked = kit.prove(moved).find((r) => r.id === 19)!;
    expect(locked.pass).toBe(false);
    expect(locked.counterexample).toMatch(/obstacle 3 .*whole number of beats/);
  });
});

describe('property 20: instant retry', () => {
  /** Real ms from each fall until level time moves again, for an obstacle the player never presses at. */
  function retries(speed: Speed): number[] {
    const kit = createGhastlyKit(STAGES[0]!);
    const profile = { ...kit.newProfile(), speed };
    const level = kit.generate(1);
    let clock = 0;
    let run!: Run;
    const falls: number[] = [];
    const restarts: number[] = [];
    const again: boolean[] = [];
    run = kit.run({
      level,
      speed,
      startReal: 0,
      emit: (event: SemanticEvent) => {
        if (event.type !== 'fall-reason') return;
        falls.push(clock);
        again.push(event.data?.again === true);
        // What the game does (main.ts): the first fall at an obstacle holds for its words; a repeat does not.
        if (event.data?.again !== true) {
          const ms = totalSpokenMs(kit.render(event, profile));
          run.holdForWords(clock, wordsHoldMs(ms));
        }
      },
      onRestart: () => restarts.push(clock),
    });
    while (restarts.length < 4 && clock < 600_000) {
      clock += 5;
      run.advance(clock);
    }
    expect(again.slice(0, 4)).toEqual([false, true, true, true]);
    return restarts.map((r, i) => r - falls[i]!);
  }

  it('after a repeat fall, level time moves again in under 1000 ms at slow, medium and fast', () => {
    for (const speed of SPEEDS) {
      const delays = retries(speed);
      for (const ms of delays.slice(1)) expect(ms, `${speed}: ${delays.join(', ')}`).toBeLessThan(1000);
    }
  });

  it('the first fall at an obstacle may wait for the words that teach, and says the sum', () => {
    const kit = createGhastlyKit(STAGES[0]!);
    const said = (data: Record<string, unknown>): string[] =>
      kit.render({ type: 'fall-reason', at: 0, data }).flatMap((c) => (c.channel === 'speech' ? [c.text] : []));
    expect(said({ reason: 'wrong', value: 7, explain: '7 is odd. Even numbers end in 0, 2, 4, 6 or 8.', attempt: 2 })).toEqual([
      'Wrong number. 7 is odd. Even numbers end in 0, 2, 4, 6 or 8.',
    ]);
    // A repeat fall: the short reason and the attempt, nothing else.
    expect(said({ reason: 'wrong', value: 7, attempt: 3, again: true })).toEqual(['Wrong number. Attempt 3.']);
    expect(said({ reason: 'early', attempt: 4, again: true })).toEqual(['Early. Attempt 4.']);
    expect(said({ reason: 'late', attempt: 5, again: true })).toEqual(['Late. Attempt 5.']);
    expect(said({ reason: 'none', attempt: 6, again: true })).toEqual(['Missed. Attempt 6.']);
  });

  it('a stage level carries the proof of it', () => {
    for (const s of STAGES) {
      const kit = createGhastlyKit(s);
      const result = kit.prove(kit.generate(2)).find((r) => r.id === 20)!;
      expect(result?.pass, s.name).toBe(true);
    }
  });
});

describe('property 21: gentle pulses', () => {
  it('every stage tempo pulses at most 3 times a second at every speed, never with reduced motion, and passes', () => {
    for (const s of STAGES) {
      const kit = createGhastlyKit(s);
      const result = kit.provePresentation(kit.generate(2)).find((r) => r.id === 21)!;
      expect(result, s.name).toBeDefined();
      expect(result.counterexamples ?? [], s.name).toEqual([]);
      for (const speed of SPEEDS) expect(kit.timing.rates[speed] / kit.timing.beat, `${s.name} ${speed}`).toBeLessThanOrEqual(3);
      for (let t = 0; t < 10; t += 0.013) expect(pulseAt(t, kit.timing.beat, true)).toBe(0);
    }
  });
});

describe('the Pumpkin King pattern, read by sound alone', () => {
  const stage = STAGES[0]!;
  const kit = createGhastlyKit(stage, { boss: true });

  it('passes every proof, and the pattern proofs 19, 22 and 23, on 250 seeds', () => {
    fc.assert(
      fc.property(SEEDS, (seed) => {
        const results = kit.prove(kit.generate(seed), `boss ${seed}`);
        expect(results.map((r) => r.id)).toEqual(expect.arrayContaining([15, 19, 20, 22, 23]));
        expect(results.filter((r) => !r.pass).map((r) => r.counterexample)).toEqual([]);
      }),
      { numRuns: 250 },
    );
  });

  it('plays the same volleys in the same order, each announced by a tell a whole bar ahead, and every throw is its volley\'s kind', () => {
    const level = kit.generate(5);
    const volleys = volleysOf(level);
    const tells = bossTells(level);
    expect(volleys.map((v) => v.id)).toEqual(PUMPKIN_PATTERN.volleys);
    expect(tells.map((t) => t.id)).toEqual(PUMPKIN_PATTERN.volleys);
    const bar = 4 * kit.timing.beat;
    volleys.forEach((v, i) => {
      expect(tells[i]!.until - tells[i]!.at).toBeCloseTo(bar, 9);
      expect(v.from).toBeCloseTo(tells[i]!.until, 9);
      expect(v.obstacles.length).toBeGreaterThan(0);
      const kind = PUMPKIN_PATTERN.throws.find((t) => t.id === v.id)!;
      for (const o of v.obstacles) expect(o.kind).toBe(kind.name);
    });
  });

  it('each kind of throw has its own sound, different in pitch and in timbre, and so does its tell', () => {
    const [lob, roll] = PUMPKIN_PATTERN.throws;
    const sound = (type: string) => {
      const cmd = kit.render({ type, at: 0 }).find((c) => c.channel === 'sound');
      return cmd && cmd.channel === 'sound' ? cmd : undefined;
    };
    expect(kit.registry.get(lob!.name)!.sound).toMatchObject({ hz: 659, wave: 'sine' });
    expect(kit.registry.get(roll!.name)!.sound).toMatchObject({ hz: 392, wave: 'square' });
    const a = sound('boss-tell-lob')!;
    const b = sound('boss-tell-roll')!;
    expect(a.wave).not.toBe(b.wave);
    expect(Math.max(a.hz, b.hz) / Math.min(a.hz, b.hz)).toBeGreaterThan(1.25);
    const c = sound('boss-throw-lob')!;
    const d = sound('boss-throw-roll')!;
    expect(c.shape?.noise).toBe(true);
    expect(d.shape?.noise).not.toBe(true);
  });

  it('a tell is a sound, a caption and words, and is felt', () => {
    for (const t of PUMPKIN_PATTERN.throws) {
      const cmds = kit.render({ type: `boss-tell-${t.id}`, at: 0 });
      const senses = new Set(cmds.flatMap((c) => c.senses));
      expect([...senses].sort()).toEqual(['hearing', 'sight', 'touch']);
      expect(cmds.some((c) => c.channel === 'captions' && c.text === t.tell.caption)).toBe(true);
      expect(cmds.some((c) => c.channel === 'speech' && c.text === t.tell.say)).toBe(true);
    }
    expect(kit.proveEvents().pass).toBe(true);
  });

  it('presses stay on the beat in the fight, and a tell never meets a countdown at any speed', () => {
    const level = kit.generate(9);
    for (const o of level.obstacles) {
      const press = o.start + (o.width - kit.timing.airtime) / 2;
      expect(Math.abs(press / kit.timing.beat - Math.round(press / kit.timing.beat))).toBeLessThan(1e-6);
    }
  });

  it('refuses a pattern whose sounds cannot be told apart', () => {
    const same: BossPattern = {
      ...PUMPKIN_PATTERN,
      throws: PUMPKIN_PATTERN.throws.map((t) => ({ ...t, beep: { hz: 440, wave: 'square' as const } })),
    };
    const result = patternByEar(same)(kit.generate(1), { objects: kit.registry, timing: kit.timing });
    expect(result.pass).toBe(false);
    expect(result.counterexample).toMatch(/beeps of the lobbed bomb and the rolled bomb cannot be told apart/);
  });

  it('refuses a tell too long to fit before the throw, and a level that breaks the pattern', () => {
    const long: BossPattern = {
      ...PUMPKIN_PATTERN,
      throws: PUMPKIN_PATTERN.throws.map((t) => ({ ...t, tell: { ...t.tell, say: 'Lobbed bombs are coming at you from above, so be ready now.' } })),
    };
    const level = kit.generate(1);
    const input = { objects: kit.registry, timing: kit.timing };
    expect(tellsClearOfCountdowns(long)(level, input).pass).toBe(false);
    const swapped = { ...level, obstacles: level.obstacles.map((o, i) => (i === 0 ? { ...o, kind: 'rolled-bomb' } : o)) };
    const broken = patternByEar(PUMPKIN_PATTERN)(swapped, input);
    expect(broken.pass).toBe(false);
    expect(broken.counterexample).toMatch(/turns up in a volley/);
  });

  it('keeps health, hits and the item reward: the need comes from the throws in the song', () => {
    const throws = kit.generate(1 + 7919).obstacles.length;
    expect(throws).toBeGreaterThanOrEqual(8);
    expect(Math.ceil(stage.boss.need * throws)).toBeGreaterThan(throws / 2);
    expect(stage.boss.item.name).toBe('Pumpkin Lantern');
  });
});

describe('progress, attempt and best', () => {
  it('counts the share of a level passed', () => {
    expect(percentPassed(0, 12)).toBe(0);
    expect(percentPassed(3, 12)).toBe(25);
    expect(percentPassed(12, 12)).toBe(100);
    expect(percentPassed(5, 0)).toBe(0);
  });

  it('keeps the best per stage and per boss, never lowers it, and ignores bad saved data', () => {
    const key = farKey(1, false, 3);
    const bossKey = farKey(1, true, 3);
    expect([key, bossKey, farKey(undefined, false, 7)]).toEqual(['1', '1b', 't7']);
    let far = withFar({}, key, 40);
    far = withFar(far, key, 25);
    far = withFar(far, bossKey, 60);
    expect(far).toEqual({ '1': 40, '1b': 60 });
    expect(parseFar(JSON.stringify(far))).toEqual(far);
    for (const raw of [null, '', 'nope', '[]', '{"x":5}', '{"1":-3}', '{"1":"a"}', '{"1":101}', '{"1":4.5}']) expect(parseFar(raw)).toEqual({});
    expect(parseFar('{"2":50,"x":5}')).toEqual({ '2': 50 });
  });
});
