import type { Character } from '@marrow/skeleton';

/**
 * Who speaks in Ghastly Moves.
 *
 * The narrator is the game itself: it has no name and no signature. It speaks every menu, number,
 * tell and coach line, and these sit right beside the countdowns, where a signature sound would
 * blur the beat. A boss speaks only its taunt, after a stage, when no countdown is running.
 *
 * Each boss has a name in the captions and the live text, its own pitch and pace, and its own short
 * signature sound, placed left or right. With one system voice, the pitch, pace and signature still
 * tell them apart; with the built-in voice off, the name and the signature do.
 * A boss's id is its name, so an event can say `speaker: '{boss}'`.
 */
export const GHASTLY_CHARACTERS: Record<string, Character> = {
  narrator: { voices: [], pitch: 1, rate: 1, pan: 0 },
  'The Pumpkin King': {
    name: 'The Pumpkin King',
    voices: ['David', 'Guy', 'Google UK English Male'],
    pitch: 0.7,
    rate: 0.9,
    pan: -0.7,
    signature: { hz: 140, hzTo: 100, wave: 'triangle', ms: 240, gain: 0.55 },
  },
  'The Bone Warden': {
    name: 'The Bone Warden',
    voices: ['Mark', 'Ryan', 'Daniel'],
    pitch: 0.85,
    rate: 1.12,
    pan: 0.7,
    signature: { hz: 520, wave: 'square', ms: 90, gain: 0.35 },
  },
  'The Moss Witch': {
    name: 'The Moss Witch',
    voices: ['Zira', 'Sonia', 'Samantha'],
    pitch: 1.4,
    rate: 0.95,
    pan: -0.35,
    signature: { hz: 400, hzTo: 700, wave: 'sine', ms: 260, gain: 0.5 },
  },
  'The Gatekeeper': {
    name: 'The Gatekeeper',
    voices: ['Guy', 'Mark', 'David'],
    pitch: 0.6,
    rate: 0.85,
    pan: 0.35,
    signature: { hz: 90, wave: 'square', ms: 200, gain: 0.45 },
  },
  'The Spider Miller': {
    name: 'The Spider Miller',
    voices: ['Aria', 'Jenny', 'Hazel'],
    pitch: 1.2,
    rate: 1.25,
    pan: 1,
    signature: { hz: 1500, hzTo: 1900, wave: 'triangle', ms: 120, gain: 0.35 },
  },
  'The Hollow Wraith': {
    name: 'The Hollow Wraith',
    voices: ['Libby', 'Natasha'],
    pitch: 0.95,
    rate: 0.8,
    pan: -1,
    signature: { hz: 300, hzTo: 180, wave: 'sine', ms: 290, gain: 0.5 },
  },
  'Count Vexar': {
    name: 'Count Vexar',
    voices: ['Ryan', 'George', 'Daniel'],
    pitch: 1.1,
    rate: 1.0,
    pan: 0.1,
    signature: { hz: 220, hzTo: 330, wave: 'triangle', ms: 160, gain: 0.5 },
  },
};
