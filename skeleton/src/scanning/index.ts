import { proofResult, type ProofResult } from '../proof';

// Switch scanning: options light up and are spoken in turn, and one press chooses
// the lit one. It cycles until pressed, with no time limit, and never expires,
// skips or chooses for the player, so one switch is enough (Requirement 2).
// Pure state machine: the game decides what to say, show and sound for each
// option as it is lit.

export interface ScanOption {
  id: string;
  label: string;
  /** Where the option sounds from, in degrees (0 ahead, 90 right, 180 behind), for placed sound. */
  angle?: number;
}

export interface ScannerOptions {
  options: readonly ScanOption[];
  /** How long each option stays lit, in ms. It is lengthened for long labels so every one can be heard in full. */
  dwellMs: number;
}

export interface Scanner {
  readonly options: readonly ScanOption[];
  /** Light the first option. Returns it. Call once, when the menu appears. */
  start(nowMs: number): ScanOption | null;
  /** Move the clock. Returns the newly lit option when the highlight moves, otherwise null. */
  tick(nowMs: number): ScanOption | null;
  /** The press chooses the lit option, or nothing if the menu is empty. */
  press(): ScanOption | null;
  /** The lit option. */
  lit(): ScanOption | null;
  /** Hold the highlight still, for example while a keyboard user has a control focused (Requirement 2.4). */
  pause(): void;
  resume(nowMs: number): void;
}

/** A fair guess at how long a line takes to say, in ms. */
export const speechMs = (label: string): number => Math.max(400 + 65 * label.length, clipMs.get(label) ?? 0);

/**
 * The real length, in ms, of each recorded line, by its exact text. A game that plays recordings fills this
 * when it loads them, so every hold and proof waits for the clip and never for a shorter guess.
 */
const clipMs = new Map<string, number>();
export function setClipDurations(durations: Readonly<Record<string, number>>): void {
  clipMs.clear();
  for (const [text, ms] of Object.entries(durations)) if (Number.isFinite(ms) && ms > 0) clipMs.set(text, ms);
}

/** How long an option stays lit: the player's dwell, or long enough to hear the label and a beat more. */
export const dwellFor = (option: ScanOption, dwellMs: number): number => Math.max(dwellMs, speechMs(option.label) + 600);

export function createScanner(config: ScannerOptions): Scanner {
  const options = [...config.options];
  let index = 0;
  let litAt = 0;
  let paused = false;
  let started = false;

  return {
    options,
    start(nowMs) {
      started = true;
      index = 0;
      litAt = nowMs;
      paused = false;
      return options[0] ?? null;
    },
    tick(nowMs) {
      if (!started || paused || options.length < 2) return null;
      if (nowMs - litAt < dwellFor(options[index]!, config.dwellMs)) return null;
      index = (index + 1) % options.length; // wraps: it cycles until pressed
      litAt = nowMs;
      return options[index]!;
    },
    press: () => (started ? (options[index] ?? null) : null),
    lit: () => (started ? (options[index] ?? null) : null),
    pause() {
      paused = true;
    },
    resume(nowMs) {
      paused = false;
      litAt = nowMs; // the lit option gets its full time again, so nothing is cut short
    },
  };
}

/**
 * Property 102, every option can be heard: each option stays lit for at least the
 * time it takes to say it, plus a beat, so a listener is never moved on mid-word.
 * `createScanner` guarantees this by lengthening a dwell, so this property checks
 * the result for a menu and a dwell, and is how a developer's own timing is judged.
 */
export function scanningAudible(options: readonly ScanOption[], dwellMs: number, label = 'Menu'): ProofResult {
  const problems: string[] = [];
  for (const option of options) {
    const lit = dwellFor(option, dwellMs);
    const needed = speechMs(option.label) + 600;
    if (lit < needed) {
      problems.push(
        `${label}: the option '${option.label}' is lit for ${Math.round(lit)} ms but takes about ${Math.round(needed)} ms to say.`,
      );
    }
  }
  if (new Set(options.map((o) => o.id)).size !== options.length) {
    problems.push(`${label}: two options have the same id, so a press could choose the wrong one.`);
  }
  return proofResult(102, 'Every option can be heard', problems);
}
