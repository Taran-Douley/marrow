import type { OutputCommand, Profile, SemanticEvent, SoundShape, Wave } from '../types';
import { EVENT_TYPES, dataNumber, dataString } from './events';
import { trackNotes, type TrackSpec } from './track';

// The world as sound: an approach tone that moves toward you, a jump and a
// landing you can feel, a stumble, a wind bed and a slow pad that rises with
// danger. All of it is synthesised; none of it is a file. It exists so a blind
// player gets a place to be, not only a beep to time.
//
// One rule governs the mix: nothing under the countdown beeps may add up to
// more than half of a beep's loudness (6 dB), whatever volumes the player
// chooses. Every bed level is a fixed share of the cue gain, so that holds by
// construction, and a test (and proof property 13) checks it.

export interface AudioOptions {
  /** Wind under the game. Default on. */
  ambience?: boolean;
  /** The slow pad that rises with danger. Default on. */
  music?: boolean;
  /** The tone that moves toward you as an obstacle nears. Default on. */
  approach?: boolean;
  /** Jump, landing and stumble sounds. Default on. */
  effects?: boolean;
  /** The pad's root note in Hz. Default 110 (a low A). */
  keyHz?: number;
  /** A background track made of patterns (see TrackSpec). It plays under the beeps and thins out as a countdown nears. Default none. */
  track?: TrackSpec | null;
  /** Length of one track slot, in running seconds, when the track sets none. The kit sets half the countdown beat. */
  trackSlot?: number;
  /** Your own version of any of the built-in sounds. Anything you leave out keeps its default. */
  recipes?: Partial<Record<'approach' | 'jumped' | 'landed' | 'fall', SoundRecipe>>;
}

/** Replace parts of a built-in sound. `gain` is a share of the player's cue volume. */
export interface SoundRecipe {
  hz?: number;
  wave?: Wave;
  gain?: number;
  shape?: SoundShape;
}

export const DEFAULT_AUDIO: Required<AudioOptions> = {
  ambience: true,
  music: true,
  approach: true,
  effects: true,
  keyHz: 110,
  track: null,
  trackSlot: 0.25,
  recipes: {},
};

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/** Semitones above the base note for each step of a streak: a major pentatonic scale, then up an octave. */
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24] as const;

/** An angle in degrees, folded into [-180, 180). 0 is straight ahead, positive is to the right. */
export function foldAngle(angle: number): number {
  return ((((angle + 180) % 360) + 360) % 360) - 180;
}

/** Eight plain words for where something is: "ahead", "ahead right", "right", "behind right", "behind"... */
export function compassWord(angle: number): string {
  const a = foldAngle(angle);
  const abs = Math.abs(a);
  if (abs <= 22.5) return 'ahead';
  if (abs >= 157.5) return 'behind';
  const side = a > 0 ? 'right' : 'left';
  if (abs <= 67.5) return `ahead ${side}`;
  if (abs < 112.5) return side;
  return `behind ${side}`;
}

/** Where a spatial event is, and how to sound it: a pan, a quieter and duller sound when far away or behind. */
export interface Placement {
  pan: number;
  gainScale: number;
  filterHz: number;
  /**
   * A direction, as a unit vector from the listener (+x right, -z ahead), for true 3D
   * sound. Only set when the event gives an `angle`. Distance is already in gain and filter.
   */
  space?: { x: number; y: number; z: number };
}

/**
 * Give an event `x` (-1 left to 1 right) for a simple left-right pan, or `angle`
 * (degrees, 0 ahead, 90 right, 180 behind) for a full circle, plus `distance`
 * (0 close to 1 far). A sound from behind is also a little quieter and duller,
 * which is how ears tell front from back.
 */
export function placementOf(event: SemanticEvent): Placement {
  const distance = clamp(dataNumber(event, 'distance') ?? 0.5, 0, 1);
  const near = 1 - 0.6 * distance;
  const bright = 600 + 3400 * (1 - distance);
  const angle = dataNumber(event, 'angle');
  if (angle !== undefined) {
    const rad = (foldAngle(angle) * Math.PI) / 180;
    const behind = (1 - Math.cos(rad)) / 2; // 0 in front, 1 directly behind
    return {
      pan: Math.sin(rad),
      gainScale: near * (1 - 0.25 * behind),
      filterHz: bright * (1 - 0.5 * behind),
      space: { x: Math.sin(rad), y: 0, z: -Math.cos(rad) },
    };
  }
  return { pan: clamp(dataNumber(event, 'x') ?? 0, -1, 1), gainScale: near, filterHz: bright };
}

