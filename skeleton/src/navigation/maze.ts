import { mulberry32 } from '../level';

// The navigation pattern's world: a maze with a start, an exit and a phantom.
// It is built so that it can always be escaped: the phantom never starts where it
// could cut off the shortest route. The proof (navigation/proof.ts) checks it.

/** Directions: 0 north, 1 east, 2 south, 3 west. A heading is a quarter turn clockwise from north. */
export type Dir = 0 | 1 | 2 | 3;
export const DIRS = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
] as const;
export const opposite = (d: Dir): Dir => ((d + 2) % 4) as Dir;

export interface Cell {
  x: number;
  y: number;
}

export interface Maze {
  seed: number;
  width: number;
  height: number;
  /** open[i] has bit d set when you can walk from cell i in direction d. */
  open: number[];
  start: Cell;
  exit: Cell;
  /** Where the phantom begins. */
  ghost: Cell;
  /** The one shortest route from start to exit, cell by cell. */
  route: Cell[];
  /** The phantom moves one cell every this many of the player's steps. */
  ghostEvery: number;
  /** Steps of spare time the route must keep over the phantom. */
  margin: number;
  /** The phantom starts at least this many cells away from the start, along the passages. */
  minGhostStart: number;
  /**
   * Places the walk stops at, whatever the passages do: every crossing and dead end, the start and the
   * exit. A game names them and gives each its own sound and look. Empty for a plain maze.
   */
  rooms: Cell[];
  /** Things to find before the exit opens. Empty for a plain maze, which is escaped by reaching the exit. */
  relics: Cell[];
  /** Rooms with somewhere to hide. */
  hides: Cell[];
  /** The way a perfect player goes: every relic, nearest first, then the exit. The plain route when there are none. */
  ritualRoute: Cell[];
  /** Once every relic is found, the phantom hunts faster: `moves` rooms for every `per` steps of yours. */
  chase: { moves: number; per: number };
  /** On the ritual route, the phantom is never nearer than this many rooms, along the passages. */
  ritualGap: number;
}

export interface MazeOptions {
  width?: number;
  height?: number;
  ghostEvery?: number;
  margin?: number;
  minGhostStart?: number;
  /** How many relics to hide in the house. 0 makes a plain maze. */
  relics?: number;
  /** How many rooms to give a hiding place. Only with relics. */
  hides?: number;
  chase?: { moves: number; per: number };
  ritualGap?: number;
}

export const DEFAULT_MAZE: Required<MazeOptions> = {
  width: 8,
  height: 8,
  ghostEvery: 2,
  margin: 2,
  minGhostStart: 6,
  relics: 0,
  hides: 3,
  chase: { moves: 2, per: 3 },
  ritualGap: 2,
};

/**
 * Play the ritual route perfectly and watch the phantom. It moves `1` room every `ghostEvery` steps
 * until the last relic is found, then at the chase rate, always by the shortest way to the player.
 * Returns the nearest it came (in rooms, along the passages), and where.
 */
export function simulateRitual(m: PhantomMaze & Pick<Maze, 'ritualRoute'>): {
  nearest: number;
  at: number;
  caught: boolean;
} {
  const route = m.ritualRoute;
  const lastRelicStep = m.relics.length === 0 ? Infinity : Math.max(...m.relics.map((r) => route.findIndex((c) => sameCell(c, r))));
  let phantom = phantomStart(m);
  let nearest = Infinity;
  let at = 0;
  for (let k = 1; k < route.length; k++) {
    const player = route[k]!;
    if (sameCell(player, phantom.at)) return { nearest: 0, at: k, caught: true };
    const turn = phantomTurn(m, phantom, player, { hidden: false, chasing: k > lastRelicStep });
    phantom = turn.state;
    if (turn.caught) return { nearest: 0, at: k, caught: true };
    const g = distancesFrom(m, player)[indexOf(m, phantom.at)]!;
    if (g < nearest) {
      nearest = g;
      at = k;
    }
  }
  return { nearest, at, caught: false };
}

