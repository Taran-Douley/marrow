import type { OutputCommand, SoundShape, Wave } from '../types';

/**
 * A background track, written as plain patterns. A bar is 8 slots. A slot is half a countdown beat by
 * default, so a bar is four beats and the music is in time with the beeps (set `slotSeconds` for a
 * free tempo, as a game with no countdown would).
 *
 * In `bass` and `melody`, a digit is a step of `scale`, a dash holds the note before it, a dot is a rest.
 * In `kick` and `hat`, `x` is a hit and `X` a strong one.
 *
 * The track can never hide a cue:
 *  - While a cue can sound (a countdown, a choice being read), every layer drops to a small, fixed
 *    share, so the beeps stay at least 6 dB over everything (proof property 13).
 *  - Every note sits below the lowest cue (proof property 14), so the beeps keep their own pitch range.
 *  - When the game does not say when its cues are, the track stays at the small share all the time.
 * In between cues it plays out at full strength, so it sets the mood.
 */
export interface TrackSpec {
  name: string;
  /** The key, in Hz. From 60 to 132, so the melody stays under the beeps. */
  rootHz: number;
  /** Semitones above the root for each digit. Up to 12. */
  scale: readonly number[];
  /** Bars of 8 slots, cycled. The bass sounds an octave below the root. */
  bass: readonly string[];
  /** Bars of 8 slots, cycled, from the root up. */
  melody: readonly string[];
  /** Drum hits. */
  kick: readonly string[];
  /** A soft high tick, for drive. It joins in as danger rises. */
  hat?: readonly string[];
  bassWave?: Wave;
  melodyWave?: Wave;
  /** Length of one slot, in running seconds. Default: half the countdown beat. */
  slotSeconds?: number;
}

export const TRACK_SLOTS = 8;
export const TRACK_MIN_ROOT_HZ = 60;
export const TRACK_MAX_ROOT_HZ = 132;

/**
 * The share of a beep's loudness each layer may use. `ducked` is used whenever a cue can sound; with
 * every other bed at its own share the total stays under half a beep (6 dB). `open` is used in between.
 */
export const TRACK_LEVELS = {
  open: { bass: 0.2, melody: 0.17, kick: 0.22, hat: 0.07 },
  ducked: { bass: 0.04, melody: 0, kick: 0.04, hat: 0.02 },
} as const;
/** The quiet share, kept under its old name. */
export const TRACK_SHARE = TRACK_LEVELS.ducked;

const NOTE = /^[0-9.-]{8}$/;
const HITS = /^[.xX]{8}$/;

/** Check a track and say, in plain words, what is wrong. Called when the kit is made. */
export function validateTrack(spec: TrackSpec): void {
  const where = `Track '${spec.name}'`;
  if (!(spec.rootHz >= TRACK_MIN_ROOT_HZ && spec.rootHz <= TRACK_MAX_ROOT_HZ)) {
    throw new Error(
      `${where}: rootHz is ${spec.rootHz}. It must be from ${TRACK_MIN_ROOT_HZ} to ${TRACK_MAX_ROOT_HZ} so the music stays under the beeps.`,
    );
  }
  if (spec.scale.length === 0 || spec.scale.some((s) => !(s >= 0 && s <= 12))) {
    throw new Error(`${where}: scale needs steps from 0 to 12 semitones.`);
  }
  if (spec.slotSeconds !== undefined && !(spec.slotSeconds >= 0.1 && spec.slotSeconds <= 2)) {
    throw new Error(`${where}: slotSeconds must be from 0.1 to 2.`);
  }
  const layers: [string, readonly string[] | undefined, RegExp][] = [
    ['bass', spec.bass, NOTE],
    ['melody', spec.melody, NOTE],
    ['kick', spec.kick, HITS],
    ['hat', spec.hat, HITS],
  ];
  for (const [layer, bars, shape] of layers) {
    if (bars === undefined && layer === 'hat') continue;
    if (!bars || bars.length === 0) throw new Error(`${where}: ${layer} needs at least one bar.`);
    for (const bar of bars) {
      if (!shape.test(bar)) {
        throw new Error(
          shape === NOTE
            ? `${where}: a ${layer} bar must be 8 characters of digits, dashes and dots, not '${bar}'.`
            : `${where}: a ${layer} bar must be 8 characters of x, X and dots, not '${bar}'.`,
        );
      }
      if (shape !== NOTE) continue;
      for (const ch of bar) {
        if (ch >= '0' && ch <= '9' && Number(ch) >= spec.scale.length) {
          throw new Error(`${where}: ${layer} uses step ${ch}, but the scale has only ${spec.scale.length} steps.`);
        }
      }
    }
  }
}

/** The highest pitch the track can play, in Hz. The proof checks it against the beeps. */
export const trackCeilingHz = (spec: TrackSpec): number => spec.rootHz * 2 ** (Math.max(...spec.scale) / 12);

export interface TrackWindow {
  /** The stretch of level time to fill, in running seconds: [from, to). */
  from: number;
  to: number;
  /** How near the danger is, 0 to 1. */
  tension: number;
  /** The player's cue volume times their music volume. */
  level: number;
  mono: boolean;
  /** Slot length when the track sets none. */
  slot: number;
  /** Where the grid starts, in running seconds, so the music lands on the same pulse as the presses. */
  offset?: number;
  /**
   * When cues can sound, as [from, to] pairs in running seconds. Notes that touch one are quiet.
   * Leave out when the game does not know: then every note is quiet.
   */
  quiet?: readonly (readonly [number, number])[] | undefined;
  /**
   * How much of the band plays, 0 to 1, for the part of the song: under 0.3 is a breakdown (melody and
   * bass, no drums), under 0.6 adds the kick, from 0.6 the hats too, and from 0.9 (the drop) the kick
   * plays every bar. Default 1. It never makes a note louder than its share, so the proofs still hold.
   */
  energy?: number;
}

