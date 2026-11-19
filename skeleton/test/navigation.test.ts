import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { compassWord, foldAngle } from '../src/channels/audio';
import {
  createScanner,
  createWalk,
  fewestSteps,
  generateMaze,
  proveMaze,
  scanningAudible,
  walkResult,
  type Maze,
  type Walk,
  type WalkOptions,
} from '../src';
import { distancesFrom, indexOf, neighbour, openings } from '../src/navigation';
import { clipsBySlug, createSoundPlayer, slugOf } from '../src/adapters/web';
import { dwellFor, speechMs } from '../src/scanning';
import type { SemanticEvent } from '../src/types';
import { seedArb } from './helpers/arbitraries';

describe('scanning', () => {
  const options = [
    { id: 'a', label: 'Ahead' },
    { id: 'b', label: 'Left' },
    { id: 'c', label: 'Listen' },
  ];

  it('lights each option in turn, wraps, and never expires', () => {
    const s = createScanner({ options, dwellMs: 2000 });
    expect(s.start(0)?.id).toBe('a');
    let now = 0;
    const seen: string[] = ['a'];
    for (let i = 0; i < 20; i++) {
      now += 3000;
      const moved = s.tick(now);
      if (moved) seen.push(moved.id);
    }
    expect(seen.slice(0, 4)).toEqual(['a', 'b', 'c', 'a']);
    expect(seen.length).toBeGreaterThan(10);
  });

  it('a press chooses the lit option and does not choose by itself', () => {
    const s = createScanner({ options, dwellMs: 2000 });
    s.start(0);
    s.tick(1_000_000);
    expect(s.press()?.id).toBe('b');
  });

  it('lengthens the dwell for long labels', () => {
    const long = { id: 'x', label: 'A very long label that takes a while to say aloud in full' };
    expect(dwellFor(long, 500)).toBeGreaterThan(speechMs(long.label));
    expect(dwellFor({ id: 'y', label: 'Hi' }, 2000)).toBe(2000);
  });

  it('holds still while paused and gives the lit option its full time on resume', () => {
    const s = createScanner({ options, dwellMs: 2000 });
    s.start(0);
    s.pause();
    expect(s.tick(50_000)).toBeNull();
    s.resume(50_000);
    expect(s.tick(51_000)).toBeNull();
    expect(s.tick(52_100)?.id).toBe('b');
  });

  it('property 102 passes for sane menus and fails for duplicate ids', () => {
    expect(scanningAudible(options, 2000).pass).toBe(true);
    const bad = scanningAudible([options[0]!, options[0]!], 2000);
    expect(bad.pass).toBe(false);
    expect((bad.counterexamples ?? []).join(' ')).toMatch(/same id/);
  });
});

describe('recordings by slug', () => {
  it('names a line for a file', () => {
    expect(slugOf('Not that one. 11 is not a multiple of 3.')).toBe('not-that-one-11-is-not-a-multiple-of-3');
    expect(slugOf('Séance Escape!')).toBe('seance-escape');
    expect(slugOf('...')).toBe('line');
  });

  it('finds a file in a folder, and skips lines that were not recorded', () => {
    expect(clipsBySlug('voice')('Dead end. Turning back.')).toBe('voice/dead-end-turning-back.mp3');
    expect(clipsBySlug('voice/', 'ogg')('Left')).toBe('voice/left.ogg');
    const some = clipsBySlug('v', 'mp3', ['left']);
    expect(some('Left')).toBe('v/left.mp3');
    expect(some('Right')).toBeUndefined();
  });
});

