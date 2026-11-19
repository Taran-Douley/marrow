import { describe, expect, it } from 'vitest';
import { createSoundPlayer, type AudioContextLike } from '../src/adapters/web';
import { wrapWords } from '../src/adapters/web/visual';
import { withAcoustics } from '../src/channels/audio';
import type { OutputCommand } from '../src/types';

type Sound = Extract<OutputCommand, { channel: 'sound' }>;
const sound = (role: Sound['role'], shape?: Sound['shape']): Sound => ({
  channel: 'sound',
  senses: ['hearing'],
  at: 0,
  role,
  hz: 300,
  wave: 'sine',
  gain: 0.5,
  pan: 0,
  ...(shape ? { shape } : {}),
});

describe('room acoustics', () => {
  it('gives effects, cues and rewards the room echo, and leaves music, ambience and speech dry', () => {
    const speech: OutputCommand = { channel: 'speech', senses: ['hearing'], at: 0, text: 'Hello' };
    const out = withAcoustics([sound('effect'), sound('cue'), sound('reward'), sound('music'), sound('ambience'), speech], { echo: 0.5, echoSeconds: 2 });
    const echoes = out.map((c) => (c.channel === 'sound' ? c.shape?.echo : undefined));
    expect(echoes).toEqual([0.5, 0.5, 0.5, undefined, undefined, undefined]);
    // Timing and place are untouched: the echo only adds a tail.
    out.forEach((c, i) => expect(c.at).toBe([sound('effect'), sound('cue'), sound('reward'), sound('music'), sound('ambience'), speech][i]!.at));
  });

  it('keeps a sound\'s own echo, and a dead room adds nothing', () => {
    const own = sound('effect', { echo: 0.1 });
    expect(withAcoustics([own], { echo: 0.9, echoSeconds: 3 })[0]).toEqual(own);
    expect(withAcoustics([sound('effect')], { echo: 0, echoSeconds: 1 })[0]).toEqual(sound('effect'));
  });
});

/** A fake context that records the graph. */
function fakeContext() {
  const made = { convolvers: 0, oscillators: 0, connections: [] as [string, string][] };
  const node = (name: string) => ({
    name,
    connect(to: { name?: string }) {
      made.connections.push([name, to?.name ?? 'param']);
    },
  });
  const param = () => ({ value: 0, setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined });
  const ctx: AudioContextLike = {
    currentTime: 0,
    destination: { name: 'out' },
    sampleRate: 8000,
    createOscillator: () => {
      made.oscillators += 1;
      return { ...node(`osc${made.oscillators}`), type: 'sine', frequency: { ...param(), name: 'freq' }, start: () => undefined, stop: () => undefined };
    },
    createGain: () => ({ ...node('gain'), gain: param() }),
    createStereoPanner: () => ({ ...node('pan'), pan: param() }),
    createBiquadFilter: () => ({ ...node('filter'), type: 'lowpass', frequency: param() }),
    createBuffer: (_c, length) => ({ getChannelData: () => new Float32Array(length) }),
    createBufferSource: () => ({ ...node('noise'), buffer: null, loop: false, start: () => undefined, stop: () => undefined }),
    createConvolver: () => {
      made.convolvers += 1;
      return { ...node('room'), buffer: null };
    },
  };
  return { ctx, made };
}

describe('the sound player', () => {
  it('sends an echoing sound into one shared room reverb, built once per length', () => {
    const { ctx, made } = fakeContext();
    const player = createSoundPlayer(ctx);
    player.play(sound('effect', { echo: 0.4, echoSeconds: 2 }), 0, false);
    player.play(sound('effect', { echo: 0.4, echoSeconds: 2 }), 0, false);
    player.play(sound('effect', { echo: 0.4, echoSeconds: 0.5 }), 0, false);
    expect(made.convolvers).toBe(2);
    expect(made.connections.filter(([from, to]) => from === 'room' && to === 'out')).toHaveLength(2);
  });

  it('a dry sound makes no reverb, and a context without one still plays', () => {
    const { ctx, made } = fakeContext();
    createSoundPlayer(ctx).play(sound('effect'), 0, false);
    expect(made.convolvers).toBe(0);
    const bare = fakeContext();
    delete (bare.ctx as { createConvolver?: unknown }).createConvolver;
    expect(() => createSoundPlayer(bare.ctx).play(sound('effect', { echo: 0.5 }), 0, false)).not.toThrow();
  });

  it('a wobble adds a slow oscillator on the pitch', () => {
    const { ctx, made } = fakeContext();
    createSoundPlayer(ctx).play(sound('effect', { wobbleHz: 5, wobble: 0.06, seconds: 1 }), 0, false);
    expect(made.oscillators).toBe(2);
    expect(made.connections).toContainEqual(['gain', 'freq']);
  });
});

describe('caption wrapping', () => {
  const width = (s: string) => s.length * 10;
  it('breaks a long line at spaces, never wider than the box', () => {
    const lines = wrapWords('Mabel: I can feel a relic two rooms away. Go left.', width, 200);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(width(l)).toBeLessThanOrEqual(200);
    expect(lines.join(' ')).toBe('Mabel: I can feel a relic two rooms away. Go left.');
  });
  it('keeps a short line whole', () => {
    expect(wrapWords('The Library', width, 200)).toEqual(['The Library']);
  });
});
