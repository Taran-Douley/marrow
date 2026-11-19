import { dwellFor, speechMs } from '../scanning';
import type { Speed } from '../types';
import { DEFAULT_WALK_SETTINGS } from './walk';
import { indexOf, neighbour, openings, opposite, pathBetween, sameCell, type Cell, type Dir, type Maze } from './maze';

/** What the explorer needs of a house: the passages, rooms, relics, start and exit. */
export type ExplorerMaze = Pick<Maze, 'width' | 'height' | 'open' | 'start' | 'exit' | 'rooms' | 'relics'>;

// A headless explorer: a player who does not know the house. It walks room to room, depth first, takes
// the relics it comes to (steering toward a hum it can hear), then goes for the bell by the shortest way.
// It never listens, hides or asks for a hint, and it is never caught, so what it measures is a clean run.
// Time is counted as a player lives it: a stride is `stepMs` for the speed; at each stop the room is
// spoken, then the ways are read out one by one, each lit for `dwellFor` (the dwell, or longer for a long
// label), and the player presses a little after the one they want is lit.

/** How long the spoken lines of a run take, in ms. The defaults are for Séance Escape's own words. */
export interface RunLines {
  /** The introduction, before the walk starts moving. */
  intro: number;
  /** A room the first time: its name, and often a word from Mabel or a whisper. */
  roomFirst: number;
  /** A room already known: its name only. */
  roomAgain: number;
  /** A relic found. */
  relic: number;
  /** The last relic: the ritual line. */
  ritual: number;
  /** The sealed exit, said when you reach it too soon. */
  sealed: number;
  /** Where the phantom is, said at most stops. */
  ghostCall: number;
}

export const DEFAULT_RUN_LINES: RunLines = {
  intro: 17_000,
  roomFirst: 4_400,
  roomAgain: 1_700,
  relic: 4_100,
  ritual: 5_800,
  sealed: 7_400,
  ghostCall: 1_000,
};

export interface RunProfile {
  speed: Speed;
  /** The scanning dwell, in ms: how long each option is lit, at least. */
  dwellMs: number;
}

export interface ExploreOptions extends RunProfile {
  lines?: Partial<RunLines>;
  /** How long after an option is lit the player presses, in ms. */
  reactionMs?: number;
  /** The first stride after a choice is a little quicker than a stride (see walk.ts). */
  firstStrideRatio?: number;
}

export interface Exploration {
  /** The whole run, from the first word of the introduction to the escape, in ms. */
  ms: number;
  steps: number;
  /** Times the player stopped in a room. */
  stops: number;
  /** Different rooms the player stood in. */
  roomsVisited: number;
  relicsFound: number;
  /** Time spent walking, listening to lines and choosing, in ms. */
  parts: { walking: number; speaking: number; choosing: number };
}

/** The runs this game is built for: every speed, and the scanning dwell from quickest to slowest. */
export const RUN_SPEEDS: readonly Speed[] = ['slow', 'medium', 'fast'];
export const RUN_DWELLS: readonly number[] = [1500, 2200, 4000];
export const RUN_PROFILES: readonly RunProfile[] = RUN_SPEEDS.flatMap((speed) => RUN_DWELLS.map((dwellMs) => ({ speed, dwellMs })));
/** A typical run lasts between these, in ms. */
export const RUN_BAND = { minMs: 5 * 60_000, maxMs: 8 * 60_000 } as const;

const RELATIVE = [
  { rel: 0, label: 'Ahead' },
  { rel: 3, label: 'Left' },
  { rel: 1, label: 'Right' },
  { rel: 2, label: 'Turn back' },
] as const;