describe('true 3D sound in the web adapter', () => {
  function context(withPanner: boolean) {
    const made: { panner?: Record<string, unknown>; stereo: number } = { stereo: 0 };
    const param = () => ({ value: 0, setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined });
    const ctx = {
      currentTime: 0,
      destination: {},
      createOscillator: () => ({ type: '', frequency: param(), connect: () => undefined, start: () => undefined, stop: () => undefined }),
      createGain: () => ({ gain: param(), connect: () => undefined }),
      createStereoPanner: () => {
        made.stereo += 1;
        return { pan: param(), connect: () => undefined };
      },
      ...(withPanner
        ? {
            createPanner: () => {
              const p = { positionX: { value: 0 }, positionY: { value: 0 }, positionZ: { value: 0 }, connect: () => undefined } as Record<string, unknown>;
              made.panner = p;
              return p;
            },
          }
        : {}),
    };
    return { ctx, made };
  }
  const cmd = {
    channel: 'sound' as const,
    senses: ['hearing'] as ['hearing'],
    at: 0,
    role: 'cue' as const,
    hz: 440,
    wave: 'sine' as const,
    gain: 1,
    pan: -0.7,
    space: { x: -0.7, y: 0, z: -0.7 },
  };

  it('places the sound by its direction with a head-related panner and no distance roll-off', () => {
    const { ctx, made } = context(true);
    createSoundPlayer(ctx as never).play(cmd, 0, false);
    expect(made.panner?.panningModel).toBe('HRTF');
    expect(made.panner?.rolloffFactor).toBe(0);
    expect((made.panner?.positionX as { value: number }).value).toBe(-0.7);
    expect((made.panner?.positionZ as { value: number }).value).toBe(-0.7);
    expect(made.stereo).toBe(0);
  });

  it('falls back to stereo when the browser has no 3D panner, and to the centre for mono', () => {
    const none = context(false);
    createSoundPlayer(none.ctx as never).play(cmd, 0, false);
    expect(none.made.stereo).toBe(1);
    const mono = context(true);
    createSoundPlayer(mono.ctx as never).play(cmd, 0, true);
    expect(mono.made.panner).toBeUndefined();
  });
});

describe('placed sound helpers', () => {
  it('folds angles and names directions', () => {
    expect(foldAngle(190)).toBe(-170);
    expect(foldAngle(-190)).toBe(170);
    expect(compassWord(0)).toMatch(/ahead/i);
    expect(compassWord(180)).toMatch(/behind/i);
  });
});

describe('maze', () => {
  it('is deterministic', () => {
    expect(generateMaze(7)).toEqual(generateMaze(7));
    expect(generateMaze(7)).not.toEqual(generateMaze(8));
  });

  it('is connected and the route is the shortest way', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const m = generateMaze(seed);
        expect(distancesFrom(m, m.start).every((d) => d >= 0)).toBe(true);
        expect(m.route.length - 1).toBe(distancesFrom(m, m.start)[indexOf(m, m.exit)]);
      }),
      { numRuns: 100 },
    );
  });

  it('passes properties 201 to 204 for 200 seeds', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const results = proveMaze(generateMaze(seed));
        expect(results.map((r) => r.id)).toEqual([201, 202, 203, 204]);
        for (const r of results) expect(r.counterexamples ?? [], `${r.name}`).toEqual([]);
      }),
      { numRuns: 200 },
    );
  });

  it('works at other sizes and phantom speeds', () => {
    for (const [w, h, g] of [[5, 5, 3], [10, 6, 2], [12, 12, 3]] as const) {
      for (let seed = 1; seed <= 20; seed++) {
        const m = generateMaze(seed, { width: w, height: h, ghostEvery: g, minGhostStart: 4 });
        for (const r of proveMaze(m)) expect(r.counterexamples ?? []).toEqual([]);
      }
    }
  });

  it('explains failures in plain English', () => {
    const m = generateMaze(3);
    const cut: Maze = { ...m, open: m.open.map(() => 0) };
    const r = proveMaze(cut);
    expect(r.find((x) => x.id === 201)!.counterexamples![0]).toMatch(/no way from the start/);

    const near: Maze = { ...m, ghost: m.route[1]! };
    expect(proveMaze(near).find((x) => x.id === 202)!.counterexamples![0]).toMatch(/phantom can be there/);
    expect(proveMaze(near).find((x) => x.id === 203)!.counterexamples![0]).toMatch(/needs at least/);

    const oneWay = { ...m, open: [...m.open] };
    const i = indexOf(m, m.start);
    const d = openings(m, m.start)[0]!;
    oneWay.open[indexOf(m, neighbour(m.start, d))] = 0;
    expect(proveMaze(oneWay).find((x) => x.id === 204)!.counterexamples![0]).toMatch(/not back/);
    expect(i).toBeGreaterThanOrEqual(0);
  });
});

