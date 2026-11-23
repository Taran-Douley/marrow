import type { TrackSpec } from '@marrow/skeleton';

// Stage 7, Midnight Manor: a gothic waltz over the spooky bed (drone, far choir, owl and creak).
//
// The song is in bars of four beats (eight slots), and every press lands on an even slot. A waltz is three to a
// measure, so the waltz is laid across the bars: a measure is three slots, and six bars of eight slots hold exactly
// sixteen measures. The bass (oom), the plucked stabs (pah, pah), the timpani and the shaker all follow the
// three-slot grouping, so the ear hears a waltz while the presses, the beeps and the speech stay on the beat. The
// music never moves a press: only the notes of the track sit on odd slots. Swing is off.
//
// Key: B-flat harmonic minor, from Bb at 117 Hz. The scale, by step (semitones above the root):
//   0 Bb, 1 C, 2 Db, 3 Eb, 4 F, 5 Gb, 6 A (the raised seventh), 7 Bb (the octave).
// Six bars of chords, one every 8 slots: i, iv, V, i, VI, V = Bbm ('024'), Ebm ('350'), F ('461'), Bbm, Gb ('502'), F.
// The choir is the pad on the top of each chord; the pluck is a harpsichord-like stab on the second and third slot
// of each measure; the tune is a waltz melody on the keys, a long note then two shorter.
//
// The tempo comes from the stage's song and is not changed here. The band builds with the streak: bed and timpani
// first, then the bass and choir chords, then the harpsichord, then the tune.

const SCALE = [0, 2, 3, 5, 7, 8, 11, 12];
const MEASURES = 16;

/** The chord of each of the sixteen waltz measures: bar one has three measures, and so on. */
const CHORD_OF: readonly ('i' | 'iv' | 'V' | 'VI')[] = ['i', 'i', 'i', 'iv', 'iv', 'iv', 'V', 'V', 'i', 'i', 'i', 'VI', 'VI', 'VI', 'V', 'V'];
const ROOT = { i: '0', iv: '3', V: '4', VI: '5' } as const;
const STAB = { i: ['2', '4'], iv: ['5', '7'], V: ['6', '1'], VI: ['7', '2'] } as const;

/** Cut a string of 8-slot bars into bars. */
const bars = (s: string): string[] => Array.from({ length: s.length / 8 }, (_, i) => s.slice(i * 8, i * 8 + 8));

/** One note for each waltz measure: a long note on the first slot, held three slots (oom). */
const oom = (note: (m: number) => string): string[] => bars(Array.from({ length: MEASURES }, (_, m) => `${note(m)}--`).join(''));
/** Two stabs after the oom (pah, pah). */
const pah = (): string[] => bars(Array.from({ length: MEASURES }, (_, m) => `.${STAB[CHORD_OF[m]!][0]}${STAB[CHORD_OF[m]!][1]}`).join(''));
/** Hits laid across the measures: slots gives the three slots of measure m, a dot being no hit. */
const hitsOn = (slots: (m: number) => string): string[] => {
  const grid = Array.from({ length: MEASURES * 3 }, () => '.');
  for (let m = 0; m < MEASURES; m++) {
    const s = slots(m);
    for (let i = 0; i < 3; i++) if (s[i] !== '.') grid[m * 3 + i] = s[i]!;
  }
  return bars(grid.join(''));
};

/** The tune: sixteen measures of three slots, a waltz in the keys. */
const MEASURES_OF_TUNE = ['4--', '2-4', '7--', '5--', '3-5', '7--', '6--', '4-6', '7--', '4-2', '0--', '5--', '7-5', '2--', '6-4', '1--'];
const TUNE = MEASURES_OF_TUNE.join('');
/** The tune with each long note struck again on the last slot, for the boss. */
const TUNE_BOSS = MEASURES_OF_TUNE.map((m) => (m.endsWith('--') ? `${m[0]}-${m[0]}` : m)).join('');

export const MANOR_TRACK: TrackSpec = {
  name: 'Midnight Manor: gothic waltz in B-flat minor',
  rootHz: 117,
  scale: SCALE,
  bass: oom((m) => ROOT[CHORD_OF[m]!]),
  pluck: pah(),
  chords: ['024', '350', '461', '024', '502', '461'],
  melody: bars(TUNE),
  // Timpani on the first slot of every measure, strong on the first of every four; the shaker on the pah, pah.
  kick: hitsOn((m) => (m % 4 === 0 ? 'X..' : 'x..')),
  shaker: hitsOn(() => '.xx'),
  bassWave: 'sine',
  bassVoice: 'sub',
  melodyVoice: 'keys',
  drums: true,
  bed: true,
  space: { seconds: 2.6, wet: 0.3 },
  stems: { bass: 2, pluck: 4, melody: 6 },
};

/**
 * Count Vexar's own, heavier version: a semitone lower (A minor, 110 Hz), the bass doubled (oom, then a second push),
 * the timpani on every measure with a roll on the last, a fuller shaker. Every layer plays from the start. Halfway
 * down his health the key lifts two semitones and the timpani and shaker fill in; the timing does not change.
 */
export const COUNT_VEXAR_TRACK: TrackSpec = {
  name: 'Count Vexar: a heavier waltz',
  rootHz: 110,
  scale: SCALE,
  bass: bars(Array.from({ length: MEASURES }, (_, m) => `${ROOT[CHORD_OF[m]!]}-${ROOT[CHORD_OF[m]!]}`).join('')),
  pluck: pah(),
  chords: ['024', '350', '461', '024', '502', '461'],
  melody: bars(TUNE_BOSS),
  kick: hitsOn((m) => (m % 4 === 3 ? 'Xxx' : 'X..')),
  shaker: hitsOn(() => 'xxx'),
  hat: hitsOn((m) => (m % 2 === 0 ? '.x.' : '..x')),
  bassWave: 'sine',
  bassVoice: 'sub',
  melodyVoice: 'keys',
  drums: true,
  bed: true,
  space: { seconds: 2.8, wet: 0.32 },
  phase2: { lift: 2, kick: hitsOn(() => 'Xx.'), shaker: ['xxxxxxxx'], hat: ['xxxxxxxx'] },
};
