import { DEFAULT_TARGET_SHARE, lessonPools, type Lesson } from '../lesson';
import type { Speed } from '../types';

// Timing model. Defaults come from .kiro/steering/tech.md. All times are in
// running seconds (level time). Real seconds = running seconds / rate.
// A game with a different jump or beat passes its own Timing (see resolveTiming).

/** Airtime of one jump. */
export const T = 0.85;
/** Countdown beat: three beeps, press on the fourth beat. */
export const BEAT = 0.4;
/** Ghost half-width. */
export const M = 0.06;
/** Spacing between obstacles: start of next minus end of previous. */
export const GAP: readonly [number, number] = [2.3, 3.0];
/** Start of the first obstacle. Leaves time for the spoken intro. */
export const FIRST_START = 6.5;
export const OBSTACLES_PER_LEVEL = 12;
/** Each countdown must start at least this long after landing from an on-time jump. */
export const LANDING_MARGIN = 0.25;

export const RATES: Readonly<Record<Speed, number>> = { slow: 0.6, medium: 0.8, fast: 1.0 };

/** Everything the timing maths depends on. Change it per game. */
export interface Timing {
  /** Airtime of one jump (T). */
  airtime: number;
  /** Length of one countdown beat (BEAT). */
  beat: number;
  /** Half the width of the player character (M). */
  halfWidth: number;
  /** Allowed spacing between obstacles: start of next minus end of previous. */
  gap: readonly [number, number];
  firstStart: number;
  obstaclesPerLevel: number;
  /** Countdown must start this long after landing (LANDING_MARGIN). */
  landingMargin: number;
  /** Real seconds = running seconds / rate. */
  rates: Readonly<Record<Speed, number>>;
  /**
   * Put every press on one steady pulse of `beat` seconds, so the countdowns and the music share a
   * tempo. Gaps stay inside `gap`. Default true.
   */
  onBeat: boolean;
}

export const DEFAULT_TIMING: Timing = {
  airtime: T,
  beat: BEAT,
  halfWidth: M,
  gap: GAP,
  firstStart: FIRST_START,
  obstaclesPerLevel: OBSTACLES_PER_LEVEL,
  landingMargin: LANDING_MARGIN,
  rates: RATES,
  onBeat: true,
};