// A harness that plays a walk on a simulated clock.
function harness(maze: Maze, speed: 'slow' | 'medium' | 'fast' = 'medium', extra: Partial<WalkOptions> = {}) {
  const events: { event: SemanticEvent; at: number }[] = [];
  const walk: Walk = createWalk({
    maze,
    speed,
    startMs: 0,
    dwellMs: 1500,
    ...extra,
    emit: (event, at) => events.push({ event, at }),
  });
  let now = 0;
  const run = (ms: number, tickMs = 50): void => {
    const end = now + ms;
    while (now < end) {
      now += tickMs;
      walk.advance(now);
    }
  };
  const types = (): string[] => events.map((e) => e.event.type);
  /** Press when the wanted option is lit; give up after a few cycles. */
  const choose = (id: string): void => {
    for (let i = 0; i < 4000 && walk.snapshot().lit !== id; i++) run(50);
    expect(walk.snapshot().lit).toBe(id);
    walk.press(now);
  };
  const stepsTo = (cell: { x: number; y: number }): number => distancesFrom(maze, cell)[indexOf(maze, maze.exit)]!;
  return { walk, events, run, types, choose, stepsTo, now: () => now };
}

/** Play the shortest route using only scanning choices. */
function playRoute(h: ReturnType<typeof harness>, maze: Maze): void {
  for (let guard = 0; guard < 4000 && h.walk.snapshot().phase !== 'escaped'; guard++) {
    const s = h.walk.snapshot();
    if (s.phase === 'choosing') {
      const want = maze.route.findIndex((c) => c.x === s.cell.x && c.y === s.cell.y);
      const next = maze.route[want + 1]!;
      const dir = openings(maze, s.cell).find((d) => {
        const n = neighbour(s.cell, d);
        return n.x === next.x && n.y === next.y;
      })!;
      h.choose(`dir:${dir}`);
    } else {
      h.run(100);
    }
  }
}

