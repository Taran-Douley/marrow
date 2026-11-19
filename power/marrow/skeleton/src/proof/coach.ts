import { cueTimes, idealPress, resolveTiming, type Level } from '../level';
import { coachTimes } from '../run';
import type { Speed } from '../types';
import { proofResult } from './timing';
import type { ProofResult } from './types';

/**
 * Property 17, the coach is in time (Requirement 21.4): every coach line starts after the player has
 * landed from an on-time jump over the obstacle before, plus the landing margin, and before the first
 * beep. Where the asked-for lead did not fit, `shortened` says so in plain words: that is not a failure,
 * because the longest lead that fits is used, but the player is told.
 */
export function coachInTime(
  level: Level,
  input: { timing?: Parameters<typeof resolveTiming>[0]; label?: string },
  speed: Speed,
  leadMs: number,
): ProofResult & { shortened: string[] } {
  const tm = resolveTiming(input.timing);
  const label = input.label ?? `Level ${level.seed}`;
  const problems: string[] = [];
  const shortened: string[] = [];
  for (const line of coachTimes(level, tm, speed, leadMs)) {
    const o = level.obstacles[line.index]!;
    const prev = level.obstacles[line.index - 1];
    const lands = prev ? idealPress(prev, tm) + tm.airtime : -Infinity;
    const where = `${label}, obstacle ${line.index + 1} (${o.kind})`;
    if (line.at < lands + tm.landingMargin - 1e-9) problems.push(`${where}: the coach starts before the player has landed from the jump before.`);
    if (line.at >= cueTimes(o, tm)[0]) problems.push(`${where}: the coach starts after the first beep.`);
    if (line.gotMs < line.askedMs - 1) shortened.push(`${where}: the coach could start only ${(line.gotMs / 1000).toFixed(1)} s before the beeps, not ${(line.askedMs / 1000).toFixed(1)} s.`);
  }
  return { ...proofResult(17, 'Coach in time', problems), shortened };
}
