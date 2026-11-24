import type { Instrument, OutputCommand } from '../../types';

// Web Audio player. Everything is synthesised, so no audio files are needed.
// The context is typed as a small "Like" interface so tests can pass a fake.
// Shaping (glides, filters, noise) is optional on the context: if a feature is
// missing, that sound is simplified or skipped, and nothing throws.

export interface AudioParamLike {
  value: number;
  setValueAtTime?(value: number, time: number): unknown;
  linearRampToValueAtTime?(value: number, time: number): unknown;
}
export interface OscillatorLike {
  type: string;
  frequency: AudioParamLike;
  connect(node: unknown): unknown;
  start(when?: number): void;
  stop(when?: number): void;
}
export interface GainLike {
  gain: AudioParamLike;
  connect(node: unknown): unknown;
}
export interface PannerLike {
  pan: AudioParamLike;
  connect(node: unknown): unknown;
}
export interface FilterLike {
  type: string;
  frequency: AudioParamLike;
  Q?: AudioParamLike;
  connect(node: unknown): unknown;
}
export interface BufferSourceLike {
  buffer: unknown;
  loop: boolean;
  connect(node: unknown): unknown;
  start(when?: number): void;
  stop(when?: number): void;
}
/** A 3D panner (the browser's PannerNode). It places a sound in space for headphones. */
export interface Panner3DLike {
  panningModel: string;
  distanceModel: string;
  refDistance: number;
  rolloffFactor: number;
  positionX?: { value: number };
  positionY?: { value: number };
  positionZ?: { value: number };
  setPosition?(x: number, y: number, z: number): void;
  connect(node: unknown): unknown;
}

/** A reverb (the browser's ConvolverNode). It makes a sound ring like a room. */
export interface ConvolverLike {
  buffer: unknown;
  normalize?: boolean;
  connect(node: unknown): unknown;
}

/** A compressor (the browser's DynamicsCompressorNode), used as a limiter on the music bus. */
export interface CompressorLike {
  threshold: AudioParamLike;
  knee?: AudioParamLike;
  ratio: AudioParamLike;
  attack?: AudioParamLike;
  release?: AudioParamLike;
  connect(node: unknown): unknown;
}

export interface AudioContextLike {
  currentTime: number;
  createDynamicsCompressor?(): CompressorLike;
  createConvolver?(): ConvolverLike;
  destination: unknown;
  sampleRate?: number;
  state?: string;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  createStereoPanner?(): PannerLike;
  createPanner?(): Panner3DLike;
  createBiquadFilter?(): FilterLike;
  createBuffer?(channels: number, length: number, sampleRate: number): { getChannelData(channel: number): Float32Array };
  createBufferSource?(): BufferSourceLike;
  resume?(): unknown;
}

export type SoundCommand = Extract<OutputCommand, { channel: 'sound' }>;

export interface SoundOptions {
  /** Loudest a cue gets, 0 to 1, before the player's cue volume. Default 0.35. */
  masterGain?: number;
  /** Length of a cue beep in seconds. Default 0.16. */
  cueSeconds?: number;
  /** Most sounds at once, for busy games (Requirement 25.4). The least important give way first; a countdown beep never does. Default 24. */
  maxVoices?: number;
}

export interface SoundPlayer {
  /**
   * Play a sound command after a delay in seconds. `mono` forces the centre.
   * `rate` is running seconds per real second, so a sound with a `span` lasts as long as the level moment it fills.
   */
  play(cmd: SoundCommand, delaySeconds: number, mono: boolean, rate?: number): void;
  /** Silence everything already scheduled (after a fall, or on Escape). */
  cancelAll(): void;
  /** Browsers start audio only after a gesture: call this from a press. */
  unlock(): void;
  /** How many sounds were left out or cut short to keep under the limit. */
  dropped(): number;
  /**
   * Muffle the music (a low-pass on its own bus), for the moment after a fall. Speech, cues and effects
   * are not touched. `false` lets it open up again over about a second.
   */
  muffle(on: boolean): void;
  /** Duck the music under speech: it drops by 6 dB (to half) while `on`, and comes back over a moment. */
  duck(on: boolean): void;
}