describe('walk', () => {
  it('walks by itself, one room per step, and announces each step', () => {
    const maze = generateMaze(11);
    const h = harness(maze);
    h.run(3000);
    expect(h.types()).toContain('walk-start');
    expect(h.types().filter((t) => t === 'walk-step').length).toBeGreaterThanOrEqual(1);
  });

  it('offers junction options by scanning, ends with Listen, and waits as long as it takes', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const maze = generateMaze(seed);
      const h = harness(maze);
      for (let i = 0; i < 2000 && h.walk.snapshot().phase === 'walking'; i++) h.run(50);
      const s = h.walk.snapshot();
      if (s.phase !== 'choosing') continue;
      const ids = s.options.map((o) => o.id);
      expect(ids[ids.length - 1]).toBe('listen');
      expect(ids.length).toBeGreaterThanOrEqual(3);
      const stepsBefore = s.steps;
      h.run(60_000);
      expect(h.walk.snapshot().steps).toBe(stepsBefore);
      expect(h.walk.snapshot().phase).toBe('choosing');
      expect(h.types()).toContain('walk-option');
      return;
    }
    throw new Error('No seed in 1..30 reached a junction.');
  });

  it('option events carry the angle the option sounds from', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const h = harness(generateMaze(seed));
      for (let i = 0; i < 2000 && h.walk.snapshot().phase === 'walking'; i++) h.run(50);
      if (h.walk.snapshot().phase !== 'choosing') continue;
      h.run(20_000);
      const angles = h.events.filter((e) => e.event.type === 'walk-option').map((e) => (e.event.data as { angle?: number }).angle);
      expect(angles.some((a) => a === 0 || a === -90 || a === 90 || a === 180)).toBe(true);
      return;
    }
  });

  it('a player who takes the shortest route is never caught, on every seed', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const maze = generateMaze(seed);
        const h = harness(maze, 'fast');
        playRoute(h, maze);
        const s = h.walk.snapshot();
        expect(s.phase).toBe('escaped');
        expect(s.catches).toBe(0);
        const result = walkResult(maze, s);
        expect(result.score).toBeGreaterThan(0);
        expect(h.types()).toContain('escaped');
      }),
      { numRuns: 25 },
    );
  });

  it('Listen at a junction costs the phantom one step; the walk then goes on', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const maze = generateMaze(seed);
      const h = harness(maze);
      for (let i = 0; i < 2000 && h.walk.snapshot().phase === 'walking'; i++) h.run(50);
      if (h.walk.snapshot().phase !== 'choosing') continue;
      h.choose('listen');
      expect(h.types()).toContain('walk-listen');
      expect(h.walk.snapshot().listens).toBe(1);
      expect(h.walk.snapshot().phase === 'choosing' || h.walk.snapshot().phase === 'caught').toBe(true);
      return;
    }
  });

  it('a press while walking listens for free, but not twice in a row', () => {
    const h = harness(generateMaze(5), 'slow');
    h.run(900);
    if (h.walk.snapshot().phase !== 'walking') return;
    const before = h.walk.snapshot().steps;
    h.walk.press(h.now());
    h.walk.press(h.now());
    expect(h.walk.snapshot().listens).toBe(1);
    expect(h.walk.snapshot().steps).toBe(before);
  });

  it('being caught sends the player back to the last junction and the phantom home', () => {
    // Make a maze where the phantom starts next to the route, then stand still at a junction and Listen until caught.
    for (let seed = 1; seed <= 40; seed++) {
      const base = generateMaze(seed);
      const maze: Maze = { ...base, ghost: base.route[Math.min(3, base.route.length - 1)]! };
      const h = harness(maze);
      let caught = false;
      for (let i = 0; i < 3000 && !caught; i++) {
        const s = h.walk.snapshot();
        if (s.phase === 'choosing') h.choose('listen');
        else h.run(50);
        caught = h.walk.snapshot().phase === 'caught';
      }
      if (!caught) continue;
      expect(h.types()).toContain('caught');
      for (let i = 0; i < 400 && h.walk.snapshot().phase === 'caught'; i++) h.run(50);
      const s = h.walk.snapshot();
      expect(s.catches).toBeGreaterThanOrEqual(1);
      expect(s.phase).not.toBe('caught');
      expect(s.ghost).toEqual(maze.ghost);
      return;
    }
    throw new Error('Never caught in any trial.');
  });

  it('scores an escape out of 1000 with a rank, and the fewest steps scores best', () => {
    const maze = generateMaze(2);
    const best = walkResult(maze, { steps: fewestSteps(maze), catches: 0 });
    expect(best.score).toBe(1000);
    expect(best.rank).toBe('S');
    const worse = walkResult(maze, { steps: fewestSteps(maze) + 40, catches: 3 });
    expect(worse.score).toBeLessThan(best.score);
  });
});


// ---- speech never talks over speech ----------------------------------------

