import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createKit, cuesAudible, trackClearOfCues, validateTrack, type TrackSpec } from '../src';
import { BED_SHARE } from '../src/channels/audio';
import { TRACK_LEVELS, trackNotes } from '../src/channels/track';
import { DEFAULT_TIMING, generateLevel, idealPress } from '../src/level';
import { defaultProfile } from '../src/profile';
import type { OutputCommand } from '../src/types';
import { seedArb } from './helpers/arbitraries';

const spec: TrackSpec = {
  name: 'Test',
  rootHz: 110,
  scale: [0, 3, 5, 7, 10, 12],
  bass: ['0---0-3-', '0---3---'],
  melody: ['..2.3.2.', '4---3...'],
  kick: ['X.x.X.x.'],
  hat: ['.x.x.x.x'],
};

type Sound = Extract<OutputCommand, { channel: 'sound' }>;
const sounds = (cmds: OutputCommand[]): Sound[] => cmds.filter((c): c is Sound => c.channel === 'sound');
const notes = (extra: Partial<Parameters<typeof trackNotes>[1]> = {}) =>
  sounds(trackNotes(spec, { from: 0, to: 1.6, tension: 0, level: 1, mono: false, slot: 0.2, quiet: [], ...extra }));

const kitWith = (track: TrackSpec | null) => {
  const kit = createKit({ audio: { track } });
  kit.defineObstacle('grave', { width: [0.16, 0.3] });
  kit.defineObstacle('fence', { width: [0.12, 0.24] });
  return kit;
};

describe('track patterns', () => {
  it('refuses a track that could hide the beeps, in plain words', () => {
    expect(() => validateTrack({ ...spec, rootHz: 200 })).toThrow(/from 60 to 132/);
    expect(() => validateTrack({ ...spec, bass: ['0..'] })).toThrow(/8 characters of digits, dashes and dots/);
    expect(() => validateTrack({ ...spec, kick: ['x.1.x...'] })).toThrow(/8 characters of x, X and dots/);
    expect(() => validateTrack({ ...spec, melody: ['..9.....'] })).toThrow(/only 6 steps/);
    expect(() => validateTrack({ ...spec, scale: [0, 14] })).toThrow(/0 to 12/);
    expect(() => validateTrack({ ...spec, slotSeconds: 5 })).toThrow(/slotSeconds/);
    expect(() => kitWith({ ...spec, rootHz: 300 })).toThrow(/from 60 to 132/);
  });

  it('a dash holds a note, and a layer never overlaps itself', () => {
    const bass = notes().filter((n) => n.wave === 'square' && n.hz < 110);
    expect(bass[0]!.shape!.span).toBeCloseTo(4 * 0.2 * 0.92, 6); // '0---'
    for (let i = 1; i < bass.length; i++) expect(bass[i]!.at).toBeGreaterThanOrEqual(bass[i - 1]!.at + bass[i - 1]!.shape!.span!);
  });

  it('plays on one grid set by the offset, so separate stretches join up and land on the pulse', () => {
    const whole = sounds(trackNotes(spec, { from: 0, to: 3.2, tension: 0.5, level: 1, mono: false, slot: 0.2, quiet: [], offset: 0.07 }));
    const split = [
      ...sounds(trackNotes(spec, { from: 0, to: 1.3, tension: 0.5, level: 1, mono: false, slot: 0.2, quiet: [], offset: 0.07 })),
      ...sounds(trackNotes(spec, { from: 1.3, to: 3.2, tension: 0.5, level: 1, mono: false, slot: 0.2, quiet: [], offset: 0.07 })),
    ];
    expect(split.map((n) => n.at.toFixed(6))).toEqual(whole.map((n) => n.at.toFixed(6)));
    for (const n of whole) expect(Math.abs(((n.at - 0.07) / 0.2) - Math.round((n.at - 0.07) / 0.2))).toBeLessThan(1e-6);
  });

  it('is full strength between cues and steps aside under them', () => {
    const open = notes();
    const quiet = notes({ quiet: [[0, 1.6]] });
    const loudest = (list: Sound[]) => Math.max(...list.map((n) => n.gain));
    expect(loudest(open)).toBeCloseTo(TRACK_LEVELS.open.kick, 6);
    expect(loudest(quiet)).toBeLessThanOrEqual(TRACK_LEVELS.ducked.kick + 1e-9);
    expect(quiet.some((n) => n.wave === 'square' && n.hz > 110)).toBe(false); // the melody is silent under cues
    // Only notes that touch a quiet window step aside.
    const half = notes({ quiet: [[0.8, 1.6]] });
    expect(half.filter((n) => n.at < 0.6).some((n) => n.gain > TRACK_LEVELS.ducked.bass)).toBe(true);
    expect(half.filter((n) => n.at >= 0.8).every((n) => n.gain <= TRACK_LEVELS.ducked.kick + 1e-9)).toBe(true);
  });

  it('stays quiet everywhere when the game does not say when its cues are', () => {
    const unknown = sounds(trackNotes(spec, { from: 0, to: 1.6, tension: 0, level: 1, mono: false, slot: 0.2 }));
    expect(unknown.every((n) => n.gain <= TRACK_LEVELS.ducked.kick + 1e-9)).toBe(true);
  });

  it('thins the melody as danger rises, adds drive, and is silent at zero volume and centred in mono', () => {
    const melody = (tension: number) => notes({ tension }).filter((n) => n.wave === 'square' && n.hz > 110);
    expect(melody(0.6)[0]!.gain).toBeLessThan(melody(0)[0]!.gain);
    expect(melody(0.9)).toHaveLength(0);
    const hats = (tension: number) => notes({ tension }).filter((n) => n.shape?.noise && (n.shape.filterHz ?? 0) > 5000);
    expect(hats(0)).toHaveLength(0);
    expect(hats(0.5).length).toBeGreaterThan(0);
    expect(sounds(trackNotes(spec, { from: 0, to: 1.6, tension: 0, level: 0, mono: false, slot: 0.2, quiet: [] }))).toHaveLength(0);
    expect(notes({ mono: true }).every((n) => n.pan === 0)).toBe(true);
  });

  it('the quiet shares add up inside the 6 dB rule, with every other bed at its own share', () => {
    const d = TRACK_LEVELS.ducked;
    const beds = BED_SHARE.approach + BED_SHARE.ambience + BED_SHARE.musicRoot + BED_SHARE.musicFifth + BED_SHARE.musicOctave;
    expect((beds + d.bass + d.melody + d.kick + d.hat) * 10 ** (6 / 20)).toBeLessThan(1);
  });
});

