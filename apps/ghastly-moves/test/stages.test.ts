import { describe, expect, it } from 'vitest';
import { cuesAudible, trackClearOfCues, validateTrack } from '@marrow/skeleton';
import { createGhastlyKit } from '../src/kit';
import {
  describeNext,
  emptyProgress,
  itemsWon,
  mapLines,
  nextStage,
  parseProgress,
  withBoss,
  withRank,
} from '../src/progress';
import { STAGES, bossTrackOf, evenNumbers, isPrime, multiplesOf, needed, primeNumbers, squareNumbers } from '../src/stages';
import { TRACKS } from '../src/tracks';

describe('the story', () => {
  it('has seven places, each with its own maths, scenery, track and boss', () => {
    expect(STAGES).toHaveLength(7);
    expect(new Set(STAGES.map((s) => s.rule)).size).toBe(7);
    expect(new Set(STAGES.map((s) => s.track.name)).size).toBe(7);
    expect(new Set(STAGES.map((s) => s.boss.item.id)).size).toBe(7);
    expect(new Set(STAGES.map((s) => s.boss.name)).size).toBe(7);
    // Not all multiples: even numbers, squares and primes are in the story.
    expect(STAGES.map((s) => s.lesson.prompt).join(' ')).toMatch(/even number/);
    expect(STAGES.map((s) => s.lesson.prompt).join(' ')).toMatch(/square number/);
    expect(STAGES.map((s) => s.lesson.prompt).join(' ')).toMatch(/prime number/);
  });

  it('every boss has harder numbers and more stones than its stage', () => {
    for (const s of STAGES) {
      expect(s.boss.lesson.values[1], s.name).toBeGreaterThan(s.lesson.values[1]);
      expect(s.boss.count, s.name).toBeGreaterThanOrEqual(s.count);
      expect(needed(s.boss)).toBeGreaterThan(s.boss.count / 2);
      expect(needed(s.boss)).toBeLessThan(s.boss.count);
    }
  });

  it('every stage and every boss passes the whole proof for 30 levels, and so does its events', () => {
    for (const s of STAGES) {
      for (const boss of [false, true]) {
        const kit = createGhastlyKit(s, { boss });
        const count = boss ? s.boss.count : s.count;
        for (let seed = 1; seed <= 30; seed++) {
          const level = kit.generate(seed, { count });
          // A boss fight has a set number of throws; a stage is as long as its song.
          if (boss) expect(level.obstacles).toHaveLength(count);
          else expect(level.obstacles.length, s.name).toBeGreaterThanOrEqual(s.count);
          const failing = kit.prove(level).filter((r) => !r.pass);
          expect(failing.map((r) => r.counterexample), `${s.name} boss=${boss} level ${seed}`).toEqual([]);
        }
        expect(kit.proveEvents().pass, `${s.name} events`).toBe(true);
      }
    }
  });

  it('the music never hides the beeps: audible and clear of their pitch, in every stage and boss, at every speed', () => {
    for (const s of STAGES) {
      for (const boss of [false, true]) {
        const kit = createGhastlyKit(s, { boss });
        for (const speed of ['slow', 'medium', 'fast'] as const) {
          const profile = { ...kit.newProfile(), speed };
          for (const seed of [1, 7, 19]) {
            const commands = kit.renderLevel(kit.generate(seed, { count: boss ? s.boss.count : s.count }), profile);
            expect(commands.some((c) => c.channel === 'sound' && c.role === 'music' && c.shape?.span !== undefined)).toBe(true);
            expect(cuesAudible(commands).counterexamples ?? [], `${s.name} boss=${boss} ${speed}`).toEqual([]);
            expect(trackClearOfCues(commands).counterexamples ?? [], `${s.name} boss=${boss} ${speed}`).toEqual([]);
          }
        }
      }
    }
  });

  it('every track is valid, and a boss track is a heavier version of its stage tune', () => {
    for (const t of TRACKS) expect(() => validateTrack(t)).not.toThrow();
    for (const s of STAGES) {
      const boss = bossTrackOf(s);
      expect(() => validateTrack(boss)).not.toThrow();
      expect(boss.rootHz).toBeLessThan(s.track.rootHz);
      expect(boss.kick.join('').replace(/\./g, '').length).toBeGreaterThan(s.track.kick.join('').replace(/\./g, '').length / 2);
    }
  });

  it('the maths rules are right and they teach', () => {
    const l = multiplesOf([4, 6]);
    expect(l.isTarget(8)).toBe(true);
    expect(l.isTarget(18)).toBe(true);
    expect(l.isTarget(10)).toBe(false);
    expect(l.explainWrong!(10)).toBe('10 is not a multiple of 4 or 6.');
    expect(l.explainMiss!(18)).toBe('18 is a multiple of 6: 3 times 6.');
    expect(() => multiplesOf([])).toThrow();

    const even = evenNumbers([1, 30]);
    expect(even.isTarget(12)).toBe(true);
    expect(even.explainWrong!(7)).toMatch(/7 is odd/);

    const sq = squareNumbers([1, 100]);
    expect([1, 4, 9, 100].every((v) => sq.isTarget(v))).toBe(true);
    expect([2, 8, 99].some((v) => sq.isTarget(v))).toBe(false);
    expect(sq.explainMiss!(49)).toBe('49 is a square: 7 times 7.');

    const prime = primeNumbers([2, 50]);
    expect([2, 3, 5, 47].every((v) => prime.isTarget(v))).toBe(true);
    expect([1, 4, 9, 49].some((v) => prime.isTarget(v))).toBe(false);
    expect(prime.explainWrong!(49)).toBe('49 is not prime: 7 times 7 makes 49.');
    expect(isPrime(97)).toBe(true);
    expect(isPrime(91)).toBe(false);
  });
});

