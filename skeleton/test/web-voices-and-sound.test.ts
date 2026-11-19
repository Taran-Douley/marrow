import { describe, expect, it } from 'vitest';
import {
  chooseVoice,
  createSoundPlayer,
  createSpeaker,
  createWebAdapter,
  type AudioContextLike,
  type ClipHandle,
  type VoiceInfo,
  type VoiceProvider,
} from '../src/adapters/web';
import { defaultProfile, mergeProfile } from '../src/profile';
import type { OutputCommand } from '../src/types';

// ---- a richer fake audio context -------------------------------------------

interface Param {
  value: number;
  calls: [string, number, number][];
  setValueAtTime(v: number, t: number): void;
  linearRampToValueAtTime(v: number, t: number): void;
}
const param = (): Param => {
  const p: Param = {
    value: 0,
    calls: [],
    setValueAtTime: (v, t) => void p.calls.push(['set', v, t]),
    linearRampToValueAtTime: (v, t) => void p.calls.push(['ramp', v, t]),
  };
  return p;
};

interface Source {
  kind: 'osc' | 'noise';
  freq: Param;
  start: number;
  stop: number;
  loop?: boolean;
  stops: number[];
}
interface Chain {
  source: Source;
  gain: Param;
  filter?: { type: string; freq: Param };
  pan?: Param;
}

function fullAudio(options: { noise?: boolean; filter?: boolean; pan?: boolean } = {}) {
  const { noise = true, filter = true, pan = true } = options;
  const chains: Chain[] = [];
  let buffers = 0;
  let pending: Partial<Chain> = {};
  const ctx: AudioContextLike = {
    currentTime: 20,
    destination: {},
    sampleRate: 8000,
    createOscillator() {
      const source: Source = { kind: 'osc', freq: param(), start: 0, stop: 0, stops: [] };
      pending = { source };
      return {
        type: '',
        frequency: source.freq,
        connect: () => undefined,
        start: (w = 0) => void (source.start = w),
        stop: (w = 0) => {
          source.stop = w;
          source.stops.push(w);
        },
      };
    },
    createGain() {
      const gain = param();
      chains.push({ source: pending.source!, gain });
      return { gain, connect: () => undefined };
    },
    ...(pan
      ? {
          createStereoPanner() {
            const p = param();
            chains[chains.length - 1]!.pan = p;
            return { pan: p, connect: () => undefined };
          },
        }
      : {}),
    ...(filter
      ? {
          createBiquadFilter() {
            const freq = param();
            const f = { type: '', freq };
            chains[chains.length - 1]!.filter = f; // the player makes the gain first, then the filter
            return {
              get type() {
                return f.type;
              },
              set type(v: string) {
                f.type = v;
              },
              frequency: freq,
              connect: () => undefined,
            };
          },
        }
      : {}),
    ...(noise
      ? {
          createBuffer: () => {
            buffers++;
            return { getChannelData: () => new Float32Array(16000) };
          },
          createBufferSource() {
            const source: Source = { kind: 'noise', freq: param(), start: 0, stop: 0, stops: [] };
            pending = { source };
            return {
              buffer: null,
              get loop() {
                return source.loop ?? false;
              },
              set loop(v: boolean) {
                source.loop = v;
              },
              connect: () => undefined,
              start: (w = 0) => void (source.start = w),
              stop: (w = 0) => {
                source.stop = w;
                source.stops.push(w);
              },
            };
          },
        }
      : {}),
  };
  return { ctx, chains, buffers: () => buffers };
}

type SoundCmd = Extract<OutputCommand, { channel: 'sound' }>;
const cmd = (over: Partial<SoundCmd> = {}): SoundCmd => ({
  channel: 'sound',
  senses: ['hearing'],
  at: 1,
  role: 'cue',
  hz: 294,
  wave: 'triangle',
  gain: 1,
  pan: 0,
  ...over,
});

// ---- shaped sound ----------------------------------------------------------