// ---- the phantom's mind ---------------------------------------------------------------------------
//
// In a plain maze the phantom always knows where you are. In a house with relics it prowls from room to
// room until it hears you (within `notice` rooms, along the passages), then hunts you. If you get far
// away, or hide, it loses your trail and prowls again. Once the ritual is done it always knows. The walk
// and the proof share this one function, so the proof checks the same phantom the player meets.

export type PhantomMaze = Pick<Maze, 'width' | 'height' | 'open' | 'seed' | 'ghost' | 'ghostEvery' | 'chase' | 'relics' | 'rooms'>;

export interface PhantomState {
  at: Cell;
  mode: 'prowl' | 'hunt';
  /** Where it is prowling to. */
  target: Cell;
  /** Part-moves saved up, for speeds like 2 rooms every 3 steps. */
  acc: number;
  /** Moves since it last heard you while hunting. */
  quiet: number;
  rng: number;
}

/** It hears you within this many rooms, along the passages. */
export const PHANTOM_NOTICE = 3;
/** It loses your trail after this many moves without hearing you. */
export const PHANTOM_LOSE_AFTER = 4;

const nextRng = (r: number): number => (Math.imul(r, 1664525) + 1013904223) >>> 0;

const prowls = (m: PhantomMaze): boolean => m.relics.length > 0 && m.rooms.length > 0;

export function phantomStart(m: PhantomMaze): PhantomState {
  const rng = nextRng((m.seed ^ 0x9e3779b9) >>> 0);
  const target = prowls(m) ? m.rooms[rng % m.rooms.length]! : m.ghost;
  return { at: m.ghost, mode: prowls(m) ? 'prowl' : 'hunt', target, acc: 0, quiet: 0, rng };
}

export type PhantomNews = 'hunts' | 'lost' | 'searched';

/**
 * One step of the player's worth of time. Returns the phantom's new state, whether it caught the player,
 * and what changed: it started hunting, it lost the trail, or it searched your hiding place and gave up.
 * `force` makes exactly one move, whatever the speed (time spent at a crossing to listen or ask).
 */
export function phantomTurn(
  m: PhantomMaze,
  state: PhantomState,
  player: Cell,
  how: { hidden: boolean; chasing: boolean; force?: boolean },
): { state: PhantomState; caught: boolean; news: PhantomNews[] } {
  const s: PhantomState = { ...state };
  const news: PhantomNews[] = [];
  const rate = how.chasing ? m.chase : { moves: 1, per: m.ghostEvery };
  let moves = 0;
  if (how.force) moves = 1;
  else {
    s.acc += rate.moves;
    while (s.acc >= rate.per) {
      s.acc -= rate.per;
      moves += 1;
    }
  }
  const newTarget = (): void => {
    s.rng = nextRng(s.rng);
    // A room away from you, so it wanders off rather than straight back.
    const far = m.rooms.filter((r) => !sameCell(r, player) && !sameCell(r, s.at));
    s.target = far.length > 0 ? far[s.rng % far.length]! : m.ghost;
  };
  for (let i = 0; i < moves; i++) {
    if (prowls(m)) {
      const d = distancesFrom(m, s.at)[indexOf(m, player)]!;
      if (how.chasing || (!how.hidden && d >= 0 && d <= PHANTOM_NOTICE)) {
        if (s.mode !== 'hunt') news.push('hunts');
        s.mode = 'hunt';
        s.quiet = 0;
      } else if (s.mode === 'hunt' && !how.hidden) {
        s.quiet += 1;
        if (s.quiet >= PHANTOM_LOSE_AFTER) {
          s.mode = 'prowl';
          news.push('lost');
          newTarget();
        }
      }
    }
    // Hunting, it goes for you (or for where you hid). Prowling, it goes to the room it chose.
    const goal = s.mode === 'hunt' ? player : s.target;
    const next = stepToward(m, s.at, goal);
    if (next) s.at = next;
    if (sameCell(s.at, player)) {
      if (!how.hidden) return { state: s, caught: true, news };
      // It reaches your hiding place, stops, and moves on.
      news.push('searched');
      s.mode = 'prowl';
      s.quiet = 0;
      newTarget();
    } else if (s.mode === 'prowl' && sameCell(s.at, s.target)) newTarget();
  }
  return { state: s, caught: false, news };
}

