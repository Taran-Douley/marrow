import { compassWord, foldAngle } from '../channels/audio';
import { mulberry32 } from '../level';
import { rankOf } from '../run';
import { createScanner, type ScanOption, type Scanner } from '../scanning';
import type { SemanticEvent, Speed } from '../types';
import {
  distancesFrom,
  fewestSteps,
  indexOf,
  neighbour,
  openings,
  opposite,
  phantomStart,
  phantomTurn,
  sameCell,
  stepToward,
  type Cell,
  type Dir,
  type Maze,
  type PhantomNews,
  type PhantomState,
} from './maze';

// The navigation pattern as a pure state machine. The player walks on their own, one
// room at a time. At a crossing, or in any room, the way forward is offered by scanning:
// each option is spoken, lit and sounded from its own direction, and one press chooses.
// Nothing is timed while the player decides: the world waits. Caught means back to the
// last crossing with the phantom sent home: no lives, no game over.
//
// A house can also hold a ritual (relics to find before the sealed exit opens, places to
// hide, hints to ask for, and a chase at the end). See `generateMaze({ relics })`.

export const NAV_EVENTS = {
  start: 'walk-start',
  step: 'walk-step',
  option: 'walk-option',
  listen: 'walk-listen',
  ghostSense: 'ghost-sense',
  ghostCall: 'ghost-call',
  exitSense: 'exit-sense',
  deadEnd: 'dead-end',
  /** The player has stopped where the way splits, or in a room: the choices are about to be read. data: { count } */
  crossing: 'walk-crossing',
  creak: 'creak',
  caught: 'caught',
  escaped: 'escaped',
  /** The player is in a room. data: { room, first, hide, relicHere } (`room` indexes `maze.rooms`) */
  room: 'walk-room',
  /** A relic was found. data: { found, total } */
  relic: 'walk-relic',
  /** The last relic was found: the exit opens and the chase begins. data: { total } */
  ritual: 'walk-ritual',
  /** The exit is sealed until every relic is found. data: { left } */
  sealed: 'walk-sealed',
  /** A relic hums from where it is. data: { angle, distance } */
  relicSense: 'relic-sense',
  hide: 'walk-hide',
  unhide: 'walk-unhide',
  /** A hint toward the nearest relic, or the exit. data: { what: 'relic' | 'exit', way, rooms, found, total } */
  hint: 'walk-hint',
  /** The phantom has heard you and is hunting. data: { angle, distance } */
  ghostHunts: 'ghost-hunts',
  /** The phantom has lost your trail. */
  ghostLost: 'ghost-lost',
  /** The phantom searched your hiding place, and moved on. */
  ghostSearched: 'ghost-searched',
} as const;

export interface WalkSettings {
  /** Real ms per room walked, by speed. */
  stepMs: Record<Speed, number>;
  /** How far, in rooms, the player can hear the phantom. */
  hearRange: number;
  /** How far, in rooms, the player can hear the bell. */
  exitRange: number;
  /** How far, in rooms, the Listen action reaches. */
  listenRange: number;
  /** After listening on the move, wait this many steps before listening again. */
  listenCooldown: number;
  /** Real ms to rest after being caught, so the line can be heard. */
  catchPauseMs: number;
  /** A creak somewhere in the house every this many steps. Decorative. */
  creakEvery: number;
  /** The phantom is heard (if in range) every this many steps. */
  ghostSenseEvery: number;
  /** The bell is heard (if in range) every this many steps. */
  exitSenseEvery: number;
  /** A relic hums (if in range) every this many steps. */
  relicSenseEvery: number;
  hideLabel: string;
  hintLabel: string;
  comeOutLabel: string;
  /**
   * When to say where the phantom is at a stop: 'always', or 'changed' (the default): only when it is
   * near (ghostCallNear), when it has come closer or changed mood since the last stop, or in the chase. A far phantom
   * that has not moved is not news, and saying it every stop makes the player wait.
   */
  ghostCall: 'always' | 'changed';
  /** With 'changed': a phantom this many rooms away or nearer is always said. */
  ghostCallNear: number;
  /** After this many catches, a hint is given for free each time you are put back. 0 turns it off. */
  freeHintAfterCatches: number;
}