describe('shaped sound (Req 18.1, 18.2)', () => {
  const approach = cmd({
    role: 'approach',
    hz: 147,
    gain: 0.2,
    pan: 0.8,
    shape: { hzTo: 220.5, panTo: 0, filterHz: 300, filterTo: 2200, span: 1.2 },
  });

  it('an approach tone lasts as long as the level moment it fills: span / rate real seconds', () => {
    const { ctx, chains } = fullAudio();
    createSoundPlayer(ctx).play(approach, 0, false, 0.6);
    expect(chains[0]!.source.start).toBe(20);
    expect(chains[0]!.source.stop).toBeCloseTo(20 + 1.2 / 0.6 + 0.02, 9); // 2 s at Slow
    const fast = fullAudio();
    createSoundPlayer(fast.ctx).play(approach, 0, false, 1);
    expect(fast.chains[0]!.source.stop).toBeCloseTo(20 + 1.2 + 0.02, 9);
  });

  it('glides the pitch, the filter and the pan from start to end, so it arrives at the centre as the press does', () => {
    const { ctx, chains } = fullAudio();
    createSoundPlayer(ctx).play(approach, 0, false, 0.6);
    const c = chains[0]!;
    expect(c.source.freq.calls).toEqual([['set', 147, 20], ['ramp', 220.5, 22]]);
    expect(c.filter!.type).toBe('lowpass');
    expect(c.filter!.freq.calls).toEqual([['set', 300, 20], ['ramp', 2200, 22]]);
    expect(c.pan!.calls).toEqual([['set', 0.8, 20], ['ramp', 0, 22]]);
  });

  it('fades long sounds in and out so they never click or pump', () => {
    const { ctx, chains } = fullAudio();
    createSoundPlayer(ctx).play(approach, 0, false, 0.6);
    const calls = chains[0]!.gain.calls;
    expect(calls[0]).toEqual(['set', 0, 20]);
    expect(calls.at(-1)![1]).toBe(0); // ends silent
    expect(calls.some(([kind, v]) => kind === 'set' && v > 0)).toBe(true); // holds at the peak before the release
  });

  it('keeps short beeps quick: a 10 ms attack and a release at the end', () => {
    const { ctx, chains } = fullAudio();
    createSoundPlayer(ctx).play(cmd(), 0, false);
    expect(chains[0]!.gain.calls).toEqual([['set', 0, 20], ['ramp', 0.35, 20.01], ['ramp', 0, 20.16]]);
  });

  it('plays filtered noise for wind and the whoosh, from one shared buffer', () => {
    const { ctx, chains, buffers } = fullAudio();
    const wind = cmd({ role: 'ambience', hz: 0, gain: 0.06, shape: { noise: true, filterHz: 400, filterTo: 600, span: 2.5 } });
    const player = createSoundPlayer(ctx);
    player.play(wind, 0, false, 0.6);
    player.play(wind, 3, false, 0.6);
    expect(chains.map((c) => c.source.kind)).toEqual(['noise', 'noise']);
    expect(chains[0]!.source.loop).toBe(true);
    expect(buffers()).toBe(1);
    expect(chains[0]!.filter!.freq.calls[0]).toEqual(['set', 400, 20]);
  });

  it('skips noise quietly where the browser cannot make it, and still plays tones', () => {
    const { ctx, chains } = fullAudio({ noise: false });
    const player = createSoundPlayer(ctx);
    expect(() => player.play(cmd({ shape: { noise: true, seconds: 0.3 } }), 0, false)).not.toThrow();
    expect(chains).toHaveLength(0);
    player.play(cmd(), 0, false);
    expect(chains).toHaveLength(1);
  });

  it('still plays a plain tone with no filter, panner or glide support', () => {
    const { ctx, chains } = fullAudio({ filter: false, pan: false });
    expect(() => createSoundPlayer(ctx).play(approach, 0, false, 0.6)).not.toThrow();
    expect(chains).toHaveLength(1);
    expect(chains[0]!.filter).toBeUndefined();
    expect(chains[0]!.pan).toBeUndefined();
  });

  it('mono ignores the pan glide', () => {
    const { ctx, chains } = fullAudio();
    createSoundPlayer(ctx).play(approach, 0, true, 0.6);
    expect(chains[0]!.pan).toBeUndefined();
  });

  it('cancels noise and tones alike', () => {
    const { ctx, chains } = fullAudio();
    const player = createSoundPlayer(ctx);
    player.play(cmd(), 5, false);
    player.play(cmd({ shape: { noise: true, seconds: 0.5 } }), 5, false);
    player.cancelAll();
    expect(chains.map((c) => c.source.stops.at(-1))).toEqual([20, 20]);
  });
});

