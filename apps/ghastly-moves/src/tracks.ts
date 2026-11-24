import type { DoomSpec, TrackSpec } from '@marrow/skeleton';
import { BONE_WARDEN_TRACK, CRYPT_TRACK } from './music/crypt';
import { MOSS_WITCH_TRACK, WOODS_TRACK } from './music/woods';
import { GATEKEEPER_TRACK, GATE_TRACK } from './music/gate';
import { MILL_TRACK, SPIDER_MILLER_TRACK } from './music/mill';
import { HOLLOW_TRACK, HOLLOW_WRAITH_TRACK } from './music/hollow';
import { COUNT_VEXAR_TRACK, MANOR_TRACK } from './music/manor';

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
    // Indie folk in A minor over a spooky bed: a fingerpicked string, soft keys on the tune, a brushed
    // snare and a shaker. Four bars, i-VI-III-VII: Am, F, C, G (the G is open, with no third, because
    // the music must stay under the beeps and the third would be above them).
    name: 'Pumpkin Patch: fingerpicked folk in A minor',
    rootHz: 110,
    // A2 C3 D3 E3 F3 G3 A3: A minor pentatonic with the F that makes the VI chord.
    scale: [0, 3, 5, 7, 8, 10, 12],
    bass: ['0---3-0-', '4---1-4-', '1---5-1-', '5---2-5-'],
    pluck: ['03136313', '01416141', '13531353', '25652565'],
    chords: ['013', '014', '135', '256'],
    melody: ['3---5-3-', '4---3-1-', '3-5-6---', '5---3-2-', '6---5-3-', '6-4-3-1-', '3-5-3-1-', '2-5-6---'],
    kick: ['X...x...'],
    snare: ['..x...x.'],
    shaker: ['XxxxXxxx'],
    bassWave: 'sine',
    bassVoice: 'sub',
    melodyVoice: 'keys',
    drums: true,
    bed: true,
    swing: 0.1,
    space: { seconds: 2, wet: 0.28 },
    // The band builds with the streak: bed and drums, then bass and chords, then the pluck, then the tune.
    stems: { bass: 2, pluck: 4, melody: 6 },
  },
  CRYPT_TRACK,
  WOODS_TRACK,
  GATE_TRACK,
  MILL_TRACK,
  HOLLOW_TRACK,
  MANOR_TRACK,
];

/**
 * The Pumpkin King's own, heavier version of the Stage 1 theme: the same four chords a tone lower, an
 * eighth-note sub bass, a kick on every beat, a full backbeat and a driving shaker. Every layer plays
 * from the start (no stems). Halfway down his health the key lifts three semitones and the drums turn
 * busier: the timing does not change, so every press stays on its beat.
 */
const PUMPKIN_KING: TrackSpec = {
  name: 'The Pumpkin King: a heavier theme',
  rootHz: 98,
  scale: [0, 3, 5, 7, 8, 10, 12],
  bass: ['0-0-0-0-', '4-4-4-4-', '1-1-1-1-', '5-5-5-5-'],
  pluck: ['03136313', '01416141', '13531353', '25652565'],
  chords: ['013', '014', '135', '256'],
  melody: ['3-3-5-3-', '4-4-3-1-', '3-5-6-5-', '5-3-2---'],
  kick: ['X.x.X.x.'],
  snare: ['..X...X.'],
  shaker: ['XxxxXxxx'],
  hat: ['x.x.x.x.'],
  bassWave: 'sine',
  bassVoice: 'sub',
  melodyVoice: 'keys',
  drums: true,
  bed: true,
  swing: 0.05,
  space: { seconds: 2.5, wet: 0.3 },
  phase2: { lift: 3, kick: ['X.xxX.xx'], snare: ['..X.x.X.'], hat: ['xxxxxxxx'] },
};

/**
 * The doom layer of each boss: the stage theme stays as it is, and under it a darker layer builds. Every
 * boss differs from every other in its pad instrument, its drum, its toll, the interval of its cluster and
 * the rhythm of its drums (a test checks that any two differ in at least two of these).
 *
 * All pitches are low (the drone from 35 to 55 Hz, nothing above the 264 Hz ceiling), and the whole layer
 * is silent under a countdown cue, so it never sits on the beeps.
 */