describe('the boss lines', () => {
  const kit = createGhastlyKit(STAGES[0]!, { boss: true });
  const said = (type: string, data: Record<string, unknown>): string => {
    const cmd = kit.render({ type, at: 0, data }).find((c) => c.channel === 'speech');
    return cmd && 'text' in cmd ? cmd.text : '';
  };

  it('a lost boss laughs, says what is needed, and invites another try', () => {
    expect(said('boss-lost', { boss: 'The Pumpkin King', hits: 6, need: 9 })).toBe(
      'The Pumpkin King laughs. You hit 6 times. You need 9. You can do it. Press any key to try again.',
    );
  });

  it('a won boss names the item and what it is', () => {
    expect(said('boss-won', { boss: 'The Pumpkin King', item: 'Pumpkin Lantern', blurb: 'A glowing pumpkin for your lantern.' })).toBe(
      'You beat The Pumpkin King! You win the Pumpkin Lantern. A glowing pumpkin for your lantern. Press any key to go on.',
    );
  });

  it('every boss line reaches sound, speech and sight', () => {
    for (const type of ['boss-intro', 'boss-won', 'boss-lost', 'stage-clear']) {
      const senses = new Set(kit.render({ type, at: 0, data: { boss: 'B', need: 9, total: 12, right: 1, item: 'I', blurb: 'b', place: 'P', rank: 'S', taunt: 't', prompt: 'p' } }).flatMap((c) => c.senses));
      expect(senses.has('hearing') && senses.has('sight'), type).toBe(true);
    }
  });
});

