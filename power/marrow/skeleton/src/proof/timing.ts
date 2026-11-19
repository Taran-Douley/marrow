import {
  cueTimes,
  idealPress,
  isSolid,
  resolveTiming,
  takeoffWindow,
  windowMs,
  type Level,
  type Obstacle,
  type Timing,
} from '../level';
import type { Speed } from '../types';
import type { ProofInput, ProofResult } from './types';

const EPS = 1e-9;

/** Floors from tech.md (property 5). Medium has no floor in the spec. A game can pass its own. */
export const WINDOW_FLOOR_MS: Readonly<Partial<Record<Speed, number>>> = { slow: 650, fast: 400 };

const secs = (n: number): string => n.toFixed(2);
const timingOf = (input: ProofInput): Timing => resolveTiming(input.timing);

interface Describe {
  /** "Level 17, obstacle 4 (crypt, 1.00 s wide)" */
  full(o: Obstacle): string;
  /** "Level 17, obstacle 4 (crypt)" */
  short(o: Obstacle): string;
}

function describer(level: Level, input: ProofInput): Describe {
  const label = input.label ?? `Level ${level.seed}`;
  return {
    full: (o) => `${label}, obstacle ${o.index + 1} (${o.kind}, ${secs(o.width)} s wide)`,
    short: (o) => `${label}, obstacle ${o.index + 1} (${o.kind})`,
  };
}

/** Build a ProofResult from a list of plain-English problems. Use it for your own properties too. */
export function proofResult(id: number, name: string, problems: string[]): ProofResult {
  const base = { id, name, failures: problems.length };
  return problems.length === 0
    ? { ...base, pass: true }
    : { ...base, pass: false, counterexample: problems[0], counterexamples: problems };
}

/** 1. Jumpable: every obstacle has a non-empty take-off window (b >= a). */
export function jumpable(level: Level, input: ProofInput): ProofResult {
  const tm = timingOf(input);
  const d = describer(level, input);
  const problems: string[] = [];
  // An obstacle the player lets pass is never jumped, so it needs no take-off window.
  for (const o of level.obstacles.filter(isSolid)) {
    const { a, b } = takeoffWindow(o, tm);
    if (b < a - EPS) {
      problems.push(
        `${d.full(o)}: no take-off point clears it. One jump covers only ${secs(tm.airtime - 2 * tm.halfWidth)} s.`,
      );
    }
  }
  return proofResult(1, 'Jumpable', problems);
}

/**
 * 2. Reachable: taking off at the earliest possible moment for each obstacle,
 * the player has landed before the next take-off window closes.
 */
export function reachable(level: Level, input: ProofInput): ProofResult {
  const tm = timingOf(input);
  const d = describer(level, input);
  const problems: string[] = [];
  let lands = Number.NEGATIVE_INFINITY;
  level.obstacles.forEach((o, i) => {
    if (!isSolid(o)) return; // let past: the ghost stays on the ground, so nothing to land from
    const { a, b } = takeoffWindow(o, tm);
    if (b < a - EPS) {
      // An empty window is property 1's failure; do not report it twice.
      lands = a + tm.airtime;
      return;
    }
    const takeoff = Math.max(a, lands);
    if (takeoff > b + EPS) {
      const prev = level.obstacles[i - 1]!;
      problems.push(
        `${d.short(o)}: after the earliest possible jump over obstacle ${prev.index + 1}, ` +
          `the player lands at ${secs(lands)} s, but the take-off window closes at ${secs(b)} s.`,
      );
    }
    lands = takeoff + tm.airtime;
  });
  return proofResult(2, 'Reachable', problems);
}

/**
 * 3. Unambiguous cues: each countdown starts after the player lands from an
 * on-time jump over the previous obstacle, with a margin to spare.
 */
export function unambiguousCues(level: Level, input: ProofInput): ProofResult {
  const tm = timingOf(input);
  const d = describer(level, input);
  const problems: string[] = [];
  for (let i = 1; i < level.obstacles.length; i++) {
    const prev = level.obstacles[i - 1]!;
    const o = level.obstacles[i]!;
    const countdownStarts = idealPress(o, tm) - 3 * tm.beat;
    const lands = idealPress(prev, tm) + tm.airtime;
    const lead = countdownStarts - lands;
    if (lead < tm.landingMargin - EPS) {
      const when =
        lead < 0
          ? `${secs(-lead)} s before the player lands from the jump over obstacle ${prev.index + 1}`
          : `only ${secs(lead)} s after the player lands from the jump over obstacle ${prev.index + 1}`;
      problems.push(`${d.short(o)}: the countdown starts ${when}. It needs at least ${secs(tm.landingMargin)} s.`);
    }
  }
  return proofResult(3, 'Unambiguous cues', problems);
}

/** 4. Multisensory: every object type has a sound, a spoken name and a caption. */
export function multisensory(level: Level, input: ProofInput): ProofResult {
  const label = input.label ?? `Level ${level.seed}`;
  const names = new Set([...input.objects.names(), ...level.obstacles.map((o) => o.kind)]);
  const problems: string[] = [];
  for (const name of names) {
    const info = input.objects.get(name);
    if (!info) {
      problems.push(`${label}: object type '${name}' is used but not defined, so it has no sound, spoken name or caption.`);
      continue;
    }
    const missing: string[] = [];
    if (!info.sound) missing.push('sound');
    if (!info.say || info.say.trim() === '') missing.push('spoken name');
    if (!info.caption || info.caption.trim() === '') missing.push('caption');
    if (missing.length > 0) {
      problems.push(`${label}: object type '${name}' has no ${missing.join(' and no ')}.`);
    }
  }
  return proofResult(4, 'Multisensory', problems);
}

/** 5. Window floor: at least 400 ms at Fast and 650 ms at Slow (or your own floors). */
export function windowFloor(level: Level, input: ProofInput): ProofResult {
  const tm = timingOf(input);
  const d = describer(level, input);
  const floors = { ...WINDOW_FLOOR_MS, ...input.floorsMs };
  const problems: string[] = [];
  for (const o of level.obstacles.filter(isSolid)) {
    for (const [speed, floor] of Object.entries(floors) as [Speed, number | undefined][]) {
      if (floor === undefined) continue;
      const ms = windowMs(o, speed, tm);
      if (ms < floor - EPS) {
        problems.push(
          `${d.full(o)}: the take-off window is only ${Math.round(Math.max(0, ms))} ms at ${cap(speed)}. ` +
            `The floor is ${floor} ms.`,
        );
      }
    }
  }
  return proofResult(5, 'Window floor', problems);
}

/** 6. Fourth beat clears: pressing exactly on the fourth beat clears every obstacle. */
export function fourthBeatClears(level: Level, input: ProofInput): ProofResult {
  const tm = timingOf(input);
  const d = describer(level, input);
  const problems: string[] = [];
  for (const o of level.obstacles.filter(isSolid)) {
    const { a, b } = takeoffWindow(o, tm);
    const press = cueTimes(o, tm)[2] + tm.beat; // third beep plus one beat
    if (press < a - EPS || press > b + EPS) {
      problems.push(
        `${d.full(o)}: pressing on the fourth beat at ${secs(press)} s misses the take-off window ` +
          `(${secs(a)} s to ${secs(b)} s).`,
      );
    }
  }
  return proofResult(6, 'Fourth beat clears', problems);
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
