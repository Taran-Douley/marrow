import { describe, expect, it } from 'vitest';
import { createInput } from '../src/input';
import { defaultProfile, mergeProfile } from '../src/profile';
import {
  DEFAULT_FONT,
  bindInput,
  createGamepadPoller,
  createHaptics,
  createProfileStore,
  createSoundPlayer,
  createSpeaker,
  createVisual,
  createWebAdapter,
  drawCaptionBox,
  isControl,
  regionFromElement,
  type AudioContextLike,
} from '../src/adapters/web';
import type { OutputCommand } from '../src/types';

// ---- fakes -----------------------------------------------------------------

function fakeAudio(state = 'running') {
  const log: { hz: number; wave: string; start: number; stop: number; peak: number; panned: boolean }[] = [];
  const stopped: number[] = [];
  let resumed = 0;
  const ctx: AudioContextLike & { resumed(): number } = {
    currentTime: 10,
    destination: {},
    state,
    createOscillator() {
      const rec = { hz: 0, wave: '', start: 0, stop: 0, peak: 0, panned: false };
      log.push(rec);
      return {
        type: '',
        frequency: {
          set value(v: number) {
            rec.hz = v;
          },
          get value() {
            return rec.hz;
          },
        },
        connect: () => undefined,
        start: (when = 0) => void (rec.start = when),
        stop: (when = 0) => {
          rec.stop = when;
          stopped.push(when);
        },
        set typeValue(_v: string) {},
      } as never;
    },
    createGain() {
      const current = log[log.length - 1]!;
      return {
        gain: {
          value: 0,
          setValueAtTime: () => undefined,
          linearRampToValueAtTime: (v: number) => void (current.peak = Math.max(current.peak, v)),
        },
        connect: () => undefined,
      };
    },
    createStereoPanner() {
      log[log.length - 1]!.panned = true;
      return { pan: { value: 0 }, connect: () => undefined };
    },
    resume() {
      resumed++;
    },
    resumed: () => resumed,
  };
  return { ctx, log, stopped };
}

const soundCmd = (over: Partial<Extract<OutputCommand, { channel: 'sound' }>> = {}) =>
  ({ channel: 'sound', senses: ['hearing'], at: 1, role: 'cue', hz: 294, wave: 'triangle', gain: 1, pan: 0, ...over }) as Extract<
    OutputCommand,
    { channel: 'sound' }
  >;

function fakeTimers() {
  let next = 1;
  const queue = new Map<number, { fn: () => void; ms: number }>();
  return {
    timers: {
      set(fn: () => void, ms: number) {
        const id = next++;
        queue.set(id, { fn, ms });
        return id;
      },
      clear(id: unknown) {
        queue.delete(id as number);
      },
    },
    pending: () => [...queue.values()].map((q) => q.ms),
    runAll() {
      for (const [id, q] of [...queue]) {
        queue.delete(id);
        q.fn();
      }
    },
  };
}

class FakeElement {
  attrs: Record<string, string> = {};
  children: FakeElement[] = [];
  textContent = '';
  ownerDocument = { createElement: () => new FakeElement() };
  setAttribute(k: string, v: string) {
    this.attrs[k] = v;
  }
  appendChild(c: FakeElement) {
    this.children.push(c);
    return c;
  }
  get childElementCount() {
    return this.children.length;
  }
  get firstElementChild() {
    const first = this.children[0];
    return first ? { remove: () => void this.children.shift() } : null;
  }
}

// ---- sound -----------------------------------------------------------------

