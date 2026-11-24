import { describe, expect, it } from 'vitest';
import { createKit, cuesAudible, trackClearOfCues, validateTrack, type TrackSpec } from '../src';
import { BED_SHARE } from '../src/channels/audio';
import { TRACK_BASE_SHARE, TRACK_CEILING_HZ, TRACK_LEVELS, trackCeilingHz, trackNotes } from '../src/channels/track';
import { DEFAULT_TIMING, idealPress } from '../src/level';
import { defaultProfile } from '../src/profile';
import { MUSIC_BUS_GAIN, MUSIC_DUCK, createSoundPlayer, type AudioContextLike, type SoundCommand } from '../src/adapters/web/sound';
import type { OutputCommand } from '../src/types';

// The band: instruments, chords, a spooky bed, stems that join with a streak, and a second phase.
// None of it may ever hide a beep: the proofs for property 13 and 14 hold with every layer playing.

const band: TrackSpec = {
  name: 'Band',
  rootHz: 110,
  scale: [0, 3, 5, 7, 8, 10, 12],
  bass: ['0---3-0-', '4---1-4-'],
  pluck: ['03136313', '01416141'],
  chords: ['013', '014'],
  melody: ['3---5-3-', '4---3-1-'],
  kick: ['X...x...'],
  snare: ['..x...x.'],
  shaker: ['XxxxXxxx'],
  hat: ['..x...x.'],
  bassVoice: 'sub',
  melodyVoice: 'keys',
  drums: true,
  bed: true,
  swing: 0.1,
  space: { seconds: 2, wet: 0.28 },
  stems: { bass: 2, pluck: 4, melody: 6 },
  phase2: { lift: 3, kick: ['X.xxX.xx'] },
};

type Sound = Extract<OutputCommand, { channel: 'sound' }>;
const sounds = (cmds: OutputCommand[]): Sound[] => cmds.filter((c): c is Sound => c.channel === 'sound');
const win = (extra: Partial<Parameters<typeof trackNotes>[1]> = {}) =>
  sounds(trackNotes(band, { from: 0, to: 6.4, tension: 0, level: 1, mono: false, slot: 0.2, quiet: [], ...extra }));
const voices = (list: Sound[], name: string) => list.filter((n) => n.shape?.voice === name);

const kitWith = (track: TrackSpec) => {
  const kit = createKit({ audio: { track } });
  kit.defineObstacle('grave', { width: [0.16, 0.3] });
  kit.defineObstacle('fence', { width: [0.12, 0.24] });
  return kit;
};

describe('a band track is checked in plain words', () => {
  it('refuses a bad chord, swing, room, lift or a note above the beeps', () => {
    expect(() => validateTrack(band)).not.toThrow();
    expect(() => validateTrack({ ...band, chords: ['9'] })).toThrow(/2 to 4 digits/);
    expect(() => validateTrack({ ...band, chords: ['017'] })).toThrow(/only 7 steps/);
    expect(() => validateTrack({ ...band, swing: 0.9 })).toThrow(/swing/);
    expect(() => validateTrack({ ...band, space: { seconds: 9, wet: 0.2 } })).toThrow(/space/);
    expect(() => validateTrack({ ...band, pluck: ['0..'] })).toThrow(/8 characters/);
    expect(() => validateTrack({ ...band, snare: ['..1.....'] })).toThrow(/x, X and dots/);
    expect(() => validateTrack({ ...band, phase2: { lift: 9 } })).toThrow(/lift/);
    // A lift that would push the top note over the beeps is refused.
    expect(() => validateTrack({ ...band, rootHz: 132, phase2: { lift: 2 } })).toThrow(/under 264 Hz/);
    expect(() => validateTrack({ ...band, stems: { bass: 99 } })).toThrow(/stems/);
  });

  it('knows its own ceiling, with the lift', () => {
    expect(trackCeilingHz(band)).toBeCloseTo(110 * 2 ** (15 / 12), 6);
    expect(trackCeilingHz(band)).toBeLessThanOrEqual(TRACK_CEILING_HZ);
  });
});

