import type { TrackSpec } from '@marrow/skeleton';

// Stage 3, Whispering Woods: lo-fi over the spooky bed (drone, far choir, owl and creak).
//
// Key: B-flat dorian, from 117 Hz (Bb2). The scale, by step (semitones above the root in brackets):
//   0 Bb (0), 1 C (2), 2 Db (3), 3 Eb (5), 4 F (7), 5 G (9), 6 Ab (10), 7 D (4), 8 Gb (8).
// Four bars, i9 - IV7 - bVImaj7 - bVII (Bbm9, Eb7, Gbmaj7, Ab), then round again:
//   Bbm9 = Bb Db F Ab ('0246'), Eb7 = Bb Db Eb G ('0235'), Gbmaj7 = Bb Db F Gb ('0248'), Ab = C Eb G Ab ('1356').
// A soft sine bass holds the root and the fifth; the chords are a warm pad (the engine's saw pad through a low-pass);
// soft keys play a lazy, sparse tune with many rests; the "pluck" is a music box, a few high notes. Dusty drums:
// a boom-bap kick, a brushed snare, shaker as vinyl dust. A lazy swing (0.2) and a long, hazy room.
//
// The tempo comes from the stage's song and is not changed here. The band builds with the streak: bed, kick and
// dust first, then the bass and pad, then the music box, then the tune.

export const WOODS_TRACK: TrackSpec = {
  name: 'Whispering Woods: lo-fi in B-flat dorian',
  rootHz: 117,
  scale: [0, 2, 3, 5, 7, 9, 10, 4, 8],
  bass: ['0-----4-', '3-----0-', '8-----2-', '6-----3-'],
  pluck: ['..4...6.', '.5...3..', '..4...8.', '.3...1..'],
  chords: ['0246', '0235', '0248', '1356'],
  melody: ['..4-6-4-', '5---3-2-', '4---8-4-', '3---1---', '..2-4-6-', '5-6-5-3-', '4---2---', '1-3-1---'],
  kick: ['X..x.x..', 'X.....x.'],
  snare: ['..x...X.'],
  shaker: ['x.x.xxx.'],
  hat: ['..x...x.'],
  bassWave: 'sine',
  bassVoice: 'sub',
  melodyVoice: 'keys',
  drums: true,
  bed: true,
  swing: 0.2,
  space: { seconds: 2.4, wet: 0.35 },
  stems: { bass: 2, pluck: 4, melody: 6 },
};

/**
 * The Moss Witch's own, heavier version: a tone and a half lower (G, 98 Hz), a pulsing sub bass in eighths, a kick
 * that thumps on every beat, a heavier backbeat and a fuller shaker, the keys leaning on longer, darker notes.
 * Every layer plays from the start. Halfway down her health the key lifts three semitones and the drums turn
 * busier; the timing does not change.
 */
export const MOSS_WITCH_TRACK: TrackSpec = {
  name: 'The Moss Witch: a heavier lo-fi',
  rootHz: 98,
  scale: [0, 2, 3, 5, 7, 9, 10, 4, 8],
  bass: ['0-0-0-4-', '3-3-3-0-', '8-8-8-2-', '6-6-6-3-'],
  pluck: ['..4.6.4.', '.5.3.2..', '..4.8.4.', '.3.1.3..'],
  chords: ['0246', '0235', '0248', '1356'],
  melody: ['4---6---', '5---3---', '4---8---', '3---1---', '2---4---', '5-6-5-3-', '4---2---', '1-3-1---'],
  kick: ['X.x.X.x.'],
  snare: ['..X...X.'],
  shaker: ['xxxxxxxx'],
  hat: ['..x...x.'],
  bassWave: 'sine',
  bassVoice: 'sub',
  melodyVoice: 'keys',
  drums: true,
  bed: true,
  swing: 0.15,
  space: { seconds: 2.8, wet: 0.36 },
  phase2: { lift: 3, kick: ['X.xxX.xx'], snare: ['..X.x.X.'], hat: ['x.x.x.x.'] },
};
