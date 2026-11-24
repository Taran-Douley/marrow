import type { Instrument, OutputCommand, SoundShape, Wave } from '../types';

/**
 * A background track, written as plain patterns. A bar is 8 slots. A slot is half a countdown beat by
 * default, so a bar is four beats and the music is in time with the beeps (set `slotSeconds` for a
 * free tempo, as a game with no countdown would).
 *
 * In `bass` and `melody`, a digit is a step of `scale`, a dash holds the note before it, a dot is a rest.
 * In `kick` and `hat`, `x` is a hit and `X` a strong one.
 *
 * The track can never hide a cue:
 *  - While a cue can sound (a countdown, a choice being read), every layer drops to a small, fixed
 *    share, so the beeps stay at least 6 dB over everything (proof property 13).
 *  - Every note sits below the lowest cue (proof property 14), so the beeps keep their own pitch range.
 *  - When the game does not say when its cues are, the track stays at the small share all the time.
 * In between cues it plays out at full strength, so it sets the mood.
 */
export interface TrackSpec {
  name: string;
  /** The key, in Hz. From 60 to 132, so the melody stays under the beeps. */
  rootHz: number;
  /** Semitones above the root for each digit. Up to 12. */
  scale: readonly number[];
  /** Bars of 8 slots, cycled. The bass sounds an octave below the root. */
  bass: readonly string[];
  /** Bars of 8 slots, cycled, from the root up. */
  melody: readonly string[];
  /** Drum hits. */
  kick: readonly string[];
  /** A soft high tick, for drive. It joins in as danger rises. */
  hat?: readonly string[];
  bassWave?: Wave;
  melodyWave?: Wave;
  /** Length of one slot, in running seconds. Default: half the countdown beat. */
  slotSeconds?: number;

  // ---- Instruments and harmony. All optional: a track without them plays exactly as before. ----

  /** The instrument for the bass and the melody, where the web player has one. Default: the plain wave. */
  bassVoice?: Instrument;
  melodyVoice?: Instrument;
  /** A plucked string, in bars of 8 slots like the melody: a fingerpicked arpeggio under the tune. */
  pluck?: readonly string[];
  /**
   * The chord of each bar, cycled, as 2 to 4 digits that are steps of `scale` (so '035' stacks three
   * notes). Played as a warm pad that swells in and holds for the bar. Also feeds the choir of the bed.
   */
  chords?: readonly string[];
  /** Play the kick, snare, hat and shaker with the web player's synthesised drum voices. */
  drums?: boolean;
  /** A brushed snare and a shaker, as hits like the kick. */
  snare?: readonly string[];
  shaker?: readonly string[];
  /** Delay every second slot by this share of a slot (0 to 0.3), for a lilt. Default 0. */
  swing?: number;
  /** How the track rings: the room's length in seconds and how much of the music goes to it (0 to 0.5). */
  space?: { seconds: number; wet: number };
  /**
   * The spooky bed under the tune: a slow drone, a faint high choir on the chord, and now and then a
   * far-off owl or creak. The far-off sounds only play where no cue can sound, and only between beats.
   */
  bed?: boolean;
  /**
   * The whole groove plays from the first bar: bed, drums, bass, chords and the theme melody. With a
   * streak the band adds to it: the bass and chords come up to full at `bass`, the melody to full at
   * `melody`, and the plucked string joins at `pluck`. Before that the bass, chords and melody play at
   * TRACK_BASE_SHARE of their level. Without `stems` every layer plays in full always.
   */
  stems?: { bass?: number; pluck?: number; melody?: number };
  /**
   * The doom layer of a boss fight: a sub drone that swells, a low brass or organ pad through a closing
   * low-pass, slow war drums on the downbeats, a dissonant choir cluster that creeps in, a bell toll every
   * few bars, and (in phase 2) a riser. It never plays under a cue. Phase 2 makes it heavier.
   */
  doom?: DoomSpec;
  /**
   * A second phase (a boss halfway down): the same grid and timing, but the key lifts by `lift`
   * semitones, and any layer given here replaces the first phase's.
   */
  phase2?: { lift?: number; kick?: readonly string[]; snare?: readonly string[]; shaker?: readonly string[]; hat?: readonly string[] };
}