describe('the track in a real level', () => {
  it('presses sit on one steady pulse, and gaps stay inside the rule, on 200 seeds', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const level = generateLevel(seed);
        const presses = level.obstacles.map((o) => idealPress(o));
        expect(level.obstacles[0]!.start).toBe(DEFAULT_TIMING.firstStart);
        for (const p of presses) {
          const beats = (p - presses[0]!) / DEFAULT_TIMING.beat;
          expect(Math.abs(beats - Math.round(beats))).toBeLessThan(1e-6);
        }
        for (let i = 1; i < level.obstacles.length; i++) {
          const prev = level.obstacles[i - 1]!;
          const gap = level.obstacles[i]!.start - (prev.start + prev.width);
          expect(gap).toBeGreaterThanOrEqual(DEFAULT_TIMING.gap[0] - 1e-9);
          expect(gap).toBeLessThanOrEqual(DEFAULT_TIMING.gap[1] + 1e-9);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('the music plays on the beat of the countdown', () => {
    const kit = kitWith(spec);
    const level = kit.generate(5);
    const p0 = idealPress(level.obstacles[0]!);
    const music = sounds(kit.renderLevel(level)).filter((s) => s.role === 'music' && s.shape?.span !== undefined && s.shape.span < 2);
    expect(music.length).toBeGreaterThan(50);
    for (const n of music) {
      const halfBeats = (n.at - p0) / (DEFAULT_TIMING.beat / 2);
      expect(Math.abs(halfBeats - Math.round(halfBeats))).toBeLessThan(1e-6);
    }
  });

  it('the music is full strength between countdowns: it really sets the mood', () => {
    const kit = kitWith(spec);
    const music = sounds(kit.renderLevel(kit.generate(5))).filter((s) => s.role === 'music' && s.wave === 'square');
    const musicVolume = defaultProfile().volume.music;
    expect(music.some((s) => s.gain >= TRACK_LEVELS.open.bass * musicVolume - 1e-9)).toBe(true);
    // And most of the bass between countdowns is open, not stepped aside.
    const bass = music.filter((s) => s.hz < 110);
    expect(bass.filter((s) => s.gain > TRACK_LEVELS.ducked.bass * musicVolume + 1e-9).length / bass.length).toBeGreaterThan(0.25);
  });

  it('beeps stay 6 dB over everything and above every note, on 40 levels at every speed', () => {
    const kit = kitWith(spec);
    for (const speed of ['slow', 'medium', 'fast'] as const) {
      const profile = { ...defaultProfile(), speed };
      for (let seed = 1; seed <= 40; seed++) {
        const commands = kit.renderLevel(kit.generate(seed), profile);
        expect(cuesAudible(commands).counterexamples ?? [], `seed ${seed}`).toEqual([]);
        expect(trackClearOfCues(commands).counterexamples ?? [], `seed ${seed}`).toEqual([]);
      }
    }
  });

  it('property 14 fails, with a counterexample, for a note above the beeps', () => {
    const kit = kitWith(spec);
    const loud = [
      ...kit.renderLevel(kit.generate(3)),
      { channel: 'sound' as const, senses: ['hearing'] as ['hearing'], at: 1, role: 'music' as const, hz: 500, wave: 'sine' as const, gain: 0.01, pan: 0 },
    ];
    const result = trackClearOfCues(loud);
    expect(result.pass).toBe(false);
    expect(result.counterexample).toMatch(/lowest beep is 294 Hz/);
  });
});
