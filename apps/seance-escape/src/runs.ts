import { generateMaze, proveMaze, proveRunLength, runLengthWords, type HouseLayout, type Maze } from '@marrow/skeleton';

// The run loop, kept apart from the page so it can be tested without a screen: which house a run
// gets, how a run ends, and what is said about it. See .kiro/specs/seance-runs.

/** House sizes, in rooms across and down. Medium is the standard house: the one a run of 5 to 8 minutes is built on. */
export const HOUSE_SIZES = {
  small: { width: 8, height: 8 },
  medium: { width: 12, height: 10 },
  large: { width: 14, height: 14 },
} as const;
export type Size = keyof typeof HOUSE_SIZES;
/** Only the standard size is judged by property 207 (run length). The others are the player's choice of a shorter or longer run. */
export const STANDARD_SIZE: Size = 'medium';

/** Relics to find in a house. */
export const RELIC_COUNT = 3;
/** Catches that end a run, when "Catches end a run" is on. */
export const CATCH_LIMIT = 3;
/** The most seeds tried for one run before giving up. At the standard size nearly every seed is served. */
export const MAX_SEED_TRIES = 400;

/** The generator's test of a layout: a clean run takes 5 to 8 minutes at every speed and dwell (property 207). */
const fitsRunLength = (house: HouseLayout): boolean => proveRunLength(house, '').pass;

export interface Skipped {
  seed: number;
  /** Why the house was not served, in plain words. */
  reason: string;
}

export interface ServedHouse {
  maze: Maze;
  seed: number;
  /** Houses tried first and not served, in order. */
  skipped: Skipped[];
  /** Whether this house passed property 207 (run length). True for the standard size. */
  lengthProven: boolean;
}

/**
 * The next house for a run: the first seed from `firstSeed` that builds and passes the whole proof,
 * 201 to 206 and, for the standard size, 207. A house that fails is skipped and never served; each skip
 * is reported to `onSkip`.
 */
export function serveHouse(firstSeed: number, size: Size, onSkip: (skip: Skipped) => void = () => undefined): ServedHouse | null {
  const { width, height } = HOUSE_SIZES[size];
  const lengthProven = size === STANDARD_SIZE;
  const skipped: Skipped[] = [];
  for (let seed = firstSeed; seed < firstSeed + MAX_SEED_TRIES; seed++) {
    let maze: Maze;
    try {
      // At the standard size the generator lays the house out again until its clean run fits 5 to 8 minutes
      // for every profile, so nearly every seed is served. The proof below still judges the finished house.
      maze = generateMaze(seed, { width, height, relics: RELIC_COUNT, ...(lengthProven ? { fit: fitsRunLength } : {}) });
    } catch (error) {
      const skip = { seed, reason: error instanceof Error ? error.message : 'It could not be built fairly.' };
      skipped.push(skip);
      onSkip(skip);
      continue;
    }
    const failing = proveMaze(maze, `House ${seed}`, lengthProven ? { runLength: true } : {}).filter((r) => !r.pass);
    if (failing.length > 0) {
      const skip = { seed, reason: `${failing[0]!.id} ${failing[0]!.name}: ${failing[0]!.counterexample ?? 'failed'}` };
      skipped.push(skip);
      onSkip(skip);
      continue;
    }
    return { maze, seed, skipped, lengthProven };
  }
  return null;
}

// ---- saved choices ----------------------------------------------------------

export const RUN_KEY = 'seance.run';
export const CATCHES_KEY = 'seance.catches';

/** The run counter: the seed the next run starts looking from. 1 when nothing is saved. */
export function readRunCounter(read: (key: string) => string | null): number {
  const n = Math.floor(Number(read(RUN_KEY)));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Catches end a run unless the player turned that off. */
export const readCatchesEnd = (read: (key: string) => string | null): boolean => read(CATCHES_KEY) !== 'off';

// ---- how a run ends -----------------------------------------------------------

export interface RunEnd {
  how: 'caught' | 'escaped';
  relicsFound: number;
  relicsTotal: number;
  rooms: number;
  ms: number;
  catches: number;
}

const times = (n: number): string => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

/** The facts of a run, in plain words: what was found, where, how long, how often caught. */
export function runFacts(end: RunEnd): string {
  const caught = end.catches === 0 ? 'You were never caught.' : `You were caught ${times(end.catches)}.`;
  return `You found ${end.relicsFound} of ${end.relicsTotal} relics. You went through ${end.rooms} rooms in ${runLengthWords(end.ms)}. ${caught}`;
}

/**
 * The line said when catches end a run. It is gentle on purpose: the house lets you go, and the next
 * house is one press away. It never says "game over".
 */
export function caughtEndLine(end: RunEnd): string {
  return `The house lets you go. ${runFacts(end)} Press any key to enter a new house, or Escape for the menu.`;
}

export function caughtEndCaption(end: RunEnd): string {
  return `The house lets you go. ${end.relicsFound} of ${end.relicsTotal} relics, ${end.rooms} rooms, ${runLengthWords(end.ms)}, caught ${end.catches}.`;
}