export const DOOM: Readonly<Record<string, DoomSpec>> = {
  // The Pumpkin King: brass over a slow timpani every second bar, a grinding minor second, a bell.
  'The Pumpkin King': {
    droneHz: 55,
    swellBars: 12,
    pad: { voice: 'brass', hz: 55, notes: [0, 7] },
    drum: { voice: 'timpani', hz: 73, bars: ['X.......', '........'], phase2: ['X...x...', 'X.....x.'] },
    cluster: { hz: 110, notes: [0, 1], open: [7, 8] },
    bell: { voice: 'bell', hz: 98, every: 4, slot: 4 },
  },
  // The Bone Warden: pipe organ, a taiko on the first and fifth slot of every bar, a tritone, a gong.
  'The Bone Warden': {
    droneHz: 49,
    swellBars: 16,
    pad: { voice: 'organ', hz: 49, notes: [0, 6] },
    drum: { voice: 'taiko', hz: 98, bars: ['X...x...'], phase2: ['X.x.X.x.', 'X.x.X.xx'] },
    cluster: { hz: 98, notes: [0, 6], open: [12] },
    bell: { voice: 'gong', hz: 65, every: 3, slot: 2 },
  },
  // The Moss Witch: brass, a late timpani on the third slot, a major seventh that leans on its octave, a gong.
  'The Moss Witch': {
    droneHz: 43.65,
    swellBars: 10,
    pad: { voice: 'brass', hz: 58.27, notes: [0, 3] },
    drum: { voice: 'timpani', hz: 87, bars: ['..X.....'], phase2: ['..X...x.', '..X.x.X.'] },
    cluster: { hz: 117, notes: [0, 11], open: [12] },
    bell: { voice: 'gong', hz: 78, every: 5, slot: 6 },
  },
  // The Gatekeeper: organ, a marching taiko, a tritone stacked on a fifth, a bell.
  'The Gatekeeper': {
    droneHz: 36.7,
    swellBars: 8,
    pad: { voice: 'organ', hz: 73.4, notes: [0, 7] },
    drum: { voice: 'taiko', hz: 110, bars: ['X.x.X...'], phase2: ['X.x.X.x.', 'X.x.XxXx'] },
    cluster: { hz: 98, notes: [0, 6, 7], open: [13] },
    bell: { voice: 'bell', hz: 82, every: 2, slot: 0 },
  },
  // The Spider Miller: brass, a quick timpani pair on the downbeat, a minor ninth, a bell on the offbeat.
  'The Spider Miller': {
    droneHz: 38.9,
    swellBars: 14,
    pad: { voice: 'brass', hz: 77.8, notes: [0, 6] },
    drum: { voice: 'timpani', hz: 92, bars: ['Xx......', '........'], phase2: ['XxXx....', 'Xx..Xx..'] },
    cluster: { hz: 92, notes: [0, 13], open: [6] },
    bell: { voice: 'bell', hz: 69, every: 6, slot: 5 },
  },
  // The Hollow Wraith: organ, a single deep taiko late in the bar, a stacked tritone and octave, a gong.
  'The Hollow Wraith': {
    droneHz: 43.65,
    swellBars: 20,
    pad: { voice: 'organ', hz: 43.65, notes: [0, 5] },
    drum: { voice: 'taiko', hz: 87, bars: ['....X...', '........'], phase2: ['....X.x.', 'x...X...'] },
    cluster: { hz: 87, notes: [0, 6, 12], open: [13, 18] },
    bell: { voice: 'gong', hz: 58, every: 8, slot: 3 },
  },
  // Count Vexar: brass, a timpani on the third slot of a waltz bar, a three-note chromatic cluster, a bell.
  'Count Vexar': {
    droneHz: 41.2,
    swellBars: 18,
    pad: { voice: 'brass', hz: 82.4, notes: [0, 3, 6] },
    drum: { voice: 'timpani', hz: 110, bars: ['x..X..x.'], phase2: ['X..X..X.', 'X.xX..XX'] },
    cluster: { hz: 110, notes: [0, 1, 2], open: [12, 13] },
    bell: { voice: 'bell', hz: 117, every: 7, slot: 1 },
  },
};

const bossCache = new Map<TrackSpec, TrackSpec>();

/** A boss's version of a tune: a little lower, a driving bass and drums, and the boss's doom layer. */
export function bossTrack(spec: TrackSpec): TrackSpec {
  const known = bossCache.get(spec);
  if (known) return known;
  const made = withDoom(bossTrackWithoutDoom(spec));
  bossCache.set(spec, made);
  return made;
}

function withDoom(track: TrackSpec): TrackSpec {
  const name = Object.keys(DOOM).find((n) => track.name.startsWith(n));
  const doom = name ? DOOM[name] : undefined;
  return doom ? { ...track, doom } : track;
}

function bossTrackWithoutDoom(spec: TrackSpec): TrackSpec {
  if (spec === TRACKS[0]) return PUMPKIN_KING;
  if (spec === CRYPT_TRACK) return BONE_WARDEN_TRACK;
  if (spec === WOODS_TRACK) return MOSS_WITCH_TRACK;
  if (spec === GATE_TRACK) return GATEKEEPER_TRACK;
  if (spec === MILL_TRACK) return SPIDER_MILLER_TRACK;
  if (spec === HOLLOW_TRACK) return HOLLOW_WRAITH_TRACK;
  if (spec === MANOR_TRACK) return COUNT_VEXAR_TRACK;
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