/** Words for text slots: where something is, so a deaf player reads what a blind player hears. */
export function directionWords(event: SemanticEvent): Record<string, string> {
  const words: Record<string, string> = {};
  const angle = dataNumber(event, 'angle');
  const x = dataNumber(event, 'x');
  const distance = dataNumber(event, 'distance');
  if (angle !== undefined) words.side = compassWord(angle);
  else if (x !== undefined) words.side = x < -0.25 ? 'left' : x > 0.25 ? 'right' : 'ahead';
  if (distance !== undefined) words.range = distance < 0.34 ? 'close' : distance < 0.67 ? 'near' : 'far';
  return words;
}

/**
 * Shares of the cue gain. Two bars overlap at any moment, so the worst-case bed
 * total is 2 x (ambience + music) + approach = 2 x (0.075 + 0.07) + 0.2 = 0.49,
 * just under the 0.5 that the 6 dB rule allows. These are a first guess made
 * without ears: tune the overall loudness with the web adapter's `sound.masterGain`.
 */
export const BED_SHARE = {
  approach: 0.2,
  ambience: 0.075,
  musicRoot: 0.04,
  musicFifth: 0.02,
  musicOctave: 0.01,
  /** Wind and room tone when no cue can sound under the bar (the game said when its cues are). */
  ambienceOpen: 0.16,
} as const;

/** How long the pad and wind for one bar last, in running seconds. Bars overlap by a quarter. */
export const BAR_SECONDS = 2;
const BAR_OVERLAP = 1.25;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

interface Voice {
  hz: number;
  wave: Wave;
}

