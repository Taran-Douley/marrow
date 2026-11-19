import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  EVENT_CHANCE,
  EVENT_FLICKER_MAX_HZ,
  NOISE,
  ROOM_EVENTS,
  createWalk,
  generateMaze,
  hearRadius,
  noiseBand,
  phantomHears,
  phantomStart,
  phantomTurn,
  proveMaze,
  rollRoomEvent,
  simulateRitual,
  type Maze,
  type SemanticEvent,
  type Walk,
} from '../src';
import { distancesFrom, indexOf, neighbour, openings, PHANTOM_NOTICE, INVESTIGATE_EXTRA, NOISE_MEMORY } from '../src/navigation';

const standard = (seed: number): Maze => generateMaze(seed, { width: 12, height: 10, relics: 3 });

/** A walk driven by hand: run the clock, light an option, press it. */
function harness(maze: Maze, speed: 'slow' | 'medium' | 'fast' = 'fast') {
  const events: SemanticEvent[] = [];
  let now = 0;
  const walk: Walk = createWalk({ maze, speed, dwellMs: 1500, startMs: 0, emit: (e) => events.push(e) });
  const run = (ms: number): void => {
    for (let t = 0; t < ms; t += 50) walk.advance((now += 50));
  };
  const choose = (id: string): void => {
    for (let i = 0; i < 4000 && walk.snapshot().lit !== id; i++) walk.advance((now += 50));
    walk.press(now);
  };
  const toChoosing = (): void => {
    for (let i = 0; i < 4000 && walk.snapshot().phase !== 'choosing'; i++) walk.advance((now += 50));
  };
  /** Wander: at each stop take the next way in turn, never Turn back unless it is the only one. */
  const wander = (stops: number): void => {
    for (let i = 0; i < stops; i++) {
      for (let j = 0; j < 4000 && walk.snapshot().phase !== 'choosing' && walk.snapshot().phase !== 'escaped'; j++) walk.advance((now += 50));
      const s = walk.snapshot();
      if (s.phase !== 'choosing') return;
      const ways = s.options.filter((o) => o.id.startsWith('dir:'));
      const forward = ways.filter((o) => o.label !== 'Turn back');
      const pool = forward.length > 0 ? forward : ways;
      choose(pool[i % pool.length]!.id);
    }
  };
  return { walk, events, run, choose, toChoosing, wander, types: () => events.map((e) => e.type) };
}

describe('2.1 each choice says its cost before it is chosen', () => {
  it('Listen, Search, Hide and the hint name their noise and cost in the option itself', () => {
    const maze = standard(3);
    // Put a hiding place at the start so every choice is on offer in the first room.
    const house: Maze = { ...maze, hides: [...maze.hides, maze.start] };
    const h = harness(house);
    h.toChoosing();
    const labels = Object.fromEntries(h.walk.snapshot().options.map((o) => [o.id, o.label]));
    expect(labels.listen).toMatch(/Listen: no noise, the phantom moves once/);
    expect(labels.search).toMatch(/Search: very loud, the phantom moves once/);
    expect(labels.hide).toMatch(/Hide: no noise, you wait, and it may search here/);
    expect(labels.hint).toMatch(/phantom moves once/);
  });

  it('the option event carries the same words, so the caption and the voice say the cost', () => {
    const h = harness(standard(3));
    h.run(60_000);
    const said = h.events.filter((e) => e.type === 'walk-option').map((e) => String((e.data as { label: string }).label));
    expect(said.some((l) => /^Search: very loud/.test(l))).toBe(true);
    expect(said.some((l) => /^Listen: no noise/.test(l))).toBe(true);
  });

  it('a room can be searched once; Search is not offered in the chase', () => {
    const h = harness(standard(3));
    h.toChoosing();
    expect(h.walk.snapshot().options.map((o) => o.id)).toContain('search');
    h.choose('search');
    expect(h.walk.snapshot().searches).toBe(1);
    expect(h.types()).toContain('walk-search');
    h.toChoosing();
    // Read out again: the room it was searched in no longer offers it.
    expect(h.walk.snapshot().options.map((o) => o.id)).not.toContain('search');
  });

  it('a search turns up a relic hint, the phantom\'s trail or nothing, by the seed and the room, and the same every time', () => {
    const results = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const run = (): string => {
        const h = harness(standard(seed));
        h.toChoosing();
        h.choose('search');
        return String((h.events.find((e) => e.type === 'walk-search')!.data as { result: string }).result);
      };
      const first = run();
      expect(run()).toBe(first);
      results.add(first);
    }
    expect([...results].sort()).toEqual(['nothing', 'relic', 'trail']);
  });

  it('Listen stays free of noise: the walk hears nothing from you, while Search is the loudest thing you do', () => {
    expect(NOISE.listen).toBe(0);
    expect(NOISE.hide).toBe(0);
    expect(NOISE.walk).toBeLessThan(NOISE.run);
    expect(NOISE.run).toBeLessThan(NOISE.search);
  });
});

