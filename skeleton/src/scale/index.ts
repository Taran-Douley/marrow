import { proofResult } from '../proof/timing';
import type { ProofResult } from '../proof/types';
import type { OutputCommand } from '../types';

// Helpers for big, busy games (Requirement 25): say only the nearest few things, and prove the voice
// never talks faster than a player can follow.

/** The `n` nearest of many placed things, nearest first. Use it to announce and sound only those. */
export function nearest<T>(items: readonly T[], n: number, distance: (item: T) => number): T[] {
  return [...items]
    .map((item) => ({ item, d: distance(item) }))
    .filter((x) => Number.isFinite(x.d))
    .sort((a, b) => a.d - b.d)
    .slice(0, Math.max(0, n))
    .map((x) => x.item);
}

/** Most new spoken lines a player is given in any few seconds, by default. */
export const DEFAULT_SPEECH_PACE = { lines: 3, seconds: 4 } as const;

/**
 * Property 18, speech a player can follow (Requirement 25.6): in any `seconds` of real time, no more
 * than `lines` new spoken lines. Pass everything a stretch of play renders (a simulated flood of events
 * is a good test), under the profile you care about, and the speed rate.
 */
export function speechPace(
  commands: readonly OutputCommand[],
  rate: number,
  pace: { lines: number; seconds: number } = DEFAULT_SPEECH_PACE,
  label = 'Game',
): ProofResult {
  const times = commands
    .filter((c) => c.channel === 'speech')
    .map((c) => c.at / rate)
    .sort((a, b) => a - b);
  const problems: string[] = [];
  for (let i = 0, j = 0; i < times.length; i++) {
    while (times[i]! - times[j]! >= pace.seconds) j++;
    const count = i - j + 1;
    if (count > pace.lines) {
      problems.push(
        `${label}: ${count} spoken lines within ${pace.seconds} seconds, from ${times[j]!.toFixed(1)} s. ` +
          `A player can follow about ${pace.lines}. Give the extra events a lower priority, or combine them.`,
      );
      j = i;
    }
  }
  return proofResult(18, 'Speech a player can follow', problems);
}