describe('sound player (Req 3.2, 3.6)', () => {
  it('schedules a beep after the delay, on the audio clock, with the voice and a click-free envelope', () => {
    const { ctx, log } = fakeAudio();
    createSoundPlayer(ctx).play(soundCmd({ hz: 587, wave: 'sine', gain: 0.5 }), 0.25, false);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ hz: 587, start: 10.25, panned: false });
    expect(log[0]!.stop).toBeCloseTo(10.25 + 0.16 + 0.02, 6);
    expect(log[0]!.peak).toBeCloseTo(0.5 * 0.35, 6); // player's cue volume times the master level
  });

  it('never schedules in the past', () => {
    const { ctx, log } = fakeAudio();
    createSoundPlayer(ctx).play(soundCmd(), -3, false);
    expect(log[0]!.start).toBe(10);
  });

  it('pans only when asked, and mono keeps it in the centre', () => {
    const a = fakeAudio();
    createSoundPlayer(a.ctx).play(soundCmd({ pan: -0.6 }), 0, false);
    expect(a.log[0]!.panned).toBe(true);
    const b = fakeAudio();
    createSoundPlayer(b.ctx).play(soundCmd({ pan: -0.6 }), 0, true);
    expect(b.log[0]!.panned).toBe(false);
  });

  it('plays a clear as two rising notes', () => {
    const { ctx, log } = fakeAudio();
    createSoundPlayer(ctx).play(soundCmd({ role: 'reward', hz: 880 }), 0, false);
    expect(log.map((l) => l.hz)).toEqual([880, 1320]);
    expect(log[1]!.start).toBeGreaterThan(log[0]!.start);
  });

  it('cancels what is scheduled, and unlocks a suspended context', () => {
    const { ctx, stopped } = fakeAudio('suspended');
    const player = createSoundPlayer(ctx);
    player.play(soundCmd(), 1, false);
    player.cancelAll();
    expect(stopped.at(-1)).toBe(10);
    player.unlock();
    expect(ctx.resumed()).toBe(1);
  });

  it('honours your own master gain and beep length', () => {
    const { ctx, log } = fakeAudio();
    createSoundPlayer(ctx, { masterGain: 1, cueSeconds: 0.5 }).play(soundCmd({ gain: 1 }), 0, false);
    expect(log[0]!.peak).toBe(1);
    expect(log[0]!.stop).toBeCloseTo(10.52, 6);
  });
});

// ---- speech ----------------------------------------------------------------

describe('speech mirrored to the live region (Req 4.1-4.4)', () => {
  const setup = (opts: { synth?: boolean; throws?: boolean } = {}) => {
    const lines: string[] = [];
    const spoken: unknown[] = [];
    let cancels = 0;
    const synth =
      opts.synth === false
        ? undefined
        : {
            speak: (u: unknown) => {
              if (opts.throws) throw new Error('no voice');
              spoken.push(u);
            },
            cancel: () => void cancels++,
          };
    const speaker = createSpeaker({
      region: { append: (t) => lines.push(t) },
      synth,
      makeUtterance: (text, volume) => ({ text, volume }),
    });
    return { speaker, lines, spoken, cancels: () => cancels };
  };

  it('writes every line to the region and speaks it when the voice is on', () => {
    const s = setup();
    s.speaker.say('Grave ahead.', { aloud: true, volume: 0.8 });
    expect(s.lines).toEqual(['Grave ahead.']);
    expect(s.spoken).toEqual([{ text: 'Grave ahead.', volume: 0.8 }]);
    expect(s.cancels()).toBe(1); // newest line wins
  });

  it('still writes to the region, and says nothing aloud, when the voice is off (4.2)', () => {
    const s = setup();
    s.speaker.say('Pressed a little early.', { aloud: false, volume: 1 });
    expect(s.lines).toEqual(['Pressed a little early.']);
    expect(s.spoken).toEqual([]);
  });

  it('is silent at zero volume but still written', () => {
    const s = setup();
    s.speaker.say('x', { aloud: true, volume: 0 });
    expect(s.lines).toEqual(['x']);
    expect(s.spoken).toEqual([]);
  });

  it('works with no speech support at all (4.4)', () => {
    const s = setup({ synth: false });
    expect(() => s.speaker.say('hello', { aloud: true, volume: 1 })).not.toThrow();
    expect(s.lines).toEqual(['hello']);
    expect(() => s.speaker.silence()).not.toThrow();
  });

  it('keeps the text even if speaking throws', () => {
    const s = setup({ throws: true });
    expect(() => s.speaker.say('hello', { aloud: true, volume: 1 })).not.toThrow();
    expect(s.lines).toEqual(['hello']);
  });

  it('wraps a page element as a polite live log and keeps only the latest lines', () => {
    const el = new FakeElement();
    const region = regionFromElement(el as unknown as HTMLElement, 3);
    expect(el.attrs).toMatchObject({ 'aria-live': 'polite', role: 'log' });
    for (const t of ['a', 'b', 'c', 'd', 'e']) region.append(t);
    expect(el.children.map((c) => c.textContent)).toEqual(['c', 'd', 'e']);
  });
});

