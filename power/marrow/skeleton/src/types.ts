// Shared contract types. Pure data only: no DOM, no engine (Requirement 20.1).

export type Sense = 'hearing' | 'sight' | 'touch';

export type ChannelId = 'sound' | 'speech' | 'captions' | 'indicator' | 'haptics';
export const CHANNEL_IDS: readonly ChannelId[] = [
  'sound',
  'speech',
  'captions',
  'indicator',
  'haptics',
];

export type Speed = 'slow' | 'medium' | 'fast';
export const SPEEDS: readonly Speed[] = ['slow', 'medium', 'fast'];

export type ThemeId = 'default' | 'high-contrast';
export const THEME_IDS: readonly ThemeId[] = ['default', 'high-contrast'];

export type Palette = 'default' | 'colourblind';
export const PALETTES: readonly Palette[] = ['default', 'colourblind'];

/** A meaning-level thing that happened. Carries data, never presentation. */
export interface SemanticEvent {
  type: string;
  /** Level time in running seconds. */
  at: number;
  data?: Record<string, unknown>;
}

export type SoundRole =
  /** The countdown beeps. The loudest thing, always. */
  | 'cue'
  /** Wind and room tone under the game. */
  | 'ambience'
  /** The slow pad that rises with danger. */
  | 'music'
  /** A clear. */
  | 'reward'
  /** A tone that moves toward you as an obstacle nears. */
  | 'approach'
  /** A jump, a landing, a stumble. */
  | 'effect';
export type Wave = 'sine' | 'triangle' | 'square';

/**
 * Instruments the web player can synthesise (no sample files): a plucked string, soft keys, a warm
 * pad, a sub bass, drums (kick, brushed snare, soft hat, shaker), a faint choir, and two far-off sounds.
 */
export type Instrument = 'pluck' | 'keys' | 'pad' | 'sub' | 'kick' | 'snare' | 'hat' | 'shaker' | 'choir' | 'owl' | 'creak';

/** Optional shaping for a sound. Without it, a sound is a short plain beep. */
export interface SoundShape {
  /** Make filtered noise instead of a tone. `hz` and `wave` are then ignored. */
  noise?: boolean;
  /** Glide the pitch to this by the end. */
  hzTo?: number;
  /** Move from `pan` to this by the end. -1 is left, 1 is right. */
  panTo?: number;
  /** Low-pass filter cut-off at the start, and where it opens to by the end. */
  filterHz?: number;
  filterTo?: number;
  /** Length in running seconds. It stretches with the speed. */
  span?: number;
  /** Length in real seconds. It does not stretch. */
  seconds?: number;
  /** Room echo: how much of the sound comes back from the walls, 0 (none) to 1. */
  echo?: number;
  /** How long the echo rings on, in seconds: about 0.4 in a cupboard, 3 in a chapel. Default 1.5. */
  echoSeconds?: number;
  /**
   * An instrument for the web player to build the sound from, instead of a plain tone. A player that
   * does not know the instrument plays the plain `wave` and the rest of the shape, so nothing is lost.
   */
  voice?: Instrument;
  /** A slow wobble in pitch (vibrato), this many times a second. Tones only. */
  wobbleHz?: number;
  /** How far the wobble goes, as a share of the pitch: 0.03 is a little, 0.1 is a moan. */
  wobble?: number;
}

/** How a spoken line sounds, where the voice allows it. 1 is normal for both. */
export interface SpeechTone {
  /** Higher or lower voice, about 0.5 to 2. */
  pitch?: number;
  /** Faster or slower speech, about 0.5 to 2. */
  rate?: number;
}

/**
 * The short sound a character makes just before each of its lines. It is the one part of a character's
 * voice that can be placed left or right, because it is played through Web Audio. The words are not.
 */
export interface Signature {
  hz: number;
  /** Glide the pitch to this by the end. */
  hzTo?: number;
  wave: Wave;
  /** How long it lasts, in ms. Under 300, so it never holds up a line for long. */
  ms: number;
  /** Loudness as a share of the player's speech volume. Default 0.5. */
  gain?: number;
}

/**
 * One speaking character. Declare it once in the kit (`characters`), then name it on an event
 * (`speaker`). Everything but `name` has a default, so `{ name: 'Mabel', pitch: 1.3 }` is enough.
 */
export interface Character {
  /** Shown before the line in captions and in the aria-live text ("Mabel: ..."). Leave out for the narrator. */
  name?: string;
  /** Browser voices you prefer, best first. A name matches if it contains the text, ignoring case. Falls back to the best voice there is. */
  voices?: readonly string[];
  /** 1 is the player's voice. About 0.5 to 2. Default 1. */
  pitch?: number;
  /** 1 is the player's pace. About 0.5 to 2. Default 1. */
  rate?: number;
  /** Where the signature sounds, -1 (left) to 1 (right). The browser's voice cannot be placed. Default 0. */
  pan?: number;
  /** The sound before each line. Without one the character has none. */
  signature?: Signature;
}

/** A character as an output command carries it: resolved, with its id. */
export interface SpeakerView extends Character {
  id: string;
  pitch: number;
  rate: number;
  pan: number;
}

/**
 * How a spoken line treats the one already being said, when the adapter queues speech:
 * - 'wait': it waits its turn (the default). Nothing is cut off.
 * - 'cut-in': it stops the line being said and clears the queue. For warnings that cannot wait.
 * - 'latest': it waits, but a newer line of the same key replaces it (scanning labels, so the
 *   voice never falls behind the highlight).
 * Without queueing every line cuts in, the newest line wins.
 */