describe('the boss fight', () => {
  it('every boss throws its own projectile, with its own sound, instead of gravestones', () => {
    const sounds = new Set<string>();
    for (const stage of STAGES) {
      const kit = createGhastlyKit(stage, { boss: true });
      expect(kit.registry.kinds().map((k) => k.name)).toEqual([stage.boss.projectile.name]);
      const def = kit.registry.get(stage.boss.projectile.name)!;
      expect(def.say).toBe(stage.boss.projectile.label);
      expect(typeof def.draw).toBe('function');
      sounds.add(JSON.stringify(def.sound));
      const stoneKit = createGhastlyKit(stage);
      expect(JSON.stringify(stoneKit.registry.get('stone')!.sound)).not.toBe(JSON.stringify(def.sound));
    }
    expect(sounds.size).toBe(1); // one boss sound for the whole game, so a player learns it once
  });

  it('the boss prompt says what to jump and what to let fly through, in words', () => {
    const kit = createGhastlyKit(STAGES[6]!, { boss: true });
    expect(kit.lesson!.prompt).toBe(
      'Jump over every bat with a prime number. The others are duds: let them fly through you. Every right move hurts Count Vexar.',
    );
  });

  it('a throw sounds and is felt, a hit groans and says how many are left, a mistake laughs', () => {
    const kit = createGhastlyKit(STAGES[0]!, { boss: true });
    const senses = (type: string, data?: Record<string, unknown>) =>
      new Set(kit.render(data ? { type, at: 0, data } : { type, at: 0 }).flatMap((c) => c.senses));
    for (const type of ['boss-throw', 'boss-laugh']) expect([...senses(type)].sort()).toEqual(['hearing', 'sight', 'touch']); // sight: the sound marker
    expect([...senses('boss-hurt', { boss: 'B', left: 3 })].sort()).toEqual(['hearing', 'sight', 'touch']);
    const caption = kit.render({ type: 'boss-hurt', at: 0, data: { boss: 'The Pumpkin King', left: 3 } }).find((c) => c.channel === 'captions');
    expect(caption && 'text' in caption ? caption.text : '').toBe('The Pumpkin King hit! 3 to go');
    // The boss's sounds are effects, never cues: they never sit on the beeps' own budget.
    for (const type of ['boss-throw', 'boss-hurt', 'boss-laugh']) {
      for (const c of kit.render({ type, at: 0, data: { boss: 'B', left: 1 } })) if (c.channel === 'sound') expect(c.role).toBe('effect');
    }
  });

  it('target and dud throws look and sound the same, so the answer is never given away', () => {
    const kit = createGhastlyKit(STAGES[2]!, { boss: true });
    const level = kit.generate(4, { count: STAGES[2]!.boss.count });
    const events = kit.levelEvents(level);
    const strip = (o: { index: number }) =>
      events
        .filter((e) => e.data?.index === o.index && e.type !== 'obstacle-approaching')
        .flatMap((e) => kit.render(e))
        .filter((c) => c.channel === 'sound' || c.channel === 'haptics')
        .map((c) => JSON.stringify({ ...c, at: 0 }));
    const target = level.obstacles.find((o) => o.solid !== false)!;
    const dud = level.obstacles.find((o) => o.solid === false)!;
    expect(strip(target)).toEqual(strip(dud));
  });
});

describe('progress and the story map', () => {
  it('starts fresh, and picks up at the next stage', () => {
    const p = emptyProgress();
    expect(nextStage(p)?.id).toBe(1);
    expect(describeNext(p)).toMatch(/No items yet. Next: stage 1, Pumpkin Patch/);
    const after = withBoss(withRank(p, 1, 'A'), 1);
    expect(nextStage(after)?.id).toBe(2);
    expect(itemsWon(after).map((i) => i.name)).toEqual(['Pumpkin Lantern']);
    expect(describeNext(after)).toMatch(/1 of 7 items won. Next: stage 2/);
  });

  it('keeps the best rank only, and the map is told in words', () => {
    let p = withRank(emptyProgress(), 3, 'B');
    p = withRank(p, 3, 'C');
    expect(p.best['3']).toBe('B');
    p = withRank(p, 3, 'S');
    expect(p.best['3']).toBe('S');
    const lines = mapLines(withBoss(p, 3));
    expect(lines).toHaveLength(7);
    expect(lines[2]).toMatch(/boss beaten, Witch.s Broom won. Best rank S/);
    expect(lines[0]).toMatch(/next/);
  });

  it('the finished story says so', () => {
    const done = STAGES.reduce((p, s) => withBoss(p, s.id), emptyProgress());
    expect(nextStage(done)).toBeUndefined();
    expect(describeNext(done)).toMatch(/won every item/);
  });

  it('bad or hostile saved data is a fresh start, not a crash', () => {
    for (const raw of [null, '', 'not json', '[]', '{"cleared":"x"}', '{"cleared":[99,"a",2],"best":{"2":"Z","1":"A","77":"S"}}']) {
      const p = parseProgress(raw);
      expect(Array.isArray(p.cleared)).toBe(true);
    }
    expect(parseProgress('{"cleared":[99,"a",2],"best":{"2":"Z","1":"A","77":"S"}}')).toEqual({ cleared: [2], best: { '1': 'A' } });
  });
});