describe('the band is built from instruments', () => {
  it('names an instrument on every layer, so the web player can build it', () => {
    const open = win({ tension: 0.5 });
    for (const v of ['sub', 'pluck', 'pad', 'keys', 'choir', 'kick', 'snare', 'shaker', 'hat']) {
      expect(voices(open, v).length, v).toBeGreaterThan(0);
    }
    // The drums are noise, with no pitch for the beeps to clash with.
    for (const v of ['snare', 'shaker', 'hat']) expect(voices(open, v).every((n) => n.shape?.noise === true && n.hz === 0), v).toBe(true);
  });

  it('puts the pitched layers in the room, and leaves the bass and the drums dry', () => {
    const open = win();
    for (const v of ['pluck', 'pad', 'keys']) expect(voices(open, v).every((n) => n.shape?.echo === 0.28 && n.shape?.echoSeconds === 2), v).toBe(true);
    for (const v of ['sub', 'kick', 'snare']) expect(voices(open, v).some((n) => n.shape?.echo !== undefined), v).toBe(false);
  });

  it('plays chords of three stacked notes, a bar long, from the scale', () => {
    const pads = voices(win(), 'pad').filter((n) => n.wave === 'triangle' && (n.shape?.filterHz ?? 0) === 900);
    // Bar one is '013': A2, C3, E3.
    const first = pads.filter((n) => n.at === 0).map((n) => Math.round(n.hz));
    expect(first).toEqual([110, 131, 165]);
    expect(pads[0]!.shape!.span).toBeCloseTo(8 * 0.2 * 1.25, 6);
  });

  it('lilts: every second slot is late by the swing, and the grid still joins up', () => {
    const plain = sounds(trackNotes({ ...band, swing: 0 }, { from: 0, to: 3.2, tension: 0.5, level: 1, mono: false, slot: 0.2, quiet: [] }));
    const lilt = sounds(trackNotes(band, { from: 0, to: 3.2, tension: 0.5, level: 1, mono: false, slot: 0.2, quiet: [] }));
    const split = [
      ...sounds(trackNotes(band, { from: 0, to: 1.3, tension: 0.5, level: 1, mono: false, slot: 0.2, quiet: [] })),
      ...sounds(trackNotes(band, { from: 1.3, to: 3.2, tension: 0.5, level: 1, mono: false, slot: 0.2, quiet: [] })),
    ];
    expect(split.map((n) => n.at.toFixed(6))).toEqual(lilt.map((n) => n.at.toFixed(6)));
    const late = lilt.filter((n) => Math.abs(n.at / 0.2 - Math.round(n.at / 0.2)) > 1e-6);
    expect(late.length).toBeGreaterThan(0);
    for (const n of late) expect(((n.at / 0.2) % 1)).toBeCloseTo(0.1, 6);
    expect(plain.every((n) => Math.abs(n.at / 0.2 - Math.round(n.at / 0.2)) < 1e-6)).toBe(true);
  });
});