describe('spoken lines in the walk', () => {
  const SAY: Record<string, number> = { 'ghost-call': 3000, 'walk-listen': 4000 };
  const speechMs = (e: SemanticEvent): number => SAY[e.type] ?? 0;
  const spoken = (e: SemanticEvent): boolean => e.type in SAY;

  /** Walk until the first crossing, with spoken lines timed. */
  function toFirstCrossing(extra: Partial<WalkOptions> = {}) {
    for (let seed = 1; seed <= 40; seed++) {
      const maze = generateMaze(seed);
      const h = harness(maze, 'medium', { speechMs, ...extra });
      for (let i = 0; i < 400 && h.walk.snapshot().phase === 'walking'; i++) h.run(50);
      if (h.walk.snapshot().phase === 'choosing') return { h, maze };
    }
    throw new Error('No seed reached a crossing.');
  }

  it('says where the phantom is at the crossing, and only then reads out the options', () => {
    const { h } = toFirstCrossing();
    h.run(10_000);
    const call = h.events.find((e) => e.event.type === 'ghost-call')!;
    const firstOption = h.events.find((e) => e.event.type === 'walk-option')!;
    expect(call).toBeDefined();
    expect(firstOption.event.at * 1000).toBeGreaterThanOrEqual(call.event.at * 1000 + 3000 - 60);
  });

  it('ghost position is not spoken while walking, only at the crossing', () => {
    const { h } = toFirstCrossing();
    const calls = h.events.filter((e) => e.event.type === 'ghost-call');
    expect(calls).toHaveLength(1);
    const lastStep = h.events.filter((e) => e.event.type === 'walk-step').at(-1)!;
    expect(calls[0]!.at).toBeGreaterThanOrEqual(lastStep.at); // after the last step of the leg, not during it
  });

  it('Listen at a crossing is heard in full before the options start again, from the top, and presses wait', () => {
    const { h } = toFirstCrossing();
    h.run(8000); // let the phantom line and some options pass
    h.choose('listen');
    const pressedAt = h.now();
    h.run(60);
    const listenEvent = h.events.find((e) => e.event.type === 'walk-listen')!;
    expect(listenEvent).toBeDefined();
    // A press while the answer is being given does nothing.
    const stepsBefore = h.walk.snapshot().steps;
    h.walk.press(h.now());
    h.run(500);
    expect(h.walk.snapshot().phase).toBe('choosing');
    expect(h.walk.snapshot().steps).toBe(stepsBefore);
    expect(h.walk.snapshot().lit).toBeNull();
    // The first option after the answer comes only once the answer has finished.
    h.run(6000);
    const after = h.events.filter((e) => e.event.type === 'walk-option' && e.event.at * 1000 > pressedAt);
    expect(after.length).toBeGreaterThan(0);
    expect(after[0]!.event.at * 1000).toBeGreaterThanOrEqual(listenEvent.event.at * 1000 + 4000 - 60);
    const first = (h.walk.snapshot().options[0] ?? { id: '' }).id;
    expect((after[0]!.event.data as { id: string }).id).toBe(first); // from the top
  });

  it('only one spoken line between two crossings, even if the player listens on the way', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const maze = generateMaze(seed);
      const h = harness(maze, 'fast', { speechMs });
      let legSpoken = 0;
      let lastCount = 0;
      let pressedThisLeg = false;
      for (let guard = 0; guard < 6000 && h.walk.snapshot().phase !== 'escaped'; guard++) {
        const s = h.walk.snapshot();
        if (s.phase === 'walking') {
          if (!pressedThisLeg && s.steps % 3 === 1) {
            h.walk.press(h.now());
            pressedThisLeg = true;
          }
          h.run(100);
          continue;
        }
        if (s.phase === 'choosing') {
          const count = h.events.filter((e) => spoken(e.event)).length;
          legSpoken = count - lastCount;
          expect(legSpoken, `seed ${seed}, steps ${s.steps}`).toBeLessThanOrEqual(1);
          lastCount = count;
          // Go the right way.
          const want = maze.route.findIndex((c) => c.x === s.cell.x && c.y === s.cell.y);
          const next = maze.route[want + 1];
          if (!next) break;
          const dir = openings(maze, s.cell).find((d) => {
            const n = neighbour(s.cell, d);
            return n.x === next.x && n.y === next.y;
          })!;
          h.choose(`dir:${dir}`);
          pressedThisLeg = false;
        } else {
          h.run(100);
        }
      }
    }
  });
});

