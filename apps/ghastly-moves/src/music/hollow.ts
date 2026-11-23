import type { TrackSpec } from '@marrow/skeleton';

// Stage 6, The Hollow: trip-hop over the spooky bed (drone, far choir, owl and creak).
//
// Key: F minor, from F at 87 Hz. The scale, by step (semitones above the root):
//   0 F, 1 G, 2 Ab, 3 Bb, 4 C, 5 Db, 6 Eb, 7 F (the octave), 8 Gb (a semitone up: the dark Phrygian second).
// Four bars: Fm7, Dbmaj7, Bbm7, Gb. As steps: Fm7 = F Ab C Eb ('0246'), Dbmaj7 = F Ab C Db ('0245'),
// Bbm7 = F Ab Bb Db ('0235'), Gb = Bb Db Gb ('358').
// The beat is slow and heavy in half time: the kick on one and a late one, the snare on three, a dusty hat on the
// off-beats and a ghost shaker. The bass is a deep sine sub that holds nearly a whole bar. The chords are a wide,
// airy pad with the choir on top; a lone electric-piano pluck answers on beats two and four. The tune is sparse: one
// long note, a small fall. A slight lazy swing (0.12) and a very long, wide room.
//
// The tempo comes from the stage's song and is not changed here. The band builds with the streak: bed, kick and
// snare first, then the sub and the pad, then the piano, then the tune.

const SCALE = [0, 2, 3, 5, 7, 8, 10, 12, 1];

export const HOLLOW_TRACK: TrackSpec = {
  name: 'The Hollow: trip-hop in F minor',
  rootHz: 87,
  scale: SCALE,
  bass: ['0-----2-', '5-----4-', '3-----5-', '8-----3-'],
  pluck: ['..4...6.', '..5...2.', '..0...2.', '..3...5.'],
  chords: ['0246', '0245', '0235', '358'],
  melody: ['4-------', '..6-5-4-', '3-------', '..2---0-', '7-------', '..6-4-5-', '3---2---', '0-------'],
  kick: ['X.....x.', 'X..x....'],
  snare: ['....X...'],
  hat: ['..x...x.', '.xx...x.'],
  shaker: ['....x.x.'],
  bassWave: 'sine',
  bassVoice: 'sub',
  melodyVoice: 'keys',
  drums: true,
  bed: true,
  swing: 0.12,
  space: { seconds: 3.2, wet: 0.36 },
  stems: { bass: 2, pluck: 4, melody: 6 },
};

/**
 * The Hollow Wraith's own, heavier version: a semitone and a half lower (E, 82 Hz), the sub pulsing in half-bar
 * pushes, the kick heavier with a double push, the snare on three with a ghost note, the hat busier. Every layer plays
 * from the start. Halfway down his health the key lifts three semitones and the kick and snare tumble faster; the
 * timing does not change.
 */
export const HOLLOW_WRAITH_TRACK: TrackSpec = {
  name: 'The Hollow Wraith: a heavier lurch',
  rootHz: 82,
  scale: SCALE,
  bass: ['0---0-2-', '5---5-4-', '3---3-5-', '8---8-3-'],
  pluck: ['..4...6.', '..5...2.', '..0...2.', '..3...5.'],
  chords: ['0246', '0245', '0235', '358'],
  melody: ['4---6---', '5-6-4---', '3---5---', '4-2---0-', '7---6---', '4-6-5---', '3-4-2---', '0-------'],
  kick: ['X..x..x.', 'X.x...xx'],
  snare: ['....X..x'],
  hat: ['.xx.xxx.'],
  shaker: ['x.x.x.x.'],
  bassWave: 'sine',
  bassVoice: 'sub',
  melodyVoice: 'keys',
  drums: true,
  bed: true,
  swing: 0.1,
  space: { seconds: 3.4, wet: 0.38 },
  phase2: { lift: 3, kick: ['X.xx.xxx'], snare: ['..x.X..x'], hat: ['xxxxxxxx'] },
};