// ---- storage ---------------------------------------------------------------

describe('profile store (Req 11.3)', () => {
  it('saves and loads a profile', () => {
    const data = new Map<string, string>();
    const store = createProfileStore({ getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) });
    expect(store.load()).toBeNull();
    const p = mergeProfile(defaultProfile(), { speed: 'fast', volume: { music: 0 } });
    store.save(p);
    expect(createProfileStore({ getItem: (k) => data.get(k) ?? null, setItem: () => undefined }).load()).toEqual(p);
  });

  it('falls back to memory when storage throws, instead of failing', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    const store = createProfileStore(blocked);
    const p = mergeProfile(defaultProfile(), { textScale: 2 });
    expect(() => store.save(p)).not.toThrow();
    expect(store.load()).toEqual(p);
  });

  it('works with no storage at all and survives garbage', () => {
    expect(createProfileStore(undefined).load()).toBeNull();
    const junk = createProfileStore({ getItem: () => '{not json', setItem: () => undefined });
    expect(junk.load()).toEqual(defaultProfile());
  });
});

// ---- input -----------------------------------------------------------------

describe('browser input (Req 1)', () => {
  function fakeTarget() {
    const handlers = new Map<string, (e: never) => void>();
    return {
      target: {
        addEventListener: (type: string, fn: (e: never) => void) => void handlers.set(type, fn),
        removeEventListener: (type: string) => void handlers.delete(type),
      },
      fire: (type: string, event: object = {}) => handlers.get(type)?.(event as never),
      has: (type: string) => handlers.has(type),
    };
  }
  const setup = () => {
    const t = fakeTarget();
    const counts = { press: 0, escape: 0 };
    const unbind = bindInput(t.target, createInput(), {
      onPress: () => void counts.press++,
      onEscape: () => void counts.escape++,
    });
    return { ...t, counts, unbind };
  };

  it('turns keys, clicks and touches into presses, and Escape into escape', () => {
    const s = setup();
    s.fire('keydown', { code: 'KeyA', key: 'a' });
    s.fire('keyup', { code: 'KeyA', key: 'a' });
    s.fire('pointerdown', { target: {} });
    s.fire('keydown', { code: 'Escape', key: 'Escape' });
    expect(s.counts).toEqual({ press: 2, escape: 1 });
  });

  it('ignores key repeat', () => {
    const s = setup();
    s.fire('keydown', { code: 'Space', key: ' ' });
    s.fire('keydown', { code: 'Space', key: ' ', repeat: true });
    s.fire('keydown', { code: 'Space', key: ' ', repeat: true });
    expect(s.counts.press).toBe(1);
  });

  it('leaves form controls alone, so a setting can be changed without a jump (Req 2.4)', () => {
    const s = setup();
    const control = { closest: (sel: string) => (sel.includes('select') ? {} : null) };
    s.fire('keydown', { code: 'ArrowDown', key: 'ArrowDown', target: control });
    s.fire('pointerdown', { target: control });
    expect(s.counts.press).toBe(0);
    expect(isControl(control)).toBe(true);
    expect(isControl({ closest: () => null })).toBe(false);
    expect(isControl(null)).toBe(false);
  });

  it('stops page scrolling on Space but not other keys such as F5', () => {
    const s = setup();
    let prevented = 0;
    const preventDefault = () => void prevented++;
    s.fire('keydown', { code: 'Space', key: ' ', preventDefault });
    s.fire('keyup', { code: 'Space', key: ' ' });
    s.fire('keydown', { code: 'F5', key: 'F5', preventDefault });
    expect(prevented).toBe(1);
    expect(s.counts.press).toBe(2); // F5 still counts as a switch press
  });

  it('leaves shortcuts and Tab to the browser', () => {
    const s = setup();
    s.fire('keydown', { code: 'KeyC', key: 'c', ctrlKey: true });
    s.fire('keydown', { code: 'Tab', key: 'Tab' });
    expect(s.counts.press).toBe(0);
  });

  it('forgets held keys on blur, and stops listening when unbound', () => {
    const s = setup();
    s.fire('keydown', { code: 'KeyA', key: 'a' });
    s.fire('blur');
    s.fire('keydown', { code: 'KeyA', key: 'a' });
    expect(s.counts.press).toBe(2);
    s.unbind();
    expect(s.has('keydown')).toBe(false);
  });

  it('counts any gamepad button once per press and survives a disconnect (Req 1.2, 1.7)', () => {
    let pads: ({ index: number; buttons: { pressed: boolean }[] } | null)[] = [
      { index: 0, buttons: [{ pressed: false }, { pressed: true }] },
    ];
    let presses = 0;
    const poller = createGamepadPoller(() => pads, createInput(), { onPress: () => void presses++, onEscape: () => undefined });
    poller.poll();
    poller.poll(); // still held: no second press
    expect(presses).toBe(1);
    pads = [null]; // unplugged
    poller.poll();
    pads = [{ index: 0, buttons: [{ pressed: true }, { pressed: false }] }]; // plugged back in, held
    poller.poll();
    expect(presses).toBe(2);
  });
});