/** The shortest path between two cells, both ends included. */
export function pathBetween(m: Pick<Maze, 'width' | 'height' | 'open'>, from: Cell, to: Cell): Cell[] {
  const path = [from];
  let c = from;
  for (let guard = 0; !sameCell(c, to) && guard < m.width * m.height; guard++) {
    const next = stepToward(m, c, to);
    if (!next) break;
    path.push(next);
    c = next;
  }
  return path;
}

export const sameCell = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y;
export const indexOf = (m: Pick<Maze, 'width'>, c: Cell): number => c.y * m.width + c.x;
const cellAt = (width: number, i: number): Cell => ({ x: i % width, y: Math.floor(i / width) });

/** The ways you can walk from a cell. */
export function openings(m: Pick<Maze, 'width' | 'open'>, c: Cell): Dir[] {
  const mask = m.open[indexOf(m, c)] ?? 0;
  return ([0, 1, 2, 3] as const).filter((d) => (mask & (1 << d)) !== 0);
}

export const neighbour = (c: Cell, d: Dir): Cell => ({ x: c.x + DIRS[d].dx, y: c.y + DIRS[d].dy });

/** Steps from a cell to every other cell, along the passages. -1 where there is no way. */
// Distances are worked out once per room and kept, per house, because the phantom and the proof ask
// for them again and again. The result is shared: treat it as read-only.
const distanceCache = new WeakMap<readonly number[], Map<number, number[]>>();

export function distancesFrom(m: Pick<Maze, 'width' | 'height' | 'open'>, from: Cell): number[] {
  let perHouse = distanceCache.get(m.open);
  if (!perHouse) {
    perHouse = new Map();
    distanceCache.set(m.open, perHouse);
  }
  const key = (from.y * m.width + from.x) * 4096 + m.width;
  const known = perHouse.get(key);
  if (known) return known;
  const fresh = bfs(m, from);
  perHouse.set(key, fresh);
  return fresh;
}

function bfs(m: Pick<Maze, 'width' | 'height' | 'open'>, from: Cell): number[] {
  const dist = new Array<number>(m.width * m.height).fill(-1);
  const queue = [from.y * m.width + from.x];
  dist[queue[0]!] = 0;
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!;
    const c = cellAt(m.width, i);
    for (const d of openings(m, c)) {
      const n = neighbour(c, d);
      const j = n.y * m.width + n.x;
      if (dist[j] === -1) {
        dist[j] = dist[i]! + 1;
        queue.push(j);
      }
    }
  }
  return dist;
}

/** The next cell on the shortest way from one cell to another, or null if already there. */
export function stepToward(m: Pick<Maze, 'width' | 'height' | 'open'>, from: Cell, to: Cell): Cell | null {
  if (sameCell(from, to)) return null;
  const dist = distancesFrom(m, to);
  let best: Cell | null = null;
  let bestDist = Infinity;
  for (const d of openings(m, from)) {
    const n = neighbour(from, d);
    const nd = dist[indexOf(m, n)]!;
    if (nd >= 0 && nd < bestDist) {
      best = n;
      bestDist = nd;
    }
  }
  return best;
}

/** How many cells a route of this maze has, counting the start: steps + 1. The fewest steps is `route.length - 1`. */
export const fewestSteps = (m: Pick<Maze, 'route'> & Partial<Pick<Maze, 'ritualRoute'>>): number => (m.ritualRoute ?? m.route).length - 1;