export interface DoomSpec {
  /** The sub drone, 35 to 55 Hz. It swells and fades over `swellBars` bars. */
  droneHz: number;
  /** Bars for one slow swell of the drone and the cluster, 4 to 32. */
  swellBars: number;
  /** A low pad of detuned saws (brass) or stacked pipes (organ) through a low-pass that closes over each bar. */
  pad: { voice: 'brass' | 'organ'; hz: number; notes: readonly number[] };
  /** War drums, in bars of 8 slots like the kick. Phase 2 plays `phase2` (more hits). */
  drum: { voice: 'timpani' | 'taiko'; hz: number; bars: readonly string[]; phase2: readonly string[] };
  /** A cluster of voices a few semitones apart: a minor second is 1, a tritone 6. Phase 2 adds the `open` notes. */
  cluster: { hz: number; notes: readonly number[]; open: readonly number[] };
  /** A low toll every `every` bars, on slot `slot` of the bar. */
  bell: { voice: 'bell' | 'gong'; hz: number; every: number; slot: number };
}

export const TRACK_SLOTS = 8;
export const TRACK_MIN_ROOT_HZ = 60;
export const TRACK_MAX_ROOT_HZ = 132;
/** The top of the music, in Hz: the lowest beep is 294 Hz and every note stays under 90% of that. */
export const TRACK_CEILING_HZ = 264;

/**
 * The share of a beep's loudness each layer may use. `ducked` is used whenever a cue can sound; with
 * every other bed at its own share the total stays under half a beep (6 dB). `open` is used in between.
 */
export const TRACK_LEVELS = {
  // Louder than before (1.5 times), so the music is plainly heard between the countdowns. The web player's music
  // bus adds 1.6 times and the default music volume is 0.85, so the ducked shares below are halved: under a
  // countdown the music is no louder than it was, and the 6 dB rule over the beeps holds at any music volume.
  open: {
    bass: 0.3,
    melody: 0.26,
    kick: 0.33,
    hat: 0.1,
    pluck: 0.22,
    chord: 0.075,
    snare: 0.18,
    shaker: 0.075,
    drone: 0.09,
    choir: 0.05,
    far: 0.07,
    // The doom layer of a boss.
    doomDrone: 0.12,
    doomPad: 0.09,
    doomDrum: 0.42,
    doomCluster: 0.07,
    doomBell: 0.2,
    doomRiser: 0.16,
  },
  // Under a cue the new layers stay inside what is left of the 6 dB rule (see the test that adds them up).
  // The doom layer is silent under a cue, so nothing of it ever sits on a countdown.
  ducked: {
    bass: 0.02,
    melody: 0,
    kick: 0.02,
    hat: 0.01,
    pluck: 0,
    chord: 0.002,
    snare: 0.006,
    shaker: 0.002,
    drone: 0.0015,
    choir: 0,
    far: 0,
    doomDrone: 0.001,
    doomPad: 0,
    doomDrum: 0,
    doomCluster: 0,
    doomBell: 0,
    doomRiser: 0,
  },
} as const;
/** The share of a layer that plays before the streak builds the band (the layers are all there from the first bar). */
export const TRACK_BASE_SHARE = 0.78;
/** The quiet share, kept under its old name. */
export const TRACK_SHARE = TRACK_LEVELS.ducked;

const NOTE = /^[0-9.-]{8}$/;
const HITS = /^[.xX]{8}$/;