export type SpeechMode = 'wait' | 'cut-in' | 'latest';

/** How much a player wants announced. */
export type AnnounceLevel = 'minimal' | 'normal' | 'detailed';

/**
 * How much an event matters, for busy games (Requirement 25): critical is never dropped and cuts in;
 * important is kept at every announce level; information is dropped at minimal; ambient is said only
 * at detailed. Sounds are never dropped by this: it governs words.
 */
export type Priority = 'critical' | 'important' | 'information' | 'ambient';

/** What a channel wants the player to perceive. An adapter performs it. */
export type OutputCommand =
  | {
      channel: 'sound';
      senses: ['hearing'];
      at: number;
      role: SoundRole;
      hz: number;
      wave: Wave;
      gain: number;
      pan: number;
      shape?: SoundShape;
      /**
       * Direction for true 3D sound, as a unit vector from the listener (+x right, -z
       * ahead). Players with a browser that cannot do 3D, and mono players, get `pan` instead.
       */
      space?: { x: number; y: number; z: number };
    }
  | {
      channel: 'speech';
      senses: ['hearing'];
      at: number;
      text: string;
      /** How the line treats one already being said, when the adapter queues speech. See SpeechMode. */
      mode?: SpeechMode;
      /** Lines with the same key replace each other while waiting (mode 'latest'). Usually the event type. */
      key?: string;
      /** A character's voice: higher, lower, faster or slower than the narrator. */
      tone?: SpeechTone;
      /** Who speaks, when the kit declares characters. Carries the voice, name and signature. */
      speaker?: SpeakerView;
    }
  | { channel: 'captions'; senses: ['sight']; at: number; text: string; pip?: 1 | 2 | 3 | 4 }
  | { channel: 'indicator'; senses: ['sight']; at: number; flash: boolean }
  | { channel: 'haptics'; senses: ['touch']; at: number; pattern: number[] };

export interface Volumes {
  cues: number;
  speech: number;
  music: number;
}

/** The one player profile. Every channel reads this and nothing else. */
export interface Profile {
  speed: Speed;
  /** How long the scanning highlight rests on each option, in ms. */
  dwellMs: number;
  theme: ThemeId;
  textScale: number;
  palette: Palette;
  reducedMotion: boolean;
  volume: Volumes;
  mono: boolean;
  /**
   * Built-in voice. When false the adapter does not speak aloud, but every
   * announcement still goes to the aria-live text (Requirement 4.2).
   */
  voice: boolean;
  channels: Record<ChannelId, boolean>;
  picture: boolean;
  scanning: boolean;
  holdToConfirm: boolean;
  setupDone: boolean;
  /**
   * The coach: a short spoken heads-up this many real ms before each countdown ('Stone coming. Get
   * ready.'). 0 is off. Only games that turn the coach on in their kit use it.
   */
  coachLeadMs: number;
  /** How much is announced: minimal (only what you need now), normal, or detailed (every little thing). */
  announce: AnnounceLevel;
}

export type ProfilePatch = Partial<Omit<Profile, 'volume' | 'channels'>> & {
  volume?: Partial<Volumes>;
  channels?: Partial<Record<ChannelId, boolean>>;
};

export interface Channel {
  id: ChannelId;
  render(event: SemanticEvent, profile: Profile): OutputCommand[];
}

/**
 * How one of your own game events should be presented. Give it any of these;
 * each one you give reaches the matching channel. Text may use {slots} filled
 * from the event's data, for example "{name} opens".
 */
export interface EventPresentation {
  say?: string;
  /** How the spoken line treats one already being said. Default 'wait'. See SpeechMode. */
  speech?: SpeechMode;
  /** Say the line in a character's voice: `{ pitch: 1.3 }` for a small ghost. */
  voice?: SpeechTone;
  /**
   * Who says the line: a character id from the kit's `characters`, which may use {slots} ("{boss}").
   * Captions and the live text then start with the character's name. Without it the narrator speaks.
   */
  speaker?: string;
  /**
   * More lines said after this one, each by its own speaker. A part whose {slots} the event does not
   * fill is left out, so a part can be optional.
   */
  also?: readonly { say: string; speaker?: string; caption?: string }[];
  /** How much it matters. Default 'important'. Words below the player's announce level are not said or captioned. */
  priority?: Priority;
  caption?: string;
  /**
   * A sound recipe. `role` defaults to a cue; `shape` can glide, filter, use
   * noise, or last a set time. `gain` is a share of the player's cue volume.
   */
  sound?: { hz: number; wave: Wave; gain?: number; role?: SoundRole; shape?: SoundShape };
  /**
   * Put the event in space. Give the event's data a `distance` (0 close to 1 far)
   * and either an `x` (-1 left to 1 right) or an `angle` (degrees: 0 ahead, 90
   * right, 180 behind). The sound is placed (true 3D for an angle), and made
   * quieter and duller with distance, and the text may use {side} ("left",
   * "ahead right", "behind"...) and {range} ("close", "near", "far").
   */
  spatial?: boolean;
  /**
   * Atmosphere that carries no information (a creak, a drip). It is skipped by the
   * two-senses check, because there is nothing to miss.
   */
  decorative?: boolean;
  /** Vibration pattern in ms (on, off, on, ...). Played by the haptics channel. */
  haptic?: number[];
}
