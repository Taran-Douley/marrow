import type { OutputCommand } from '../../types';

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

export interface AudioContextLike {
  currentTime: number;
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
}

/** Which sounds give way first when too many play at once. A cue is never dropped. */
const RANK: Partial<Record<string, number>> = { ambience: 0, music: 1, effect: 2, approach: 3, reward: 4, cue: 9 };

interface Stoppable {
  stop(when?: number): void;
}

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
  const rooms = new Map<number, ConvolverLike>();
  const reverb = (seconds: number): ConvolverLike | undefined => {
    if (!ctx.createConvolver || !ctx.createBuffer) return undefined;
    const length = Math.max(0.25, Math.min(4, Math.round(seconds * 4) / 4));
    const known = rooms.get(length);
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
    room.connect(ctx.destination);
    rooms.set(length, room);
    return room;
  };

  const track = (node: Stoppable): void => {
    live.push(node);
    fresh.push(node);
    if (live.length > 96) live = live.slice(-48); // finished sounds fall away
  };

  /** Move a parameter from one value to another across [start, end]. */
  const glide = (param: AudioParamLike, from: number, to: number | undefined, start: number, end: number): void => {
    param.setValueAtTime?.(from, start);
    if (to !== undefined) param.linearRampToValueAtTime?.(to, end);
  };

  const voice = (cmd: SoundCommand, hz: number, wave: string, gain: number, start: number, seconds: number, pan: number, mono: boolean): void => {
    const shape = cmd.shape ?? {};
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
    out.connect(ctx.destination);
    // The room answers: part of the sound, from where it was, rings on in the reverb.
    const wet = Math.max(0, Math.min(1, shape.echo ?? 0));
    if (wet > 0) {
      const room = reverb(shape.echoSeconds ?? 1.5);
      if (room) {
        const send = ctx.createGain();
        send.gain.value = wet;
        out.connect(send);
        send.connect(room);
      }
    }

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
    unlock() {
      if (ctx.state === 'suspended') void ctx.resume?.();
    },
  };
}
