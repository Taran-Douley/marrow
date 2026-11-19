import type { TrackSpec } from '@marrow/skeleton';

/**
 * One background track for each place, on the beat of the countdown: a bar is four beats, a slot
 * is half a beat. A digit is a note of the scale, a dash holds it, a dot is a rest; in the drums,
 * x is a hit and X a strong one.
 *
 * The kit plays them full between the countdowns and drops them right down while the beeps play, so
 * the beeps are always on top. All notes stay under the stones' hum (property 14).
 *
 * The notes were chosen without ears. Tune them by playing the game.
 */
const PENTATONIC = [0, 3, 5, 7, 10, 12];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10, 12];
const DORIAN = [0, 2, 3, 5, 7, 9, 10, 12];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11, 12];
const WHOLE_TONE = [0, 2, 4, 6, 8, 10, 12];
const LOCRIAN = [0, 1, 3, 5, 6, 8, 10, 12];
const MINOR = [0, 2, 3, 5, 7, 8, 10, 12];

export const TRACKS: readonly TrackSpec[] = [
  {
    name: 'Pumpkin Patch: a spooky bounce',
    rootHz: 110,
    scale: PENTATONIC,
    bass: ['0-..4-..', '0-..3-.2'],
    melody: ['2.3.4-3.', '5-4-3-..', '2.3.4.5.', '4-3-2---'],
    kick: ['X...x...'],
    hat: ['..x...x.'],
  },
  {
    name: 'Crypt Steps: a slow creep',
    rootHz: 98,
    scale: PHRYGIAN,
    bass: ['0-------', '1-------'],
    melody: ['....2-..', '.3-.2...', '....1-..', '.2-...0.'],
    kick: ['X.......', 'X...x...'],
    hat: ['x.x.x.x.'],
    melodyWave: 'triangle',
  },
  {
    name: 'Whispering Woods: a drifting tune',
    rootHz: 123,
    scale: DORIAN,
    bass: ['0-0-3-0-', '0-0-4-2-'],
    melody: ['3---5---', '4-3-2---', '..5-4-3-', '2-------'],
    kick: ['X...x...'],
    hat: ['.x.x.x.x'],
    melodyWave: 'triangle',
  },
  {
    name: 'The Old Gate: a march',
    rootHz: 104,
    scale: HARMONIC,
    bass: ['0.0.0.0.', '4.4.0.0.'],
    melody: ['..3.4.5.', '6---5---', '..3.4.3.', '2---0---'],
    kick: ['X.x.X.x.'],
    hat: ['xxxxxxxx'],
  },
  {
    name: 'Haunted Mill: an eerie turn',
    rootHz: 87,
    scale: WHOLE_TONE,
    bass: ['0-----0-', '3-------'],
    melody: ['.2---4..', '..5---3.', '1---4---', '...6----'],
    kick: ['X.....x.', '..x.....'],
    hat: ['x..x..x.'],
    melodyWave: 'triangle',
  },
  {
    name: 'The Hollow: an uneasy lurch',
    rootHz: 92,
    scale: LOCRIAN,
    bass: ['0--0--0-', '0--0--4-'],
    melody: ['..2---3.', '4--3--2.', '..5---4.', '3---2---'],
    kick: ['X..x..x.', 'X..x....'],
    hat: ['.x..x..x'],
  },
  {
    name: 'Midnight Manor: a grand waltz',
    rootHz: 117,
    scale: MINOR,
    bass: ['0---3---', '0---4---', '0---5---', '0---3-4-'],
    melody: ['4.5.7.5.', '4.3.2.3.', '5.7.6.7.', '5.4.3---'],
    kick: ['X...x...', 'X...x.x.'],
    hat: ['x.x.x.x.'],
    melodyWave: 'triangle',
  },
];

/** A boss's version of a tune: a little lower, a driving bass and drums. */
export function bossTrack(spec: TrackSpec): TrackSpec {
  return {
    ...spec,
    name: `${spec.name} (boss)`,
    rootHz: Math.max(60, Math.round(spec.rootHz * 0.94)),
    bass: ['0.0.0.0.', '0.0.3.0.'],
    kick: ['X.x.X.x.', 'X.x.X.xX'],
    hat: ['xxxxxxxx'],
    melodyWave: 'square',
  };
}
