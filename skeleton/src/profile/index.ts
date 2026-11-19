import {
  CHANNEL_IDS,
  PALETTES,
  SPEEDS,
  THEME_IDS,
  type ChannelId,
  type Profile,
  type ProfilePatch,
} from '../types';

export const DWELL_RANGE_MS = [500, 10000] as const;
export const TEXT_SCALE_RANGE = [1, 3] as const;

/** Requirement 11.1: Slow by default, scanning on by default, every channel on. */
export function defaultProfile(): Profile {
  return {
    speed: 'slow',
    dwellMs: 2200,
    theme: 'default',
    textScale: 1,
    palette: 'default',
    reducedMotion: false,
    volume: { cues: 1, speech: 1, music: 0.6 },
    mono: false,
    voice: true,
    channels: { sound: true, speech: true, captions: true, indicator: true, haptics: true },
    picture: true,
    scanning: true,
    holdToConfirm: false,
    setupDone: false,
  };
}

/** Apply a patch without mutating the base. Nested volume/channels merge. */
export function mergeProfile(base: Profile, patch: ProfilePatch): Profile {
  const { volume, channels, ...rest } = patch;
  return {
    ...base,
    ...stripUndefined(rest),
    volume: { ...base.volume, ...stripUndefined(volume ?? {}) },
    channels: { ...base.channels, ...stripUndefined(channels ?? {}) },
  };
}

export interface OsPreferences {
  reducedMotion?: boolean;
  highContrast?: boolean;
}

/**
 * Requirements 11.2 and 17.6: start from OS preferences. Motion is reduced if
 * either the OS or the player asks for it; high contrast switches the theme
 * only while the theme is still the default.
 */
export function withOsPreferences(profile: Profile, os: OsPreferences): Profile {
  return {
    ...profile,
    reducedMotion: profile.reducedMotion || os.reducedMotion === true,
    theme: os.highContrast === true && profile.theme === 'default' ? 'high-contrast' : profile.theme,
  };
}

export function serialiseProfile(profile: Profile): string {
  return JSON.stringify(profile);
}

/**
 * Read a stored profile defensively. Anything missing or invalid falls back to
 * the default for that field, so a damaged store never breaks the game.
 */
export function parseProfile(input: unknown): Profile {
  const base = defaultProfile();
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return base;
    }
  }
  if (!isRecord(raw)) return base;

  const volume = isRecord(raw.volume) ? raw.volume : {};
  const channels = isRecord(raw.channels) ? raw.channels : {};

  return {
    speed: pickEnum(raw.speed, SPEEDS, base.speed),
    dwellMs: pickNumber(raw.dwellMs, DWELL_RANGE_MS, base.dwellMs),
    theme: pickEnum(raw.theme, THEME_IDS, base.theme),
    textScale: pickNumber(raw.textScale, TEXT_SCALE_RANGE, base.textScale),
    palette: pickEnum(raw.palette, PALETTES, base.palette),
    reducedMotion: pickBool(raw.reducedMotion, base.reducedMotion),
    volume: {
      cues: pickNumber(volume.cues, [0, 1], base.volume.cues),
      speech: pickNumber(volume.speech, [0, 1], base.volume.speech),
      music: pickNumber(volume.music, [0, 1], base.volume.music),
    },
    mono: pickBool(raw.mono, base.mono),
    voice: pickBool(raw.voice, base.voice),
    channels: Object.fromEntries(
      CHANNEL_IDS.map((id) => [id, pickBool(channels[id], base.channels[id])]),
    ) as Record<ChannelId, boolean>,
    picture: pickBool(raw.picture, base.picture),
    scanning: pickBool(raw.scanning, base.scanning),
    holdToConfirm: pickBool(raw.holdToConfirm, base.holdToConfirm),
    setupDone: pickBool(raw.setupDone, base.setupDone),
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pickEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function pickBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function pickNumber(v: unknown, range: readonly [number, number], fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(range[1], Math.max(range[0], v));
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
