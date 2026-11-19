import type { ObstacleKind } from '../level';
import type { Wave } from '../types';

// Voice table from tech.md. Beeps are synthesised, so pitch and timbre are data.
export interface Voice {
  label: string;
  hz: number;
  wave: Wave;
}

export const VOICE_TABLE: readonly Voice[] = [
  { label: 'low hum', hz: 294, wave: 'triangle' },
  { label: 'high chime', hz: 587, wave: 'sine' },
  { label: 'buzz', hz: 440, wave: 'square' },
  { label: 'bright bell', hz: 784, wave: 'triangle' },
];

/** Vibration patterns in ms (on, off, on, ...). One per voice, so each differs by feel. */
export const HAPTIC_TABLE: readonly (readonly number[])[] = [
  [250, 120, 250],
  [60, 60, 60],
  [120, 80, 120, 80, 120],
  [400],
];

export interface DrawBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The lesson number on this obstacle, if the game has a lesson. */
  value?: number;
}

/** Draws an object. The context type is opaque so the core stays free of the DOM. */
export type DrawFn = (ctx: unknown, box: DrawBox) => void;

export interface SoundSpec {
  hz: number;
  wave: Wave;
}

/**
 * Any thing in your game that should be seen, heard and felt: an enemy, a coin,
 * a landmark, a door. `width` is only for things a player must jump over.
 */
export interface ObjectOptions {
  /** Width in running seconds: one number, or a [min, max] range. Only for obstacles. */
  width?: number | readonly [number, number];
  say?: string;
  caption?: string;
  sound?: SoundSpec;
  haptic?: readonly number[];
  /** Omit to get a default placeholder shape, drawn by the adapter. */
  draw?: DrawFn;
}

/** An obstacle is an object with a width. */
export type ObstacleOptions = ObjectOptions & { width: number | readonly [number, number] };

export type MissingOutput = 'sound' | 'say' | 'caption';

export class RegistrationError extends Error {
  constructor(
    message: string,
    readonly missing: MissingOutput[] = [],
  ) {
    super(message);
    this.name = 'RegistrationError';
  }
}

export interface ObjectDef {
  name: string;
  /** Present only for obstacles. */
  width?: readonly [number, number];
  say: string;
  caption: string;
  sound: SoundSpec;
  haptic: readonly number[];
  /** Null means the adapter draws the default placeholder. */
  draw: DrawFn | null;
  /** True when the sound was assigned from the voice table. */
  autoSound: boolean;
  /** True when no table voice with a new timbre was left (pitch still differs). */
  sharesTimbre: boolean;
}

export interface Registry {
  define(name: string, options?: ObjectOptions): ObjectDef;
  get(name: string): ObjectDef | undefined;
  names(): string[];
  /** Width ranges of the obstacles, ready for generateLevel. Other objects are left out. */
  kinds(): ObstacleKind[];
  /** Pairs of object names whose sounds share a timbre (they still differ in pitch). */
  sharedTimbres(): [string, string][];
}

const humanise = (name: string): string => name.trim().replace(/[-_]+/g, ' ').toLowerCase();
const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const blank = (text: string | undefined): boolean => text !== undefined && text.trim() === '';

function validSound(s: SoundSpec): boolean {
  return Number.isFinite(s.hz) && s.hz > 0;
}

function toRange(width: ObstacleOptions['width'], name: string): readonly [number, number] {
  const range = typeof width === 'number' ? ([width, width] as const) : width;
  const [lo, hi] = range;
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo <= 0 || hi < lo) {
    throw new RegistrationError(`Object '${name}' needs a width above zero, like 0.2 or [0.1, 0.3].`);
  }
  return range;
}

export interface RegistryOptions {
  /** Your own voices for objects that do not set a sound. Replaces the default table. */
  voices?: readonly Voice[];
  /** Your own vibration patterns, used in the same order as the voices. */
  haptics?: readonly (readonly number[])[];
}

export function createRegistry(options: RegistryOptions = {}): Registry {
  const defs = new Map<string, ObjectDef>();
  const voices = options.voices ?? VOICE_TABLE;
  const hapticTable = options.haptics && options.haptics.length > 0 ? options.haptics : HAPTIC_TABLE;

  const pickVoice = (name: string): { voice: Voice; index: number; sharesTimbre: boolean } => {
    const used = [...defs.values()].map((d) => d.sound);
    const pitchFree = (v: Voice) => !used.some((u) => u.hz === v.hz);
    const timbreFree = (v: Voice) => !used.some((u) => u.wave === v.wave);

    const both = voices.findIndex((v) => pitchFree(v) && timbreFree(v));
    if (both >= 0) return { voice: voices[both]!, index: both, sharesTimbre: false };

    const pitchOnly = voices.findIndex(pitchFree);
    if (pitchOnly >= 0) return { voice: voices[pitchOnly]!, index: pitchOnly, sharesTimbre: true };

    throw new RegistrationError(
      `Object '${name}' has no unused voice left. Give it its own sound, like { hz: 523, wave: 'sine' }.`,
      ['sound'],
    );
  };

  return {
    define(rawName, options = {}) {
      const name = rawName.trim();
      if (name === '') throw new RegistrationError('An object needs a name.');
      if (defs.has(name)) throw new RegistrationError(`Object '${name}' is already defined.`);
      const width = options.width === undefined ? undefined : toRange(options.width, name);

      const missing: MissingOutput[] = [];
      if (blank(options.say)) missing.push('say');
      if (blank(options.caption)) missing.push('caption');
      if (options.sound !== undefined && !validSound(options.sound)) missing.push('sound');
      if (missing.length > 0) {
        const words = missing.map((m) => ({ sound: 'sound', say: 'spoken name', caption: 'caption' })[m]);
        throw new RegistrationError(`Object '${name}' has no ${words.join(' and no ')}.`, missing);
      }

      let sound: SoundSpec;
      let autoSound = false;
      let sharesTimbre = false;
      let haptic: readonly number[];
      if (options.sound !== undefined) {
        sound = { hz: options.sound.hz, wave: options.sound.wave };
        haptic = options.haptic ?? hapticTable[defs.size % hapticTable.length]!;
      } else {
        const picked = pickVoice(name);
        sound = { hz: picked.voice.hz, wave: picked.voice.wave };
        autoSound = true;
        sharesTimbre = picked.sharesTimbre;
        haptic = options.haptic ?? hapticTable[picked.index % hapticTable.length]!;
      }

      const def: ObjectDef = {
        name,
        ...(width ? { width } : {}),
        say: options.say?.trim() ?? humanise(name),
        caption: options.caption?.trim() ?? capitalise(humanise(name)),
        sound,
        haptic,
        draw: options.draw ?? null,
        autoSound,
        sharesTimbre,
      };
      defs.set(name, def);
      return def;
    },
    get: (name) => defs.get(name),
    names: () => [...defs.keys()],
    kinds: () =>
      [...defs.values()].flatMap((d) => (d.width ? [{ name: d.name, width: d.width }] : [])),
    sharedTimbres() {
      const list = [...defs.values()];
      const pairs: [string, string][] = [];
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          if (list[i]!.sound.wave === list[j]!.sound.wave) pairs.push([list[i]!.name, list[j]!.name]);
        }
      }
      return pairs;
    },
  };
}

/** The shared registry used by `defineObstacle`. Tests make their own with createRegistry. */
export const defaultRegistry: Registry = createRegistry();

/** The whole declaration most objects need: `defineObstacle('crypt', { width: 0.2 })`. */
export function defineObstacle(name: string, options: ObstacleOptions): ObjectDef {
  return defaultRegistry.define(name, options);
}
