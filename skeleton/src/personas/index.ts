import { EVENT_TYPES } from '../channels/events';
import {
  DEFAULT_TIMING,
  idealPress,
  isSolid,
  mulberry32,
  takeoffWindow,
  windowMs,
  type Level,
  type Timing,
} from '../level';
import { levelEvents } from '../schedule';
import type { Speed } from '../types';

// Headless simulated players (Requirement 9). They need no audio hardware and no screen, so they
// run in CI and in the MCP server. Each one presses a little off the fourth beat, and a press
// clears an obstacle when it lands inside the take-off window. A player who knows the rule lets a
// distractor pass, so only the obstacles to jump are at risk.

export type PersonaSpec =
  /** Presses exactly on the fourth beat. */
  | { kind: 'perfect' }
  /** One switch, with Gaussian timing error of `sigmaMs` real milliseconds. */
  | { kind: 'noisy'; sigmaMs: number }
  /**
   * Cannot see the screen. Receives only the countdown beeps and presses one beat after the third,
   * with timing error (default 120 ms).
   */
  | { kind: 'audio-only'; sigmaMs?: number };

export const DEFAULT_AUDIO_SIGMA_MS = 120;

export function personaName(spec: PersonaSpec): string {
  if (spec.kind === 'perfect') return 'perfect one-switch';
  if (spec.kind === 'noisy') return `one-switch, ${spec.sigmaMs} ms timing error`;
  return `audio-only, ${spec.sigmaMs ?? DEFAULT_AUDIO_SIGMA_MS} ms timing error`;
}

const sigmaOf = (spec: PersonaSpec): number =>
  spec.kind === 'perfect' ? 0 : spec.kind === 'noisy' ? spec.sigmaMs : (spec.sigmaMs ?? DEFAULT_AUDIO_SIGMA_MS);

/** The standard normal cumulative distribution (Abramowitz and Stegun 7.1.26, error under 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const erf = 1 - poly * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/**
 * Where this persona aims, per obstacle, in running seconds. The audio-only persona works it out
 * from the cue events alone: the third beep plus one beat.
 */
export function aimTimes(level: Level, spec: PersonaSpec, timing: Timing = DEFAULT_TIMING): number[] {
  if (spec.kind !== 'audio-only') return level.obstacles.map((o) => idealPress(o, timing));
  const thirdBeeps = levelEvents(level, timing)
    .filter((e) => e.type === EVENT_TYPES.beat && e.data?.beat === 3)
    .map((e) => e.at);
  return level.obstacles.map((_, i) => (thirdBeeps[i] ?? Number.NaN) + timing.beat);
}

export interface ObstacleChance {
  level: number;
  index: number;
  kind: string;
  /** Width of the take-off window in real ms at this speed. */
  windowMs: number;
  /** Chance of clearing it on the first try, 0 to 1. */
  chance: number;
}

/** The exact chance of clearing each obstacle to jump, on the first try, at a speed. */
export function obstacleChances(level: Level, spec: PersonaSpec, speed: Speed, timing: Timing = DEFAULT_TIMING): ObstacleChance[] {
  const aims = aimTimes(level, spec, timing);
  const sigmaRunning = (sigmaOf(spec) / 1000) * timing.rates[speed]; // real seconds to running seconds
  const out: ObstacleChance[] = [];
  level.obstacles.forEach((o, i) => {
    if (!isSolid(o)) return;
    const { a, b } = takeoffWindow(o, timing);
    const aim = aims[i]!;
    const chance =
      sigmaRunning === 0 ? (aim >= a && aim <= b ? 1 : 0) : Math.max(0, normalCdf((b - aim) / sigmaRunning) - normalCdf((a - aim) / sigmaRunning));
    out.push({ level: level.seed, index: i, kind: o.kind, windowMs: windowMs(o, speed, timing), chance });
  });
  return out;
}

export interface PersonaReport {
  persona: string;
  speed: Speed;
  levels: number;
  /** Obstacles to jump, across all levels. */
  jumps: number;
  /** Average chance of clearing a jump on the first try. */
  meanClearRate: number;
  /** Average chance of finishing a level without a single fall. */
  cleanLevelRate: number;
  /** The hardest obstacle, in plain words. */
  hardest: string | null;
  hardestChance: number | null;
}

/** Report how a persona does across levels at one speed. */
export function simulatePersona(levels: readonly Level[], spec: PersonaSpec, speed: Speed, timing: Timing = DEFAULT_TIMING): PersonaReport {
  let jumps = 0;
  let sum = 0;
  let clean = 0;
  let worst: ObstacleChance | null = null;
  for (const level of levels) {
    const chances = obstacleChances(level, spec, speed, timing);
    jumps += chances.length;
    sum += chances.reduce((s, c) => s + c.chance, 0);
    clean += chances.reduce((p, c) => p * c.chance, 1);
    for (const c of chances) if (!worst || c.chance < worst.chance) worst = c;
  }
  return {
    persona: personaName(spec),
    speed,
    levels: levels.length,
    jumps,
    meanClearRate: jumps === 0 ? 1 : sum / jumps,
    cleanLevelRate: levels.length === 0 ? 1 : clean / levels.length,
    hardest: worst
      ? `Level ${worst.level}, obstacle ${worst.index + 1} (${worst.kind}): ${Math.round(worst.chance * 100)}% on the first try. The take-off window is ${Math.round(worst.windowMs)} ms.`
      : null,
    hardestChance: worst?.chance ?? null,
  };
}

/** Every persona at every speed. */
export function personaReport(
  levels: readonly Level[],
  specs: readonly PersonaSpec[],
  speeds: readonly Speed[] = ['slow', 'medium', 'fast'],
  timing: Timing = DEFAULT_TIMING,
): PersonaReport[] {
  return specs.flatMap((spec) => speeds.map((speed) => simulatePersona(levels, spec, speed, timing)));
}

/**
 * Play a level once, press by press, with random error. Used to check the exact chances above, and
 * handy for a "watch it play" tool. Returns which jumps cleared on the first try.
 */
export function playOnce(level: Level, spec: PersonaSpec, speed: Speed, rand: () => number, timing: Timing = DEFAULT_TIMING): boolean[] {
  const aims = aimTimes(level, spec, timing);
  const sigmaRunning = (sigmaOf(spec) / 1000) * timing.rates[speed];
  const gauss = (): number => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
  const result: boolean[] = [];
  level.obstacles.forEach((o, i) => {
    if (!isSolid(o)) return;
    const { a, b } = takeoffWindow(o, timing);
    const press = aims[i]! + gauss() * sigmaRunning;
    result.push(press >= a && press <= b);
  });
  return result;
}

export { mulberry32 as personaRandom };
