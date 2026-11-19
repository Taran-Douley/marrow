import { cueTimes, idealPress, resolveTiming, type Level, type Timing } from '../level';
import { MAX_PULSES_PER_SECOND, PULSE_MAX_ALPHA, pulseAt, pulsesPerSecond } from '../pulse';
import { resolveRunSettings, type RunSettings, type RunSettingsInput } from '../run';
import { THEMES, luminance } from '../theme';
import type { Speed } from '../types';
import { proofResult } from './timing';
import type { ProofInput, ProofProperty, ProofResult } from './types';

// The properties of a rhythm game's feel: 19 locked to the song, 20 instant retry, 21 gentle pulses.

const EPS = 1e-6;
const secs = (n: number): string => n.toFixed(2);
const SPEEDS: readonly Speed[] = ['slow', 'medium', 'fast'];

/**
 * Property 19, locked to the song: every ideal press (the fourth beat) is a whole number of beats from
 * the start of the level, and each countdown, from its first beep until the obstacle is passed, lies
 * inside one part of the song that is not a rest. So every press lands on the beat of the music, and
 * rests stay silent of cues. A level with no song has nothing to lock to and passes.
 */
export function lockedToTheSong(level: Level, input: ProofInput): ProofResult {
  const tm = resolveTiming(input.timing);
  const label = input.label ?? `Level ${level.seed}`;
  const problems: string[] = [];
  if (level.sections && level.sections.length > 0) {
    for (const o of level.obstacles) {
      const where = `${label}, obstacle ${o.index + 1} (${o.kind})`;
      const press = idealPress(o, tm);
      const beats = press / tm.beat;
      if (Math.abs(beats - Math.round(beats)) * tm.beat > EPS) {
        problems.push(`${where}: its press is at ${secs(press)} s, which is ${beats.toFixed(3)} beats from the start. It must be a whole number of beats.`);
      }
      const first = cueTimes(o, tm)[0];
      const passed = o.start + o.width + tm.halfWidth;
      const part = level.sections.find((s) => first >= s.from - EPS && passed <= s.to + EPS);
      if (!part) {
        problems.push(`${where}: its countdown (${secs(first)} s to ${secs(passed)} s) does not sit inside one part of the song.`);
      } else if (part.feel === 'rest') {
        problems.push(`${where}: its countdown sits inside the rest '${part.name}'. A rest must have nothing to press.`);
      }
    }
  }
  return proofResult(19, 'Locked to the song', problems);
}

/** The most real ms that can pass from a fall until level time moves again, at each speed, and where. */
export function retryDelays(
  level: Level,
  timing: Timing,
  settings: RunSettings,
  wordsMs: number,
): Record<Speed, { ms: number; obstacle: number }> {
  const out = {} as Record<Speed, { ms: number; obstacle: number }>;
  for (const speed of SPEEDS) {
    const rate = timing.rates[speed];
    let worst = { ms: settings.fallPause * 1000, obstacle: 0 };
    level.obstacles.forEach((o, i) => {
      const cue1 = cueTimes(o, timing)[0];
      const prev = level.obstacles[i - 1];
      const previousClear = prev ? prev.start + prev.width + timing.halfWidth + 0.05 : 0;
      const from = Math.max(0, previousClear, cue1 - settings.restartLead);
      // Words are held so they finish before the countdown comes back (`holdForWords`).
      const soonMs = ((cue1 - from) / rate) * 1000;
      const ms = Math.max(settings.fallPause * 1000, wordsMs - soonMs);
      if (ms > worst.ms) worst = { ms, obstacle: i };
    });
    out[speed] = worst;
  }
  return out;
}

/** The longest a retry may wait, in real ms, when a player falls at an obstacle they fell at before. */
export const RETRY_LIMIT_MS = 1000;

/**
 * Property 20, instant retry: after a fall at an obstacle already fallen at, level time moves again within
 * one second of real time at every speed, counting the pause and the short reason being said in full
 * (`wordsMs`: how long that line is held). The first fall at an obstacle may wait longer, for the words
 * that teach: the rule that words are heard in full before a countdown still holds.
 */
export function retryInTime(settings: RunSettingsInput | RunSettings, wordsMs: number): ProofProperty {
  return (level, input) => {
    const tm = resolveTiming(input.timing);
    const label = input.label ?? `Level ${level.seed}`;
    const resolved = resolveRunSettings(settings);
    const problems: string[] = [];
    const delays = retryDelays(level, tm, resolved, wordsMs);
    for (const speed of SPEEDS) {
      const { ms, obstacle } = delays[speed];
      if (ms >= RETRY_LIMIT_MS) {
        problems.push(
          `${label}, obstacle ${obstacle + 1}: after a repeat fall at ${speed}, level time waits ${Math.round(ms)} ms. It must be under ${RETRY_LIMIT_MS} ms. ` +
            `Shorten the pause (${resolved.fallPause} s), lengthen the lead (${resolved.restartLead} s) or shorten the line (${Math.round(wordsMs)} ms).`,
        );
      }
    }
    return proofResult(20, 'Instant retry', problems);
  };
}

/** Colours the game pulses with, as tokens of each theme. The default is its amber. */
const PULSE_TOKEN = 'amber' as const;

/**
 * Property 21, gentle pulses: for each tempo (`beats`, running seconds per beat) the picture pulses at
 * most once a beat and at most three times a real second at every speed; it never pulses when motion is
 * reduced; and a pulse changes the picture by less than the WCAG general-flash threshold (0.1 of
 * relative luminance) in every theme.
 */
export function pulsesGentle(beats: readonly number[], timingOverrides: Partial<Timing> = {}, label = 'Pulses'): ProofResult {
  const tm = resolveTiming(timingOverrides);
  const problems: string[] = [];
  for (const beat of beats) {
    for (const speed of SPEEDS) {
      const rate = pulsesPerSecond(beat, tm.rates[speed]);
      if (rate > MAX_PULSES_PER_SECOND + 1e-9) {
        problems.push(`${label}: at a beat of ${beat} s and ${speed}, the picture pulses ${rate.toFixed(2)} times a second. The limit is ${MAX_PULSES_PER_SECOND}.`);
      }
    }
    // Sample eight beats: one rise per beat, and nothing at all with reduced motion.
    const steps = 80;
    let rises = 0;
    let stillMoved = 0;
    let before = 0;
    for (let i = 0; i <= 8 * steps; i++) {
      const t = (i / steps) * beat;
      const now = pulseAt(t, beat);
      if (before < 0.5 && now >= 0.5) rises++;
      before = now;
      if (pulseAt(t, beat, true) !== 0) stillMoved++;
    }
    if (rises > 9) problems.push(`${label}: at a beat of ${beat} s the picture pulses ${rises} times in 8 beats. It may pulse once a beat.`);
    if (stillMoved > 0) problems.push(`${label}: with motion reduced the picture still pulses at a beat of ${beat} s. It must stand still.`);
  }
  for (const [name, theme] of Object.entries(THEMES)) {
    const change = PULSE_MAX_ALPHA * Math.abs(luminance(theme[PULSE_TOKEN]) - luminance(theme.background));
    if (change >= 0.1) {
      problems.push(`${label}: in theme '${name}' a full pulse changes the luminance by ${change.toFixed(3)}. It must stay under 0.1.`);
    }
  }
  return proofResult(21, 'Gentle pulses', problems);
}