export type WalkSettingsInput = Partial<Omit<WalkSettings, 'stepMs'>> & { stepMs?: Partial<Record<Speed, number>> };

export const DEFAULT_WALK_SETTINGS: WalkSettings = {
  stepMs: { slow: 800, medium: 600, fast: 450 },
  hearRange: 6,
  ghostCall: 'changed',
  ghostCallNear: 3,
  freeHintAfterCatches: 2,
  exitRange: 8,
  listenRange: 12,
  listenCooldown: 4,
  catchPauseMs: 2600,
  creakEvery: 7,
  ghostSenseEvery: 2,
  exitSenseEvery: 5,
  relicSenseEvery: 3,
  hideLabel: 'Hide',
  hintLabel: 'Ask for a hint',
  comeOutLabel: 'Come out',
};

export function resolveWalkSettings(input: WalkSettingsInput = {}): WalkSettings {
  const { stepMs, ...rest } = input;
  const clean = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  return {
    ...DEFAULT_WALK_SETTINGS,
    ...clean,
    stepMs: { ...DEFAULT_WALK_SETTINGS.stepMs, ...stepMs },
  };
}

export interface WalkOptions {
  maze: Maze;
  speed: Speed;
  settings?: WalkSettingsInput;
  /** Real clock time, in ms, when the walk begins. */
  startMs: number;
  /**
   * How long, in ms, the player will be listening to a spoken line for this event, or 0 if it
   * says nothing. The walk never starts reading out options until the line is finished, so a line
   * is never cut off by the next one. Without it, nothing waits.
   */
  speechMs?: (event: SemanticEvent) => number;
  /** Speech already under way when the walk begins (an introduction), in ms. Options wait for it. */
  quietMs?: number;
  /** How long each option stays lit, in ms. Long labels are given longer. */
  dwellMs: number;
  /**
   * Add your own data to an event before it is sent: a room's name, a line of story. It is merged
   * into the event, and the walk waits for it to be spoken like any other line.
   */
  decorate?: (type: string, data: Readonly<Record<string, unknown>>) => Record<string, unknown> | undefined;
  /** Called for each event, with the walk time in seconds. */
  emit(event: SemanticEvent, nowSec: number): void;
}

export interface WalkSnapshot {
  phase: 'walking' | 'choosing' | 'hidden' | 'caught' | 'escaped';
  cell: Cell;
  facing: Dir;
  ghost: Cell;
  /** 'prowl' or 'hunt'. A plain maze's phantom always hunts. */
  ghostMode: PhantomState['mode'];
  steps: number;
  catches: number;
  listens: number;
  /** Which rooms the player has been in, by index. */
  visited: boolean[];
  /** The options being offered, and which is lit. Empty when walking. */
  options: readonly ScanOption[];
  lit: string | null;
  /** The room the player is in, as an index into `maze.rooms`, or null. */
  room: number | null;
  /** Relics not found yet. */
  relicsLeft: readonly Cell[];
  relicsFound: number;
  /** The ritual is done: the phantom always knows where you are, and the exit is open. */
  chasing: boolean;
  hides: number;
  hints: number;
}

export interface Walk {
  advance(nowMs: number): void;
  press(nowMs: number): void;
  snapshot(): WalkSnapshot;
}

const RELATIVE = [
  { rel: 0, label: 'Ahead', angle: 0, way: 'ahead' },
  { rel: 3, label: 'Left', angle: -90, way: 'left' },
  { rel: 1, label: 'Right', angle: 90, way: 'right' },
  { rel: 2, label: 'Turn back', angle: 180, way: 'back' },
] as const;

const rangeWord = (fraction: number): 'close' | 'near' | 'far' => (fraction < 0.34 ? 'close' : fraction < 0.67 ? 'near' : 'far');