// ---- the ritual: relics, a sealed door, hiding, hints, a prowling phantom and a chase ---------------

describe('ritual houses', () => {
  const ritual = (seed: number, size = 8) => generateMaze(seed, { width: size, height: size, relics: 3 });

  it('a plain maze is unchanged: no rooms, no relics, and only properties 201 to 204', () => {
    const m = generateMaze(9);
    expect(m.rooms).toEqual([]);
    expect(m.relics).toEqual([]);
    expect(proveMaze(m).map((r) => r.id)).toEqual([201, 202, 203, 204]);
  });

  it('is deterministic, with three relics in rooms, and passes 201 to 206 on 120 seeds', () => {
    expect(ritual(4)).toEqual(ritual(4));
    for (let seed = 1; seed <= 120; seed++) {
      const m = ritual(seed);
      expect(m.relics).toHaveLength(3);
      const results = proveMaze(m);
      expect(results.map((r) => r.id)).toEqual([201, 202, 203, 204, 205, 206]);
      for (const r of results) expect(r.counterexamples ?? [], `seed ${seed}: ${r.name}`).toEqual([]);
    }
  });

  it('works in a large house too', () => {
    for (let seed = 1; seed <= 20; seed++) for (const r of proveMaze(ritual(seed, 10))) expect(r.pass, `${seed} ${r.name}`).toBe(true);
  });

  it('explains a ritual that is not safe, in plain words', () => {
    const m = ritual(3);
    const unsafe = { ...m, ghost: m.ritualRoute[3]! };
    const r = proveMaze(unsafe).find((x) => x.id === 205)!;
    expect(r.pass).toBe(false);
    expect(r.counterexample).toMatch(/House 3: (a player doing the ritual the best way is caught|on the best ritual route the phantom comes within)/);
    const misplaced = proveMaze({ ...m, relics: [m.start, m.relics[1]!, m.relics[1]!] }).find((x) => x.id === 206)!;
    expect(misplaced.counterexamples!.join(' ')).toMatch(/at the start or the exit/);
    expect(misplaced.counterexamples!.join(' ')).toMatch(/two relics share/);
  });

  /** Play a ritual house: at every stop, go toward the nearest relic not yet found, then the exit. */
  function playRitual(h: ReturnType<typeof harness>, maze: Maze): void {
    for (let guard = 0; guard < 8000 && h.walk.snapshot().phase !== 'escaped'; guard++) {
      const s = h.walk.snapshot();
      if (s.phase !== 'choosing') {
        h.run(100);
        continue;
      }
      const from = distancesFrom(maze, s.cell);
      const target = [...s.relicsLeft].sort((a, b) => from[indexOf(maze, a)]! - from[indexOf(maze, b)]!)[0] ?? maze.exit;
      const dir = openings(maze, s.cell).find((d) => {
        const n = neighbour(s.cell, d);
        return distancesFrom(maze, n)[indexOf(maze, target)]! < from[indexOf(maze, target)]!;
      })!;
      h.choose(`dir:${dir}`);
    }
  }

  it('a player who does the ritual the best way finds every relic, is never caught, and escapes through the chase', () => {
    for (const seed of [1, 2, 5, 8, 13]) {
      const maze = ritual(seed);
      const h = harness(maze, 'fast');
      playRitual(h, maze);
      const s = h.walk.snapshot();
      expect(s.phase, `seed ${seed}`).toBe('escaped');
      expect(s.catches, `seed ${seed}`).toBe(0);
      expect(s.relicsFound).toBe(3);
      expect(h.types().filter((t) => t === 'walk-relic')).toHaveLength(3);
      expect(h.types()).toContain('walk-ritual');
      expect(h.types().filter((t) => t === 'walk-room').length).toBeGreaterThan(3);
    }
  });

  it('the exit is sealed until every relic is found', () => {
    const maze = ritual(6);
    const h = harness(maze, 'fast');
    // Walk straight for the exit, ignoring the relics.
    for (let guard = 0; guard < 4000; guard++) {
      const s = h.walk.snapshot();
      if (s.phase === 'choosing' && sameCellOf(s.cell, maze.exit)) break;
      if (s.phase !== 'choosing') {
        h.run(100);
        continue;
      }
      const from = distancesFrom(maze, s.cell);
      const dir = openings(maze, s.cell).find((d) => distancesFrom(maze, neighbour(s.cell, d))[indexOf(maze, maze.exit)]! < from[indexOf(maze, maze.exit)]!)!;
      h.choose(`dir:${dir}`);
    }
    const s = h.walk.snapshot();
    if (sameCellOf(s.cell, maze.exit)) {
      expect(s.phase).toBe('choosing');
      expect(h.types()).toContain('walk-sealed');
      expect(h.types()).not.toContain('escaped');
    }
  });

  it('the phantom prowls until it hears you, and the walk says when it starts to hunt', () => {
    const maze = ritual(2);
    const h = harness(maze, 'fast');
    expect(h.walk.snapshot().ghostMode).toBe('prowl');
    // Stand at the start and ask for hints until it finds you: each costs it a move.
    let hunted = false;
    for (let i = 0; i < 400 && !hunted; i++) {
      const s = h.walk.snapshot();
      if (s.phase === 'choosing') h.choose('hint');
      else h.run(100);
      hunted = h.types().includes('ghost-hunts');
    }
    expect(hunted).toBe(true);
  });

  it('a hint names the way to the nearest relic, and it really is that way', () => {
    const maze = ritual(7);
    const h = harness(maze);
    for (let i = 0; i < 400 && h.walk.snapshot().phase !== 'choosing'; i++) h.run(50);
    const before = h.walk.snapshot();
    h.choose('hint');
    const e = h.events.find((x) => x.event.type === 'walk-hint')!.event.data as { what: string; way: string; rooms: number; total: number };
    expect(e.what).toBe('relic');
    expect(e.total).toBe(3);
    expect(['ahead', 'left', 'right', 'back']).toContain(e.way);
    const option = before.options.find((o) => o.label.toLowerCase().startsWith(e.way === 'back' ? 'turn back' : e.way))!;
    const dir = Number(option.id.slice(4)) as 0 | 1 | 2 | 3;
    const nearest = Math.min(...before.relicsLeft.map((r) => distancesFrom(maze, before.cell)[indexOf(maze, r)]!));
    expect(e.rooms).toBe(nearest);
    expect(Math.min(...before.relicsLeft.map((r) => distancesFrom(maze, neighbour(before.cell, dir))[indexOf(maze, r)]!))).toBe(nearest - 1);
  });

  it('hiding: it comes, searches, and moves on, and you are never caught while hidden', () => {
    const base = ritual(11);
    // Put a hiding place at the start, and the phantom two rooms away, so it hears you at once.
    const two = base.rooms.find((r) => distancesFrom(base, base.start)[indexOf(base, r)] === 2) ?? pathTo(base, 2);
    const maze: Maze = { ...base, hides: [...base.hides, base.start], ghost: two };
    const h = harness(maze, 'medium');
    // Wait at the start (asking for hints) until it hears you and starts to hunt, then hide.
    for (let i = 0; i < 40 && !h.types().includes('ghost-hunts'); i++) h.choose('hint');
    expect(h.types()).toContain('ghost-hunts');
    expect(h.walk.snapshot().catches).toBe(0);
    h.choose('hide');
    expect(h.walk.snapshot().phase).toBe('hidden');
    h.run(20_000);
    expect(h.walk.snapshot().catches).toBe(0);
    expect(h.types()).toContain('walk-hide');
    expect(h.types()).toContain('ghost-searched');
    h.choose('come-out');
    expect(h.types()).toContain('walk-unhide');
    expect(h.walk.snapshot().phase).toBe('choosing');
  });

  it('there is no hiding in the chase, and the bell rings every step to lead you out', () => {
    const maze = ritual(5);
    const h = harness(maze, 'fast');
    playRitual(h, maze);
    const ritualAt = h.events.findIndex((e) => e.event.type === 'walk-ritual');
    const afterwards = h.events.slice(ritualAt);
    const steps = afterwards.filter((e) => e.event.type === 'walk-step').length;
    const bells = afterwards.filter((e) => e.event.type === 'exit-sense').length;
    expect(bells).toBeGreaterThanOrEqual(steps - 1);
    const offered = afterwards.filter((e) => e.event.type === 'walk-option').map((e) => (e.event.data as { id: string }).id);
    expect(offered).not.toContain('hide');
  });

  it('a game can add its own words to any event: a room name, a line of story', () => {
    const maze = ritual(4);
    const h = harness(maze, 'fast', { decorate: (type, data) => (type === 'walk-room' ? { name: `Room ${data.room}` } : undefined) });
    for (let i = 0; i < 400 && !h.types().includes('walk-room'); i++) h.run(50);
    const room = h.events.find((e) => e.event.type === 'walk-room')!.event.data as { room: number; name: string };
    expect(room.name).toBe(`Room ${room.room}`);
  });
});