// ---- haptics ---------------------------------------------------------------

describe('haptics (Req 3a.5)', () => {
  it('vibrates the phone and rumbles each "on" part of the pattern at its own time', () => {
    const vibrations: number[][] = [];
    const rumbles: { duration: number }[] = [];
    const scheduled: number[] = [];
    const haptics = createHaptics({
      vibrate: (p) => void vibrations.push(p),
      getPads: () => [{ vibrationActuator: { playEffect: (_t, params) => void rumbles.push({ duration: params.duration! }) } }, null],
      schedule: (fn, ms) => {
        scheduled.push(ms);
        fn();
      },
    });
    haptics.buzz([250, 120, 250]);
    expect(vibrations).toEqual([[250, 120, 250]]);
    expect(scheduled).toEqual([0, 370]);
    expect(rumbles.map((r) => r.duration)).toEqual([250, 250]);
  });

  it('does nothing for an empty pattern and never throws', () => {
    let calls = 0;
    const quiet = createHaptics({ vibrate: () => void calls++, schedule: () => undefined });
    quiet.buzz([]);
    expect(calls).toBe(0);
    const angry = createHaptics({
      vibrate: () => {
        throw new Error('not allowed');
      },
      getPads: () => [{ vibrationActuator: { playEffect: () => { throw new Error('no'); } } }],
      schedule: (fn) => fn(),
    });
    expect(() => angry.buzz([50])).not.toThrow();
  });
});

// ---- visual ----------------------------------------------------------------