/** Walk a house as a player who does not know it, and count the time. */
export function exploreHouse(maze: ExplorerMaze, options: ExploreOptions): Exploration {
  const lines: RunLines = { ...DEFAULT_RUN_LINES, ...options.lines };
  const reaction = options.reactionMs ?? 400;
  const first = options.firstStrideRatio ?? 0.6;
  const stride = DEFAULT_WALK_SETTINGS.stepMs[options.speed];
  const roomAt = new Set(maze.rooms.map((r) => indexOf(maze, r)));
  const ritual = maze.relics.length > 0;
  const hearRange = DEFAULT_WALK_SETTINGS.exitRange;

  const parts = { walking: 0, speaking: lines.intro, choosing: 0 };
  let steps = 0;
  let stops = 0;
  let cell: Cell = maze.start;
  let facing: Dir = openings(maze, maze.start)[0]!;
  const seen = new Set<number>();
  const taken = new Set<number>();
  const tried = new Set<string>();
  /** The way back down the tree: the room and heading to return by. */
  const trail: { cell: Cell }[] = [];
  const key = (c: Cell, d: Dir): string => `${indexOf(maze, c)}:${d}`;

  /** The ways offered at a stop, in the order the game reads them. */
  const waysHere = (): { dir: Dir; label: string }[] => {
    const ways = openings(maze, cell);
    return RELATIVE.flatMap(({ rel, label }) => {
      const d = ((facing + rel) % 4) as Dir;
      return ways.includes(d) ? [{ dir: d, label }] : [];
    });
  };

  /** What the player pays to choose option `index` of `labels`: each earlier option is lit its full time. */
  const choose = (labels: readonly string[], index: number): number => {
    let ms = 0;
    for (let i = 0; i < index; i++) ms += dwellFor({ id: String(i), label: labels[i]! }, options.dwellMs);
    return ms + reaction;
  };
  const optionLabels = (): string[] => {
    const labels = waysHere().map((w) => w.label);
    labels.push('Listen');
    if (ritual) labels.push('Ask Mabel');
    return labels;
  };

  const relicsLeft = (): Cell[] => maze.relics.filter((r) => !taken.has(indexOf(maze, r)));

  /** Stand in a room: say it, read the ways, return the label list and the way chosen later. */
  const arrive = (): void => {
    stops += 1;
    const firstTime = !seen.has(indexOf(maze, cell));
    seen.add(indexOf(maze, cell));
    parts.speaking += firstTime ? lines.roomFirst : lines.roomAgain;
    const relic = maze.relics.findIndex((r) => sameCell(r, cell));
    if (relic >= 0 && !taken.has(indexOf(maze, cell))) {
      taken.add(indexOf(maze, cell));
      const last = relicsLeft().length === 0;
      parts.speaking += last ? lines.relic + lines.ritual : lines.relic;
    }
    if (ritual && sameCell(cell, maze.exit) && relicsLeft().length > 0) parts.speaking += lines.sealed;
    parts.speaking += lines.ghostCall;
  };

  /** Choose a way out of this room. */
  const pick = (): Dir => {
    const ways = waysHere();
    const left = relicsLeft();
    let want: Dir;
    if (ritual && left.length === 0) {
      // Every relic is found: the bell is the way out, by the shortest road.
      const next = pathBetween(maze, cell, maze.exit)[1]!;
      want = openings(maze, cell).find((d) => sameCell(neighbour(cell, d), next))!;
    } else {
      // Unexplored ways first. A way toward a relic whose hum can be heard comes before the others.
      const fresh = ways.filter((w) => !tried.has(key(cell, w.dir)) && !seen.has(indexOf(maze, neighbour(cell, w.dir))));
      const humming = left.filter((r) => Math.hypot(r.x - cell.x, r.y - cell.y) <= hearRange);
      let chosen = fresh[0]?.dir;
      if (fresh.length > 1 && humming.length > 0) {
        const near = humming.sort((a, b) => Math.hypot(a.x - cell.x, a.y - cell.y) - Math.hypot(b.x - cell.x, b.y - cell.y))[0]!;
        const score = (d: Dir): number => Math.hypot(neighbour(cell, d).x - near.x, neighbour(cell, d).y - near.y);
        chosen = [...fresh].sort((a, b) => score(a.dir) - score(b.dir))[0]!.dir;
      }
      if (chosen === undefined) {
        // Nothing new here: back the way we came.
        const back = trail.pop();
        const next = back ? pathBetween(maze, cell, back.cell)[1] : undefined;
        chosen = next ? openings(maze, cell).find((d) => sameCell(neighbour(cell, d), next))! : opposite(facing);
        const labels = optionLabels();
        const index = waysHere().findIndex((w) => w.dir === chosen);
        parts.choosing += choose(labels, index);
        return chosen;
      }
      want = chosen;
    }
    tried.add(key(cell, want));
    const index = ways.findIndex((w) => w.dir === want);
    parts.choosing += choose(optionLabels(), index);
    // Going on from here, remember to come back to this room.
    if (!(ritual && left.length === 0)) trail.push({ cell });
    return want;
  };

  /** Walk from this room along `dir` to the next room. */
  const walkTo = (dir: Dir): void => {
    facing = dir;
    let n = 0;
    do {
      cell = neighbour(cell, facing);
      n += 1;
      steps += 1;
      if (roomAt.has(indexOf(maze, cell))) break;
      // A passage: carry straight on round any bend.
      const ways = openings(maze, cell).filter((d) => d !== opposite(facing));
      if (ways.length === 0) break;
      facing = ways[0]!;
    } while (n < maze.width * maze.height);
    tried.add(key(cell, opposite(facing))); // the way we came is not a new way
    parts.walking += stride * (n - 1 + first);
  };

  arrive();
  for (let guard = 0; guard < maze.width * maze.height * 6; guard++) {
    if (sameCell(cell, maze.exit) && relicsLeft().length === 0) break;
    walkTo(pick());
    arrive();
  }

  return {
    ms: Math.round(parts.walking + parts.speaking + parts.choosing),
    steps,
    stops,
    roomsVisited: seen.size,
    relicsFound: taken.size,
    parts: { walking: Math.round(parts.walking), speaking: Math.round(parts.speaking), choosing: Math.round(parts.choosing) },
  };
}

/** The estimated length of a clean run, in ms. */
export const estimateRunMs = (maze: ExplorerMaze, profile: RunProfile, lines?: Partial<RunLines>): number =>
  exploreHouse(maze, lines ? { ...profile, lines } : profile).ms;

/** A fair guess at how long a spoken line takes: the same rule the scanner uses, a little slower for different voices. */
export const lineMs = (text: string): number => Math.round(speechMs(text) * 1.2);

/** `{ minutes, seconds }` in words, for captions and reports. */
export function runLengthWords(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m === 0 ? `${s} seconds` : s === 0 ? `${m} minute${m === 1 ? '' : 's'}` : `${m} minute${m === 1 ? '' : 's'} ${s} seconds`;
}
