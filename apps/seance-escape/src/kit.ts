import { createKit, type EventPresentation, type Kit, type TrackSpec } from '@marrow/skeleton';
import { GHOST_HEARD, NOISE_WORDS, RELICS, ROOM_EVENT_STYLES, ROOM_STYLES, type RoomKind } from './content';

/**
 * The house's music: a slow music box over a low drone, with a clock that starts ticking as the
 * phantom draws near. When it is close, the music falls away and your own heartbeat takes over. All of
 * it stays under the crossing bell (property 14), and it steps aside whenever a cue can sound.
 */
export const HOUSE_TRACK: TrackSpec = {
  name: 'The house at night',
  rootHz: 110,
  scale: [0, 1, 3, 5, 7, 8, 11, 12],
  slotSeconds: 0.5,
  bass: ['0-------', '0-------', '5-------', '6-------'],
  melody: ['7...5.4.', '3-......', '..7.6.5.', '4-3-....'],
  kick: ['X.......', '........', 'X.......', '....x...'],
  hat: ['x.x.x.x.'],
  bassWave: 'triangle',
  melodyWave: 'triangle',
};

/** The chase: once the ritual is done, a driving, fast version, as the bell calls you to the door. */
export const CHASE_TRACK: TrackSpec = {
  name: 'Run',
  rootHz: 98,
  scale: [0, 1, 3, 5, 6, 8, 10, 12],
  slotSeconds: 0.16,
  bass: ['0.0.0.0.', '0.0.1.0.', '3.3.3.3.', '1.1.0.0.'],
  melody: ['7.6.5.4.', '5.4.3.1.', '7.7.6.6.', '5.4.3.0.'],
  kick: ['X.x.X.x.'],
  hat: ['xxxxxxxx'],
  bassWave: 'square',
  melodyWave: 'square',
};

/** Mabel speaks a little higher than the narrator, so you know who is talking. */
export const MABEL_VOICE = { pitch: 1.3, rate: 1.02 };

/** How frightening the game is. "gentle" softens the stings; "off" removes them. Information is never removed. */
export type Fright = 'full' | 'gentle' | 'off';
export const FRIGHTS: readonly Fright[] = ['full', 'gentle', 'off'];

export interface SeanceKitOptions {
  fright?: Fright;
  /** Use the chase music. */
  chase?: boolean;
}

/** Sounds that would scare: louder and sharper with more fright, a soft chime with none. */
function scare(fright: Fright, full: NonNullable<EventPresentation['sound']>): NonNullable<EventPresentation['sound']> {
  if (fright === 'full') return full;
  if (fright === 'gentle') return { ...full, gain: (full.gain ?? 1) * 0.5, shape: { ...full.shape, filterHz: Math.min(full.shape?.filterHz ?? 1200, 900) } };
  return { hz: 330, wave: 'sine', gain: 0.3, role: 'effect', shape: { seconds: 0.4 } };
}

/**
 * Everything this game chooses, in one place. Each line says what the player hears,
 * reads and feels for one event. Anything left out uses the kit's defaults.
 *
 * Events with `spatial: true` are placed in the room: the sound comes from where the
 * thing is (true 3D in browsers that can), and the words can say {side} and {range}.
 *
 * Between rooms nothing beeps and nothing speaks. The house has its own sounds: footsteps on old
 * boards, creaks, wind, the rooms' own noises, a far-off bell, the relics' hum, the phantom's whisper,
 * and your heartbeat. A room has one bell, its name, then the ways out, each a draught of air from
 * its own direction.
 */