/** Check a track and say, in plain words, what is wrong. Called when the kit is made. */
export function validateTrack(spec: TrackSpec): void {
  const where = `Track '${spec.name}'`;
  if (!(spec.rootHz >= TRACK_MIN_ROOT_HZ && spec.rootHz <= TRACK_MAX_ROOT_HZ)) {
    throw new Error(
      `${where}: rootHz is ${spec.rootHz}. It must be from ${TRACK_MIN_ROOT_HZ} to ${TRACK_MAX_ROOT_HZ} so the music stays under the beeps.`,
    );
  }
  if (spec.scale.length === 0 || spec.scale.some((s) => !(s >= 0 && s <= 12))) {
    throw new Error(`${where}: scale needs steps from 0 to 12 semitones.`);
  }
  if (spec.slotSeconds !== undefined && !(spec.slotSeconds >= 0.1 && spec.slotSeconds <= 2)) {
    throw new Error(`${where}: slotSeconds must be from 0.1 to 2.`);
  }
  if (spec.swing !== undefined && !(spec.swing >= 0 && spec.swing <= 0.3)) throw new Error(`${where}: swing must be from 0 to 0.3.`);
  if (spec.space && !(spec.space.seconds >= 0.25 && spec.space.seconds <= 4 && spec.space.wet >= 0 && spec.space.wet <= 0.5)) {
    throw new Error(`${where}: space needs a room of 0.25 to 4 seconds and a wet share from 0 to 0.5.`);
  }
  const lift = spec.phase2?.lift ?? 0;
  if (!Number.isInteger(lift) || lift < 0 || lift > 7) throw new Error(`${where}: phase2 lift must be a whole number of semitones from 0 to 7.`);
  if (trackCeilingHz(spec) > TRACK_CEILING_HZ + 1e-9) {
    throw new Error(`${where}: with its highest note and its lift the track reaches ${Math.round(trackCeilingHz(spec))} Hz. It must stay under ${TRACK_CEILING_HZ} Hz so the beeps keep their own pitch range.`);
  }
  if (spec.doom) validateDoom(spec.doom, where);
  for (const [name, need] of Object.entries(spec.stems ?? {})) {
    if (!(typeof need === 'number' && need >= 0 && need <= 20)) throw new Error(`${where}: stems.${name} must be a streak from 0 to 20.`);
  }
  for (const chord of spec.chords ?? []) {
    if (!/^[0-9]{2,4}$/.test(chord)) throw new Error(`${where}: a chord is 2 to 4 digits that are steps of the scale, not '${chord}'.`);
    for (const ch of chord) {
      if (Number(ch) >= spec.scale.length) throw new Error(`${where}: chord '${chord}' uses step ${ch}, but the scale has only ${spec.scale.length} steps.`);
    }
  }
  const layers: [string, readonly string[] | undefined, RegExp][] = [
    ['bass', spec.bass, NOTE],
    ['melody', spec.melody, NOTE],
    ['kick', spec.kick, HITS],
    ['hat', spec.hat, HITS],
    ['pluck', spec.pluck, NOTE],
    ['snare', spec.snare, HITS],
    ['shaker', spec.shaker, HITS],
    ['phase2 kick', spec.phase2?.kick, HITS],
    ['phase2 snare', spec.phase2?.snare, HITS],
    ['phase2 shaker', spec.phase2?.shaker, HITS],
    ['phase2 hat', spec.phase2?.hat, HITS],
  ];
  for (const [layer, bars, shape] of layers) {
    if (bars === undefined && layer !== 'bass' && layer !== 'melody' && layer !== 'kick') continue;
    if (!bars || bars.length === 0) throw new Error(`${where}: ${layer} needs at least one bar.`);
    for (const bar of bars) {
      if (!shape.test(bar)) {
        throw new Error(
          shape === NOTE
            ? `${where}: a ${layer} bar must be 8 characters of digits, dashes and dots, not '${bar}'.`
            : `${where}: a ${layer} bar must be 8 characters of x, X and dots, not '${bar}'.`,
        );
      }
      if (shape !== NOTE) continue;
      for (const ch of bar) {
        if (ch >= '0' && ch <= '9' && Number(ch) >= spec.scale.length) {
          throw new Error(`${where}: ${layer} uses step ${ch}, but the scale has only ${spec.scale.length} steps.`);
        }
      }
    }
  }
}