describe('the band builds with the streak', () => {
  const layers = (streak: number | undefined) => {
    const list = win({ tension: 0.1, ...(streak === undefined ? {} : { streak }) });
    return {
      bass: voices(list, 'sub').filter((n) => n.shape?.filterHz === 650).length,
      chords: voices(list, 'pad').length,
      pluck: voices(list, 'pluck').length,
      melody: voices(list, 'keys').length,
      drums: voices(list, 'kick').length + voices(list, 'snare').length,
      bed: voices(list, 'choir').length,
    };
  };

  it('plays the whole groove from the first bar, then the streak brings the string and lifts the body to full', () => {
    const s0 = layers(0);
    // Bed, drums, bass, chords and the theme melody are all there at streak 0 (the theme is heard in the first bars).
    expect(s0.drums).toBeGreaterThan(0);
    expect(s0.bed).toBeGreaterThan(0);
    expect(s0.bass).toBeGreaterThan(0);
    expect(s0.melody).toBeGreaterThan(0);
    expect(s0.chords).toBeGreaterThan(0);
    expect(s0.pluck).toBe(0); // the extra colour waits for the streak
    const firstMelody = voices(win({ tension: 0.1, streak: 0 }), 'keys')[0]!;
    expect(firstMelody.at).toBeLessThan(8 * 8 * 0.2); // within the first 8 bars
    expect(layers(4).pluck).toBeGreaterThan(0);
    // The body is at a share of full at streak 0 and at full once the streak is in.
    const gain = (streak: number) => Math.max(...voices(win({ tension: 0.1, streak }), 'keys').map((n) => n.gain));
    expect(gain(0)).toBeCloseTo(gain(6) * TRACK_BASE_SHARE, 6);
    const bassGain = (streak: number) => Math.max(...voices(win({ tension: 0.1, streak }), 'sub').filter((n) => n.shape?.filterHz === 650).map((n) => n.gain));
    expect(bassGain(0)).toBeCloseTo(bassGain(2) * TRACK_BASE_SHARE, 6);
  });
  it('plays every layer when no streak is given, which is the worst case the proofs measure', () => {
    const all = layers(undefined);
    expect(all.bass).toBeGreaterThan(0);
    expect(all.pluck).toBeGreaterThan(0);
    expect(all.melody).toBeGreaterThan(0);
  });

  it('a track without stems plays every layer whatever the streak', () => {
    const { stems: _stems, ...plain } = band;
    void _stems;
    const list = sounds(trackNotes(plain, { from: 0, to: 3.2, tension: 0.1, level: 1, mono: false, slot: 0.2, quiet: [], streak: 0 }));
    expect(voices(list, 'pluck').length).toBeGreaterThan(0);
    expect(voices(list, 'keys').length).toBeGreaterThan(0);
  });
});

describe('the second phase changes the key and the drums, never the timing', () => {
  it('lifts every pitched note by the lift, and keeps the times of the shared layers exactly', () => {
    const one = win({ phase: 0, tension: 0.1 });
    const two = win({ phase: 1, tension: 0.1 });
    for (const v of ['sub', 'pluck', 'keys']) {
      const a = voices(one, v);
      const b = voices(two, v);
      expect(b.map((n) => n.at), v).toEqual(a.map((n) => n.at));
      b.forEach((n, i) => expect(n.hz / a[i]!.hz, v).toBeCloseTo(2 ** (3 / 12), 6));
    }
    // The drums are the second phase's: busier than the first.
    expect(voices(two, 'kick').length).toBeGreaterThan(voices(one, 'kick').length);
  });

  it('a track with no second phase is the same in either', () => {
    const { phase2: _p, ...single } = band;
    void _p;
    const w = { from: 0, to: 3.2, tension: 0.3, level: 1, mono: false, slot: 0.2, quiet: [] };
    expect(trackNotes(single, { ...w, phase: 1 })).toEqual(trackNotes(single, { ...w, phase: 0 }));
  });
});

