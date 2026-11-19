import { createInput } from '../../input';
import { withOsPreferences, type OsPreferences } from '../../profile';
import type { OutputCommand, Profile, SpeechTone } from '../../types';

/** Browsers accept pitch and rate from 0.1 to 2 or so; stay well inside. */
const clampTone = (v: number): number => Math.max(0.5, Math.min(2, v));
import { createHaptics, type Haptics, type RumblePadLike } from './haptics';
import { bindInput, createGamepadPoller, type EventTargetLike, type GamepadLike, type InputHandlers } from './input';
import { createSoundPlayer, type AudioContextLike, type SoundOptions, type SoundPlayer } from './sound';
import {
  chooseVoice,
  createSpeaker,
  regionFromElement,
  type BrowserVoiceOptions,
  type ClipHandle,
  type Clips,
  type PlayClip,
  type Speaker,
  type SynthLike,
  type VoiceProvider,
} from './speech';
import { createProfileStore, type ProfileStore, type StorageLike } from './storage';
import { createVisual, drawCaptionBox, type Rect, type Visual, type WebStyle } from './visual';

export { createSoundPlayer } from './sound';
export { fingerprint, registerOffline, serviceWorkerSource } from './offline';
export type { ServiceWorkerOptions } from './offline';
export { chooseVoice, clipsBySlug, createSpeaker, regionFromElement, slugOf } from './speech';
export type { BrowserVoiceOptions, ClipHandle, Clips, PlayClip, SayHow, SpeakerOptions, VoiceInfo, VoiceProvider } from './speech';
export { createProfileStore } from './storage';
export { bindInput, createGamepadPoller, isControl } from './input';
export { createHaptics } from './haptics';
export { createVisual, drawCaptionBox, DEFAULT_FONT } from './visual';
export type { AudioContextLike, SoundOptions } from './sound';
export type { RegionLike, SynthLike } from './speech';
export type { StorageLike } from './storage';
export type { WebStyle, Rect, VisualState } from './visual';

interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

/** Everything is injectable, so the adapter can be tested without a browser. */
export interface WebAdapterOptions {
  /** The aria-live region. A screen reader reads whatever is added to it. */
  region: HTMLElement;
  /** Where key and pointer events come from. Default: the window. */
  target?: EventTargetLike;
  audioContext?: AudioContextLike;
  synth?: SynthLike;
  makeUtterance?: (text: string, volume: number, tone?: SpeechTone) => unknown;
  storage?: StorageLike;
  storageKey?: string;
  getPads?: () => readonly (GamepadLike & RumblePadLike | null)[];
  vibrate?: (pattern: number[]) => unknown;
  now?: () => number;
  timers?: Timers;
  sound?: SoundOptions;
  /** Fonts and colour overrides for what the kit draws. */
  style?: Partial<WebStyle>;
  /**
   * Who speaks aloud. Leave it out for the best voice the browser has. Plug in
   * your own AI voice (`provider`), your own recordings (`clips`), or choose a
   * browser voice by name (`browser`). The text log is written whichever you pick.
   */
  voice?: {
    provider?: VoiceProvider;
    clips?: Clips;
    /** How a recording is played. Default: a plain audio element. */
    playClip?: PlayClip;
    browser?: BrowserVoiceOptions;
    /**
     * Let each line finish before the next starts. Off by default (the newest line cuts in, best for
     * fast games). Turn it on for story games with long lines. Events choose 'wait', 'cut-in' or
     * 'latest' with `speech` in their presentation.
     */
    queue?: boolean;
    /** Most lines that may wait at once when queueing. Default 3. */
    maxWaiting?: number;
  };
}

/** Play a recording with an audio element. `done` rejects if the file cannot play. */
const playClipWithAudioElement: PlayClip = (url, volume): ClipHandle => {
  const audio = new Audio(url);
  audio.volume = volume;
  const done = new Promise<void>((resolve, reject) => {
    audio.addEventListener('ended', () => resolve());
    audio.addEventListener('error', () => reject(new Error(`Could not play ${url}`)));
    audio.play().catch(reject);
  });
  return {
    done,
    stop() {
      audio.pause();
      audio.currentTime = 0;
    },
  };
};

export interface PerformTiming {
  /** Level time now, in running seconds. */
  now: number;
  /** Running seconds per real second (the speed rate). */
  rate: number;
}

export interface WebAdapter {
  /** Play, say, show and buzz what the channels produced, each at its own moment. */
  perform(commands: readonly OutputCommand[], timing: PerformTiming, profile: Profile): void;
  /** True while the voice is saying a line or has lines waiting. */
  speaking(): boolean;
  /** Drop everything scheduled but not yet played. Pass `silence` to also stop speech. */
  cancelPending(options?: { silence?: boolean }): void;
  /** Start listening for key, pointer and gamepad presses. Returns a function that stops. */
  bind(handlers: InputHandlers): () => void;
  /** Call once per frame so gamepad buttons count as the switch. */
  poll(): void;
  /** Browsers allow sound only after a gesture: call this from the first press. */
  unlock(): void;
  loadProfile(): Profile | null;
  saveProfile(profile: Profile): void;
  osPreferences(): OsPreferences;
  /** Merge OS preferences (reduced motion, contrast) into a profile. */
  withOsPreferences(profile: Profile): Profile;
  readonly visual: Visual;
  drawCaptionBox(ctx: CanvasRenderingContext2D, profile: Profile, rect: Rect): void;
  now(): number;
  dispose(): void;
}

