import type { TrackSpec } from '@marrow/skeleton';

// Stage 4, The Old Gate: a dark march over the spooky bed (drone, far choir, owl and creak).
//
// Key: G harmonic minor, from 98 Hz. The scale, by step: 0 G, 1 A, 2 Bb, 3 C, 4 D, 5 Eb, 6 F#, 7 G (the octave).
// Four bars, i - bVI - iv - V (Gm, Eb, Cm, D), then round again:
//   Gm = G Bb D ('024'), Eb = G Bb Eb ('025'), Cm = G C Eb ('035'), D = A D F# ('146').
// The low pad is the brass: the engine's saw pad through a low-pass, swelling in and holding each bar, so the chords
// sound like a section sitting on one chord. A sine sub marches in quarter notes (root, root, root, fifth); the kick is
// the timpani, strong on one and three; the snare rolls in short bursts on the eighths; the hat ticks like a side drum
// rim. The tune is a stiff fanfare in keys, and the pluck is a low harp on the eighths. A straight feel (no swing).
//
// The tempo comes from the stage's song and is not changed here. The band builds with the streak: bed, timpani and
// snare first, then the bass and brass pad, then the harp, then the fanfare.

export const GATE_TRACK: TrackSpec = {
  name: 'The Old Gate: a dark march in G minor',
  rootHz: 98,
  scale: [0, 2, 3, 5, 7, 8, 11, 12],
  bass: ['0-0-0-4-', '5-5-5-0-', '3-3-3-0-', '4-4-4-6-'],
  pluck: ['4.4.6.4.', '5.5.0.5.', '3.3.5.3.', '6.6.4.6.'],
  chords: ['024', '025', '035', '146'],
  melody: ['4-2-4-7-', '5-4-2-0-', '3-5-7-5-', '6-4-6---', '7-4-7-5-', '5-7-5-4-', '3-5-3-0-', '4-6-4---'],
  kick: ['X...X...', 'X...X.x.'],
  snare: ['x.xxX.xx', 'xxx.X.xx'],
  hat: ['x.x.x.x.'],
  bassWave: 'sine',
  bassVoice: 'sub',
  melodyVoice: 'keys',
  drums: true,
  bed: true,
  space: { seconds: 2.2, wet: 0.26 },
  stems: { bass: 2, pluck: 4, melody: 6 },
};

/**
 * The Gatekeeper's own, heavier version: a semitone lower (F-sharp, 92 Hz), the sub marching
 * in eighths, the timpani on every beat, a full snare roll and a driving rim tick. Every layer plays from the
 * start. Halfway down his health the key lifts two semitones and the timpani and snare double up; the timing does
 * not change.
 */
export const GATEKEEPER_TRACK: TrackSpec = {
  name: 'The Gatekeeper: a heavier march',
  rootHz: 92,
  scale: [0, 2, 3, 5, 7, 8, 11, 12],
  bass: ['00004040', '55550505', '33330303', '44446464'],
  pluck: ['4.4.6.4.', '5.5.0.5.', '3.3.5.3.', '6.6.4.6.'],
  chords: ['024', '025', '035', '146'],
  melody: ['4-4-7-4-', '5-5-2-0-', '3-5-7-5-', '6-4-6-7-', '7-7-4-7-', '5-7-5-4-', '3-5-3-0-', '4-6-4---'],
  kick: ['X.x.X.x.'],
  snare: ['x.xxX.xx', 'xxxxXxxx'],
  hat: ['x.x.x.x.'],
  bassWave: 'sine',
  bassVoice: 'sub',
  melodyVoice: 'keys',
  drums: true,
  bed: true,
  space: { seconds: 2.4, wet: 0.28 },
  phase2: { lift: 2, kick: ['XxxxXxxx'], snare: ['XxXxXxXx'], hat: ['xxxxxxxx'] },
};
