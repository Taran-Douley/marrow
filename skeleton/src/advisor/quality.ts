import type { Kit } from '../kit';
import { cueTimes, idealPress, type Level } from '../level';
import { simulatePersona, type PersonaSpec } from '../personas';
import { speechPace } from '../scale';
import type { Speed } from '../types';

// The quality report (Requirement A7): can it be finished, and how does it play? Proofs answer the
// first; simulated players answer the second. Neither says whether it is fun: people do.

export type Verdict = 'good' | 'hard' | 'too hard';

export interface QualityReport {
  levels: number;
  /** Levels that passed every proof property. */
  proved: number;
  bySpeed: Record<Speed, { verdict: Verdict; clear150: number; clear250: number; clean250: number; audioOnly: number; reason: string }>;
  /** The longest stretch with nothing to do, in real seconds at Slow. */
  longestQuietSeconds: number;
  speechFollowable: boolean;
  /** The changes that would help most, in plain words. */
  advice: string[];
  markdown: string;
}

const SPEEDS: readonly Speed[] = ['slow', 'medium', 'fast'];
const pct = (x: number): string => `${Math.round(x * 100)}%`;
const noisy = (sigmaMs: number): PersonaSpec => ({ kind: 'noisy', sigmaMs });

/** How a game's levels play, for simulated players with 150 and 250 ms of timing error, and by sound only. */
export function qualityReport(kit: Kit, levels: readonly Level[], title = 'Game'): QualityReport {
  const tm = kit.timing;
  const proved = levels.filter((l) => kit.prove(l).every((r) => r.pass)).length;
  const bySpeed = {} as QualityReport['bySpeed'];
  for (const speed of SPEEDS) {
    const p150 = simulatePersona(levels, noisy(150), speed, tm);
    const p250 = simulatePersona(levels, noisy(250), speed, tm);
    const audio = simulatePersona(levels, { kind: 'audio-only' }, speed, tm);
    const verdict: Verdict = p250.meanClearRate >= 0.9 ? 'good' : p250.meanClearRate >= 0.75 ? 'hard' : 'too hard';
    const reason =
      verdict === 'good'
        ? `${pct(p250.meanClearRate)} of jumps cleared first time, even with 250 ms of timing error.`
        : `${pct(p250.meanClearRate)} of jumps cleared first time with 250 ms of timing error; ${pct(p250.cleanLevelRate)} of levels finished without a fall.`;
    bySpeed[speed] = { verdict, clear150: p150.meanClearRate, clear250: p250.meanClearRate, clean250: p250.cleanLevelRate, audioOnly: audio.meanClearRate, reason };
  }

  // The longest wait between one press and the next countdown, at Slow: long waits feel like nothing is happening.
  let quiet = 0;
  for (const l of levels) {
    let prev = 0;
    for (const o of l.obstacles) {
      quiet = Math.max(quiet, cueTimes(o, tm)[0] - prev);
      prev = idealPress(o, tm);
    }
  }
  const longestQuietSeconds = quiet / tm.rates.slow;
  const speechFollowable = levels.every((l) => speechPace(kit.renderLevel(l), tm.rates.fast).pass);

  const advice: string[] = [];
  if (proved < levels.length) advice.push(`${levels.length - proved} level(s) fail the proof and will be refused. Run kit.prove on them to see why.`);
  const hardest = SPEEDS.filter((s) => bySpeed[s].verdict !== 'good');
  if (hardest.length > 0) advice.push(`${hardest.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' and ')} ${hardest.length === 1 ? 'is' : 'are'} hard for a player with 250 ms of timing error: offer timing help and the coach, and keep Slow as the default.`);
  if (SPEEDS.some((s) => bySpeed[s].audioOnly < bySpeed[s].clear150 - 0.05)) advice.push('Players by sound do worse than players by sight: check every cue is heard before it is needed.');
  if (longestQuietSeconds > 12) advice.push(`The longest wait with nothing to do is ${longestQuietSeconds.toFixed(0)} s at Slow: shorten rests, or give the wait something to listen to.`);
  if (!speechFollowable) advice.push('Speech comes faster than a player can follow at Fast: give lesser events a lower priority (proof 18).');
  if (advice.length === 0) advice.push('Nothing to change: every level proved, and it plays well at every speed for these players.');

  const markdown = [
    `# How ${title} plays`,
    '',
    `**${proved} of ${levels.length} levels passed every proof property.**`,
    '',
    '| Speed | Verdict | Jumps cleared, 150 ms error | Jumps cleared, 250 ms error | Levels clean, 250 ms | By sound only |',
    '|---|---|---|---|---|---|',
    ...SPEEDS.map((s) => {
      const r = bySpeed[s];
      return `| ${s} | ${r.verdict} | ${pct(r.clear150)} | ${pct(r.clear250)} | ${pct(r.clean250)} | ${pct(r.audioOnly)} |`;
    }),
    '',
    `Longest wait with nothing to do: ${longestQuietSeconds.toFixed(1)} s at Slow. Speech a player can follow: ${speechFollowable ? 'yes' : 'no'}.`,
    '',
    '## What would help most',
    '',
    ...advice.map((a) => `- ${a}`),
    '',
    'These numbers come from simulated players. They show whether a game can be finished and how it plays, not whether it is fun. Test with real players, including disabled players.',
    '',
  ].join('\n');
  return { levels: levels.length, proved, bySpeed, longestQuietSeconds, speechFollowable, advice, markdown };
}