function recordingCtx() {
  const calls: string[] = [];
  const texts: string[] = [];
  const widths: number[] = [];
  const target: Record<string, unknown> = { font: '', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: '', textBaseline: '' };
  const ctx = new Proxy(target, {
    get(obj, prop: string) {
      if (prop in obj) return obj[prop];
      if (prop === 'measureText') return (t: string) => ({ width: t.length * 10 });
      if (prop === 'fillText') return (t: string) => void texts.push(t);
      return (...args: unknown[]) => {
        calls.push(prop);
        if (prop === 'stroke') widths.push(obj.lineWidth as number);
        void args;
      };
    },
    set(obj, prop: string, value) {
      obj[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, texts, widths };
}

describe('visual state and caption box (Req 5)', () => {
  it('lights pips in order, and a caption without a pip starts afresh', () => {
    const v = createVisual();
    v.caption('Grave', 1);
    v.caption('Grave', 2);
    expect(v.state).toMatchObject({ caption: 'Grave', pip: 2 });
    v.caption('Fence');
    expect(v.state.pip).toBe(0);
    v.indicator(true, 1000);
    expect(v.state.indicatorUntil).toBe(1220);
    v.reset();
    expect(v.state).toMatchObject({ caption: '', pip: 0, indicatorUntil: 0 });
  });

  it('draws the caption, three round pips, a diamond pip and labels so colour is never the only cue', () => {
    const v = createVisual();
    v.caption('Grave', 3);
    const { ctx, calls, texts } = recordingCtx();
    drawCaptionBox(ctx, v.state, defaultProfile(), { x: 0, y: 0, width: 700, height: 90 }, 0);
    expect(texts).toEqual(expect.arrayContaining(['Grave', '1', '2', '3', 'NOW', 'sound']));
    expect(calls.filter((c) => c === 'arc')).toHaveLength(4); // marker + three round pips
    expect(calls).toContain('closePath'); // the diamond for the press
  });

  it('shows a steady thick ring instead of a flash when motion is reduced', () => {
    const v = createVisual();
    v.indicator(false, 0, 1000);
    const steady = recordingCtx();
    drawCaptionBox(steady.ctx, v.state, defaultProfile(), { x: 0, y: 0, width: 700, height: 90 }, 10);
    expect(steady.widths[0]).toBe(6);
    const v2 = createVisual();
    v2.indicator(true, 0, 1000);
    const flash = recordingCtx();
    drawCaptionBox(flash.ctx, v2.state, defaultProfile(), { x: 0, y: 0, width: 700, height: 90 }, 10);
    expect(flash.calls).toContain('fill');
    expect(flash.widths[0]).not.toBe(6);
  });

  it('has a hyperlegible font first with real fallbacks', () => {
    expect(DEFAULT_FONT.startsWith('"Atkinson Hyperlegible"')).toBe(true);
    expect(DEFAULT_FONT).toContain('sans-serif');
  });
});

// ---- the adapter -----------------------------------------------------------

describe('createWebAdapter', () => {
  function setup(extra: { audio?: ReturnType<typeof fakeAudio>; clock?: { t: number } } = {}) {
    const audio = extra.audio ?? fakeAudio();
    const region = new FakeElement();
    const t = fakeTimers();
    const lines: unknown[] = [];
    const buzzes: number[][] = [];
    const store = new Map<string, string>();
    const clock = extra.clock ?? { t: 5000 };
    const adapter = createWebAdapter({
      region: region as unknown as HTMLElement,
      audioContext: audio.ctx,
      synth: { speak: (u) => void lines.push(u), cancel: () => undefined },
      makeUtterance: (text, volume) => ({ text, volume }),
      storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) },
      vibrate: (p) => void buzzes.push(p),
      getPads: () => [],
      now: () => clock.t,
      timers: t.timers,
    });
    return { adapter, audio, region, t, lines, buzzes, store, clock };
  }

  const cmds: OutputCommand[] = [
    soundCmd({ at: 11 }),
    { channel: 'speech', senses: ['hearing'], at: 11, text: 'Grave ahead.' },
    { channel: 'captions', senses: ['sight'], at: 11, text: 'Grave', pip: 1 },
    { channel: 'indicator', senses: ['sight'], at: 11, flash: true },
    { channel: 'haptics', senses: ['touch'], at: 11, pattern: [250, 120, 250] },
  ];

  it('delays each command by (its time - now) / rate, in real time', () => {
    const s = setup();
    // The commands are due 1 running second ahead; at Slow (0.6) that is 1.667 real seconds.
    s.adapter.perform(cmds, { now: 10, rate: 0.6 }, defaultProfile());
    expect(s.audio.log[0]!.start).toBeCloseTo(10 + 1 / 0.6, 6);
    expect(s.t.pending().every((ms) => Math.abs(ms - 1666.67) < 1)).toBe(true);
    expect(s.t.pending()).toHaveLength(4);
    expect(s.region.children).toHaveLength(0); // nothing yet: it is not time
  });

  it('delivers speech, captions, the marker and the buzz when their moment comes', () => {
    const s = setup();
    s.adapter.perform(cmds, { now: 10, rate: 0.6 }, defaultProfile());
    s.t.runAll();
    expect(s.region.children.map((c) => c.textContent)).toEqual(['Grave ahead.']);
    expect(s.lines).toEqual([{ text: 'Grave ahead.', volume: 1 }]);
    expect(s.adapter.visual.state).toMatchObject({ caption: 'Grave', pip: 1, indicatorFlash: true, indicatorUntil: 5220 });
    expect(s.buzzes).toEqual([[250, 120, 250]]);
  });

  it('does things due now at once', () => {
    const s = setup();
    s.adapter.perform(
      [{ channel: 'captions', senses: ['sight'], at: 10, text: 'Now' }],
      { now: 10, rate: 0.6 },
      defaultProfile(),
    );
    expect(s.adapter.visual.state.caption).toBe('Now');
    expect(s.t.pending()).toEqual([]);
  });

  it('writes to the live region but stays quiet when the built-in voice is off', () => {
    const s = setup();
    s.adapter.perform(cmds, { now: 10, rate: 1 }, mergeProfile(defaultProfile(), { voice: false }));
    s.t.runAll();
    expect(s.region.children.map((c) => c.textContent)).toEqual(['Grave ahead.']);
    expect(s.lines).toEqual([]);
  });

  it('uses the player\'s speech volume', () => {
    const s = setup();
    s.adapter.perform(cmds, { now: 10, rate: 1 }, mergeProfile(defaultProfile(), { volume: { speech: 0.4 } }));
    s.t.runAll();
    expect(s.lines).toEqual([{ text: 'Grave ahead.', volume: 0.4 }]);
  });

  it('drops what is scheduled when play restarts', () => {
    const s = setup();
    s.adapter.perform(cmds, { now: 10, rate: 0.6 }, defaultProfile());
    s.adapter.cancelPending();
    expect(s.t.pending()).toEqual([]);
    s.t.runAll();
    expect(s.region.children).toHaveLength(0);
    expect(s.audio.stopped.length).toBeGreaterThan(0);
  });

  it('saves and loads the profile, and merges OS preferences safely when matchMedia is missing', () => {
    const s = setup();
    expect(s.adapter.loadProfile()).toBeNull();
    const p = mergeProfile(defaultProfile(), { speed: 'medium' });
    s.adapter.saveProfile(p);
    expect(s.adapter.loadProfile()).toEqual(p);
    expect(s.adapter.osPreferences()).toEqual({});
    expect(s.adapter.withOsPreferences(p)).toEqual(p);
  });

  it('unlocks audio, binds input with a fake target, and cleans up', () => {
    const audio = fakeAudio('suspended');
    const s = setup({ audio });
    const handlers = new Map<string, (e: never) => void>();
    const adapter = createWebAdapter({
      region: new FakeElement() as unknown as HTMLElement,
      audioContext: audio.ctx,
      synth: { speak: () => undefined, cancel: () => undefined },
      target: {
        addEventListener: (t, fn) => void handlers.set(t, fn),
        removeEventListener: (t) => void handlers.delete(t),
      },
      storage: { getItem: () => null, setItem: () => undefined },
      getPads: () => [],
      timers: s.t.timers,
    });
    let presses = 0;
    const stop = adapter.bind({ onPress: () => void presses++, onEscape: () => undefined });
    handlers.get('keydown')?.({ code: 'Space', key: ' ' } as never);
    expect(presses).toBe(1);
    adapter.unlock();
    expect(audio.ctx.resumed()).toBe(1); // the suspended context was resumed
    stop();
    expect(handlers.size).toBe(0);
    adapter.dispose();
  });
});