/** The result of an escape: a score out of 1000 and a rank. Each catch and each wasted step costs a little. */
export function walkResult(maze: Maze, snapshot: Pick<WalkSnapshot, 'steps' | 'catches'>): { score: number; rank: 'S' | 'A' | 'B' | 'C' } {
  const wasted = Math.max(0, snapshot.steps - fewestSteps(maze));
  const score = Math.max(0, 1000 - 150 * snapshot.catches - 6 * wasted);
  return { score, rank: rankOf(score / 1000) };
}

/** Where something is from a cell, facing a way: an angle from straight ahead (degrees), and how far in a straight line. */
export function bearingFrom(cell: Cell, facing: Dir, to: Cell): { angle: number; rooms: number } {
  const dx = to.x - cell.x;
  const dy = to.y - cell.y;
  const heading = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return { angle: dx === 0 && dy === 0 ? 0 : foldAngle(heading - facing * 90), rooms: Math.hypot(dx, dy) };
}

export function createWalk(options: WalkOptions): Walk {
  const { maze } = options;
  const settings = resolveWalkSettings(options.settings);
  const stepMs = settings.stepMs[options.speed];
  const creak = mulberry32((maze.seed ^ 0x5ea17) >>> 0);
  const roomIndex = new Map(maze.rooms.map((r, i) => [indexOf(maze, r), i]));
  const hideAt = new Set(maze.hides.map((h) => indexOf(maze, h)));
  const ritualHouse = maze.relics.length > 0;

  const initial = openings(maze, maze.start)[0]!;
  let cell = maze.start;
  let facing: Dir = initial;
  let phantom: PhantomState = phantomStart(maze);
  let steps = 0;
  let catches = 0;
  let listens = 0;
  let hides = 0;
  let hints = 0;
  let lastListenStep = -Infinity;
  let phase: WalkSnapshot['phase'] = 'walking';
  let nextStepAt = options.startMs;
  let nextTickAt = 0;
  let resumeAt = 0;
  let scanner: Scanner | null = null;
  let junction: { cell: Cell; facing: Dir } | null = null;
  // One spoken line between two crossings, and the options wait until it has been heard.
  let busyUntil = options.startMs + (options.quietMs ?? 0);
  let spokeThisLeg = false;
  /** What the last phantom line said, so the same far-off news is not repeated at every stop. */
  let lastCall: { range: number; mode: PhantomState['mode'] | '' } = { range: -1, mode: '' };
  let scanStartAt: number | null = null;
  let optionsNow: readonly ScanOption[] = [];
  const found = maze.relics.map(() => false);
  let chasing = false;
  const visited = new Array<boolean>(maze.width * maze.height).fill(false);
  const relicsLeft = (): Cell[] => maze.relics.filter((_, i) => !found[i]);

  const sec = (ms: number): number => (ms - options.startMs) / 1000;
  const send = (type: string, data: Record<string, unknown> | undefined, nowMs: number, offsetSec = 0): void => {
    const extra = options.decorate?.(type, data ?? {});
    const merged = extra ? { ...data, ...extra } : data;
    const event: SemanticEvent = merged ? { type, at: sec(nowMs) + offsetSec, data: merged } : { type, at: sec(nowMs) + offsetSec };
    options.emit(event, sec(nowMs));
    // Note how long this event will be spoken for, so nothing is read over it.
    const ms = options.speechMs?.(event) ?? 0;
    if (ms > 0) busyUntil = Math.max(busyUntil, nowMs + offsetSec * 1000) + ms;
  };
  /** Send a line after anything still being said. */
  const sendAfter = (type: string, data: Record<string, unknown> | undefined, nowMs: number): void =>
    send(type, data, nowMs, Math.max(0, busyUntil - nowMs) / 1000);

  const bearing = (to: Cell): { angle: number; rooms: number } => bearingFrom(cell, facing, to);

  /** Say where the phantom is: the one spoken line of a leg, given when the player stops. */
  const announceGhost = (nowMs: number): void => {
    const g = bearing(phantom.at);
    const distance = Math.min(1, g.rooms / settings.hearRange);
    // Only news is said: it is near, it came closer than last said, its mood changed, or the chase is on.
    // Its direction alone changes whenever you turn, so that is not news; Listen always tells it.
    const range = ['far', 'near', 'close'].indexOf(rangeWord(distance));
    const news =
      settings.ghostCall === 'always' || chasing || g.rooms <= settings.ghostCallNear || phantom.mode !== lastCall.mode || range > lastCall.range;
    lastCall = { range, mode: phantom.mode };
    if (!news) return;
    sendAfter(NAV_EVENTS.ghostCall, { angle: g.angle, distance }, nowMs);
  };

  /** Start reading out the options, once whatever is being said has finished. */
  const beginScan = (nowMs: number): void => {
    if (!scanner) return;
    if (busyUntil <= nowMs) {
      scanStartAt = null;
      sendOption(scanner.start(nowMs), nowMs);
    } else {
      scanStartAt = busyUntil;
    }
  };

  const sendOption = (option: ScanOption | null, nowMs: number): void => {
    if (!option) return;
    send(
      NAV_EVENTS.option,
      {
        id: option.id,
        label: option.label,
        ...(option.angle !== undefined ? { angle: option.angle, distance: 0.3 } : {}),
        index: optionsNow.findIndex((o) => o.id === option.id) + 1,
        count: optionsNow.length,
      },
      nowMs,
    );
  };

  const offer = (choices: ScanOption[], nowMs: number): void => {
    optionsNow = choices;
    scanner = createScanner({ options: choices, dwellMs: options.dwellMs });
    beginScan(nowMs);
  };

  const share = (news: readonly PhantomNews[], nowMs: number): void => {
    for (const n of news) {
      if (n === 'hunts') {
        const g = bearing(phantom.at);
        send(NAV_EVENTS.ghostHunts, { angle: g.angle, distance: Math.min(1, g.rooms / settings.hearRange) }, nowMs);
      } else if (n === 'lost') send(NAV_EVENTS.ghostLost, undefined, nowMs);
      else send(NAV_EVENTS.ghostSearched, undefined, nowMs);
    }
  };

  /** The sounds of the house around the player after each step. */
  const sense = (nowMs: number): void => {
    const g = bearing(phantom.at);
    if (g.rooms <= settings.hearRange && steps % settings.ghostSenseEvery === 0) {
      const distance = Math.min(1, g.rooms / settings.hearRange);
      // While walking the phantom is only a sound. It is put into words when the player stops.
      send(NAV_EVENTS.ghostSense, { angle: g.angle, distance, rooms: Math.round(g.rooms) }, nowMs);
    }
    const e = bearing(maze.exit);
    // In the chase the bell rings every step: it is the way out.
    const bellEvery = chasing ? 1 : settings.exitSenseEvery;
    if ((chasing || e.rooms <= settings.exitRange) && steps % bellEvery === 0) {
      send(NAV_EVENTS.exitSense, { angle: e.angle, distance: Math.min(1, e.rooms / settings.exitRange) }, nowMs);
    }
    if (!chasing && steps % settings.relicSenseEvery === 0) {
      maze.relics.forEach((r, relic) => {
        if (found[relic]) return;
        const b = bearing(r);
        if (b.rooms <= settings.exitRange) send(NAV_EVENTS.relicSense, { angle: b.angle, distance: Math.min(1, b.rooms / settings.exitRange), relic }, nowMs);
      });
    }
    if (steps > 0 && steps % settings.creakEvery === 0) {
      send(NAV_EVENTS.creak, { angle: creak() * 360 - 180, distance: 0.4 + creak() * 0.5 }, nowMs);
    }
  };

  const caught = (nowMs: number): void => {
    catches += 1;
    phase = 'caught';
    scanner = null;
    optionsNow = [];
    resumeAt = nowMs + settings.catchPauseMs;
    send(NAV_EVENTS.caught, { catches }, nowMs);
  };

  /** One turn of the phantom. Returns true if it caught the player. */
  const phantomMoves = (nowMs: number, how: { hidden?: boolean; force?: boolean } = {}): boolean => {
    const turn = phantomTurn(maze, phantom, cell, { hidden: how.hidden === true, chasing, ...(how.force ? { force: true } : {}) });
    phantom = turn.state;
    share(turn.news, nowMs);
    if (turn.caught) {
      caught(nowMs);
      return true;
    }
    return false;
  };

  /** Listen: say where the phantom, the bell and the nearest relic are, and sound each from its own direction. */
  const listen = (nowMs: number, costsAStep: boolean): void => {
    listens += 1;
    lastListenStep = steps;
    const g = bearing(phantom.at);
    const e = bearing(maze.exit);
    const word = (b: { angle: number; rooms: number }): string =>
      b.rooms > settings.listenRange ? 'far away' : `${compassWord(b.angle)}, ${rangeWord(b.rooms / settings.listenRange)}`;
    const left = relicsLeft();
    const nearest = left.map((r) => bearing(r)).sort((a, b) => a.rooms - b.rooms)[0];
    const relicLine = nearest ? ` The nearest relic hums ${word(nearest)}.` : '';
    const lead = Math.max(0, busyUntil - nowMs) / 1000; // after anything still being said
    send(NAV_EVENTS.listen, { summary: `The phantom is ${word(g)}. The bell is ${word(e)}.${relicLine}` }, nowMs, lead);
    if (g.rooms <= settings.listenRange) {
      send(NAV_EVENTS.ghostSense, { angle: g.angle, distance: Math.min(1, g.rooms / settings.listenRange) }, nowMs, lead + 0.2);
    }
    if (e.rooms <= settings.listenRange) {
      send(NAV_EVENTS.exitSense, { angle: e.angle, distance: Math.min(1, e.rooms / settings.listenRange) }, nowMs, lead + 1.0);
    }
    if (nearest && nearest.rooms <= settings.listenRange) {
      send(NAV_EVENTS.relicSense, { angle: nearest.angle, distance: Math.min(1, nearest.rooms / settings.listenRange) }, nowMs, lead + 1.6);
    }
    spokeThisLeg = true;
    // Holding your breath to listen costs time where you stand: the phantom moves.
    if (costsAStep) phantomMoves(nowMs, { force: true });
  };

  /** A hint: which way leads to the nearest relic (or, once they are all found, to the exit). */
  const hint = (nowMs: number, free = false): void => {
    if (!free) hints += 1;
    const left = relicsLeft();
    const fromHere = distancesFrom(maze, cell);
    const target = left.length > 0 ? [...left].sort((a, b) => fromHere[indexOf(maze, a)]! - fromHere[indexOf(maze, b)]!)[0]! : maze.exit;
    const next = stepToward(maze, cell, target);
    const dir = next ? openings(maze, cell).find((d) => sameCell(neighbour(cell, d), next)) : undefined;
    const way = dir === undefined ? 'here' : RELATIVE.find(({ rel }) => ((facing + rel) % 4) === dir)!.way;
    sendAfter(
      NAV_EVENTS.hint,
      {
        what: left.length > 0 ? 'relic' : 'exit',
        way,
        rooms: fromHere[indexOf(maze, target)]!,
        found: maze.relics.length - left.length,
        total: maze.relics.length,
        ...(free ? { free: true } : {}),
      },
      nowMs,
    );
    if (free) return; // a hint given after a catch costs nothing: the phantom does not move
    spokeThisLeg = true;
    phantomMoves(nowMs, { force: true });
  };

  /** The choices where the player stands: each way, Listen, and in a ritual house Hide and a hint. */
  const choicesHere = (): ScanOption[] => {
    const ways = openings(maze, cell);
    const choices: ScanOption[] = RELATIVE.flatMap(({ rel, label, angle }) => {
      const d = ((facing + rel) % 4) as Dir;
      return ways.includes(d) ? [{ id: `dir:${d}`, label, angle }] : [];
    });
    choices.push({ id: 'listen', label: 'Listen' });
    if (hideAt.has(indexOf(maze, cell)) && !chasing) choices.push({ id: 'hide', label: settings.hideLabel });
    if (ritualHouse) choices.push({ id: 'hint', label: settings.hintLabel });
    return choices;
  };

  /** Stop here and offer the choices. */
  const stopHere = (nowMs: number, ring = true): void => {
    junction = { cell, facing };
    phase = 'choosing';
    const choices = choicesHere();
    if (ring) send(NAV_EVENTS.crossing, { count: choices.filter((c) => c.id.startsWith('dir:')).length }, nowMs);
    // The one line of the leg: where the phantom is now. If the player already listened on the way, that was it.
    if (!spokeThisLeg) announceGhost(nowMs);
    offer(choices, nowMs);
  };

  /** Arrive in a room: escape, find a relic, carry on down a passage, turn at a dead end, or stop and choose. */
  const arrive = (nowMs: number): void => {
    const first = !visited[indexOf(maze, cell)];
    visited[indexOf(maze, cell)] = true;
    const atExit = sameCell(cell, maze.exit);
    if (atExit && relicsLeft().length === 0) {
      phase = 'escaped';
      send(NAV_EVENTS.escaped, { steps, catches, listens, hides, hints, fewest: fewestSteps(maze) }, nowMs);
      return;
    }
    const room = roomIndex.get(indexOf(maze, cell));
    const relicAt = maze.relics.findIndex((r, i) => !found[i] && sameCell(r, cell));
    if (room !== undefined) {
      sendAfter(NAV_EVENTS.room, { room, first, hide: hideAt.has(indexOf(maze, cell)), relicHere: relicAt >= 0 }, nowMs);
    }
    if (relicAt >= 0) {
      found[relicAt] = true;
      const count = found.filter(Boolean).length;
      sendAfter(NAV_EVENTS.relic, { found: count, total: found.length, relic: relicAt }, nowMs);
      if (count === found.length) {
        chasing = true;
        sendAfter(NAV_EVENTS.ritual, { total: found.length }, nowMs);
      }
    }
    if (atExit) sendAfter(NAV_EVENTS.sealed, { left: relicsLeft().length }, nowMs);
    if (room !== undefined || atExit) return stopHere(nowMs);

    const ways = openings(maze, cell);
    const back = opposite(facing);
    const atStart = steps === 0 && sameCell(cell, maze.start);
    const forward = atStart ? ways : ways.filter((d) => d !== back);
    if (forward.length === 0) {
      send(NAV_EVENTS.deadEnd, undefined, nowMs);
      facing = back;
      phase = 'walking';
      nextStepAt = nowMs + stepMs;
      return;
    }
    if (forward.length === 1 && !(atStart && ways.length > 1)) {
      facing = forward[0]!;
      phase = 'walking';
      nextStepAt = nowMs + stepMs;
      return;
    }
    stopHere(nowMs);
  };

  const step = (nowMs: number): void => {
    cell = neighbour(cell, facing);
    steps += 1;
    send(NAV_EVENTS.step, { steps }, nowMs);
    if (sameCell(cell, phantom.at)) return caught(nowMs);
    if (phantomMoves(nowMs)) return;
    sense(nowMs);
    arrive(nowMs);
  };

  /** After being caught: back to the last place you stopped, the phantom sent home. Relics stay found. */
  const resume = (nowMs: number): void => {
    cell = junction?.cell ?? maze.start;
    facing = junction?.facing ?? initial;
    phantom = phantomStart(maze);
    spokeThisLeg = false;
    if (junction === null) steps = 0; // caught before the first choice: begin the house again
    // A player caught again and again is lost: point the way, for free, before the choices.
    const n = settings.freeHintAfterCatches;
    if (ritualHouse && n > 0 && catches >= n && !sameCell(cell, maze.exit)) hint(nowMs, true);
    arrive(nowMs);
  };

  /** While hidden, time passes a step at a time: you hear it come, search, and go. */
  const hiddenTick = (nowMs: number): void => {
    phantomMoves(nowMs, { hidden: true });
    const g = bearing(phantom.at);
    if (g.rooms <= settings.hearRange) {
      send(NAV_EVENTS.ghostSense, { angle: g.angle, distance: Math.min(1, g.rooms / settings.hearRange), rooms: Math.round(g.rooms) }, nowMs);
    }
  };

  // The first room.
  send(NAV_EVENTS.start, undefined, options.startMs);
  arrive(options.startMs);

  return {
    advance(nowMs) {
      if (phase === 'walking') {
        let guard = 0;
        while (phase === 'walking' && nowMs >= nextStepAt && guard++ < 50) {
          const at = nextStepAt;
          nextStepAt = at + stepMs; // a late frame catches up one step at a time, never skipping a sound
          step(at);
        }
      } else if (phase === 'choosing' || phase === 'hidden') {
        if (phase === 'hidden') {
          let guard = 0;
          while (phase === 'hidden' && nowMs >= nextTickAt && guard++ < 50) {
            const at = nextTickAt;
            nextTickAt = at + stepMs;
            hiddenTick(at);
          }
        }
        if (scanStartAt !== null) {
          // Something is still being said: the options start when it is finished.
          if (nowMs >= scanStartAt) {
            scanStartAt = null;
            if (scanner) sendOption(scanner.start(nowMs), nowMs);
          }
        } else {
          sendOption(scanner?.tick(nowMs) ?? null, nowMs);
        }
      } else if (phase === 'caught' && nowMs >= resumeAt) {
        resume(nowMs);
      }
    },
    press(nowMs) {
      if (phase === 'walking') {
        // A press on the move listens, free, but not twice in quick succession.
        if (steps - lastListenStep >= settings.listenCooldown) listen(nowMs, false);
        return;
      }
      if ((phase !== 'choosing' && phase !== 'hidden') || !scanner || scanStartAt !== null) return; // nothing to choose until the options are being read
      const chosen = scanner.press();
      if (!chosen) return;
      if (chosen.id === 'listen' || chosen.id === 'hint') {
        if (chosen.id === 'listen') listen(nowMs, phase === 'choosing');
        else hint(nowMs);
        if (phase === 'choosing' || phase === 'hidden') {
          // Hear the whole answer first, then read the options again from the top.
          offer([...optionsNow], nowMs);
        }
        return;
      }
      if (chosen.id === 'hide') {
        hides += 1;
        phase = 'hidden';
        nextTickAt = nowMs + stepMs;
        sendAfter(NAV_EVENTS.hide, undefined, nowMs);
        offer(
          [
            { id: 'come-out', label: settings.comeOutLabel },
            { id: 'listen', label: 'Listen' },
          ],
          nowMs,
        );
        return;
      }
      if (chosen.id === 'come-out') {
        sendAfter(NAV_EVENTS.unhide, undefined, nowMs);
        spokeThisLeg = false;
        stopHere(nowMs, false);
        return;
      }
      facing = Number(chosen.id.slice(4)) as Dir;
      scanner = null;
      optionsNow = [];
      spokeThisLeg = false;
      phase = 'walking';
      nextStepAt = nowMs + stepMs * 0.6; // off you go, a little quicker than a stride
    },
    snapshot: () => ({
      phase,
      cell,
      facing,
      ghost: phantom.at,
      ghostMode: phantom.mode,
      steps,
      catches,
      listens,
      visited,
      options: optionsNow,
      lit: scanner?.lit()?.id ?? null,
      room: roomIndex.get(indexOf(maze, cell)) ?? null,
      relicsLeft: relicsLeft(),
      relicsFound: found.filter(Boolean).length,
      chasing,
      hides,
      hints,
    }),
  };
}