const sameCellOf = (a: { x: number; y: number }, b: { x: number; y: number }): boolean => a.x === b.x && a.y === b.y;
function pathTo(m: Maze, rooms: number): { x: number; y: number } {
  const d = distancesFrom(m, m.start);
  const i = d.findIndex((v) => v === rooms);
  return { x: i % m.width, y: Math.floor(i / m.width) };
}

describe('less waiting at each stop', () => {
  /** Walk a ritual house choosing Listen until caught `times` times, then return the events. */
  function caughtTimes(times: number, settings: WalkOptions['settings'] = {}) {
    for (let seed = 1; seed <= 30; seed++) {
      let maze: Maze;
      try {
        maze = generateMaze(seed, { width: 6, height: 6, relics: 3 });
      } catch {
        continue;
      }
      const h = harness(maze, 'fast', { settings });
      for (let i = 0; i < 400 && h.walk.snapshot().catches < times; i++) {
        const s = h.walk.snapshot();
        if (s.phase === 'choosing') {
          for (let j = 0; j < 200 && h.walk.snapshot().lit !== 'listen' && h.walk.snapshot().phase === 'choosing'; j++) h.run(50);
          if (h.walk.snapshot().lit === 'listen') h.walk.press(h.now());
        }
        h.run(200);
      }
      if (h.walk.snapshot().catches >= times) {
        h.run(4000);
        return h;
      }
    }
    return null;
  }

  it('after two catches a hint is given for free, and it does not cost a move', () => {
    const h = caughtTimes(2);
    expect(h).not.toBeNull();
    const hints = h!.events.filter((e) => e.event.type === 'walk-hint');
    expect(hints.some((e) => e.event.data?.free === true)).toBe(true);
    expect(h!.walk.snapshot().hints).toBe(0); // only hints the player asked for are counted
  });

  it('no free hint when it is turned off', () => {
    const h = caughtTimes(2, { freeHintAfterCatches: 0 });
    expect(h).not.toBeNull();
    expect(h!.events.some((e) => e.event.type === 'walk-hint')).toBe(false);
  });

  it('a far phantom that has not changed is not said again at every stop', () => {
    const count = (ghostCall: 'always' | 'changed') => {
      let calls = 0;
      for (let seed = 1; seed <= 10; seed++) {
        const maze = generateMaze(seed, { width: 10, height: 10 });
        const h = harness(maze, 'fast', { settings: { ghostCall, hearRange: 2 } });
        playRoute(h, maze);
        calls += h.events.filter((e) => e.event.type === 'ghost-call').length;
      }
      return calls;
    };
    const always = count('always');
    const changed = count('changed');
    expect(changed).toBeGreaterThan(0);
    expect(changed).toBeLessThan(always);
  });
});
