import type { Speed } from '../types';

/** One try at one obstacle (Requirement 10.1). */
export interface Attempt {
  /** Level seed. */
  level: number;
  /** Obstacle number, counting from 1. */
  obstacle: number;
  kind: string;
  /**
   * cleared: jumped on the beat. passed: correctly let a distractor go by.
   * wrong: pressed on a distractor. early, late, none: timing misses.
   */
  result: 'cleared' | 'passed' | 'wrong' | 'early' | 'late' | 'none';
  /** Press time minus the fourth beat, in real ms. Negative is early. Null when nothing was pressed. */
  offsetMs: number | null;
  /** Width of the take-off window, in real ms at the chosen speed. */
  windowMs: number;
  speed: Speed;
  /** Whether the picture was on. Off means the player played by sound. */
  picture: boolean;
}

export interface LogSummary {
  attempts: number;
  cleared: number;
  falls: number;
  /** Average distance from the fourth beat, in ms, ignoring the sign. Null if nothing was pressed. */
  meanAbsOffsetMs: number | null;
}

export interface SessionLog {
  record(attempt: Attempt): void;
  entries(): Attempt[];
  clear(): void;
  summary(): LogSummary;
  /** All attempts as CSV, ready to save or paste (Requirement 10.2). */
  toCsv(): string;
}

const HEADER = ['attempt', 'level', 'obstacle', 'kind', 'result', 'offset_ms', 'window_ms', 'speed', 'picture'];

/** Quote a text cell, and stop spreadsheets from running one that starts like a formula. */
function textCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const round1 = (n: number): string => (Math.round(n * 10) / 10).toString();

export function createSessionLog(): SessionLog {
  let list: Attempt[] = [];

  return {
    record: (attempt) => void list.push({ ...attempt }),
    entries: () => list.map((a) => ({ ...a })),
    clear: () => void (list = []),
    summary() {
      const offsets = list.flatMap((a) => (a.offsetMs === null ? [] : [Math.abs(a.offsetMs)]));
      const cleared = list.filter((a) => a.result === 'cleared' || a.result === 'passed').length;
      return {
        attempts: list.length,
        cleared,
        falls: list.length - cleared,
        meanAbsOffsetMs: offsets.length === 0 ? null : offsets.reduce((s, n) => s + n, 0) / offsets.length,
      };
    },
    toCsv() {
      const rows = list.map((a, i) =>
        [
          String(i + 1),
          String(a.level),
          String(a.obstacle),
          textCell(a.kind),
          a.result,
          a.offsetMs === null ? '' : round1(a.offsetMs),
          round1(a.windowMs),
          a.speed,
          a.picture ? 'on' : 'off',
        ].join(','),
      );
      return [HEADER.join(','), ...rows].join('\n') + '\n';
    },
  };
}