export function createWebAdapter(options: WebAdapterOptions): WebAdapter {
  const now = options.now ?? (() => performance.now());
  const timers: Timers = options.timers ?? {
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  };

  // Browser pieces are created only when first needed, and only if they exist.
  let audio: SoundPlayer | undefined;
  const getAudio = (): SoundPlayer | undefined => {
    if (audio) return audio;
    const ctx = options.audioContext ?? (typeof AudioContext !== 'undefined' ? new AudioContext() : undefined);
    if (ctx) audio = createSoundPlayer(ctx, options.sound);
    return audio;
  };

  const synth: SynthLike | undefined =
    options.synth ?? (typeof speechSynthesis !== 'undefined' ? speechSynthesis : undefined);
  const speaker: Speaker = createSpeaker({
    region: regionFromElement(options.region),
    synth,
    makeUtterance:
      options.makeUtterance ??
      ((text, volume, tone) => {
        const u = new SpeechSynthesisUtterance(text);
        u.volume = volume;
        const prefs = options.voice?.browser ?? {};
        // Most browsers ship a plain robotic voice and a natural one. Take the natural one.
        const installed = speechSynthesis.getVoices?.() ?? [];
        const best = chooseVoice(installed, prefs, typeof navigator !== 'undefined' ? navigator.language : 'en');
        const real = best && installed.find((v) => v.name === best.name && v.lang === best.lang);
        if (real) {
          u.voice = real;
          u.lang = real.lang;
        }
        if (prefs.rate !== undefined) u.rate = prefs.rate;
        if (prefs.pitch !== undefined) u.pitch = prefs.pitch;
        // A character's voice is relative to the player's chosen voice.
        if (tone?.rate !== undefined) u.rate = clampTone((prefs.rate ?? 1) * tone.rate);
        if (tone?.pitch !== undefined) u.pitch = clampTone((prefs.pitch ?? 1) * tone.pitch);
        return u;
      }),
    provider: options.voice?.provider,
    clips: options.voice?.clips,
    playClip: options.voice?.playClip ?? (typeof Audio !== 'undefined' ? playClipWithAudioElement : undefined),
    queue: options.voice?.queue,
    maxWaiting: options.voice?.maxWaiting,
    timers,
  });

  const storage: StorageLike | undefined = options.storage ?? safeLocalStorage();
  const store: ProfileStore = createProfileStore(storage, options.storageKey);
  const visual = createVisual();
  const getPads = options.getPads ?? (() => (typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()] : []));
  const haptics: Haptics = createHaptics({
    vibrate: options.vibrate ?? (typeof navigator !== 'undefined' && navigator.vibrate ? (p) => navigator.vibrate(p) : undefined),
    getPads,
    schedule: (fn, ms) => (ms <= 0 ? fn() : timers.set(fn, ms)),
  });

  const machine = createInput();
  let handlers: InputHandlers | undefined;
  const poller = createGamepadPoller(getPads, machine, {
    onPress: () => handlers?.onPress(),
    onEscape: () => handlers?.onEscape(),
  });

  const pending = new Set<unknown>();
  const later = (delayMs: number, fn: () => void): void => {
    if (delayMs < 1) return fn();
    const handle = timers.set(() => {
      pending.delete(handle);
      fn();
    }, delayMs);
    pending.add(handle);
  };

  let unbind: (() => void) | undefined;

  return {
    perform(commands, timing, profile) {
      for (const cmd of commands) {
        const delayMs = Math.max(0, ((cmd.at - timing.now) / timing.rate) * 1000);
        switch (cmd.channel) {
          case 'sound':
            getAudio()?.play(cmd, delayMs / 1000, profile.mono, timing.rate);
            break;
          case 'speech':
            later(delayMs, () =>
              speaker.say(cmd.text, { aloud: profile.voice, volume: profile.volume.speech, mode: cmd.mode, key: cmd.key, tone: cmd.tone }),
            );
            break;
          case 'captions':
            later(delayMs, () => visual.caption(cmd.text, cmd.pip));
            break;
          case 'indicator':
            later(delayMs, () => visual.indicator(cmd.flash, now()));
            break;
          case 'haptics':
            later(delayMs, () => haptics.buzz(cmd.pattern));
            break;
        }
      }
    },
    speaking: () => speaker.busy(),
    cancelPending({ silence = false } = {}) {
      for (const handle of pending) timers.clear(handle);
      pending.clear();
      audio?.cancelAll();
      if (silence) speaker.silence();
    },
    bind(h) {
      handlers = h;
      const target: EventTargetLike | undefined =
        options.target ?? (typeof window !== 'undefined' ? (window as unknown as EventTargetLike) : undefined);
      if (!target) return () => undefined;
      unbind?.();
      unbind = bindInput(target, machine, h);
      return () => {
        unbind?.();
        unbind = undefined;
      };
    },
    poll: () => poller.poll(),
    unlock: () => getAudio()?.unlock(),
    loadProfile: () => store.load(),
    saveProfile: (profile) => store.save(profile),
    osPreferences() {
      if (typeof matchMedia === 'undefined') return {};
      return {
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        highContrast: matchMedia('(prefers-contrast: more)').matches,
      };
    },
    withOsPreferences(profile) {
      return withOsPreferences(profile, this.osPreferences());
    },
    visual,
    drawCaptionBox: (ctx, profile, rect) => drawCaptionBox(ctx, visual.state, profile, rect, now(), options.style),
    now,
    dispose() {
      for (const handle of pending) timers.clear(handle);
      pending.clear();
      audio?.cancelAll();
      speaker.silence();
      unbind?.();
    },
  };
}

function safeLocalStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined; // some browsers throw just for looking at it
  }
}