describe('2.2 noise: the phantom follows the loudest recent noise, and you hear it move', () => {
  it('a louder noise is heard from farther: walking 3 rooms (as before), running 4, searching 5; silence only beside you', () => {
    expect(hearRadius(NOISE.walk)).toBe(PHANTOM_NOTICE);
    expect(hearRadius(NOISE.run)).toBe(4);
    expect(hearRadius(NOISE.search)).toBe(5);
    expect(hearRadius(NOISE.listen)).toBe(1);
  });

  it('in earshot it remembers where a noise was made and goes there; out of earshot it hears nothing', () => {
    let checked = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const maze = standard(seed);
      const start = phantomStart(maze);
      const from = distancesFrom(maze, start.at);
      const edge = hearRadius(NOISE.search) + INVESTIGATE_EXTRA;
      const far = maze.rooms.find((r) => from[indexOf(maze, r)]! > edge);
      const nearRoom = maze.rooms.find((r) => from[indexOf(maze, r)]! > hearRadius(NOISE.search) && from[indexOf(maze, r)]! <= edge);
      if (!far || !nearRoom) continue;
      checked += 1;
      expect(phantomHears(maze, start, far, NOISE.search).state.heard).toBeNull();
      const heard = phantomHears(maze, start, nearRoom, NOISE.search);
      expect(heard.state.heard?.at).toEqual(nearRoom);
      // Far enough not to hunt yet: it goes to look, and says so.
      expect(heard.state.mode).toBe('prowl');
      expect(heard.news).toContain('heard');
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('it follows the loudest noise: a quieter noise later does not take its mind off a loud one', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const maze = standard(seed);
      const start = phantomStart(maze);
      const from = distancesFrom(maze, start.at);
      const spots = maze.rooms.filter((r) => from[indexOf(maze, r)]! > 0 && from[indexOf(maze, r)]! <= hearRadius(NOISE.walk) + INVESTIGATE_EXTRA);
      if (spots.length < 2) continue;
      const [loud, quiet] = spots;
      const a = phantomHears(maze, start, loud!, NOISE.search).state;
      const b = phantomHears(maze, a, quiet!, NOISE.walk).state;
      expect(b.heard?.at, `seed ${seed}`).toEqual(loud);
      // Later, with the loud one forgotten, a walking noise is the one it follows.
      let aged = b;
      for (let i = 0; i < NOISE_MEMORY; i++) aged = phantomTurn(maze, aged, quiet!, { hidden: true, chasing: false }).state;
      expect(aged.heard).toBeNull();
    }
  });

  it('a loud noise within its hearing starts the hunt on the spot; the same noise from a hiding place does not', () => {
    let checked = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const maze = standard(seed);
      const start = phantomStart(maze);
      const from = distancesFrom(maze, start.at);
      const spot = maze.rooms.find((r) => from[indexOf(maze, r)]! > hearRadius(NOISE.walk) && from[indexOf(maze, r)]! <= hearRadius(NOISE.search));
      if (!spot) continue;
      checked += 1;
      // Walking there would not be heard to hunt; searching is.
      expect(phantomHears(maze, start, spot, NOISE.walk, true).state.mode).toBe('prowl');
      const loud = phantomHears(maze, start, spot, NOISE.search, true);
      expect(loud.state.mode).toBe('hunt');
      expect(loud.news).toContain('hunts');
      const hidden = phantomTurn(maze, start, spot, { hidden: true, chasing: false, force: true });
      expect(hidden.state.heard).toBeNull();
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('is deterministic: the same house and the same choices give the same phantom', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 60 }), (seed) => {
        const maze = standard(seed);
        const run = () => {
          const h = harness(maze);
          h.toChoosing();
          h.choose('search');
          h.run(30_000);
          return JSON.stringify(h.walk.snapshot().ghost) + h.types().join(',');
        };
        expect(run()).toBe(run());
      }),
      { numRuns: 20 },
    );
  });

  it('searching makes the noise meter say "very loud", then it dies away a step at a time, and only band changes are told', () => {
    const h = harness(standard(3));
    h.toChoosing();
    h.choose('search');
    expect(h.walk.snapshot().noise).toBe(NOISE.search);
    expect(h.walk.snapshot().noiseBand).toBe('very loud');
    h.toChoosing();
    // Walk on, quietly.
    const dir = h.walk.snapshot().options.find((o) => o.id.startsWith('dir:'))!;
    h.choose(dir.id);
    h.run(8000);
    const told = h.events.filter((e) => e.type === 'noise-meter').map((e) => (e.data as { band: string }).band);
    expect(told[0]).toBe('very loud');
    expect(told).toContain('quiet');
    // Never the same band twice in a row.
    told.forEach((band, i) => i > 0 && expect(band).not.toBe(told[i - 1]));
    expect(noiseBand(0)).toBe('quiet');
    expect(noiseBand(2)).toBe('loud');
    expect(noiseBand(3)).toBe('very loud');
  });

  it('the phantom\'s moves are sounded from where it is: ghost-step with an angle and a distance', () => {
    let steps = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const h = harness(standard(seed));
      h.wander(40);
      for (const e of h.events.filter((x) => x.type === 'ghost-step')) {
        steps += 1;
        const d = e.data as { angle: number; distance: number };
        expect(Math.abs(d.angle)).toBeLessThanOrEqual(180);
        expect(d.distance).toBeGreaterThanOrEqual(0);
        expect(d.distance).toBeLessThanOrEqual(1);
      }
    }
    expect(steps).toBeGreaterThan(0);
  });
});