describe('the band never hides a cue', () => {
  it('shares of every layer under a cue add up inside the 6 dB rule', () => {
    const d = TRACK_LEVELS.ducked;
    const beds = BED_SHARE.approach + BED_SHARE.ambience + BED_SHARE.musicRoot + BED_SHARE.musicFifth + BED_SHARE.musicOctave;
    // Worst case at one instant: chords overlap their neighbour (2 bars x 3 notes), the drone and its fifth overlap too.
    const band = d.bass + d.melody + d.kick + d.hat + d.pluck + 6 * d.chord + d.snare + d.shaker + 4 * d.drone + d.choir + d.far;
    expect((beds + band) * 10 ** (6 / 20)).toBeLessThan(1);
  });

  it('beeps stay 6 dB over everything and above every note, on 30 levels at every speed, with every layer playing', () => {
    const kit = kitWith(band);
    for (const speed of ['slow', 'medium', 'fast'] as const) {
      const profile = { ...defaultProfile(), speed };
      for (let seed = 1; seed <= 30; seed++) {
        const commands = kit.renderLevel(kit.generate(seed), profile);
        expect(cuesAudible(commands).counterexamples ?? [], `seed ${seed} ${speed}`).toEqual([]);
        expect(trackClearOfCues(commands).counterexamples ?? [], `seed ${seed} ${speed}`).toEqual([]);
      }
    }
  });

  it('every music note, in phase two too, stays under the beeps', () => {
    const lowest = 294; // the lowest beep, in Hz
    for (const phase of [0, 1]) {
      const top = Math.max(...win({ phase, tension: 0 }).map((n) => Math.max(n.hz, n.shape?.hzTo ?? 0)));
      expect(top, `phase ${phase}`).toBeLessThanOrEqual(lowest * 0.9 + 1e-9);
    }
  });

  it('far-off sounds never play where a cue can sound, and never on a beat', () => {
    const kit = kitWith(band);
    let heard = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const level = kit.generate(seed);
      const commands = sounds(kit.renderLevel(level));
      const cues = commands.filter((c) => c.role === 'cue').map((c) => c.at);
      const press0 = idealPress(level.obstacles[0]!);
      const far = commands.filter((c) => c.shape?.voice === 'owl' || c.shape?.voice === 'creak');
      heard += far.length;
      for (const f of far) {
        const end = f.at + (f.shape!.span ?? 0);
        for (const c of cues) expect(c >= f.at - 0.12 && c <= end + 0.12, `seed ${seed}: far sound at ${f.at} over a cue at ${c}`).toBe(false);
        const beats = (f.at - press0) / DEFAULT_TIMING.beat;
        expect(Math.abs(beats - Math.round(beats)), `seed ${seed}: far sound on a beat`).toBeGreaterThan(0.2);
      }
    }
    expect(heard).toBeGreaterThan(0); // the test would pass if none ever played
  });
});

// ---- the web player --------------------------------------------------------------

/** A context with every feature, recording what is made, so the instruments can be checked without a browser. */
function fullContext() {
  const made: { kind: string; type?: string }[] = [];
  const bufferCalls = { n: 0 };
  const connects: { from: unknown; to: unknown }[] = [];
  const param = (value = 0) => ({ value, setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined });
  const node = (kind: string, extra: Record<string, unknown> = {}) => {
    const n: Record<string, unknown> = {
      kind,
      connect(to: unknown) {
        connects.push({ from: n, to });
      },
      start: () => undefined,
      stop: () => undefined,
      ...extra,
    };
    made.push(n as { kind: string });
    return n;
  };
  const destination = { kind: 'destination' };
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    destination,
    state: 'running',
    createOscillator: () => node('osc', { type: 'sine', frequency: param() }),
    createGain: () => node('gain', { gain: param(1) }),
    createBiquadFilter: () => node('filter', { type: 'lowpass', frequency: param(1000), Q: param() }),
    createStereoPanner: () => node('pan', { pan: param() }),
    createConvolver: () => node('convolver', { buffer: null }),
    createBuffer: (_c: number, length: number) => {
      bufferCalls.n++;
      return { getChannelData: () => new Float32Array(length) };
    },
    createBufferSource: () => node('buffer', { buffer: null, loop: false }),
  };
  return { ctx: ctx as unknown as AudioContextLike, made, connects, destination, bufferCalls };
}

const music = (voice: SoundCommand['shape'], hz = 110): SoundCommand => ({
  channel: 'sound',
  senses: ['hearing'],
  at: 0,
  role: 'music',
  hz,
  wave: 'sine',
  gain: 0.2,
  pan: 0,
  shape: { span: 1, ...voice },
});