// ---- voices ----------------------------------------------------------------

describe('plugging in your own voice (Req 4)', () => {
  function setup(opts: { provider?: VoiceProvider; clips?: Record<string, string> | ((t: string) => string | undefined); playClip?: (url: string, v: number) => ClipHandle } = {}) {
    const region: string[] = [];
    const browser: string[] = [];
    const log: string[] = [];
    const speaker = createSpeaker({
      region: { append: (t) => void region.push(t) },
      synth: { speak: (u) => void browser.push((u as { text: string }).text), cancel: () => void log.push('browser-cancel') },
      makeUtterance: (text) => ({ text }),
      provider: opts.provider,
      clips: opts.clips,
      playClip: opts.playClip,
    });
    return { speaker, region, browser, log };
  }
  const on = { aloud: true, volume: 0.8 };
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('speaks through the provider instead of the browser, and still writes the text log', () => {
    const said: [string, number][] = [];
    const s = setup({ provider: { speak: (t, h) => void said.push([t, h.volume]), cancel: () => undefined } });
    s.speaker.say('Grave ahead.', on);
    expect(said).toEqual([['Grave ahead.', 0.8]]);
    expect(s.browser).toEqual([]);
    expect(s.region).toEqual(['Grave ahead.']);
  });

  it('stops the old line when a newer one arrives, and on silence', () => {
    let cancels = 0;
    const s = setup({ provider: { speak: () => undefined, cancel: () => void cancels++ } });
    s.speaker.say('one', on);
    s.speaker.say('two', on);
    s.speaker.silence();
    expect(cancels).toBe(3);
  });

  it('says nothing aloud when the voice is off or silent, whoever the provider is', () => {
    let calls = 0;
    const s = setup({ provider: { speak: () => void calls++, cancel: () => undefined } });
    s.speaker.say('quiet', { aloud: false, volume: 1 });
    s.speaker.say('mute', { aloud: true, volume: 0 });
    expect(calls).toBe(0);
    expect(s.region).toEqual(['quiet', 'mute']);
  });

  it('falls back to the browser voice if the provider throws, so a line is never lost', () => {
    const s = setup({
      provider: {
        speak: () => {
          throw new Error('service down');
        },
        cancel: () => undefined,
      },
    });
    s.speaker.say('Level complete.', on);
    expect(s.browser).toEqual(['Level complete.']);
  });

  it('falls back if the provider rejects later (a network voice that fails)', async () => {
    const s = setup({ provider: { speak: () => Promise.reject(new Error('timeout')), cancel: () => undefined } });
    s.speaker.say('Hurt.', on);
    await settle();
    expect(s.browser).toEqual(['Hurt.']);
  });

  it('plays a recording for the exact line, else the browser', () => {
    const played: [string, number][] = [];
    const s = setup({
      clips: { 'Grave ahead.': '/voice/grave.mp3' },
      playClip: (url, v) => {
        played.push([url, v]);
        return { stop: () => undefined, done: new Promise(() => undefined) };
      },
    });
    s.speaker.say('Grave ahead.', on);
    s.speaker.say('Fence ahead.', on);
    expect(played).toEqual([['/voice/grave.mp3', 0.8]]);
    expect(s.browser).toEqual(['Fence ahead.']);
  });

  it('finds recordings with a function, for naming schemes', () => {
    const urls: string[] = [];
    const s = setup({
      clips: (text) => (text.endsWith('ahead.') ? `/voice/${text.toLowerCase().replace(/\W+/g, '-')}.mp3` : undefined),
      playClip: (url) => {
        urls.push(url);
        return { stop: () => undefined, done: new Promise(() => undefined) };
      },
    });
    s.speaker.say('Fence ahead.', on);
    expect(urls).toEqual(['/voice/fence-ahead-.mp3']);
  });

  it('falls back to the browser if a recording cannot be played', async () => {
    const s = setup({
      clips: { 'No press.': '/missing.mp3' },
      playClip: () => ({ stop: () => undefined, done: Promise.reject(new Error('404')) }),
    });
    s.speaker.say('No press.', on);
    await settle();
    expect(s.browser).toEqual(['No press.']);
  });

  it('stops a recording that is playing when a newer line arrives', () => {
    let stopped = 0;
    const s = setup({
      clips: { a: '/a.mp3' },
      playClip: () => ({ stop: () => void stopped++, done: new Promise(() => undefined) }),
    });
    s.speaker.say('a', on);
    s.speaker.say('b', on);
    expect(stopped).toBe(1);
  });

  it('prefers the provider over a recording', () => {
    const order: string[] = [];
    const s = setup({
      provider: { speak: () => void order.push('provider'), cancel: () => undefined },
      clips: { x: '/x.mp3' },
      playClip: () => {
        order.push('clip');
        return { stop: () => undefined, done: new Promise(() => undefined) };
      },
    });
    s.speaker.say('x', on);
    expect(order).toEqual(['provider']);
  });

  it('works end to end through the web adapter', () => {
    const said: string[] = [];
    const region = {
      attrs: {} as Record<string, string>,
      children: [] as { textContent: string }[],
      ownerDocument: { createElement: () => ({ textContent: '' }) },
      setAttribute(k: string, v: string) {
        this.attrs[k] = v;
      },
      appendChild(c: { textContent: string }) {
        this.children.push(c);
      },
      get childElementCount() {
        return this.children.length;
      },
      firstElementChild: null,
    };
    const adapter = createWebAdapter({
      region: region as unknown as HTMLElement,
      audioContext: fullAudio().ctx,
      synth: { speak: () => said.push('browser'), cancel: () => undefined },
      makeUtterance: () => ({}),
      voice: { provider: { speak: (t) => void said.push(`mine:${t}`), cancel: () => undefined } },
      storage: { getItem: () => null, setItem: () => undefined },
      getPads: () => [],
      timers: { set: (fn) => (fn(), 0), clear: () => undefined },
    });
    const line: OutputCommand = { channel: 'speech', senses: ['hearing'], at: 1, text: 'Grave ahead.' };
    adapter.perform([line], { now: 1, rate: 1 }, defaultProfile());
    expect(said).toEqual(['mine:Grave ahead.']);
    expect(region.children.map((c) => c.textContent)).toEqual(['Grave ahead.']);
    adapter.perform([line], { now: 1, rate: 1 }, mergeProfile(defaultProfile(), { voice: false }));
    expect(said).toEqual(['mine:Grave ahead.']); // the voice is off: still written, not spoken
    expect(region.children).toHaveLength(2);
  });
});