/** Song energy at which each layer joins. */
export const ENERGY = { kick: 0.3, hat: 0.6, drop: 0.9 } as const;

const pick = (bars: readonly string[], bar: number): string => bars[((bar % bars.length) + bars.length) % bars.length]!;

/** How many slots a note at `slot` lasts: itself and every dash after it in the bar. */
function lengthOf(pattern: string, slot: number): number {
  let n = 1;
  while (slot + n < TRACK_SLOTS && pattern[slot + n] === '-') n++;
  return n;
}

/** The notes of a track for one stretch of time, on one steady grid, so stretches join up seamlessly. */
export function trackNotes(spec: TrackSpec, w: TrackWindow): OutputCommand[] {
  const slot = spec.slotSeconds ?? w.slot;
  const out: OutputCommand[] = [];
  const quietAt = (t: number, end: number): boolean => w.quiet === undefined || w.quiet.some(([a, b]) => end > a && t < b);
  const push = (at: number, hz: number, wave: Wave, gain: number, pan: number, shape: SoundShape): void => {
    if (gain <= 0) return;
    out.push({
      channel: 'sound',
      senses: ['hearing'],
      at,
      role: 'music',
      hz,
      wave,
      gain,
      pan: w.mono ? 0 : pan,
      shape,
    });
  };
  const hz = (step: string, octave: number): number => spec.rootHz * 2 ** (spec.scale[Number(step)]! / 12) * octave;
  const energy = Math.min(1, Math.max(0, w.energy ?? 1));
  // The drop only drives harder when a song says so; without a song the track plays as it always has.
  const drop = w.energy !== undefined && energy >= ENERGY.drop;
  // In a breakdown there is no danger to step aside for, so the melody sings out.
  const melodyFade = energy < ENERGY.kick ? 1 : 1 - 0.8 * Math.min(1, Math.max(0, w.tension));

  const offset = w.offset ?? 0;
  for (let k = Math.ceil((w.from - offset) / slot - 1e-9); offset + k * slot < w.to - 1e-9; k++) {
    const t = offset + k * slot;
    const bar = Math.floor(k / TRACK_SLOTS);
    const s = ((k % TRACK_SLOTS) + TRACK_SLOTS) % TRACK_SLOTS;
    const level = (open: number, ducked: number, end: number): number => (quietAt(t, end) ? ducked : open) * w.level;

    const bassBar = pick(spec.bass, bar);
    const b = bassBar[s]!;
    if (b >= '0' && b <= '9') {
      const span = lengthOf(bassBar, s) * slot * 0.92; // a note never runs into the next, so a layer never doubles up
      push(t, hz(b, 0.5), spec.bassWave ?? 'square', level(TRACK_LEVELS.open.bass, TRACK_LEVELS.ducked.bass, t + span), 0, { filterHz: 650, span });
    }

    if (w.tension < 0.75) {
      const melodyBar = pick(spec.melody, bar);
      const m = melodyBar[s]!;
      if (m >= '0' && m <= '9') {
        const span = lengthOf(melodyBar, s) * slot * 0.92;
        push(
          t,
          hz(m, 1),
          spec.melodyWave ?? 'square',
          level(TRACK_LEVELS.open.melody, TRACK_LEVELS.ducked.melody, t + span) * melodyFade,
          s % 2 === 0 ? -0.25 : 0.25,
          { filterHz: 1800, filterTo: 1200, span },
        );
      }
    }

    const kickBar = pick(spec.kick, bar);
    const kc = kickBar[s]!;
    if (kc !== '.' && energy >= ENERGY.kick && (w.tension > 0.2 || bar % 2 === 0 || drop)) {
      const strong = kc === 'X' ? 1 : 0.75;
      const span = Math.min(0.16, slot * 0.8);
      const quiet = quietAt(t, t + span);
      push(t, 150, 'sine', level(TRACK_LEVELS.open.kick, TRACK_LEVELS.ducked.kick, t + span) * strong, 0, { hzTo: 48, span });
      // A short click on top, so the kick is heard on small speakers that cannot play its low note.
      if (!quiet) push(t, 0, 'sine', TRACK_LEVELS.open.hat * w.level * strong, 0, { noise: true, filterHz: 2500, filterTo: 900, span: 0.02 });
    }

    if (spec.hat && energy >= ENERGY.hat && (w.tension >= 0.35 || drop)) {
      const hc = pick(spec.hat, bar)[s]!;
      if (hc !== '.') {
        const span = 0.04;
        push(t, 0, 'sine', level(TRACK_LEVELS.open.hat, TRACK_LEVELS.ducked.hat, t + span) * (hc === 'X' ? 1 : 0.7), s % 2 === 0 ? 0.3 : -0.3, {
          noise: true,
          filterHz: 7000,
          filterTo: 9000,
          span,
        });
      }
    }
  }
  return out;
}

/**
 * One bar of the track, starting at `at`, with a 2 s bar and no cue times known: every note quiet.
 * Kept for older callers; the kit itself uses `trackNotes`.
 */
export function trackBar(spec: TrackSpec, bar: number, tension: number, level: number, at: number, mono: boolean): OutputCommand[] {
  void bar;
  return trackNotes(spec, { from: at, to: at + 2, tension, level, mono, slot: 0.25 });
}
