import type { TrackSpec } from '@marrow/skeleton';

// Stage 2, Crypt Steps: swing jazz over the spooky bed (drone, far choir, owl and creak).
//
// Key: A minor with a raised seventh and a few chromatic steps, from A at 110 Hz. The scale, by step:
//   0 A, 1 B, 2 C, 3 D, 4 E, 5 F, 6 F#, 7 G, 8 G#, 9 A (the octave).
// Four bars of changes, i7 - iv7 - V7 - bVImaj7 (Am7, Dm7, E7, Fmaj7), then round again:
//   Am7 = A C E G ('0247'), Dm7 = C D F A ('2359'), E7 = B D E G# ('1348'), Fmaj7 = A C E F ('0245').
// Walking bass in quarter notes (one note every two slots) that leans into the next chord; a muted guitar-like
// comp on the "and" of two (slot 3), the way a jazz comp lands; soft keys on a lazy, bluesy tune; brushes on the
// snare, a feathered kick, a ride pattern on the hat. A long swing (0.28 of a slot) puts every off-beat late,
// like triplets. The presses stay on the even slots, which the swing never moves.
//
// The tempo comes from the stage's song and is not changed here. The band builds with the streak: bed, kick
// and brushes first, then the bass and chords, then the comp, then the tune.

export const CRYPT_TRACK: TrackSpec = {
  name: 'Crypt Steps: swing jazz in A minor',
  rootHz: 110,
  scale: [0, 2, 3, 5, 7, 8, 9, 10, 11, 12],
  bass: ['0-2-4-5-', '3-5-9-7-', '4-8-1-6-', '5-9-4-1-'],
  pluck: ['4..7.2..', '5..9.3..', '8..3.4..', '4..5.9..'],
  chords: ['0247', '2359', '1348', '0245'],
  melody: ['2-4-7-4-', '5---3---', '8-4-1-4-', '5---4-2-', '..0-2-4-', '5-9---7-', '6-8-9---', '5---4---'],
  kick: ['x.......', 'x...x...'],
  snare: ['x.X.x.X.'],
  hat: ['x.xxx.xx'],
  bassWave: 'triangle',
  bassVoice: 'pluck',
  melodyVoice: 'keys',
  drums: true,
  bed: true,
  swing: 0.28,
  space: { seconds: 1.4, wet: 0.2 },
  stems: { bass: 2, pluck: 4, melody: 6 },
};

/**
 * The Bone Warden's own, heavier version: the same changes a tone lower (G minor), the walking
 * bass in eighth notes, a stronger comp, a kick on every beat and a full backbeat. Every layer plays from the start.
 * Halfway down his health the key lifts three semitones and the ride and brushes turn busier; the timing does not change.
 */
export const BONE_WARDEN_TRACK: TrackSpec = {
  name: 'The Bone Warden: a heavier swing',
  rootHz: 98,
  scale: [0, 2, 3, 5, 7, 8, 9, 10, 11, 12],
  bass: ['02454542', '35979753', '48164861', '59414352'],
  pluck: ['4.47.2.4', '5.59.3.5', '8.83.4.8', '4.45.9.4'],
  chords: ['0247', '2359', '1348', '0245'],
  melody: ['2-4-7-9-', '5-5-3---', '8-4-1-4-', '5-4-2-4-', '7-7-9-7-', '5-9---7-', '6-8-9-8-', '5---4---'],
  kick: ['X.x.X.x.'],
  snare: ['..X...X.'],
  hat: ['x.xxx.xx'],
  bassWave: 'triangle',
  bassVoice: 'pluck',
  melodyVoice: 'keys',
  drums: true,
  bed: true,
  swing: 0.25,
  space: { seconds: 1.8, wet: 0.24 },
  phase2: { lift: 3, kick: ['X.xxX.xx'], snare: ['x.X.x.XX'], hat: ['xxxxxxxx'] },
};