describe('choosing a more natural browser voice', () => {
  const voices: VoiceInfo[] = [
    { name: 'Microsoft David - English (United States)', lang: 'en-US', localService: true, default: true },
    { name: 'Microsoft Sonia Online (Natural) - English (United Kingdom)', lang: 'en-GB', localService: false },
    { name: 'Google UK English Female', lang: 'en-GB', localService: false },
    { name: 'Microsoft Aria Online (Natural) - English (United States)', lang: 'en-US', localService: false },
    { name: 'Microsoft Elsa Online (Natural) - Italian (Italy)', lang: 'it-IT', localService: false },
  ];

  it('takes a natural voice over the plain default', () => {
    expect(chooseVoice(voices, {}, 'en-US')!.name).toContain('Aria');
  });

  it('prefers the exact region when it can', () => {
    expect(chooseVoice(voices, {}, 'en-GB')!.name).toContain('Sonia');
  });

  it('never picks another language', () => {
    expect(chooseVoice(voices, {}, 'it-IT')!.name).toContain('Elsa');
    expect(chooseVoice(voices, {}, 'fr-FR')).toBeUndefined();
  });

  it('honours your named voices, best first, ignoring case', () => {
    expect(chooseVoice(voices, { names: ['no such voice', 'google uk'] }, 'en-GB')!.name).toBe('Google UK English Female');
    expect(chooseVoice(voices, { names: ['david'] }, 'en-US')!.name).toContain('David');
  });

  it('lets a game choose its own language', () => {
    expect(chooseVoice(voices, { lang: 'it' }, 'en-US')!.name).toContain('Elsa');
  });

  it('falls back to the default voice when none sound natural', () => {
    const plain: VoiceInfo[] = [
      { name: 'Voice A', lang: 'en-US' },
      { name: 'Voice B', lang: 'en-US', default: true },
    ];
    expect(chooseVoice(plain, {}, 'en-US')!.name).toBe('Voice B');
    expect(chooseVoice([], {}, 'en-US')).toBeUndefined();
  });
});