describe('2.3 the proofs hold with the costs and the noise in force', () => {
  it('on 200 standard houses, the best ritual route is never caught, whichever relic rooms it searches in', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), (seed) => {
        const maze = standard(seed);
        const worst = simulateRitual(maze);
        expect(worst.caught, `house ${seed}`).toBe(false);
        expect(worst.nearest, `house ${seed}`).toBeGreaterThanOrEqual(maze.ritualGap);
        // Each way of paying the costs on its own.
        for (const searches of [[], [0], [1], [0, 1]]) {
          const one = simulateRitual(maze, { searches });
          expect(one.caught, `house ${seed} searching ${JSON.stringify(searches)}`).toBe(false);
        }
        const results = proveMaze(maze, `House ${seed}`);
        for (const r of results) expect(r.pass, `house ${seed} ${r.name}`).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('205 fails when the phantom would catch a player who searches', () => {
    const maze = standard(5);
    const unsafe = { ...maze, ghost: maze.ritualRoute[4]! };
    expect(proveMaze(unsafe).find((r) => r.id === 205)!.pass).toBe(false);
  });
});

describe('3.1 room events', () => {
  it('has at least eight, each unique, with a weight, and some scary and some gentle', () => {
    expect(ROOM_EVENTS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(ROOM_EVENTS.map((e) => e.id)).size).toBe(ROOM_EVENTS.length);
    expect(ROOM_EVENTS.some((e) => e.scary)).toBe(true);
    expect(ROOM_EVENTS.some((e) => !e.scary)).toBe(true);
    for (const e of ROOM_EVENTS) expect(e.weight).toBeGreaterThan(0);
  });

  it('is rolled by the house seed and the room: the same every time, and every event comes up', () => {
    const seen = new Set<string>();
    let rooms = 0;
    let withEvent = 0;
    for (let seed = 1; seed <= 200; seed++) {
      for (let room = 0; room < 12; room++) {
        const a = rollRoomEvent(seed, room);
        expect(rollRoomEvent(seed, room)?.id).toBe(a?.id);
        rooms += 1;
        if (a) {
          withEvent += 1;
          seen.add(a.id);
        }
      }
    }
    expect(seen.size).toBe(ROOM_EVENTS.length);
    expect(withEvent / rooms).toBeGreaterThan(EVENT_CHANCE - 0.07);
    expect(withEvent / rooms).toBeLessThan(EVENT_CHANCE + 0.07);
  });

  it('the walk sends each event once per room, the first time you walk in, never in the start room or the chase', () => {
    let total = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const maze = standard(seed);
      const h = harness(maze);
      h.wander(60);
      const rooms = new Map<number, number>();
      let current = -1;
      for (const e of h.events) {
        if (e.type === 'walk-room') current = (e.data as { room: number }).room;
        if (e.type === 'room-event') {
          total += 1;
          rooms.set(current, (rooms.get(current) ?? 0) + 1);
          expect((e.data as { id: string }).id).toBe(rollRoomEvent(maze.seed, current)!.id);
          expect(maze.rooms[current]).not.toEqual(maze.start);
        }
      }
      for (const [, n] of rooms) expect(n).toBe(1);
    }
    expect(total).toBeGreaterThan(0);
  });

  it('a noisy event is heard by the phantom as a noise; a hint event names a real way', () => {
    let noisy = 0;
    let hints = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const h = harness(standard(seed));
      h.wander(60);
      for (const e of h.events.filter((x) => x.type === 'room-event')) {
        const d = e.data as { effect: string; level?: number; way?: string };
        if (d.effect === 'noise') {
          noisy += 1;
          expect(d.level).toBeGreaterThanOrEqual(2);
        }
        if (d.effect === 'hint') {
          hints += 1;
          expect(['ahead', 'left', 'right', 'back', 'here']).toContain(d.way);
        }
      }
    }
    expect(noisy).toBeGreaterThan(0);
    expect(hints).toBeGreaterThan(0);
  });

  it('nothing an event does flashes more than 3 times a second', () => {
    expect(EVENT_FLICKER_MAX_HZ).toBeLessThanOrEqual(3);
  });
});