export function createSeanceKit(options: SeanceKitOptions = {}): Kit {
  const fright = options.fright ?? 'full';
  const roomSounds: Record<string, EventPresentation> = {};
  for (const [kind, style] of Object.entries(ROOM_STYLES) as [RoomKind, (typeof ROOM_STYLES)[RoomKind]][]) {
    if (!style.sound) continue;
    // A room's own sound, from where the room is. It is the house, not a cue: it never asks anything of you.
    roomSounds[`room-${kind}`] = {
      decorative: true,
      spatial: true,
      sound: { hz: style.sound.hz, wave: style.sound.wave, gain: style.sound.gain, role: 'effect', shape: style.sound.shape },
    };
  }
  const relicHums: Record<string, EventPresentation> = {};
  RELICS.forEach((r, i) => {
    relicHums[`relic-sense-${i}`] = {
      spatial: true,
      sound: { hz: r.hum, wave: 'sine', gain: 0.4, shape: { hzTo: r.hum, seconds: 1.1 } },
      haptic: [20, 40, 20],
    };
  });

  // The room events: each is heard, written and said, from somewhere in the room. A scary one is softened by Fright.
  const roomEvents: Record<string, EventPresentation> = {};
  for (const [id, style] of Object.entries(ROOM_EVENT_STYLES)) {
    const sound = { hz: style.sound.hz, wave: style.sound.wave, gain: style.sound.gain, role: 'effect' as const, shape: style.sound.shape };
    roomEvents[`room-event-${id}`] = {
      spatial: true,
      say: '{line}',
      caption: '{caption}',
      sound: style.soft ? scare(fright, sound) : sound,
      ...(style.haptic ? { haptic: style.haptic } : {}),
    };
  }
  // The noise meter: a soft tick for quiet, a firmer one for loud, a rasp for very loud. Said and written, too.
  const noiseMeter: Record<string, EventPresentation> = {
    'noise-meter-quiet': { say: NOISE_WORDS.quiet.say, caption: NOISE_WORDS.quiet.caption, sound: { hz: 220, wave: 'sine', gain: 0.3, role: 'effect', shape: { hzTo: 180, seconds: 0.2 } } },
    'noise-meter-loud': { say: NOISE_WORDS.loud.say, caption: NOISE_WORDS.loud.caption, sound: { hz: 440, wave: 'triangle', gain: 0.5, role: 'effect', shape: { hzTo: 520, seconds: 0.3 } }, haptic: [40] },
    'noise-meter-very-loud': { say: NOISE_WORDS['very loud'].say, caption: NOISE_WORDS['very loud'].caption, sound: { hz: 660, wave: 'square', gain: 0.5, role: 'effect', shape: { hzTo: 880, filterHz: 2400, seconds: 0.4 } }, haptic: [60, 30, 60] },
  };

  return createKit({
    audio: { keyHz: 55, track: options.chase ? CHASE_TRACK : HOUSE_TRACK },
    events: {
      intro: {
        say: '{line}',
        voice: MABEL_VOICE,
        caption: 'Find three relics. Ring the bell. Get out.',
      },
      menu: {
        say: 'Séance Escape. Press any key to begin. Escape comes back here.',
        speech: 'cut-in',
        caption: 'Press any key to begin',
      },
      // A run won: you escaped. The facts of the run, then the next house is one press away.
      summary: {
        say: 'You escaped and banished the phantom! {facts} Rank {rank}, {score} points. You heard {whispers} of {whisperTotal} whispers. Press any key to enter a new house, or Escape for the menu.',
        caption: 'Escaped! Rank {rank}: {score} points. {time}. Caught {catches} times.',
        sound: { hz: 523, wave: 'sine', gain: 0.6, role: 'reward', shape: { hzTo: 784, seconds: 1.2 } },
        haptic: [60, 60, 120],
      },
      // A run ended by three catches. Told gently: the house lets you go. Never "game over", never a scare.
      'run-end': {
        say: '{line}',
        caption: '{caption}',
        sound: { hz: 392, wave: 'sine', gain: 0.45, role: 'effect', shape: { hzTo: 262, filterHz: 1200, seconds: 1.8 } },
        haptic: [60, 80, 60],
      },

      // The sound guide, before the house: choose a sound to hear it.
      'guide-option': { say: '{label}', speech: 'latest', caption: '{label} ({index} of {count})', sound: { hz: 0, wave: 'sine', gain: 0.3, shape: { noise: true, filterHz: 900, filterTo: 1600, seconds: 0.25 } } },
      'guide-line': { say: '{line}', caption: '{line}' },

      // A heavy door, closing behind you.
      'walk-start': {
        caption: 'You step inside.',
        sound: { hz: 70, wave: 'square', gain: 0.6, role: 'effect', shape: { hzTo: 45, filterHz: 400, seconds: 0.9 } },
        haptic: [80],
      },
      // Footsteps on old boards.
      'walk-step': {
        decorative: true,
        sound: { hz: 0, wave: 'sine', gain: 0.3, role: 'effect', shape: { noise: true, filterHz: 600, filterTo: 250, seconds: 0.08 } },
        haptic: [14],
      },
      // The one bell of a stop: the choices are about to be read.
      'walk-crossing': {
        caption: 'A doorway',
        sound: { hz: 392, wave: 'sine', gain: 0.6, shape: { hzTo: 392, seconds: 1.2 } },
        haptic: [40],
      },
      'walk-room': { say: '{line}', caption: '{caption}' },
      'walk-relic': {
        say: 'Mabel: {line}',
        voice: MABEL_VOICE,
        caption: '{relic} found: {found} of {total}',
        sound: { hz: 523, wave: 'sine', gain: 0.8, role: 'reward', shape: { hzTo: 1047, seconds: 1.0 } },
        haptic: [60, 40, 60, 40, 120],
      },
      'walk-ritual': {
        say: 'Mabel: {line}',
        voice: MABEL_VOICE,
        caption: 'Ritual complete! Run to the bell!',
        sound: scare(fright, { hz: 196, wave: 'square', gain: 0.9, role: 'effect', shape: { hzTo: 98, filterHz: 2600, filterTo: 400, seconds: 1.4 } }),
        haptic: [200, 60, 200, 60, 400],
      },
      'walk-sealed': { say: '{line}', voice: MABEL_VOICE, caption: 'Sealed. {left} relics to find.', haptic: [60, 60, 60] },
      'walk-hint': { say: 'Mabel: {line}', voice: MABEL_VOICE, caption: 'Mabel: {line}' },
      'walk-hide': {
        say: 'You hide in the wardrobe. Hold your breath.',
        caption: 'Hiding. Hold your breath.',
        sound: { hz: 0, wave: 'sine', gain: 0.4, role: 'effect', shape: { noise: true, filterHz: 500, filterTo: 200, seconds: 0.5 } },
        haptic: [40],
      },
      'walk-unhide': {
        say: 'You creep out.',
        caption: 'You creep out.',
        sound: { hz: 0, wave: 'sine', gain: 0.35, role: 'effect', shape: { noise: true, filterHz: 400, filterTo: 700, seconds: 0.5 } },
      },
      // Each way is a draught of air from where it lies, then its name.
      'walk-option': {
        spatial: true,
        say: '{label}',
        speech: 'latest',
        caption: '{label} ({index} of {count})',
        sound: { hz: 0, wave: 'sine', gain: 0.6, shape: { noise: true, filterHz: 700, filterTo: 1800, seconds: 0.5 } },
      },
      'walk-listen': { say: '{summary}', caption: '{summary}' },
      // A search: loud. What it turns up is said, and written.
      'walk-search': {
        say: '{line}',
        caption: '{caption}',
        sound: { hz: 0, wave: 'sine', gain: 0.7, role: 'effect', shape: { noise: true, filterHz: 3600, filterTo: 700, seconds: 0.9 } },
        haptic: [40, 30, 40, 30, 40],
      },
      // The phantom heard a noise it was too far to hunt you for. It comes from where it is.
      'ghost-heard': {
        spatial: true,
        say: GHOST_HEARD.say,
        caption: GHOST_HEARD.caption,
        sound: scare(fright, { hz: 392, wave: 'triangle', gain: 0.55, role: 'effect', shape: { hzTo: 262, filterHz: 1000, seconds: 0.9 } }),
        haptic: [40, 60, 40],
      },
      // The phantom whispers from where it is: louder and brighter the nearer it is.
      'ghost-sense': {
        spatial: true,
        sound: { hz: 0, wave: 'sine', gain: 0.9, shape: { noise: true, filterHz: 2600, filterTo: 900, seconds: 0.9 } },
        haptic: [30, 60, 30],
      },
      // It heard you. A shriek from its direction.
      'ghost-hunts': {
        spatial: true,
        caption: 'It heard you! It is hunting.',
        sound: scare(fright, { hz: 880, wave: 'square', gain: 0.7, role: 'effect', shape: { hzTo: 1320, filterHz: 3800, filterTo: 1400, seconds: 0.6 } }),
        haptic: [100, 40, 100],
      },
      'ghost-lost': {
        caption: 'It lost your trail.',
        sound: { hz: 0, wave: 'sine', gain: 0.4, role: 'effect', shape: { noise: true, filterHz: 1200, filterTo: 300, seconds: 1.2 } },
        haptic: [20],
      },
      'ghost-searched': {
        caption: 'It searched the wardrobe, and moved on.',
        sound: scare(fright, { hz: 0, wave: 'sine', gain: 0.9, role: 'effect', shape: { noise: true, filterHz: 3200, filterTo: 600, seconds: 1.6 } }),
        haptic: [60, 100, 60, 100, 60],
      },
      // Your heartbeat, lub then dub, faster the nearer the phantom is.
      heartbeat: {
        sound: { hz: 0, wave: 'sine', gain: 0.95, shape: { noise: true, filterHz: 260, filterTo: 90, seconds: 0.11 } },
        haptic: [45],
      },
      'heartbeat-dub': {
        sound: { hz: 0, wave: 'sine', gain: 0.6, shape: { noise: true, filterHz: 220, filterTo: 80, seconds: 0.1 } },
        haptic: [25],
      },
      // The moment it gets right behind you.
      'ghost-close': {
        caption: 'It is right behind you!',
        ...(fright === 'off' ? {} : { sound: scare(fright, { hz: 660, wave: 'square', gain: 0.6, role: 'effect', shape: { hzTo: 990, filterHz: 3000, filterTo: 1200, seconds: 0.7 } }) }),
        haptic: [120, 40, 120],
      },
      'ghost-call': {
        spatial: true,
        say: 'Phantom {side}, {range}.{mood}',
        caption: 'Phantom {side}, {range}',
      },
      // The great bell, tolling in the Front Hall: the way out.
      'exit-sense': {
        spatial: true,
        sound: { hz: 659, wave: 'sine', gain: 0.45, shape: { seconds: 2.2 } },
      },
      // A relic hums from where it is, a little louder than the house's own sounds.
      'relic-sense': {
        spatial: true,
        sound: { hz: 523, wave: 'sine', gain: 0.4, shape: { hzTo: 523, seconds: 1.1 } },
        haptic: [20, 40, 20],
      },
      ...relicHums,
      ...roomEvents,
      ...noiseMeter,
      ...roomSounds,
      // Your feet, by floor: old boards creak and thud, stone clicks and rings, carpet hushes.
      'step-wood': {
        decorative: true,
        sound: { hz: 0, wave: 'sine', gain: 0.32, role: 'effect', shape: { noise: true, filterHz: 700, filterTo: 220, seconds: 0.1 } },
        haptic: [14],
      },
      'step-stone': {
        decorative: true,
        sound: { hz: 0, wave: 'sine', gain: 0.3, role: 'effect', shape: { noise: true, filterHz: 2600, filterTo: 900, seconds: 0.05 } },
        haptic: [10],
      },
      'step-carpet': {
        decorative: true,
        sound: { hz: 0, wave: 'sine', gain: 0.2, role: 'effect', shape: { noise: true, filterHz: 320, filterTo: 150, seconds: 0.14 } },
        haptic: [8],
      },
      // A board that groans under you, now and then.
      'board-creak': {
        decorative: true,
        sound: { hz: 210, wave: 'triangle', gain: 0.2, role: 'effect', shape: { hzTo: 160, filterHz: 700, wobbleHz: 9, wobble: 0.04, seconds: 0.5 } },
      },
      // The door of a room, groaning open as you walk in.
      door: {
        decorative: true,
        sound: { hz: 240, wave: 'triangle', gain: 0.28, role: 'effect', shape: { hzTo: 150, filterHz: 900, filterTo: 500, wobbleHz: 7, wobble: 0.05, seconds: 0.9 } },
      },
      // The phantom's moan, from where it is. Information, not decoration: it tells you where it is.
      'ghost-moan': {
        spatial: true,
        sound: scare(fright, { hz: 165, wave: 'triangle', gain: 0.55, role: 'effect', shape: { hzTo: 118, filterHz: 1100, filterTo: 600, wobbleHz: 5, wobble: 0.07, seconds: 1.9 } }),
        haptic: [20, 80, 20],
      },
      // Its feet, dragging, each time it moves near you.
      'ghost-step': {
        spatial: true,
        sound: { hz: 0, wave: 'sine', gain: 0.5, role: 'effect', shape: { noise: true, filterHz: 240, filterTo: 90, seconds: 0.22 } },
        haptic: [18],
      },
      // The house breathing: wind through the cracks, thunder far off, your own breath when you hide.
      gust: {
        decorative: true,
        spatial: true,
        sound: { hz: 0, wave: 'sine', gain: 0.24, role: 'effect', shape: { noise: true, filterHz: 300, filterTo: 1300, seconds: 3.4 } },
      },
      thunder: {
        decorative: true,
        sound: { hz: 0, wave: 'sine', gain: fright === 'off' ? 0.25 : 0.5, role: 'effect', shape: { noise: true, filterHz: 200, filterTo: 45, seconds: 3.4 } },
        haptic: [60, 40, 140],
      },
      breath: {
        decorative: true,
        sound: { hz: 0, wave: 'sine', gain: 0.16, role: 'effect', shape: { noise: true, filterHz: 900, filterTo: 380, seconds: 1.5 } },
      },
      'dead-end': {
        caption: 'Dead end. Turning back.',
        sound: { hz: 0, wave: 'sine', gain: 0.5, role: 'effect', shape: { noise: true, filterHz: 300, filterTo: 120, seconds: 0.25 } },
        haptic: [60],
      },
      creak: {
        decorative: true,
        spatial: true,
        sound: { hz: 180, wave: 'triangle', gain: 0.35, role: 'effect', shape: { hzTo: 120, filterHz: 500, seconds: 0.8 } },
      },
      caught: {
        say: 'Caught! {line}',
        speech: 'cut-in',
        caption: 'Caught! Back to the last room.',
        sound: scare(fright, { hz: 330, wave: 'square', gain: 0.9, role: 'effect', shape: { hzTo: 55, filterHz: 2400, filterTo: 300, seconds: 1.0 } }),
        haptic: [300],
      },
      escaped: {
        say: 'You ring the great bell. The phantom shrieks, and is gone. The door swings open. You escaped!',
        caption: 'You escaped!',
        sound: { hz: 523, wave: 'sine', gain: 0.8, role: 'reward', shape: { hzTo: 1047, seconds: 1.4 } },
        haptic: [60, 60, 200],
      },
    },
  });
}