/** The highest doom note, in Hz (the open cluster included). */
const doomTopHz = (d: DoomSpec): number =>
  Math.max(
    d.droneHz,
    d.pad.hz * 2 ** (Math.max(...d.pad.notes) / 12),
    d.drum.hz,
    d.cluster.hz * 2 ** (Math.max(...d.cluster.notes, ...d.cluster.open) / 12),
    d.bell.hz,
  );

/** The highest pitch the track can play, in Hz. The proof checks it against the beeps. */
export const trackCeilingHz = (spec: TrackSpec): number =>
  Math.max(spec.rootHz * 2 ** ((Math.max(...spec.scale) + (spec.phase2?.lift ?? 0)) / 12), spec.doom ? doomTopHz(spec.doom) : 0);

function validateDoom(d: DoomSpec, where: string): void {
  if (!(d.droneHz >= 35 && d.droneHz <= 55)) throw new Error(`${where}: the doom drone must be from 35 to 55 Hz, not ${d.droneHz}.`);
  if (!(Number.isInteger(d.swellBars) && d.swellBars >= 4 && d.swellBars <= 32)) throw new Error(`${where}: doom swellBars must be a whole number from 4 to 32.`);
  if (!(d.bell.every >= 1 && d.bell.every <= 16 && Number.isInteger(d.bell.every) && d.bell.slot >= 0 && d.bell.slot < TRACK_SLOTS && Number.isInteger(d.bell.slot))) {
    throw new Error(`${where}: the doom bell needs a whole number of bars from 1 to 16 and a slot from 0 to 7.`);
  }
  if (d.pad.notes.length === 0 || d.cluster.notes.length < 2) throw new Error(`${where}: the doom pad needs a note and the cluster at least two.`);
  for (const bars of [d.drum.bars, d.drum.phase2]) {
    if (bars.length === 0 || bars.some((b) => !HITS.test(b))) throw new Error(`${where}: doom drum bars must be 8 characters of x, X and dots.`);
  }
}

/** The shape of a slow swell over `bars` bars: 0 at the start, 1 in the middle, 0 at the end, as a triangle. */
const swell = (bar: number, bars: number): number => {
  const p = (((bar % bars) + bars) % bars) / bars;
  return 1 - Math.abs(2 * p - 1);
};

export interface TrackWindow {
  /** The stretch of level time to fill, in running seconds: [from, to). */
  from: number;
  to: number;
  /** How near the danger is, 0 to 1. */
  tension: number;
  /** The player's cue volume times their music volume. */
  level: number;
  mono: boolean;
  /** Slot length when the track sets none. */
  slot: number;
  /** Where the grid starts, in running seconds, so the music lands on the same pulse as the presses. */
  offset?: number;
  /**
   * When cues can sound, as [from, to] pairs in running seconds. Notes that touch one are quiet.
   * Leave out when the game does not know: then every note is quiet.
   */
  quiet?: readonly (readonly [number, number])[] | undefined;
  /**
   * How much of the band plays, 0 to 1, for the part of the song: under 0.3 is a breakdown (melody and
   * bass, no drums), under 0.6 adds the kick, from 0.6 the hats too, and from 0.9 (the drop) the kick
   * plays every bar. Default 1. It never makes a note louder than its share, so the proofs still hold.
   */
  energy?: number;
  /** The player's streak, for a track with `stems`: the band builds as it grows. Leave out to play every layer. */
  streak?: number;
  /** 1 for the second phase of a track that has `phase2` (the key lifts, the drums change; the timing does not). */
  phase?: number;
  /** Bars since phase 2 began (0 for the first), so a boss track can riser into it. Leave out when unknown. */
  phaseBar?: number;
}

/** Song energy at which each layer joins. */
export const ENERGY = { kick: 0.3, hat: 0.6, drop: 0.9 } as const;

/** A fixed pseudo-random number from 0 to 1 for a bar, so far-off sounds fall in the same places every play. */
const farHash = (i: number, salt: number): number => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const pick = (bars: readonly string[], bar: number): string => bars[((bar % bars.length) + bars.length) % bars.length]!;