/**
 * Build a house. Same seed, same house. It is a perfect maze (one route between any two
 * cells) so it is always connected, and the phantom is placed where it cannot cut off the
 * shortest route to the exit. If a seed cannot be made fair it is nudged, deterministically.
 */
export function generateMaze(seed: number, options: MazeOptions = {}): Maze {
  const o = { ...DEFAULT_MAZE, ...stripUndefined(options) };
  if (o.width < 4 || o.height < 4) throw new Error('A house needs to be at least 4 by 4 rooms.');

  // A ritual house has more to fit, so it may take more tries to find a fair one.
  const attempts = o.relics > 0 ? 160 : 40;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const rand = mulberry32((seed + attempt * 7919) >>> 0);
    const { width: w, height: h } = o;
    const open = new Array<number>(w * h).fill(0);
    const seen = new Array<boolean>(w * h).fill(false);

    // Carve passages with a depth-first walk from a random corner.
    const corners = [0, w - 1, (h - 1) * w, h * w - 1];
    const startIndex = corners[Math.floor(rand() * 4)]!;
    const stack = [startIndex];
    seen[startIndex] = true;
    while (stack.length > 0) {
      const here = stack[stack.length - 1]!;
      const c = cellAt(w, here);
      const choices = ([0, 1, 2, 3] as const).filter((d) => {
        const n = neighbour(c, d);
        return n.x >= 0 && n.y >= 0 && n.x < w && n.y < h && !seen[n.y * w + n.x];
      });
      if (choices.length === 0) {
        stack.pop();
        continue;
      }
      const d = choices[Math.floor(rand() * choices.length)]!;
      const n = neighbour(c, d);
      const ni = n.y * w + n.x;
      open[here]! |= 1 << d;
      open[ni]! |= 1 << opposite(d);
      seen[ni] = true;
      stack.push(ni);
    }

    const base = { width: w, height: h, open };
    const start = cellAt(w, startIndex);
    const fromStart = distancesFrom(base, start);
    // The exit is the farthest room from the start.
    let exitIndex = 0;
    fromStart.forEach((dist, i) => {
      if (dist > fromStart[exitIndex]!) exitIndex = i;
    });
    const exit = cellAt(w, exitIndex);

    // The one route: walk back from the exit, always to a cell one step nearer the start.
    const route: Cell[] = [exit];
    for (let c = exit; !sameCell(c, start); ) {
      const here = fromStart[indexOf(base, c)]!;
      const next = openings(base, c)
        .map((d) => neighbour(c, d))
        .find((n) => fromStart[indexOf(base, n)] === here - 1)!;
      route.push(next);
      c = next;
    }
    route.reverse();
    const onRoute = new Set(route.map((c) => indexOf(base, c)));

    // The ritual: rooms to stop in, relics spread far apart, hiding places, and the way to do it all.
    const ritual = o.relics > 0 ? planRitual(base, start, exit, o, rand) : null;
    if (o.relics > 0 && !ritual) continue;
    const ritualRoute = ritual?.route ?? route;
    const onRitual = new Set(ritualRoute.map((c) => indexOf(base, c)));

    // The phantom goes where it is slowest to reach any step of the route, and far from the start.
    // With a ritual it must also never get near a player who does the ritual the best way.
    let best: { cell: Cell; spare: number; far: number; nearest: number } | null = null;
    for (let i = 0; i < w * h; i++) {
      // A plain maze is escaped by its shortest route, so the phantom must start off it with time to spare.
      // A ritual house is judged by playing the ritual route against the prowling phantom instead.
      if (!ritual && (onRoute.has(i) || onRitual.has(i))) continue;
      const g = cellAt(w, i);
      const dg = distancesFrom(base, g);
      const spare = Math.min(...route.map((r, k) => o.ghostEvery * dg[indexOf(base, r)]! - k));
      const far = dg[indexOf(base, start)]!;
      if ((!ritual && spare < o.margin + 1) || far < o.minGhostStart) continue;
      let nearest = Infinity;
      if (ritual) {
        const sim = simulateRitual({ ...base, seed, ghost: g, ritualRoute, relics: ritual.relics, rooms: ritual.rooms, ghostEvery: o.ghostEvery, chase: o.chase });
        if (sim.caught || sim.nearest < o.ritualGap) continue;
        nearest = sim.nearest;
      }
      const better =
        !best ||
        (ritual ? nearest > best.nearest || (nearest === best.nearest && far > best.far) : spare > best.spare || (spare === best.spare && far > best.far));
      if (better) best = { cell: g, spare, far, nearest };
    }
    if (!best) continue;

    return {
      rooms: ritual?.rooms ?? [],
      relics: ritual?.relics ?? [],
      hides: ritual?.hides ?? [],
      ritualRoute,
      chase: o.relics > 0 ? o.chase : { moves: 1, per: o.ghostEvery },
      ritualGap: o.ritualGap,
      seed,
      width: w,
      height: h,
      open,
      start,
      exit,
      ghost: best.cell,
      route,
      ghostEvery: o.ghostEvery,
      margin: o.margin,
      minGhostStart: o.minGhostStart,
    };
  }
  throw new Error(`Could not build a fair house for seed ${seed}. Try a bigger house or a slower phantom.`);
}