/** Fill in the defaults and reject numbers that cannot work, in plain words. */
export function resolveTiming(overrides: Partial<Timing> = {}): Timing {
  const timing: Timing = { ...DEFAULT_TIMING, ...stripUndefined(overrides) };
  const positive = (name: string, value: number): void => {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Timing '${name}' must be a number above zero.`);
  };
  positive('airtime', timing.airtime);
  positive('beat', timing.beat);
  positive('halfWidth', timing.halfWidth);
  positive('firstStart', timing.firstStart);
  if (!Number.isFinite(timing.landingMargin) || timing.landingMargin < 0) {
    throw new Error("Timing 'landingMargin' must be zero or more.");
  }
  if (!Number.isInteger(timing.obstaclesPerLevel) || timing.obstaclesPerLevel < 1) {
    throw new Error("Timing 'obstaclesPerLevel' must be a whole number of at least 1.");
  }
  if (!(timing.gap[0] > 0) || timing.gap[1] < timing.gap[0]) {
    throw new Error("Timing 'gap' must be [min, max] with min above zero and max at least min.");
  }
  for (const speed of ['slow', 'medium', 'fast'] as const) positive(`rates.${speed}`, timing.rates[speed]);
  return timing;
}

function stripUndefined<V extends object>(obj: V): Partial<V> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<V>;
}

/** A kind of obstacle and the width range it is generated with. */
export interface ObstacleKind {
  name: string;
  /** Width range in running seconds. */
  width: readonly [number, number];
}

export const DEFAULT_KINDS: readonly ObstacleKind[] = [
  { name: 'grave', width: [0.16, 0.3] },
  { name: 'fence', width: [0.12, 0.24] },
];

export interface Obstacle {
  index: number;
  kind: string;
  /** Start, in running seconds. */
  start: number;
  /** Width, in running seconds. */
  width: number;
  /** A number to think about, for a lesson. It is shown and spoken. */
  value?: number;
  /**
   * False means a distractor: the ghost passes through it and pressing is a
   * mistake. Missing or true means jump on the beat.
   */
  solid?: boolean;
  /** What a press does here. Missing means 'jump'. Every move is one press on the fourth beat. */
  move?: Move;
  /**
   * A number gate (move 'switch'): two lanes, one number each. `value` is the number in the other
   * lane, the one a press switches you to; `here` is the number in your lane. Exactly one is right.
   */
  gate?: { here: number };
}

/**
 * What one press does. Each uses the same take-off window as a jump, so the timing proofs hold for all:
 * - 'jump': hop over it.
 * - 'flip': gravity flips, and you run on the other side, clear of it.
 * - 'switch': you change lane, to the other number.
 */
export type Move = 'jump' | 'flip' | 'switch';
export const MOVES: readonly Move[] = ['jump', 'flip', 'switch'];

/** An obstacle you must jump, as opposed to one you must let pass. */
export const isSolid = (o: Pick<Obstacle, 'solid'>): boolean => o.solid !== false;

/** How busy a part of the song is: a rest has nothing to press, calm is spaced out, busy is close together. */
export type Feel = 'rest' | 'calm' | 'busy';

/** A part of a song, placed on level time. */
export interface LevelSection {
  name: string;
  /** Running seconds: [from, to). */
  from: number;
  to: number;
  feel: Feel;
  /** How much of the band plays, 0 to 1. */
  energy: number;
  move: Move;
}

/** A portal: from `at`, a press does `move`. It is announced a whole bar before its first obstacle. */
export interface Portal {
  at: number;
  move: Move;
}

/**
 * A level is plain data. Use `generateLevel`, or build one by hand from your
 * own game's obstacles: the proof accepts any level in this shape.
 */
export interface Level {
  seed: number;
  obstacles: Obstacle[];
  /** The song's parts, when the level was built from a song. */
  sections?: LevelSection[];
  /** Where the move changes. */
  portals?: Portal[];
}

export interface TakeoffWindow {
  a: number;
  b: number;
}

type Spot = Pick<Obstacle, 'start' | 'width'>;

/** Press at t0 clears the obstacle if a <= t0 <= b. */
export function takeoffWindow(o: Spot, timing: Timing = DEFAULT_TIMING): TakeoffWindow {
  return { a: o.start + o.width + timing.halfWidth - timing.airtime, b: o.start - timing.halfWidth };
}

/** The fourth beat: the middle of the take-off window. */
export function idealPress(o: Spot, timing: Timing = DEFAULT_TIMING): number {
  const { a, b } = takeoffWindow(o, timing);
  return (a + b) / 2;
}

/** The three countdown beeps, at J-3*beat, J-2*beat and J-beat. */
export function cueTimes(o: Spot, timing: Timing = DEFAULT_TIMING): [number, number, number] {
  const j = idealPress(o, timing);
  return [j - 3 * timing.beat, j - 2 * timing.beat, j - timing.beat];
}

/** Convert running seconds to real seconds at a speed. */
export function toRealSeconds(running: number, speed: Speed, timing: Timing = DEFAULT_TIMING): number {
  return running / timing.rates[speed];
}

/** Width of the take-off window in real milliseconds at a speed. */
export function windowMs(o: Spot, speed: Speed, timing: Timing = DEFAULT_TIMING): number {
  const { a, b } = takeoffWindow(o, timing);
  return toRealSeconds(b - a, speed, timing) * 1000;
}

/** Small, fast, seedable PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GenerateOptions {
  kinds?: readonly ObstacleKind[];
  count?: number;
  timing?: Partial<Timing>;
  /** Give each obstacle a number, and make it a target or a distractor by the lesson's rule. */
  lesson?: Lesson;
}

/** Same seed and options always give the same level (Requirement 7.2). */
export function generateLevel(seed: number, options: GenerateOptions = {}): Level {
  const timing = resolveTiming(options.timing);
  const kinds = options.kinds ?? DEFAULT_KINDS;
  const count = options.count ?? timing.obstaclesPerLevel;
  if (kinds.length === 0) throw new Error('A level needs at least one obstacle kind.');

  const pools = options.lesson ? lessonPools(options.lesson) : undefined;
  const share = options.lesson?.targetShare ?? DEFAULT_TARGET_SHARE;

  const rand = mulberry32(seed);
  const obstacles: Obstacle[] = [];
  let start = timing.firstStart;

  // Choose how many are targets first, then shuffle them into place. A random draw per obstacle
  // would sometimes leave a level with almost no choice to make, which the proof would refuse.
  const targetAt: boolean[] = [];
  if (pools) {
    const targets = count >= 4 ? Math.min(count - 2, Math.max(2, Math.round(count * share))) : Math.round(count * share);
    for (let i = 0; i < count; i++) targetAt.push(i < targets);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [targetAt[i], targetAt[j]] = [targetAt[j]!, targetAt[i]!];
    }
  }

  // On the beat: every fourth beat lands on one steady pulse of `beat` seconds, so the countdowns,
  // and any music played on the same pulse, are in time with each other all level long. The gap rule
  // is kept: the start is moved within the allowed gap to the nearest pulse, never outside it.
  const half = (width: number): number => (width - timing.airtime) / 2; // press = start + half(width)
  // The pulse is set by the first press, so the first obstacle still starts exactly at `firstStart`.
  let phase = 0;
  const onPulse = (lo: number, hi: number, width: number): number => {
    const kMin = Math.ceil((lo + half(width) - phase) / timing.beat - 1e-9);
    const kMax = Math.floor((hi + half(width) - phase) / timing.beat + 1e-9);
    if (kMax < kMin) return lo + draw * (hi - lo); // the gap is narrower than one beat: keep it as drawn
    const k = kMin + Math.min(kMax - kMin, Math.floor(draw * (kMax - kMin + 1)));
    return phase + k * timing.beat - half(width);
  };
  let prevEnd: number | null = null;
  // The gap's random draw is taken at the same point as without the pulse, so a seed gives the same
  // obstacles, widths and numbers either way; only the starts move, by less than one beat.
  let draw = 0;

  for (let index = 0; index < count; index++) {
    const kind = kinds[Math.min(kinds.length - 1, Math.floor(rand() * kinds.length))]!;
    const width = kind.width[0] + rand() * (kind.width[1] - kind.width[0]);
    if (timing.onBeat) {
      if (prevEnd === null) phase = (start + half(width)) % timing.beat; // the first press sets the pulse
      else start = onPulse(prevEnd + timing.gap[0], prevEnd + timing.gap[1], width);
    }
    let numbered: Pick<Obstacle, 'value' | 'solid'> = {};
    if (pools) {
      const target = targetAt[index]!;
      const pool = target ? pools.targets : pools.distractors;
      numbered = { value: pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))]!, solid: target };
    }
    obstacles.push({ index, kind: kind.name, start, width, ...numbered });
    prevEnd = start + width;
    draw = rand();
    if (!timing.onBeat) start = start + width + (timing.gap[0] + draw * (timing.gap[1] - timing.gap[0]));
  }

  return { seed, obstacles };
}
