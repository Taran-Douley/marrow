import { proofResult } from '../proof/timing';
import type { ProofResult } from '../proof/types';
import type { SoundShape, Wave } from '../types';
import type { Theme } from './brief';

// Sounds that fit the game (Requirement A3). Every game has the same jobs for sound: a countdown,
// steps, a reward, danger, a menu tick, a fall, and a bed underneath. A palette fills each job with a
// sound that belongs in the game's world, and words for it, so a haunted house rings a church bell
// where a space game pings sonar. All synthesised: no files.

export type PaletteRole = 'cueLow' | 'cueHigh' | 'step' | 'reward' | 'danger' | 'tick' | 'fall' | 'ambience';
export const PALETTE_ROLES: readonly PaletteRole[] = ['cueLow', 'cueHigh', 'step', 'reward', 'danger', 'tick', 'fall', 'ambience'];

export interface PaletteSound {
  /** What it sounds like, in words a player and a developer both understand. */
  words: string;
  hz: number;
  wave: Wave;
  gain?: number;
  shape?: SoundShape;
}

export interface Palette {
  theme: Theme;
  /** One line about the palette as a whole. */
  mood: string;
  sounds: Record<PaletteRole, PaletteSound>;
}

const noise = (words: string, from: number, to: number, seconds: number, gain = 0.35): PaletteSound => ({
  words,
  hz: 0,
  wave: 'sine',
  gain,
  shape: { noise: true, filterHz: from, filterTo: to, seconds },
});

export const PALETTES: Readonly<Record<Theme, Palette>> = {
  haunted: {
    theme: 'haunted',
    mood: 'Old wood, bells and wind: a house that is not quite empty.',
    sounds: {
      cueLow: { words: 'a low church bell', hz: 294, wave: 'triangle' },
      cueHigh: { words: 'a thin glass chime', hz: 587, wave: 'sine' },
      step: noise('a creaking board', 700, 220, 0.1, 0.3),
      reward: { words: 'a music-box ting', hz: 880, wave: 'sine', gain: 0.7, shape: { hzTo: 1320, seconds: 0.5 } },
      danger: { words: 'a rising moan', hz: 165, wave: 'triangle', gain: 0.55, shape: { hzTo: 220, filterHz: 1100, wobbleHz: 5, wobble: 0.07, seconds: 1.4 } },
      tick: { words: 'a candle tick', hz: 660, wave: 'sine', gain: 0.3, shape: { seconds: 0.05 } },
      fall: { words: 'a hollow thud', hz: 120, wave: 'triangle', gain: 0.7, shape: { hzTo: 55, seconds: 0.4 } },
      ambience: noise('wind through the rafters', 300, 900, 3, 0.2),
    },
  },
  space: {
    theme: 'space',
    mood: 'Clean electronic tones over an engine hum: a ship that talks to you.',
    sounds: {
      cueLow: { words: 'a sonar ping', hz: 330, wave: 'sine' },
      cueHigh: { words: 'a bright console blip', hz: 660, wave: 'square' },
      step: noise('a soft servo whirr', 2400, 1200, 0.08, 0.25),
      reward: { words: 'a rising power-up chime', hz: 523, wave: 'triangle', gain: 0.7, shape: { hzTo: 1047, seconds: 0.5 } },
      danger: { words: 'a falling alarm sweep', hz: 440, wave: 'square', gain: 0.5, shape: { hzTo: 330, filterHz: 1800, seconds: 1 } },
      tick: { words: 'a console click', hz: 1200, wave: 'square', gain: 0.2, shape: { seconds: 0.03 } },
      fall: { words: 'a power-down whine', hz: 300, wave: 'square', gain: 0.5, shape: { hzTo: 60, seconds: 0.5 } },
      ambience: noise('the engine hum', 120, 200, 3, 0.2),
    },
  },
  forest: {
    theme: 'forest',
    mood: 'Wood, birds and leaves: warm and close.',
    sounds: {
      cueLow: { words: 'a hollow wooden knock', hz: 294, wave: 'triangle' },
      cueHigh: { words: 'a bird call', hz: 784, wave: 'sine', shape: { wobbleHz: 9, wobble: 0.03, seconds: 0.18 } },
      step: noise('leaves underfoot', 2200, 800, 0.12, 0.28),
      reward: { words: 'a woodwind trill', hz: 659, wave: 'triangle', gain: 0.7, shape: { hzTo: 988, wobbleHz: 12, wobble: 0.02, seconds: 0.5 } },
      danger: { words: 'a low growl', hz: 110, wave: 'square', gain: 0.45, shape: { hzTo: 90, filterHz: 500, wobbleHz: 14, wobble: 0.05, seconds: 1 } },
      tick: { words: 'a twig snap', hz: 0, wave: 'sine', gain: 0.3, shape: { noise: true, filterHz: 4000, filterTo: 2000, seconds: 0.03 } },
      fall: { words: 'a soft thump on moss', hz: 100, wave: 'sine', gain: 0.6, shape: { hzTo: 50, seconds: 0.35 } },
      ambience: noise('leaves in the wind', 1500, 3000, 3, 0.18),
    },
  },
  underwater: {
    theme: 'underwater',
    mood: 'Soft, round, muffled sounds: everything is far and slow.',
    sounds: {
      cueLow: { words: 'a deep bell buoy', hz: 311, wave: 'triangle' },
      cueHigh: { words: 'a bubble pop', hz: 698, wave: 'sine', shape: { hzTo: 900, seconds: 0.12 } },
      step: noise('a slow swish of water', 600, 300, 0.25, 0.25),
      reward: { words: 'a shimmer of light', hz: 1047, wave: 'sine', gain: 0.6, shape: { hzTo: 1568, wobbleHz: 7, wobble: 0.02, seconds: 0.7 } },
      danger: { words: 'a low sonar warning', hz: 196, wave: 'sine', gain: 0.6, shape: { hzTo: 147, filterHz: 700, seconds: 1.2 } },
      tick: { words: 'a tiny bubble', hz: 900, wave: 'sine', gain: 0.25, shape: { hzTo: 1200, seconds: 0.05 } },
      fall: { words: 'a muffled bump', hz: 90, wave: 'triangle', gain: 0.6, shape: { hzTo: 45, filterHz: 400, seconds: 0.45 } },
      ambience: noise("the sea's hush", 250, 500, 3, 0.2),
    },
  },
  neutral: {
    theme: 'neutral',
    mood: 'Plain, clear tones: they fit anything and are easy to tell apart.',
    sounds: {
      cueLow: { words: 'a low hum', hz: 294, wave: 'triangle' },
      cueHigh: { words: 'a high chime', hz: 587, wave: 'sine' },
      step: noise('a soft tap', 1500, 800, 0.05, 0.25),
      reward: { words: 'a rising chime', hz: 880, wave: 'sine', gain: 0.7, shape: { hzTo: 1320, seconds: 0.4 } },
      danger: { words: 'a falling buzz', hz: 440, wave: 'square', gain: 0.45, shape: { hzTo: 330, seconds: 0.8 } },
      tick: { words: 'a soft tick', hz: 660, wave: 'sine', gain: 0.3, shape: { seconds: 0.05 } },
      fall: { words: 'a low bonk', hz: 150, wave: 'triangle', gain: 0.7, shape: { hzTo: 60, seconds: 0.35 } },
      ambience: noise('a quiet wind', 350, 600, 3, 0.18),
    },
  },
};