describe('the web player builds the instruments', () => {
  const all = ['pluck', 'keys', 'pad', 'sub', 'kick', 'snare', 'hat', 'shaker', 'choir', 'owl', 'creak', 'timpani', 'taiko', 'brass', 'organ', 'bell', 'gong', 'riser'] as const;

  it('makes every instrument without throwing, and tracks it so Escape can silence it', () => {
    for (const voice of all) {
      const { ctx, made } = fullContext();
      const player = createSoundPlayer(ctx);
      expect(() => player.play(music({ voice, noise: voice === 'snare' || voice === 'hat' || voice === 'shaker' || voice === 'creak', filterHz: 2000 }), 0, false)).not.toThrow();
      expect(made.length, voice).toBeGreaterThan(1);
      expect(() => player.cancelAll()).not.toThrow();
    }
  });

  it('builds a plucked string once for each pitch and keeps it', () => {
    const { ctx, bufferCalls } = fullContext();
    const player = createSoundPlayer(ctx);
    player.play(music({ voice: 'pluck' }, 110), 0, false);
    const first = bufferCalls.n;
    expect(first).toBe(1); // the string's samples
    player.play(music({ voice: 'pluck' }, 110), 0.5, false);
    expect(bufferCalls.n).toBe(first); // same pitch: the samples are reused
    player.play(music({ voice: 'pluck' }, 165), 1, false);
    expect(bufferCalls.n).toBe(first + 1); // a new pitch is worked out once
  });

  it('plays the plain tone when the context cannot make filters or buffers', () => {
    const bare = {
      currentTime: 0,
      destination: {},
      createOscillator: () => ({ type: 'sine', frequency: { value: 0 }, connect: () => undefined, start: () => undefined, stop: () => undefined }),
      createGain: () => ({ gain: { value: 0 }, connect: () => undefined }),
    } as unknown as AudioContextLike;
    const player = createSoundPlayer(bare);
    for (const voice of all) expect(() => player.play(music({ voice, noise: voice === 'snare' }), 0, false)).not.toThrow();
  });

  it('sends music through its own bus, and effects straight to the speakers', () => {
    const { ctx, connects, destination } = fullContext();
    const player = createSoundPlayer(ctx);
    player.play(music({ voice: 'sub' }), 0, false);
    player.play({ ...music({ voice: 'sub' }), role: 'effect' }, 0, false);
    const direct = connects.filter((c) => c.to === destination).length;
    // One for the effect, one for the bus's own low-pass; the music itself does not reach the speakers directly.
    expect(direct).toBe(2);
  });

  it('muffles only the music and opens it up again', () => {
    const freq: { at: number; value: number }[] = [];
    const { ctx } = fullContext();
    const original = ctx.createBiquadFilter!;
    ctx.createBiquadFilter = () => {
      const f = original();
      f.frequency.value = 1000;
      f.frequency.linearRampToValueAtTime = (value: number, at: number) => void freq.push({ at, value });
      return f;
    };
    const player = createSoundPlayer(ctx);
    player.play(music({ voice: 'sub' }), 0, false); // makes the bus
    freq.length = 0;
    player.muffle(true);
    expect(freq.at(-1)!.value).toBe(450);
    freq.length = 0;
    player.muffle(false);
    expect(freq.at(-1)!.value).toBeCloseTo(20000, 6);
    expect(freq.map((f) => f.value)).toEqual([...freq.map((f) => f.value)].sort((a, b) => a - b)); // opens steadily
    expect(freq.at(-1)!.at).toBeCloseTo(0.9, 6);
  });

  it('ducks the music under speech and brings it back', () => {
    const ramps: number[] = [];
    const { ctx } = fullContext();
    const original = ctx.createGain;
    ctx.createGain = () => {
      const g = original();
      g.gain.linearRampToValueAtTime = (v: number) => void ramps.push(v);
      return g;
    };
    const player = createSoundPlayer(ctx);
    player.play(music({ voice: 'sub' }), 0, false);
    ramps.length = 0;
    player.duck(true);
    expect(ramps.at(-1)).toBeCloseTo(MUSIC_DUCK * MUSIC_BUS_GAIN, 6); // 6 dB down
    expect(MUSIC_DUCK).toBeCloseTo(10 ** (-6 / 20), 1);
    player.duck(false);
    expect(ramps.at(-1)).toBe(MUSIC_BUS_GAIN);
  });
});