/** The sound commands for the world and the player's body. Beeps and chimes stay in the sound channel. */
export function worldSound(
  event: SemanticEvent,
  profile: Profile,
  options: Required<AudioOptions>,
  voice: Voice,
): OutputCommand[] {
  const cues = profile.volume.cues;
  const centre = profile.mono;
  const sound = (
    role: Extract<OutputCommand, { channel: 'sound' }>['role'],
    hz: number,
    wave: Wave,
    gain: number,
    pan: number,
    shape: Extract<OutputCommand, { channel: 'sound' }>['shape'],
  ): OutputCommand => ({
    channel: 'sound',
    senses: ['hearing'],
    at: event.at,
    role,
    hz,
    wave,
    gain,
    pan: centre ? 0 : pan,
    shape: centre && shape ? { ...shape, panTo: undefined } : shape,
  });

  /** Apply the developer's own recipe over a default sound. A bed can never be louder than its share. */
  const withRecipe = (key: keyof Required<AudioOptions>['recipes'], cmd: OutputCommand): OutputCommand[] => {
    const r = options.recipes[key];
    if (!r || cmd.channel !== 'sound') return [cmd];
    const ceiling = cmd.role === 'approach' ? BED_SHARE.approach * cues : cues;
    const shape = { ...cmd.shape, ...r.shape };
    return [
      {
        ...cmd,
        hz: r.hz ?? cmd.hz,
        wave: r.wave ?? cmd.wave,
        gain: r.gain !== undefined ? Math.min(r.gain * cues, ceiling) : cmd.gain,
        pan: centre ? 0 : cmd.pan,
        shape: centre ? { ...shape, panTo: undefined } : shape,
      },
    ];
  };

  switch (event.type) {
    case EVENT_TYPES.approaching: {
      if (!options.approach) return [];
      // The object's own voice, an octave down, comes in from the right and
      // opens up as it reaches you at the press. It gives the wait a shape.
      const span = dataNumber(event, 'span') ?? 1.2;
      return withRecipe(
        'approach',
        sound('approach', voice.hz / 2, voice.wave, BED_SHARE.approach * cues, 0.8, {
          hzTo: (voice.hz / 2) * 1.5,
          panTo: 0,
          filterHz: 300,
          filterTo: 2200,
          span,
        }),
      );
    }
    case EVENT_TYPES.jumped:
      // A whoosh the moment you press: the player must hear that the press worked.
      return options.effects
        ? withRecipe('jumped', sound('effect', 0, 'sine', 0.7 * cues, 0, { noise: true, filterHz: 500, filterTo: 3000, seconds: 0.28 }))
        : [];
    case EVENT_TYPES.landed:
      return options.effects ? withRecipe('landed', sound('effect', 95, 'sine', 0.6 * cues, 0, { hzTo: 45, seconds: 0.2 })) : [];
    case EVENT_TYPES.judged: {
      if (!options.effects) return [];
      // Each right decision in a row climbs one step of a pentatonic scale, so a streak is a tune you build.
      const streak = Math.max(1, dataNumber(event, 'streak') ?? 1);
      const hz = 523.25 * 2 ** (SCALE[Math.min(streak, SCALE.length) - 1]! / 12);
      const grade = dataString(event, 'grade');
      if (grade === 'perfect') {
        return [
          sound('reward', hz, 'sine', 0.5 * cues, 0, { seconds: 0.18 }),
          sound('reward', hz * 1.5, 'sine', 0.35 * cues, 0, { seconds: 0.26 }),
        ];
      }
      if (grade === 'good') return [sound('reward', hz, 'sine', 0.45 * cues, 0, { seconds: 0.16 })];
      return [sound('effect', 300, 'triangle', 0.3 * cues, 0, { seconds: 0.08 })]; // a soft tick: in the window, but not close
    }
    case EVENT_TYPES.passed:
      // A soft brush as a distractor slides by: the right move was to do nothing.
      return options.effects
        ? [sound('effect', 0, 'sine', 0.3 * cues, 0, { noise: true, filterHz: 300, filterTo: 900, seconds: 0.22 })]
        : [];
    case EVENT_TYPES.fallReason:
      // A low bonk at once, so a fall is heard before the reason is spoken.
      return options.effects
        ? withRecipe('fall', sound('effect', 150, 'triangle', 0.7 * cues, 0, { hzTo: 60, seconds: 0.35 }))
        : [];
    case EVENT_TYPES.atmosphere: {
      const tension = clamp01(dataNumber(event, 'tension') ?? 0.3);
      const bar = dataNumber(event, 'bar') ?? 0;
      const barSpan = dataNumber(event, 'span') ?? BAR_SECONDS;
      const span = barSpan * BAR_OVERLAP;
      // When the game says when its cues can sound, the beds may open up in between. If it does not, they stay quiet.
      const rawQuiet = event.data?.quiet;
      const quiet = Array.isArray(rawQuiet)
        ? rawQuiet.filter((q): q is [number, number] => Array.isArray(q) && typeof q[0] === 'number' && typeof q[1] === 'number')
        : undefined;
      const open = quiet !== undefined && !quiet.some(([a, b]) => b > event.at && a < event.at + span);
      const level = cues * profile.volume.music; // the player's music volume scales every bed
      const out: OutputCommand[] = [];
      if (options.ambience) {
        out.push(
          sound('ambience', 0, 'sine', (open ? BED_SHARE.ambienceOpen : BED_SHARE.ambience) * level, bar % 2 === 0 ? -0.5 : 0.5, {
            noise: true,
            filterHz: 350 + 500 * tension,
            filterTo: 500 + 500 * tension,
            span,
          }),
        );
      }
      if (options.music) {
        const key = options.keyHz;
        out.push(sound('music', key, 'sine', BED_SHARE.musicRoot * level, 0, { span }));
        if (tension > 0.35) {
          out.push(sound('music', key * 1.5, 'triangle', BED_SHARE.musicFifth * level * tension, 0, { span }));
        }
        if (tension > 0.7) {
          out.push(sound('music', key * 2, 'sine', BED_SHARE.musicOctave * level * tension, 0, { span }));
        }
      }
      if (options.track && options.music) {
        out.push(
          ...trackNotes(options.track, {
            from: event.at,
            to: event.at + barSpan,
            tension,
            level,
            mono: centre,
            slot: options.trackSlot,
            quiet,
            offset: dataNumber(event, 'pulse') ?? 0,
            ...(dataNumber(event, 'energy') !== undefined ? { energy: clamp01(dataNumber(event, 'energy')!) } : {}),
          }),
        );
      }
      return out;
    }
    default:
      return [];
  }
}

/** The voice an object sounds with, for the approach tone. */
export function voiceOf(
  event: SemanticEvent,
  lookup: { get(name: string): { sound: Voice } | undefined },
  fallback: Voice,
): Voice {
  return lookup.get(dataString(event, 'object') ?? '')?.sound ?? fallback;
}

/** How a place sounds: how much the walls answer, and for how long. */
export interface Acoustics {
  /** 0 (a padded cupboard) to 1 (a stone crypt). */
  echo: number;
  /** How long the echo rings on, in seconds. */
  echoSeconds: number;
}

/**
 * Put sounds in a place: every sound effect, cue and reward gets that place's echo, unless it chose its
 * own. Music and the ambient bed are left dry, so the mix under the cues stays as the proofs measured it.
 * The echo only adds a quieter tail after each sound; it never changes when or where a sound starts.
 */
export function withAcoustics(commands: readonly OutputCommand[], place: Acoustics): OutputCommand[] {
  const echo = Math.max(0, Math.min(1, place.echo));
  if (echo === 0) return [...commands];
  return commands.map((c) => {
    if (c.channel !== 'sound' || c.role === 'music' || c.role === 'ambience' || c.shape?.echo !== undefined) return c;
    return { ...c, shape: { ...c.shape, echo, echoSeconds: place.echoSeconds } };
  });
}