/** The lowest a cue may be, so the cues keep their own pitch range above the music (property 14). */
export const CUE_FLOOR_HZ = 264;

/**
 * Proof for a palette (Requirement A3.2): every role has words and a sound; the two cues differ in
 * pitch (by at least three semitones) and in timbre; and both sit above the music.
 */
export function paletteProof(p: Palette, musicCeilingHz = CUE_FLOOR_HZ): ProofResult {
  const problems: string[] = [];
  const label = `Palette '${p.theme}'`;
  for (const role of PALETTE_ROLES) {
    const s = p.sounds[role];
    if (!s || !s.words.trim()) problems.push(`${label}: the ${role} sound has no words to describe it.`);
    else if (!(s.hz > 0) && !s.shape?.noise) problems.push(`${label}: the ${role} sound (${s.words}) has no pitch and is not noise, so it would be silent.`);
  }
  const { cueLow: lo, cueHigh: hi } = p.sounds;
  if (lo && hi) {
    if (lo.wave === hi.wave) problems.push(`${label}: both cues are ${lo.wave} waves. Two cues must differ in timbre as well as pitch.`);
    const semis = Math.abs(12 * Math.log2(hi.hz / lo.hz));
    if (!(semis >= 3)) problems.push(`${label}: the cues (${lo.words}, ${hi.words}) are only ${semis.toFixed(1)} semitones apart. They need at least 3.`);
    for (const c of [lo, hi]) {
      if (c.hz < musicCeilingHz) problems.push(`${label}: the cue "${c.words}" is ${c.hz} Hz, inside the music's range (up to ${Math.round(musicCeilingHz)} Hz).`);
    }
  }
  return proofResult(301, 'Palette fits and can be told apart', problems);
}