/** Choose rooms, relics and hiding places, and the best order to fetch the relics. Null if the house is too small. */
function planRitual(
  base: Pick<Maze, 'width' | 'height' | 'open'>,
  start: Cell,
  exit: Cell,
  o: Required<MazeOptions>,
  rand: () => number,
): { rooms: Cell[]; relics: Cell[]; hides: Cell[]; route: Cell[] } | null {
  const { width: w, height: h } = base;
  const all: Cell[] = [];
  for (let i = 0; i < w * h; i++) all.push(cellAt(w, i));
  // Every crossing and every dead end is a room, and so are the start and the exit.
  const rooms = all.filter((c) => openings(base, c).length !== 2 || sameCell(c, start) || sameCell(c, exit));
  const dist = new Map<number, number[]>();
  const from = (c: Cell): number[] => {
    const key = indexOf(base, c);
    if (!dist.has(key)) dist.set(key, distancesFrom(base, c));
    return dist.get(key)!;
  };
  const gapTo = (c: Cell, set: readonly Cell[]): number => Math.min(...set.map((s) => from(s)[indexOf(base, c)]!));
  /** Pick `n` cells from `pool`, each as far as possible from those already picked (and from `avoid`). */
  const spread = (pool: Cell[], n: number, avoid: Cell[]): Cell[] => {
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    const picked: Cell[] = [];
    while (picked.length < n && shuffled.length > 0) {
      let bestAt = 0;
      let bestGap = -1;
      shuffled.forEach((c, i) => {
        const g = gapTo(c, [...avoid, ...picked]);
        if (g > bestGap) {
          bestGap = g;
          bestAt = i;
        }
      });
      picked.push(shuffled.splice(bestAt, 1)[0]!);
    }
    return picked;
  };
  const candidates = rooms.filter((c) => !sameCell(c, start) && !sameCell(c, exit));
  if (candidates.length < o.relics) return null;
  const relics = spread(candidates, o.relics, [start, exit]);
  const rest = candidates.filter((c) => !relics.some((r) => sameCell(r, c)));
  const hides = spread(rest, Math.min(o.hides, rest.length), [start, ...relics]);

  // The way to do it: nearest relic first, then the next nearest, then the exit.
  const route: Cell[] = [start];
  let here = start;
  const left = [...relics];
  while (left.length > 0) {
    left.sort((a, b) => from(here)[indexOf(base, a)]! - from(here)[indexOf(base, b)]!);
    const next = left.shift()!;
    route.push(...pathBetween(base, here, next).slice(1));
    here = next;
  }
  route.push(...pathBetween(base, here, exit).slice(1));
  return { rooms, relics, hides, route };
}

function stripUndefined<V extends object>(obj: V): Partial<V> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<V>;
}