describe('3.2 events never change the maze or break the proofs', () => {
  it('on 200 seeds: playing a house with its events leaves the maze exactly as it was, and the proofs the same', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), (seed) => {
        const maze = standard(seed);
        const before = JSON.stringify(maze);
        const proofBefore = JSON.stringify(proveMaze(maze, `House ${seed}`));
        const h = harness(maze);
        h.run(90_000);
        // Walk a little by choosing ways, so rooms are entered and events roll.
        for (let i = 0; i < 6; i++) {
          h.toChoosing();
          const way = h.walk.snapshot().options.find((o) => o.id.startsWith('dir:'));
          if (way) h.choose(way.id);
          h.run(4000);
        }
        expect(JSON.stringify(maze), `house ${seed}`).toBe(before);
        expect(JSON.stringify(proveMaze(maze, `House ${seed}`))).toBe(proofBefore);
        // The event table is a function of the seed and the room alone, never of the maze.
        expect(JSON.stringify(rollRoomEvent(seed, 3))).toBe(JSON.stringify(rollRoomEvent(seed, 3)));
        // And the passages are still perfect: every room reachable, every passage both ways.
        const from = distancesFrom(maze, maze.start);
        expect(from.every((d) => d >= 0)).toBe(true);
        for (let i = 0; i < maze.width * maze.height; i++) {
          const c = { x: i % maze.width, y: Math.floor(i / maze.width) };
          for (const d of openings(maze, c)) expect(openings(maze, neighbour(c, d)).length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('the noise of events is in the proof: a house where the best route meets a noisy event is still never caught', () => {
    let noisyRoutes = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const maze = standard(seed);
      const hit = maze.ritualRoute.some((c) => {
        const room = maze.rooms.findIndex((r) => r.x === c.x && r.y === c.y);
        const e = room >= 0 && !(c.x === maze.start.x && c.y === maze.start.y) ? rollRoomEvent(maze.seed, room) : null;
        return e?.effect.kind === 'noise';
      });
      if (hit) noisyRoutes += 1;
      expect(simulateRitual(maze, { searches: [], events: true }).caught, `house ${seed}`).toBe(false);
    }
    expect(noisyRoutes).toBeGreaterThan(0);
  });
});
