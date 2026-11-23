import type { TrackSpec } from '@marrow/skeleton';

// Stage 5, Haunted Mill: electro swing over the spooky bed (drone, far choir, owl and creak).
//
// Key: G minor, from G at 98 Hz. The scale, by step (semitones above the root):
//   0 G, 1 A, 2 Bb, 3 C, 4 D, 5 Eb, 6 F, 7 F# (the leading note), 8 G (the octave).
// Four bars: Gm7, Cm7, D7, Gm7. As steps: Gm7 = G Bb D F ('0246'), Cm7 = G Bb C Eb ('0235'),
// D7 = A C D F# ('1347').
// A plucked bass bounces root-fifth on the beat, a plucky stab lands on the off-beats like a muted horn, the keys
// play a quick clarinet-like tune, the kick is four on the floor (soft), claps land on two and four and the hat
// sits on the off-beats. A long swing (0.27 of a slot) puts every off-beat late. Presses stay on the even slots,
// which the swing never moves.
//
// The tempo comes from the stage's song and is not changed here. The band builds with the streak: bed, kick,
// claps and hat first, then the bass and chords, then the stabs, then the tune.

const SCALE = [0, 2, 3, 5, 7, 8, 10, 11, 12];

export const MILL_TRACK: TrackSpec = {
  name: 'Haunted Mill: electro swing in G minor',
  rootHz: 98,
  scale: SCALE,
  bass: ['0-4-0-2-', '3-0-3-5-', '4-1-4-7-', '0-4-0-6-'],
  pluck: ['.2.4.6.4', '.3.5.2.5', '.1.3.4.7', '.2.4.6.8'],
  chords: ['0246', '0235', '1347', '0246'],
  melody: ['.4-5-4-2', '0---2-4-', '3-5-8-5-', '3-2-0---', '4-7-4-3-', '2-0-2-3-', '5-4-3-2-', '1-2-0---'],
  kick: ['X.x.x.x.'],
  snare: ['..x...X.'],
  hat: ['.x.x.x.x'],
  bassWave: 'triangle',
  bassVoice: 'pluck',
  melodyVoice: 'keys',
  drums: true,
  bed: true,
  swing: 0.27,
  space: { seconds: 1.3, wet: 0.2 },
  stems: { bass: 2, pluck: 4, melody: 6 },
};

/**
 * The Spider Miller's own, heavier version: a semitone lower (F-sharp minor, 92 Hz), the bass in eighth notes,
 * a kick on every beat with a push, claps on two and four with a ghost clap, every off-beat on the hat. Every layer
 * plays from the start. Halfway down his health the key lifts three semitones and the kick, claps and hat double
 * up; the timing does not change.
 */
export const SPIDER_MILLER_TRACK: TrackSpec = {
  name: 'The Spider Miller: a heavier swing',
  rootHz: 92,
  scale: SCALE,
  bass: ['04040402', '30303035', '41414147', '04040406'],
  pluck: ['.2.4.6.4', '.3.5.2.5', '.1.3.4.7', '.2.4.6.8'],
  chords: ['0246', '0235', '1347', '0246'],
  melody: ['.4-5-4-2', '0-0-2-4-', '3-5-8-5-', '3-2-0-2-', '4-7-4-3-', '2-0-2-3-', '5-4-3-2-', '1-2-0---'],
  kick: ['X.x.X.x.', 'X.x.X.xx'],
  snare: ['..X...X.', '..X..xX.'],
  hat: ['.x.x.x.x'],
  bassWave: 'triangle',
  bassVoice: 'pluck',
  melodyVoice: 'keys',
  drums: true,
  bed: true,
  swing: 0.24,
  space: { seconds: 1.6, wet: 0.22 },
  phase2: { lift: 3, kick: ['X.xxX.xx'], snare: ['..X.x.XX'], hat: ['xxxxxxxx'] },
};