/** How many slots a note at `slot` lasts: itself and every dash after it in the bar. */
function lengthOf(pattern: string, slot: number): number {
  let n = 1;
  while (slot + n < TRACK_SLOTS && pattern[slot + n] === '-') n++;
  return n;
}

/** The notes of a track for one stretch of time, on one steady grid, so stretches join up seamlessly. */
export function trackNotes(spec: TrackSpec, w: TrackWindow): OutputCommand[] {
  const slot = spec.slotSeconds ?? w.slot;
  const out: OutputCommand[] = [];
  const quietAt = (t: number, end: number): boolean => w.quiet === undefined || w.quiet.some(([a, b]) => end > a && t < b);
  const room: Partial<SoundShape> = spec.space ? { echo: spec.space.wet, echoSeconds: spec.space.seconds } : {};
  const push = (at: number, hz: number, wave: Wave, gain: number, pan: number, shape: SoundShape): void => {
    if (gain <= 0) return;
    out.push({
      channel: 'sound',
      senses: ['hearing'],
      at,
      role: 'music',
      hz,
      wave,
      gain,
      pan: w.mono ? 0 : pan,
      shape,
    });
  };
  const phase2 = w.phase === 1 ? spec.phase2 : undefined;
  // The second phase lifts the key. The grid, and so the timing, stays exactly as it was.
  const root = spec.rootHz * 2 ** ((phase2?.lift ?? 0) / 12);
  const hz = (step: string, octave: number): number => root * 2 ** (spec.scale[Number(step)]! / 12) * octave;
  const energy = Math.min(1, Math.max(0, w.energy ?? 1));
  // The drop only drives harder when a song says so; without a song the track plays as it always has.
  const drop = w.energy !== undefined && energy >= ENERGY.drop;
  // In a breakdown there is no danger to step aside for, so the melody sings out.
  const melodyFade = energy < ENERGY.kick ? 1 : 1 - 0.8 * Math.min(1, Math.max(0, w.tension));
  // The band builds with the streak, when the track says how. Without a streak (a proof, a menu) every layer plays.
  const stems = spec.stems;
  const joined = (need: number | undefined, fallback: number): boolean => stems === undefined || w.streak === undefined || w.streak >= (need ?? fallback);
  // The groove is whole from the first bar: bass, chords and the theme melody are always there, at a share
  // of their level that the streak brings up to full. Only the plucked string waits for the streak.
  const bassIn = true;
  const bodyShare = joined(stems?.bass, 2) ? 1 : TRACK_BASE_SHARE;
  const pluckIn = joined(stems?.pluck, 4);
  const melodyIn = true;
  const leadShare = joined(stems?.melody, 6) ? 1 : TRACK_BASE_SHARE;
  const kickBars = phase2?.kick ?? spec.kick;
  const hatBars = phase2?.hat ?? spec.hat;
  const snareBars = phase2?.snare ?? spec.snare;
  const shakerBars = phase2?.shaker ?? spec.shaker;
  const swing = spec.swing ?? 0;
  const voiced = (voice: Instrument | undefined): Partial<SoundShape> => (voice ? { voice } : {});
  const drums = (voice: Instrument): Partial<SoundShape> => (spec.drums ? { voice } : {});

  const offset = w.offset ?? 0;
  for (let k = Math.ceil((w.from - offset) / slot - 1e-9); offset + k * slot < w.to - 1e-9; k++) {
    const bar = Math.floor(k / TRACK_SLOTS);
    const s = ((k % TRACK_SLOTS) + TRACK_SLOTS) % TRACK_SLOTS;
    // A lilt: every second slot comes a little late. Still on one fixed grid, so stretches join up.
    const t = offset + k * slot + (s % 2 === 1 ? swing * slot : 0);
    const level = (open: number, ducked: number, end: number): number => (quietAt(t, end) ? ducked : open) * w.level;

    if (bassIn) {
      const bassBar = pick(spec.bass, bar);
      const b = bassBar[s]!;
      if (b >= '0' && b <= '9') {
        const span = lengthOf(bassBar, s) * slot * 0.92; // a note never runs into the next, so a layer never doubles up
        push(t, hz(b, 0.5), spec.bassWave ?? 'square', level(TRACK_LEVELS.open.bass, TRACK_LEVELS.ducked.bass, t + span) * bodyShare, 0, { filterHz: 650, span, ...voiced(spec.bassVoice) });
      }
    }

    if (w.tension < 0.75 && melodyIn) {
      const melodyBar = pick(spec.melody, bar);
      const m = melodyBar[s]!;
      if (m >= '0' && m <= '9') {
        const span = lengthOf(melodyBar, s) * slot * 0.92;
        push(
          t,
          hz(m, 1),
          spec.melodyWave ?? 'square',
          level(TRACK_LEVELS.open.melody, TRACK_LEVELS.ducked.melody, t + span) * melodyFade * leadShare,
          s % 2 === 0 ? -0.25 : 0.25,
          { filterHz: 1800, filterTo: 1200, span, ...voiced(spec.melodyVoice), ...(spec.melodyVoice ? room : {}) },
        );
      }
    }

    // The plucked string: an arpeggio over the chords. Each string rings on for three slots at least.
    if (spec.pluck && pluckIn && w.tension < 0.85) {
      const pluckBar = pick(spec.pluck, bar);
      const p = pluckBar[s]!;
      if (p >= '0' && p <= '9') {
        const span = Math.max(3, lengthOf(pluckBar, s)) * slot * 0.92;
        push(t, hz(p, 1), 'triangle', level(TRACK_LEVELS.open.pluck, TRACK_LEVELS.ducked.pluck, t + span) * melodyFade, s % 2 === 0 ? 0.2 : -0.2, {
          voice: 'pluck',
          filterHz: 2400,
          span,
          ...room,
        });
      }
    }

    // Chords and the bed change once a bar. Each is held a quarter longer, so the next swells in as this fades out.
    if (s === 0) {
      const span = TRACK_SLOTS * slot * 1.25;
      const chord = spec.chords ? pick(spec.chords, bar) : undefined;
      if (chord && bassIn) {
        const g = level(TRACK_LEVELS.open.chord, TRACK_LEVELS.ducked.chord, t + span) * bodyShare;
        [...chord].forEach((d, i) => push(t, hz(d, 1), 'triangle', g, (i - (chord.length - 1) / 2) * 0.25, { voice: 'pad', filterHz: 900, span, ...room }));
      }
      if (spec.bed) {
        const drone = level(TRACK_LEVELS.open.drone, TRACK_LEVELS.ducked.drone, t + span);
        push(t, root * 0.5, 'sine', drone, 0, { voice: 'sub', filterHz: 200, span });
        if (root * 1.5 <= TRACK_CEILING_HZ) push(t, root * 1.5, 'triangle', drone, 0, { voice: 'pad', filterHz: 420, span, wobbleHz: 0.18, wobble: 0.012, ...room });
        // A faint high choir on the top note of the chord. It steps right out under a cue.
        if (w.tension < 0.75) {
          const top = chord ? chord.split('').sort().at(-1)! : '2';
          push(t, hz(top, 1), 'sine', level(TRACK_LEVELS.open.choir, TRACK_LEVELS.ducked.choir, t + span), 0.3 * (bar % 2 === 0 ? 1 : -1), { voice: 'choir', span, wobbleHz: 4.5, wobble: 0.006, ...room });
        }
      }
    }

    // Far-off sounds: an owl, a creak. Only on a half-beat, and only where no cue can sound, so none ever lands on a countdown beat.
    if (spec.bed && s % 2 === 1 && s <= 5 && w.tension < 0.6 && s === 3 + 2 * Math.floor(farHash(bar, 2) * 2)) {
      const roll = farHash(bar, 1);
      const far = (at: number, hzNow: number, span: number, shape: SoundShape): void => {
        if (quietAt(at, at + span)) return;
        push(at, hzNow, 'sine', TRACK_LEVELS.open.far * w.level, farHash(bar, 3) * 1.2 - 0.6, { span, echo: 0.5, echoSeconds: 2.5, ...shape });
      };
      if (roll < 0.16) {
        const top = Math.min(root * 2, TRACK_CEILING_HZ);
        far(t, top, slot * 2.2, { voice: 'owl', filterHz: 900 });
        far(t + slot * 2, top * 0.84, slot * 2.6, { voice: 'owl', filterHz: 800 });
      } else if (roll < 0.24) {
        far(t, 0, slot * 3, { voice: 'creak', noise: true, filterHz: 500, filterTo: 1400 });
      }
    }

    // The doom layer of a boss. Every part is silent under a cue (its ducked share is nil), so none of it
    // sits on a countdown, and every part is a note on the grid, so no press moves.
    const doom = spec.doom;
    if (doom) {
      const heavy = w.phase === 1 ? 1.35 : 1;
      const sw = swell(bar, doom.swellBars);
      if (s === 0) {
        const span = TRACK_SLOTS * slot * 1.25;
        // The sub drone swells slowly over `swellBars` bars. A note an octave up carries it on small speakers.
        const drone = level(TRACK_LEVELS.open.doomDrone, TRACK_LEVELS.ducked.doomDrone, t + span) * (0.45 + 0.55 * sw) * heavy;
        push(t, doom.droneHz, 'sine', drone, 0, { voice: 'sub', filterHz: 160, span });
        push(t, doom.droneHz * 2, 'sine', drone * 0.45, 0, { voice: 'sub', filterHz: 240, span });
        // The low pad: detuned saws or pipes, through a low-pass that closes over the bar.
        const padGain = level(TRACK_LEVELS.open.doomPad, TRACK_LEVELS.ducked.doomPad, t + span) * (0.5 + 0.5 * sw) * heavy;
        doom.pad.notes.forEach((n, i) =>
          push(t, doom.pad.hz * 2 ** (n / 12), 'triangle', padGain, (i % 2 === 0 ? -1 : 1) * 0.3, { voice: doom.pad.voice, filterHz: 950, filterTo: 170, span, ...room }),
        );
        // The cluster creeps in as the swell rises: a few voices a semitone or a tritone apart. Phase 2 opens it wider.
        const creep = Math.min(1, Math.max(0, (sw - 0.25) / 0.75));
        const cluster = level(TRACK_LEVELS.open.doomCluster, TRACK_LEVELS.ducked.doomCluster, t + span) * creep * heavy;
        const voices = w.phase === 1 ? [...doom.cluster.notes, ...doom.cluster.open] : doom.cluster.notes;
        voices.forEach((n, i) => push(t, doom.cluster.hz * 2 ** (n / 12), 'sine', cluster, ((i % 3) - 1) * 0.35, { voice: 'choir', span, wobbleHz: 3.2, wobble: 0.012, ...room }));
      }
      // War drums on the downbeats, slow; more of them in phase 2.
      const drumHit = pick(w.phase === 1 ? doom.drum.phase2 : doom.drum.bars, bar)[s]!;
      if (drumHit !== '.') {
        const span = slot * (doom.drum.voice === 'timpani' ? 4 : 2);
        push(t, doom.drum.hz, 'sine', level(TRACK_LEVELS.open.doomDrum, TRACK_LEVELS.ducked.doomDrum, t + span) * (drumHit === 'X' ? 1 : 0.7) * heavy, 0, {
          voice: doom.drum.voice,
          hzTo: doom.drum.hz * 0.72,
          filterHz: doom.drum.voice === 'timpani' ? 420 : 900,
          span,
          ...room,
        });
      }
      // A low toll every few bars (twice as often in phase 2). The gong swells in, the bell strikes.
      const every = w.phase === 1 ? Math.max(1, Math.ceil(doom.bell.every / 2)) : doom.bell.every;
      const impact = w.phase === 1 && w.phaseBar === 1 && s === 0;
      if ((s === doom.bell.slot && bar % every === 0 && bar > 0) || impact) {
        const span = slot * 9;
        push(t, doom.bell.hz, 'sine', level(TRACK_LEVELS.open.doomBell, TRACK_LEVELS.ducked.doomBell, t + span) * heavy * (impact ? 1.3 : 1), 0, {
          voice: doom.bell.voice,
          filterHz: 1300,
          span,
          echo: 0.4,
          echoSeconds: 2.8,
        });
      }
      // A riser into phase 2: the first bar after the boss is halved is four climbing sweeps of noise.
      if (w.phase === 1 && w.phaseBar === 0 && s % 2 === 0) {
        const seg = s / 2;
        const span = slot * 2;
        push(t, 0, 'sine', level(TRACK_LEVELS.open.doomRiser, TRACK_LEVELS.ducked.doomRiser, t + span) * (0.4 + 0.2 * seg), 0, {
          noise: true,
          voice: 'riser',
          filterHz: 180 * 2 ** (seg * 1.1),
          filterTo: 180 * 2 ** ((seg + 1) * 1.1),
          span,
        });
      }
    }

    const kickBar = pick(kickBars, bar);
    const kc = kickBar[s]!;
    if (kc !== '.' && energy >= ENERGY.kick && (w.tension > 0.2 || bar % 2 === 0 || drop)) {
      const strong = kc === 'X' ? 1 : 0.75;
      const span = Math.min(0.16, slot * 0.8);
      const quiet = quietAt(t, t + span);
      push(t, 150, 'sine', level(TRACK_LEVELS.open.kick, TRACK_LEVELS.ducked.kick, t + span) * strong, 0, { hzTo: 48, span, ...drums('kick') });
      // A short click on top, so the kick is heard on small speakers that cannot play its low note.
      if (!quiet) push(t, 0, 'sine', TRACK_LEVELS.open.hat * w.level * strong, 0, { noise: true, filterHz: 2500, filterTo: 900, span: 0.02 });
    }

    // A brushed snare on the backbeat and a shaker between: soft noise, never a crack.
    if (snareBars && energy >= ENERGY.kick) {
      const hit = pick(snareBars, bar)[s]!;
      if (hit !== '.') {
        const span = Math.min(0.2, slot * 0.9);
        push(t, 0, 'sine', level(TRACK_LEVELS.open.snare, TRACK_LEVELS.ducked.snare, t + span) * (hit === 'X' ? 1 : 0.7), 0.1, { noise: true, filterHz: 3800, filterTo: 1800, span, ...drums('snare') });
      }
    }
    if (shakerBars && energy >= ENERGY.kick) {
      const hit = pick(shakerBars, bar)[s]!;
      if (hit !== '.') {
        const span = 0.06;
        push(t, 0, 'sine', level(TRACK_LEVELS.open.shaker, TRACK_LEVELS.ducked.shaker, t + span) * (hit === 'X' ? 1 : 0.65), s % 2 === 0 ? -0.35 : 0.35, { noise: true, filterHz: 6500, filterTo: 8500, span, ...drums('shaker') });
      }
    }

    if (hatBars && energy >= ENERGY.hat && (w.tension >= 0.35 || drop)) {
      const hc = pick(hatBars, bar)[s]!;
      if (hc !== '.') {
        const span = 0.04;
        push(t, 0, 'sine', level(TRACK_LEVELS.open.hat, TRACK_LEVELS.ducked.hat, t + span) * (hc === 'X' ? 1 : 0.7), s % 2 === 0 ? 0.3 : -0.3, {
          noise: true,
          filterHz: 7000,
          filterTo: 9000,
          span,
          ...drums('hat'),
        });
      }
    }
  }
  return out;
}

/**
 * One bar of the track, starting at `at`, with a 2 s bar and no cue times known: every note quiet.
 * Kept for older callers; the kit itself uses `trackNotes`.
 */
export function trackBar(spec: TrackSpec, bar: number, tension: number, level: number, at: number, mono: boolean): OutputCommand[] {
  void bar;
  return trackNotes(spec, { from: at, to: at + 2, tension, level, mono, slot: 0.25 });
}