/** Which sounds give way first when too many play at once. A cue is never dropped. */
const RANK: Partial<Record<string, number>> = { ambience: 0, music: 1, effect: 2, approach: 3, reward: 4, cue: 9 };

interface Stoppable {
  stop(when?: number): void;
}

/** The music bus gain (was 1): the music is plainly heard. A limiter on the bus keeps the peaks clean. */
export const MUSIC_BUS_GAIN = 1.6;
/** Under speech the music drops to half (6 dB), not to a third as before, and comes back in 0.4 s. */
export const MUSIC_DUCK = 0.5;

/** Long sounds (wind, pad, the approach tone) fade in and out so they never click or pump. */
const LONG_SECONDS = 0.6;

export function createSoundPlayer(ctx: AudioContextLike, options: SoundOptions = {}): SoundPlayer {
  const master = options.masterGain ?? 0.35;
  const cueSeconds = options.cueSeconds ?? 0.16;
  let live: Stoppable[] = [];
  const maxVoices = Math.max(4, options.maxVoices ?? 24);
  let sounding: { role: string; end: number; nodes: Stoppable[] }[] = [];
  let fresh: Stoppable[] = [];
  let dropped = 0;
  let noise: { getChannelData(channel: number): Float32Array } | undefined;

  const noiseBuffer = () => {
    if (noise || !ctx.createBuffer) return noise;
    const rate = ctx.sampleRate ?? 44100;
    noise = ctx.createBuffer(1, rate * 2, rate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return noise;
  };

  /**
   * One reverb per length of echo (to the nearest quarter second), made from decaying noise, so a room
   * can ring without any recording. Built once, then shared.
   */
  const rooms = new Map<string, ConvolverLike>();

  // The music has its own bus: a gain (to duck under speech) into a low-pass (to muffle after a fall),
  // then the speakers. Cues, effects and speech never go through it. Without filters, music goes straight out.
  let musicIn: GainLike | undefined;
  let musicFilter: FilterLike | undefined;
  let muffled = false;
  let ducked = false;
  const OPEN_HZ = 20000;
  const MUFFLED_HZ = 450;
  const musicBus = (): unknown => {
    if (musicIn) return musicIn;
    if (!ctx.createBiquadFilter) return ctx.destination;
    musicIn = ctx.createGain();
    musicFilter = ctx.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = muffled ? MUFFLED_HZ : OPEN_HZ;
    musicIn.gain.value = (ducked ? MUSIC_DUCK : 1) * MUSIC_BUS_GAIN;
    musicIn.connect(musicFilter);
    // The bus is louder than the notes alone, so a limiter catches the peaks where many layers land together.
    if (ctx.createDynamicsCompressor) {
      const limit = ctx.createDynamicsCompressor();
      limit.threshold.value = -10;
      limit.ratio.value = 6;
      if (limit.knee) limit.knee.value = 12;
      if (limit.attack) limit.attack.value = 0.005;
      if (limit.release) limit.release.value = 0.25;
      musicFilter.connect(limit);
      limit.connect(ctx.destination);
    } else {
      musicFilter.connect(ctx.destination);
    }
    return musicIn;
  };
  const toDestination = (role: string): unknown => (role === 'music' ? musicBus() : ctx.destination);

  const reverb = (seconds: number, music = false): ConvolverLike | undefined => {
    if (!ctx.createConvolver || !ctx.createBuffer) return undefined;
    const length = Math.max(0.25, Math.min(4, Math.round(seconds * 4) / 4));
    const key = `${length}|${music}`;
    const known = rooms.get(key);
    if (known) return known;
    const rate = ctx.sampleRate ?? 44100;
    const frames = Math.floor(rate * length);
    const impulse = ctx.createBuffer(2, frames, rate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 3);
    }
    const room = ctx.createConvolver();
    room.normalize = true;
    room.buffer = impulse;
    room.connect(toDestination(music ? 'music' : 'effect'));
    rooms.set(key, room);
    return room;
  };

  const track = (node: Stoppable): void => {
    live.push(node);
    fresh.push(node);
    if (live.length > 96) live = live.slice(-48); // finished sounds fall away
  };

  /**
   * A plucked string, by Karplus-Strong: a short burst of softened noise is fed round a delay of one
   * period, averaged each time round, so the high partials die first, as on a real string. Worked out
   * once for each pitch (to a quarter of a hertz) and kept, so playing a note costs nothing.
   */
  const strings = new Map<number, unknown>();
  const pluckBuffer = (hz: number): unknown => {
    if (!ctx.createBuffer || !(hz > 20)) return undefined;
    const rate = ctx.sampleRate ?? 44100;
    const key = Math.round(hz * 4) / 4;
    const known = strings.get(key);
    if (known) return known;
    const period = Math.max(2, Math.round(rate / key));
    const length = Math.floor(rate * 1.4);
    const buffer = ctx.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    let soft = 0;
    for (let i = 0; i < period; i++) {
      soft = soft * 0.5 + (Math.random() * 2 - 1) * 0.5; // a softened burst: a rounder, folk-guitar start
      data[i] = soft;
    }
    for (let i = period; i < length; i++) data[i] = 0.9985 * 0.5 * (data[i - period]! + (i - period - 1 >= 0 ? data[i - period - 1]! : 0));
    if (strings.size >= 64) strings.clear();
    strings.set(key, buffer);
    return buffer;
  };

  /** Move a parameter from one value to another across [start, end]. */
  const glide = (param: AudioParamLike, from: number, to: number | undefined, start: number, end: number): void => {
    param.setValueAtTime?.(from, start);
    if (to !== undefined) param.linearRampToValueAtTime?.(to, end);
  };

  /** Pan or place a finished sound, send it to the speakers (the music bus for music), and give it its room. */
  const route = (cmd: SoundCommand, amp: { connect(node: unknown): unknown }, pan: number, mono: boolean, start: number, end: number): void => {
    const shape = cmd.shape ?? {};
    const target = mono ? 0 : pan;
    const panTo = mono ? undefined : shape.panTo;
    let out: { connect(node: unknown): unknown } = amp;
    if (cmd.space && !mono && ctx.createPanner) {
      // True 3D: the browser's head-related filter puts the sound where the direction says. Distance
      // is already in the gain and filter, so the sound sits one unit away in that direction.
      const spot = ctx.createPanner();
      spot.panningModel = 'HRTF';
      spot.distanceModel = 'inverse';
      spot.refDistance = 1;
      spot.rolloffFactor = 0; // distance is handled by the gain, so the panner must not add its own
      if (spot.positionX && spot.positionY && spot.positionZ) {
        spot.positionX.value = cmd.space.x;
        spot.positionY.value = cmd.space.y;
        spot.positionZ.value = cmd.space.z;
      } else {
        spot.setPosition?.(cmd.space.x, cmd.space.y, cmd.space.z);
      }
      amp.connect(spot);
      out = spot;
    } else if ((target !== 0 || panTo !== undefined) && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, target));
      if (panTo !== undefined) glide(panner.pan, Math.max(-1, Math.min(1, target)), Math.max(-1, Math.min(1, panTo)), start, end);
      amp.connect(panner);
      out = panner;
    }
    out.connect(toDestination(cmd.role));
    // The room answers: part of the sound, from where it was, rings on in the reverb.
    const wet = Math.max(0, Math.min(1, shape.echo ?? 0));
    if (wet > 0) {
      const room = reverb(shape.echoSeconds ?? 1.5, cmd.role === 'music');
      if (room) {
        const send = ctx.createGain();
        send.gain.value = wet;
        out.connect(send);
        send.connect(room);
      }
    }
  };

  /** A node that is started at `start` and stopped just after `end`, and tracked so Escape can silence it. */
  const run = (node: Stoppable & { start(when?: number): void }, start: number, end: number): void => {
    node.start(start);
    node.stop(end + 0.02);
    track(node);
  };

  /** Slow pitch wobble on an oscillator (vibrato), the same as the plain voice has. */
  const vibrato = (o: OscillatorLike, hz: number, shape: NonNullable<SoundCommand['shape']>, start: number, end: number): void => {
    if (shape.wobbleHz === undefined || shape.wobble === undefined || shape.wobble <= 0) return;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = Math.max(0.1, Math.min(20, shape.wobbleHz));
    const depth = ctx.createGain();
    depth.gain.value = hz * Math.min(0.5, shape.wobble);
    lfo.connect(depth);
    depth.connect(o.frequency);
    run(lfo, start, end);
  };

  /**
   * The instruments, all built from oscillators and noise. Returns false when this context cannot make
   * the instrument (no filters, no buffers), and the plain voice plays instead.
   */
  const instrument = (cmd: SoundCommand, kind: Instrument, hz: number, gain: number, start: number, seconds: number, pan: number, mono: boolean): boolean => {
    const shape = cmd.shape ?? {};
    if (!ctx.createBiquadFilter || !ctx.createGain) return false;
    const noisy = kind === 'snare' || kind === 'hat' || kind === 'shaker' || kind === 'creak' || kind === 'riser';
    if (noisy && !(ctx.createBufferSource && noiseBuffer())) return false;
    const pluckSamples = kind === 'pluck' ? pluckBuffer(hz) : undefined;
    if (kind === 'pluck' && !pluckSamples) return false;

    const end = start + seconds;
    const peak = Math.max(0, Math.min(1, gain)) * master;
    const amp = ctx.createGain();
    /** attack to the peak, an optional decay to a share of it, then down to nothing at the end. */
    const envelope = (attack: number, sustain = 1, decayBy = 0): void => {
      const a = Math.min(attack, seconds / 2);
      amp.gain.setValueAtTime?.(0, start);
      amp.gain.linearRampToValueAtTime?.(peak, start + a);
      if (sustain < 1) amp.gain.linearRampToValueAtTime?.(peak * sustain, start + Math.min(seconds * 0.8, a + decayBy));
      else if (seconds > 1) amp.gain.setValueAtTime?.(peak, end - Math.min(0.5, seconds / 4));
      amp.gain.linearRampToValueAtTime?.(0, end);
    };
    const filter = (type: string, from: number, to?: number, q?: number): FilterLike => {
      const f = ctx.createBiquadFilter!();
      f.type = type;
      glide(f.frequency, from, to, start, end);
      if (q !== undefined && f.Q) f.Q.value = q;
      return f;
    };
    const osc = (type: string, f: number, share: number, into: { connect(node: unknown): unknown }, glideTo?: number): OscillatorLike => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      if (glideTo !== undefined) glide(o.frequency, f, glideTo, start, end);
      const level = ctx.createGain();
      level.gain.value = share;
      o.connect(level);
      level.connect(into);
      run(o, start, end);
      return o;
    };
    const noise = (): BufferSourceLike => {
      const n = ctx.createBufferSource!();
      n.buffer = noiseBuffer();
      n.loop = true;
      return n;
    };
    const hzTo = shape.hzTo;

    switch (kind) {
      case 'pluck': {
        // Karplus-Strong: a burst of noise rings in a short feedback loop, worked out once per pitch.
        const s = ctx.createBufferSource!();
        s.buffer = pluckSamples;
        s.loop = false;
        const tone = filter('lowpass', shape.filterHz ?? 3000, shape.filterTo);
        s.connect(tone);
        tone.connect(amp);
        envelope(0.002);
        run(s, start, end);
        break;
      }
      case 'keys': {
        // Soft keys: two-operator FM with a fast fade of the modulation (the bright start), and a detuned triangle for warmth.
        const mix = ctx.createGain();
        mix.gain.value = 0.7;
        const carrier = osc('sine', hz, 1, mix);
        const mod = ctx.createOscillator();
        mod.type = 'sine';
        mod.frequency.value = hz * 2;
        const depth = ctx.createGain();
        depth.gain.setValueAtTime?.(hz * 1.4, start);
        depth.gain.linearRampToValueAtTime?.(hz * 0.08, start + Math.min(0.5, seconds));
        mod.connect(depth);
        depth.connect(carrier.frequency);
        run(mod, start, end);
        osc('triangle', hz * 1.004, 0.35, mix);
        const tone = filter('lowpass', shape.filterHz ?? 2400, shape.filterTo);
        mix.connect(tone);
        tone.connect(amp);
        envelope(0.008, 0.35, 0.3);
        break;
      }
      case 'pad': {
        // A warm pad: three slightly detuned saws through a low-pass, with a slow attack.
        const mix = ctx.createGain();
        mix.gain.value = 0.34;
        const saws = [0.996, 1, 1.004].map((d) => osc('sawtooth', hz * d, 1, mix));
        if (shape.wobbleHz !== undefined) vibrato(saws[1]!, hz, shape, start, end);
        const tone = filter('lowpass', shape.filterHz ?? 900, shape.filterTo, 0.7);
        mix.connect(tone);
        tone.connect(amp);
        const a = Math.min(0.45, seconds * 0.3);
        amp.gain.setValueAtTime?.(0, start);
        amp.gain.linearRampToValueAtTime?.(peak, start + a);
        amp.gain.setValueAtTime?.(peak, end - a);
        amp.gain.linearRampToValueAtTime?.(0, end);
        break;
      }
      case 'sub': {
        const mix = ctx.createGain();
        mix.gain.value = 0.8;
        const main = osc('sine', hz, 1, mix, hzTo);
        osc('triangle', hz, 0.25, mix, hzTo);
        vibrato(main, hz, shape, start, end);
        const tone = filter('lowpass', shape.filterHz ?? 260, shape.filterTo);
        mix.connect(tone);
        tone.connect(amp);
        envelope(seconds > 1 ? Math.min(0.5, seconds / 4) : 0.015);
        break;
      }
      case 'choir': {
        // A faint choir: a few sines at the note and its upper partials, with a slow wobble and a long swell.
        const mix = ctx.createGain();
        mix.gain.value = 0.5;
        const voices = [osc('sine', hz, 1, mix), osc('sine', hz * 2.003, 0.45, mix), osc('sine', hz * 3.01, 0.22, mix), osc('sine', hz * 1.002, 0.5, mix)];
        for (const v of voices) vibrato(v, v.frequency.value, shape, start, end);
        const tone = filter('bandpass', Math.min(2200, hz * 4), undefined, 0.6);
        mix.connect(tone);
        tone.connect(amp);
        const a = Math.min(0.6, seconds * 0.35);
        amp.gain.setValueAtTime?.(0, start);
        amp.gain.linearRampToValueAtTime?.(peak, start + a);
        amp.gain.setValueAtTime?.(peak, end - a);
        amp.gain.linearRampToValueAtTime?.(0, end);
        break;
      }
      case 'kick': {
        // A kick: the pitch drops fast, with a very short click at the front.
        const body = ctx.createGain();
        body.gain.value = 1;
        const o = osc('sine', hz, 1, body);
        const drop = Math.min(0.12, seconds);
        o.frequency.setValueAtTime?.(hz, start);
        o.frequency.linearRampToValueAtTime?.(hzTo ?? hz * 0.3, start + drop);
        body.connect(amp);
        envelope(0.002, 0.5, 0.04);
        break;
      }
      case 'snare': {
        // Brushed: noise through a band, with a soft attack, so it swishes instead of cracking.
        const n = noise();
        const high = filter('highpass', 1200);
        const low = filter('lowpass', shape.filterHz ?? 3800, shape.filterTo);
        n.connect(high);
        high.connect(low);
        low.connect(amp);
        envelope(0.012, 0.3, 0.05);
        run(n, start, end);
        break;
      }
      case 'hat': {
        const n = noise();
        const high = filter('highpass', 6500);
        n.connect(high);
        high.connect(amp);
        envelope(0.002);
        run(n, start, end);
        break;
      }
      case 'shaker': {
        const n = noise();
        const band = filter('bandpass', shape.filterHz ?? 6500, shape.filterTo, 1.2);
        n.connect(band);
        band.connect(amp);
        envelope(Math.min(0.02, seconds * 0.4));
        run(n, start, end);
        break;
      }
      case 'timpani':
      case 'taiko': {
        // A war drum: a sine that falls onto its pitch, a soft thump of low noise, and a long decay (timpani) or a short punch (taiko).
        const big = kind === 'timpani';
        const body = ctx.createGain();
        body.gain.value = 1;
        const o = osc('sine', hz * (big ? 1.4 : 2), 1, body);
        o.frequency.setValueAtTime?.(hz * (big ? 1.4 : 2), start);
        o.frequency.linearRampToValueAtTime?.(hzTo ?? hz, start + (big ? 0.14 : 0.06));
        osc('triangle', hz * 0.5, 0.5, body);
        if (ctx.createBufferSource && noiseBuffer()) {
          const n = noise();
          const thump = filter('lowpass', big ? 220 : 500);
          const level = ctx.createGain();
          level.gain.value = big ? 0.35 : 0.5;
          n.connect(thump);
          thump.connect(level);
          level.connect(body);
          run(n, start, Math.min(end, start + 0.12));
        }
        const tone = filter('lowpass', shape.filterHz ?? 500);
        body.connect(tone);
        tone.connect(amp);
        envelope(0.003, big ? 0.4 : 0.18, big ? seconds * 0.45 : 0.08);
        break;
      }
      case 'brass': {
        // Low brass-like pad: detuned saws and a square an octave down, through a low-pass that closes, with a slow swell in.
        const mix = ctx.createGain();
        mix.gain.value = 0.3;
        [0.99, 1, 1.012].forEach((d) => osc('sawtooth', hz * d, 1, mix));
        osc('square', hz * 0.5, 0.45, mix);
        const tone = filter('lowpass', shape.filterHz ?? 900, shape.filterTo ?? 170, 1.1);
        mix.connect(tone);
        tone.connect(amp);
        const a = Math.min(0.9, seconds * 0.45);
        amp.gain.setValueAtTime?.(0, start);
        amp.gain.linearRampToValueAtTime?.(peak, start + a);
        amp.gain.setValueAtTime?.(peak, end - Math.min(0.5, seconds * 0.25));
        amp.gain.linearRampToValueAtTime?.(0, end);
        break;
      }
      case 'organ': {
        // A low pipe organ: the note, its octave and its twelfth, with a square for the reed. Steady, with a slow swell.
        const mix = ctx.createGain();
        mix.gain.value = 0.4;
        osc('sine', hz, 1, mix);
        osc('square', hz, 0.3, mix);
        osc('sine', hz * 2, 0.5, mix);
        osc('sine', hz * 3, 0.25, mix);
        const tone = filter('lowpass', shape.filterHz ?? 700, shape.filterTo, 0.8);
        mix.connect(tone);
        tone.connect(amp);
        const a = Math.min(0.7, seconds * 0.4);
        amp.gain.setValueAtTime?.(0, start);
        amp.gain.linearRampToValueAtTime?.(peak, start + a);
        amp.gain.setValueAtTime?.(peak, end - Math.min(0.5, seconds * 0.25));
        amp.gain.linearRampToValueAtTime?.(0, end);
        break;
      }
      case 'bell':
      case 'gong': {
        // A low toll: partials that do not sit on whole multiples, so it rings like metal. The gong swells in, the bell strikes.
        const ratios = kind === 'bell' ? [1, 2, 2.4, 3, 4.2] : [1, 1.47, 2.09, 2.56, 3.4];
        const shares = kind === 'bell' ? [1, 0.5, 0.35, 0.22, 0.1] : [1, 0.7, 0.5, 0.3, 0.15];
        const mix = ctx.createGain();
        mix.gain.value = 0.4;
        ratios.forEach((r, i) => osc('sine', hz * r, shares[i]!, mix));
        const tone = filter('lowpass', shape.filterHz ?? 1300);
        mix.connect(tone);
        tone.connect(amp);
        envelope(kind === 'bell' ? 0.004 : 0.14, 0.3, seconds * (kind === 'bell' ? 0.35 : 0.5));
        break;
      }
      case 'riser': {
        // A rising sweep of noise that grows as it climbs.
        const n = noise();
        const band = filter('bandpass', shape.filterHz ?? 200, shape.filterTo ?? 2000, 1.6);
        n.connect(band);
        band.connect(amp);
        amp.gain.setValueAtTime?.(0, start);
        amp.gain.linearRampToValueAtTime?.(peak, end - Math.min(0.03, seconds / 3));
        amp.gain.linearRampToValueAtTime?.(0, end);
        run(n, start, end);
        break;
      }
      case 'owl': {
        // A far-off hoot: a soft sine that sags a little, behind a low-pass, so it sounds distant.
        const mix = ctx.createGain();
        mix.gain.value = 1;
        osc('sine', hz, 1, mix, hz * 0.94);
        osc('sine', hz * 2, 0.12, mix, hz * 1.88);
        const tone = filter('lowpass', shape.filterHz ?? 900);
        mix.connect(tone);
        tone.connect(amp);
        envelope(Math.min(0.08, seconds * 0.3), 0.6, seconds * 0.4);
        break;
      }
      case 'creak': {
        // A creak: noise through a narrow band that slides, swelling in and fading out slowly.
        const n = noise();
        const band = filter('bandpass', shape.filterHz ?? 500, shape.filterTo ?? 1400, 9);
        n.connect(band);
        band.connect(amp);
        const a = Math.min(0.3, seconds * 0.4);
        amp.gain.setValueAtTime?.(0, start);
        amp.gain.linearRampToValueAtTime?.(peak, start + a);
        amp.gain.linearRampToValueAtTime?.(0, end);
        run(n, start, end);
        break;
      }
    }
    route(cmd, amp, pan, mono, start, end);
    return true;
  };

  const voice = (cmd: SoundCommand, hz: number, wave: string, gain: number, start: number, seconds: number, pan: number, mono: boolean): void => {
    const shape = cmd.shape ?? {};
    // An instrument, where this context can make it. Otherwise the plain tone below plays, so nothing is lost.
    if (shape.voice && instrument(cmd, shape.voice, hz, gain, start, seconds, pan, mono)) return;
    const useNoise = shape.noise === true;
    if (useNoise && !(ctx.createBufferSource && noiseBuffer())) return; // no noise here: skip, never throw

    const end = start + seconds;
    const source: OscillatorLike | BufferSourceLike = useNoise ? ctx.createBufferSource!() : ctx.createOscillator();
    if (useNoise) {
      const s = source as BufferSourceLike;
      s.buffer = noiseBuffer();
      s.loop = true;
    } else {
      const o = source as OscillatorLike;
      o.type = wave;
      o.frequency.value = hz;
      if (shape.hzTo !== undefined) glide(o.frequency, hz, shape.hzTo, start, end);
      if (shape.wobbleHz !== undefined && shape.wobble !== undefined && shape.wobble > 0) {
        // Vibrato: a slow second oscillator pushes the pitch up and down.
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = Math.max(0.1, Math.min(20, shape.wobbleHz));
        const depth = ctx.createGain();
        depth.gain.value = hz * Math.min(0.5, shape.wobble);
        lfo.connect(depth);
        depth.connect(o.frequency);
        lfo.start(start);
        lfo.stop(end + 0.02);
        track(lfo);
      }
    }

    const amp = ctx.createGain();
    const peak = Math.max(0, Math.min(1, gain)) * master;
    // Short sounds: a quick attack and release stop clicks. Long sounds fade over a quarter of their length.
    const long = seconds > LONG_SECONDS;
    const fade = long ? Math.min(0.5, seconds / 4) : 0.01;
    amp.gain.setValueAtTime?.(0, start);
    amp.gain.linearRampToValueAtTime?.(peak, start + fade);
    if (long) amp.gain.setValueAtTime?.(peak, end - fade);
    amp.gain.linearRampToValueAtTime?.(0, end);

    let chain: { connect(node: unknown): unknown } = source;
    if (shape.filterHz !== undefined && ctx.createBiquadFilter) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      glide(filter.frequency, shape.filterHz, shape.filterTo, start, end);
      chain.connect(filter);
      chain = filter;
    }
    chain.connect(amp);

    route(cmd, amp, pan, mono, start, end);

    source.start(start);
    source.stop(end + 0.02);
    track(source);
  };

  return {
    play(cmd, delaySeconds, mono, rate = 1) {
      const start = ctx.currentTime + Math.max(0, delaySeconds);
      // A busy game: at most `maxVoices` sounds at once. The least important gives way; a beep never does.
      sounding = sounding.filter((v) => v.end > start);
      if (sounding.length >= maxVoices) {
        const rank = RANK[cmd.role] ?? 0;
        const weakest = sounding.filter((v) => v.role !== 'cue').sort((a, b) => (RANK[a.role] ?? 0) - (RANK[b.role] ?? 0))[0];
        if (cmd.role !== 'cue' && (!weakest || (RANK[weakest.role] ?? 0) >= rank)) {
          dropped += 1;
          return; // nothing less important to make room: this one is left out
        }
        if (weakest) {
          for (const node of weakest.nodes) {
            try {
              node.stop(start);
            } catch {
              // already stopped
            }
          }
          sounding = sounding.filter((v) => v !== weakest);
          dropped += 1;
        }
      }
      fresh = [];
      const shape = cmd.shape ?? {};
      const seconds =
        shape.span !== undefined ? shape.span / Math.max(rate, 0.01) : shape.seconds ?? (cmd.role === 'reward' ? 0.14 : cueSeconds);

      if (cmd.role === 'reward') {
        // A rising chime: the note, then a fifth above it.
        voice(cmd, cmd.hz, cmd.wave, cmd.gain, start, 0.14, cmd.pan, mono);
        voice(cmd, cmd.hz * 1.5, cmd.wave, cmd.gain, start + 0.12, 0.2, cmd.pan, mono);
      } else {
        voice(cmd, cmd.hz, cmd.wave, cmd.gain, start, seconds, cmd.pan, mono);
      }
      sounding.push({ role: cmd.role, end: start + (cmd.role === 'reward' ? 0.34 : seconds), nodes: fresh });
    },
    cancelAll() {
      for (const node of live) {
        try {
          node.stop(ctx.currentTime);
        } catch {
          // Already stopped: nothing to do.
        }
      }
      live = [];
      sounding = [];
    },
    dropped: () => dropped,
    muffle(on) {
      muffled = on;
      const f = musicFilter;
      if (!f) return; // no music has played yet: the bus will open muffled when it is made
      const now = ctx.currentTime;
      f.frequency.setValueAtTime?.(f.frequency.value, now);
      if (on) {
        f.frequency.linearRampToValueAtTime?.(MUFFLED_HZ, now + 0.08);
        return;
      }
      // Opening up: steps spaced evenly in pitch, so it sweeps open and does not jump at the end.
      const steps = 8;
      for (let i = 1; i <= steps; i++) f.frequency.linearRampToValueAtTime?.(MUFFLED_HZ * (OPEN_HZ / MUFFLED_HZ) ** (i / steps), now + (i / steps) * 0.9);
    },
    duck(on) {
      ducked = on;
      const g = musicIn?.gain;
      if (!g) return;
      const now = ctx.currentTime;
      g.setValueAtTime?.(g.value, now);
      g.linearRampToValueAtTime?.((on ? MUSIC_DUCK : 1) * MUSIC_BUS_GAIN, now + (on ? 0.06 : 0.4));
    },
    unlock() {
      if (ctx.state === 'suspended') void ctx.resume?.();
    },
  };
}
