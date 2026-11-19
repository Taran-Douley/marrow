import type { OutputCommand } from '../types';
import { proofResult } from './timing';
import type { ProofResult } from './types';

/** How much louder a beep must be than everything sounding under it, in decibels. */
export const CUE_MARGIN_DB = 6;

type SoundCommand = Extract<OutputCommand, { channel: 'sound' }>;
const isSound = (c: OutputCommand): c is SoundCommand => c.channel === 'sound';

/** Roles that sit under the beeps. Effects and rewards are brief and never overlap a beep. */
const BED_ROLES = new Set<SoundCommand['role']>(['ambience', 'music', 'approach']);

/**
 * Property 14, the track stays clear of the beeps: every note of the music sits below the lowest
 * beep, so the beeps keep their own pitch range and are never hidden by a tune. The ceiling is
 * 90% of the lowest beep.
 */
export function trackClearOfCues(commands: readonly OutputCommand[]): ProofResult {
  const sounds = commands.filter(isSound);
  // Only pitched cues set the ceiling: noise has no pitch for music to clash with.
  const cues = sounds.filter((s) => s.role === 'cue' && s.gain > 0 && s.hz > 0 && !s.shape?.noise);
  const problems: string[] = [];
  if (cues.length > 0) {
    const lowest = Math.min(...cues.map((c) => c.hz));
    const ceiling = lowest * 0.9;
    for (const m of sounds.filter((s) => s.role === 'music')) {
      const top = Math.max(m.hz, m.shape?.hzTo ?? 0);
      if (top > ceiling + 1e-9) {
        problems.push(
          `A music note at ${m.at.toFixed(2)} s is ${Math.round(top)} Hz, but the lowest beep is ${Math.round(lowest)} Hz. ` +
            `Music must stay under ${Math.round(ceiling)} Hz so the beeps keep their own pitch range.`,
        );
      }
    }
  }
  return proofResult(14, 'Track clear of the beeps', problems);
}

/**
 * Property 13, cues audible over ambience: at the moment each beep plays, its
 * level must beat the sum of everything sounding under it by the margin, under
 * the profile the commands were rendered for. Pass the commands for a whole
 * level, rendered with the profile you want to check.
 *
 * Levels are static gains, which is the worst case: a bed that is fading in or
 * out is quieter than its peak, so passing here means the real mix passes too.
 */
export function cuesAudible(commands: readonly OutputCommand[], marginDb: number = CUE_MARGIN_DB): ProofResult {
  const sounds = commands.filter(isSound);
  const beds = sounds.filter((s) => BED_ROLES.has(s.role) && s.shape?.span !== undefined);
  const needed = 10 ** (marginDb / 20);
  const problems: string[] = [];

  for (const cue of sounds.filter((s) => s.role === 'cue')) {
    if (cue.gain <= 0) continue; // the player turned the beeps off: there is nothing to be heard over
    const under = beds.filter((b) => b.at <= cue.at && cue.at < b.at + b.shape!.span!);
    const total = under.reduce((sum, b) => sum + b.gain, 0);
    if (total * needed > cue.gain + 1e-12) {
      problems.push(
        `The beep at ${cue.at.toFixed(2)} s plays at ${cue.gain.toFixed(2)}, but the sounds under it add up to ` +
          `${total.toFixed(2)}. A beep must be at least ${marginDb} dB louder than what is under it.`,
      );
    }
  }
  return proofResult(13, 'Cues audible over ambience', problems);
}
