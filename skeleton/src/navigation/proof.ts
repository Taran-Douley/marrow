import { proofResult, type ProofResult } from '../proof';
import { RUN_BAND, RUN_PROFILES, estimateRunMs, runLengthWords, type ExplorerMaze, type RunLines, type RunProfile } from './explorer';
import { distancesFrom, indexOf, neighbour, opposite, openings, sameCell, simulateRitual, type Cell, type Maze } from './maze';

const where = (c: { x: number; y: number }): string => `column ${c.x + 1}, row ${c.y + 1}`;

/**
 * The navigation pattern's proof: can this house always be escaped? Four properties,
 * numbered 201 to 204. A house that fails any of them is never served.
 *
 *  201 Exit reachable: there is a way from the start to the exit.
 *  202 Shortest route safe: a player who takes the shortest route is never caught,
 *      with steps to spare. This is the finishability guarantee.
 *  203 Fair start: the phantom does not start too close.
 *  204 Well formed: every passage can be walked both ways, and none leaves the house.
 *  205 Ritual route safe (houses with relics): fetching every relic the best way, then running the chase, is never caught.
 *  206 Ritual well placed: relics and hiding places are reachable rooms, and the exit is a room.
 *  207 Run length fits (only when asked, with `options.runLength`): a clean run takes 5 to 8 minutes
 *      at every speed and scanning dwell. A house that is too short or too long is skipped, never served.
 */
export interface ProveMazeOptions {
  /** Also judge how long a run takes. `true` uses the defaults: 5 to 8 minutes, every speed and dwell. */
  runLength?: boolean | RunLengthOptions;
}

export interface RunLengthOptions {
  /** Defaults to RUN_BAND (5 to 8 minutes). */
  band?: { minMs: number; maxMs: number };
  /** Defaults to every speed and every dwell in RUN_PROFILES. */
  profiles?: readonly RunProfile[];
  /** How long the spoken lines take, if the game's words differ from the defaults. */
  lines?: Partial<RunLines>;
}

/** Property 207. Exported so a game can judge a house by its own profiles and words. */
export function proveRunLength(maze: ExplorerMaze, label: string, options: RunLengthOptions = {}): ProofResult {
  const band = options.band ?? RUN_BAND;
  const profiles = options.profiles ?? RUN_PROFILES;
  const problems: string[] = [];
  for (const profile of profiles) {
    const ms = estimateRunMs(maze, profile, options.lines);
    if (ms < band.minMs || ms > band.maxMs) {
      problems.push(
        `${label}: at ${profile.speed} speed with a ${profile.dwellMs} ms dwell a clean run takes about ${runLengthWords(ms)}. ` +
          `A run must take ${runLengthWords(band.minMs)} to ${runLengthWords(band.maxMs)}.`,
      );
    }
  }
  return proofResult(207, 'Run length fits', problems);
}

export function proveMaze(maze: Maze, label = `House ${maze.seed}`, options: ProveMazeOptions = {}): ProofResult[] {
  const results = proveStructure(maze, label);
  if (options.runLength) results.push(proveRunLength(maze, label, options.runLength === true ? {} : options.runLength));
  return results;
}

function proveStructure(maze: Maze, label: string): ProofResult[] {
  const fromStart = distancesFrom(maze, maze.start);
  const fromGhost = distancesFrom(maze, maze.ghost);

  // 201
  const reach: string[] = [];
  if (fromStart[indexOf(maze, maze.exit)] === -1) {
    reach.push(`${label}: there is no way from the start (${where(maze.start)}) to the exit (${where(maze.exit)}).`);
  }

  // 202 (a plain maze: in a ritual house the exit is sealed until the relics are found, so 205 judges the way out)
  const safe: string[] = [];
  if (maze.relics.length === 0) maze.route.forEach((cell, k) => {
    const dg = fromGhost[indexOf(maze, cell)]!;
    const ghostArrives = dg < 0 ? Infinity : maze.ghostEvery * dg;
    if (ghostArrives <= k + maze.margin) {
      safe.push(
        `${label}: on the shortest route the player reaches ${where(cell)} at step ${k}, but the phantom can be there ` +
          `by step ${ghostArrives}. It needs ${maze.margin} spare steps.`,
      );
    }
  });

  // 203
  const fair: string[] = [];
  const startGap = fromGhost[indexOf(maze, maze.start)]!;
  if (startGap >= 0 && startGap < maze.minGhostStart) {
    fair.push(`${label}: the phantom starts only ${startGap} rooms from the player. It needs at least ${maze.minGhostStart}.`);
  }

  // 204
  const formed: string[] = [];
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const here = { x, y };
      for (const d of openings(maze, here)) {
        const n = neighbour(here, d);
        if (n.x < 0 || n.y < 0 || n.x >= maze.width || n.y >= maze.height) {
          formed.push(`${label}: ${where(here)} has a passage ${['north', 'east', 'south', 'west'][d]} out of the house.`);
        } else if (!openings(maze, n).includes(opposite(d))) {
          formed.push(`${label}: you can walk from ${where(here)} ${['north', 'east', 'south', 'west'][d]}, but not back.`);
        }
      }
    }
  }
  const results = [
    proofResult(201, 'Exit reachable', reach),
    proofResult(202, 'Shortest route safe', safe),
    proofResult(203, 'Fair start', fair),
    proofResult(204, 'Well formed', formed),
  ];
  if (maze.relics.length === 0) return results;

  // 205: a player who fetches every relic the best way, then runs for the door through the chase, is
  // never caught, and the phantom never comes nearer than `ritualGap` rooms.
  const ritual: string[] = [];
  const sim = simulateRitual(maze);
  if (sim.caught) {
    ritual.push(`${label}: a player doing the ritual the best way is caught at step ${sim.at}, at ${where(maze.ritualRoute[sim.at]!)}.`);
  } else if (sim.nearest < maze.ritualGap) {
    ritual.push(
      `${label}: on the best ritual route the phantom comes within ${sim.nearest} room${sim.nearest === 1 ? '' : 's'} at step ${sim.at}. It must stay ${maze.ritualGap} away.`,
    );
  }

  // 206: every relic and hiding place is a room you can reach, and none is the start or the exit.
  const placed: string[] = [];
  const isRoom = (c: Cell): boolean => maze.rooms.some((r) => sameCell(r, c));
  const seen = new Set<number>();
  maze.relics.forEach((r, i) => {
    if (fromStart[indexOf(maze, r)] === -1) placed.push(`${label}: relic ${i + 1} at ${where(r)} cannot be reached.`);
    if (!isRoom(r)) placed.push(`${label}: relic ${i + 1} at ${where(r)} is not in a room, so the walk would not stop for it.`);
    if (sameCell(r, maze.start) || sameCell(r, maze.exit)) placed.push(`${label}: relic ${i + 1} is at the start or the exit.`);
    if (seen.has(indexOf(maze, r))) placed.push(`${label}: two relics share ${where(r)}.`);
    seen.add(indexOf(maze, r));
  });
  for (const h of maze.hides) if (!isRoom(h)) placed.push(`${label}: the hiding place at ${where(h)} is not in a room.`);
  if (!isRoom(maze.exit)) placed.push(`${label}: the exit is not a room, so the sealed door cannot stop you.`);
  results.push(proofResult(205, 'Ritual route safe', ritual), proofResult(206, 'Ritual well placed', placed));
  return results;
}