describe('songs, portals and number gates', () => {
  it('every stage is a song with its own name and tempo, and a rest after the intro', () => {
    expect(new Set(STAGES.map((s) => s.song.song.name)).size).toBe(7);
    for (const s of STAGES) {
      expect(s.song.song.sections[0]!.feel, s.name).toBe('rest');
      expect(s.song.song.sections.some((p) => p.feel === 'rest' && p !== s.song.song.sections[0]), s.name).toBe(true);
    }
    // Slower songs first.
    expect(STAGES[0]!.song.beat).toBeGreaterThanOrEqual(STAGES[6]!.song.beat);
  });

  it('the moves arrive one at a time: jumps, then flips, then gates, then all of them', () => {
    const moves = (i: number) => new Set(STAGES[i]!.song.song.sections.map((p) => p.move ?? 'jump'));
    expect([...moves(0)]).toEqual(['jump']);
    expect(moves(1).has('flip') && !moves(1).has('switch')).toBe(true);
    expect(moves(2).has('switch') && !moves(2).has('flip')).toBe(true);
    expect(moves(3).has('flip') && moves(3).has('switch')).toBe(true);
  });

  it('every stage level, on 100 seeds, passes every proof, the song proofs included', () => {
    for (const s of STAGES) {
      const kit = createGhastlyKit(s);
      for (let seed = 1; seed <= 100; seed++) {
        const results = kit.prove(kit.generate(seed), `${s.name} ${seed}`);
        expect(results.filter((r) => !r.pass).map((r) => r.counterexample)).toEqual([]);
        expect(results.map((r) => r.id)).toEqual(expect.arrayContaining([15, 16, 103, 104]));
      }
    }
  });

  it('spikes only appear in flip parts, gates only in gate parts, and stones only in jump parts', () => {
    for (const s of STAGES) {
      const level = createGhastlyKit(s).generate(5);
      for (const o of level.obstacles) {
        const want = o.move === 'flip' ? 'spike' : o.move === 'switch' ? 'gate' : 'stone';
        expect(o.kind, s.name).toBe(want);
      }
    }
  });

  it('a gate says your number first, then the other, and never which is right', () => {
    const kit = createGhastlyKit(STAGES[2]!);
    const level = kit.generate(3);
    const gate = level.obstacles.find((o) => o.move === 'switch')!;
    const approach = kit.levelEvents(level).find((e) => e.type === 'obstacle-approaching' && e.data?.index === gate.index)!;
    expect(approach.data).not.toHaveProperty('solid');
    const speech = kit.render(approach).find((c) => c.channel === 'speech');
    expect(speech).toMatchObject({ text: `${gate.gate!.here} or ${gate.value}?` });
  });
});

describe('how the game is presented', () => {
  it('every stage and boss passes properties 7 to 11: flashing, two senses, contrast, no hold, every line in the script', () => {
    for (const s of STAGES) {
      for (const boss of [false, true]) {
        const kit = createGhastlyKit(s, { boss });
        const failing = kit.provePresentation(kit.generate(2, { count: boss ? s.boss.count : s.count })).filter((r) => !r.pass);
        expect(failing.map((r) => r.counterexample), `${s.name} boss=${boss}`).toEqual([]);
      }
    }
  });
});
