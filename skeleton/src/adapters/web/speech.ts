// Speech, always mirrored to a live region (Requirements 4.1 to 4.4).
// The text goes to the aria-live region every time. It is spoken aloud only
// when the built-in voice is on, so a screen-reader user can turn the voice off
// and still get every line without hearing it twice.
//
// Who speaks aloud is the game developer's choice, in this order:
//   1. a voice provider they plug in (their own AI voice service, say),
//   2. a recorded clip for that exact line,
//   3. the best voice the browser has (the default).
// If a step fails, the next one speaks, so a line is never lost.

import type { SpeechMode, SpeechTone } from '../../types';

export interface RegionLike {
  /** Add a line of text to the live region. */
  append(text: string): void;
}

export interface SynthLike {
  speak(utterance: unknown): void;
  cancel(): void;
}

/** Your own voice: an AI voice service, a recorded-voice engine, anything that can say a line. */
export interface VoiceProvider {
  /** Say the line. Return a promise if it takes time; if it rejects, the next voice speaks instead. */
  speak(text: string, how: { volume: number; tone?: SpeechTone | undefined }): void | Promise<void>;
  /** Stop speaking now. Called when a newer line arrives and on Escape. */
  cancel(): void;
}

/** Plays one recording. `done` rejects if the file cannot be played, so the next voice can take over. */
export interface ClipHandle {
  stop(): void;
  done: Promise<void>;
}
export type PlayClip = (url: string, volume: number) => ClipHandle;

/** Recordings by the exact spoken text, or a function that finds one for a line. */
export type Clips = Readonly<Record<string, string>> | ((text: string) => string | undefined);

/**
 * A file-name-safe version of a line: lower case, letters and digits, words joined by hyphens.
 * "Not that one. 11 is not a multiple of 3." becomes "not-that-one-11-is-not-a-multiple-of-3".
 * Name your recordings this way and `clipsBySlug` finds them.
 */
export function slugOf(text: string): string {
  return (
    text
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'line'
  );
}

/**
 * Recordings kept in one folder, named by `slugOf`: `clipsBySlug('voice/')` plays
 * `voice/not-that-one-11-is-not-a-multiple-of-3.mp3` for that line. Pass the result as
 * `voice: { clips }`. A line with no file falls to the browser voice, so a partial set is fine.
 * `known` lists the slugs you have recorded; without it every line is tried and a missing file falls back.
 */
export function clipsBySlug(base: string, extension = 'mp3', known?: readonly string[]): (text: string) => string | undefined {
  const folder = base === '' || base.endsWith('/') ? base : `${base}/`;
  const have = known ? new Set(known) : undefined;
  return (text) => {
    const slug = slugOf(text);
    return have && !have.has(slug) ? undefined : `${folder}${slug}.${extension}`;
  };
}

export interface SpeakerTimers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface SpeakerOptions {
  region: RegionLike;
  /** Absent when the Web Speech API is unavailable: the text still goes to the region. */
  synth?: SynthLike | undefined;
  makeUtterance?: (text: string, volume: number, tone?: SpeechTone) => unknown;
  provider?: VoiceProvider | undefined;
  clips?: Clips | undefined;
  playClip?: PlayClip | undefined;
  /**
   * Let each line finish before the next starts (see SpeechMode). Off by default: the newest line
   * cuts in, which suits fast games where an old line would arrive too late to help. Turn it on for
   * games with story and long lines, so no line is cut off.
   */
  queue?: boolean | undefined;
  /** Most lines that may wait at once; the oldest waiting line is dropped past this. Default 3. */
  maxWaiting?: number | undefined;
  /** A guess at how long a line takes, in ms, if the voice never says it has finished. */
  estimateMs?: ((text: string) => number) | undefined;
  timers?: SpeakerTimers | undefined;
}

export interface SayHow {
  aloud: boolean;
  volume: number;
  /** Only used when the speaker queues. Default 'wait'. */
  mode?: SpeechMode | undefined;
  /** Lines with the same key replace each other while waiting, in mode 'latest'. */
  key?: string | undefined;
  /** A character's voice, where the voice allows it. */
  tone?: SpeechTone | undefined;
}

export interface Speaker {
  say(text: string, how: SayHow): void;
  /** Stop speech now and drop any waiting lines (after a fall, on Escape). The region keeps its lines. */
  silence(): void;
  /** True while a line is being said or waiting to be said. */
  busy(): boolean;
}

interface Line {
  text: string;
  volume: number;
  key?: string | undefined;
  /** A character's voice, where the voice allows it. */
  tone?: SpeechTone | undefined;
}

/** A line is given up on after this much longer than its guess, in case the voice never reports the end. */
const GUARD_FACTOR = 2;
const GUARD_EXTRA_MS = 1500;

export function createSpeaker(options: SpeakerOptions): Speaker {
  const { region, synth, makeUtterance, provider, clips, playClip } = options;
  const queue = options.queue === true;
  const maxWaiting = Math.max(0, options.maxWaiting ?? 3);
  const estimate = options.estimateMs ?? ((text: string) => 400 + 65 * text.length);
  const timers: SpeakerTimers = options.timers ?? {
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
  let clip: ClipHandle | undefined;
  let waiting: Line[] = [];
  /** The token of the line being said; 0 when the voice is free. */
  let current = 0;
  let token = 0;
  const guards = new Map<number, unknown>();

  const clipFor = (text: string): string | undefined =>
    typeof clips === 'function' ? clips(text) : clips?.[text];

  const stopEverything = (): void => {
    for (const stop of [() => provider?.cancel(), () => clip?.stop(), () => synth?.cancel()]) {
      try {
        stop();
      } catch {
        // Nothing to stop, or it refused: carry on.
      }
    }
    clip = undefined;
  };

  /** Each voice calls `done` when the line has been said (or could not be). */
  const browserVoice = (text: string, volume: number, done: () => void, tone?: SpeechTone): void => {
    if (!synth || !makeUtterance) return done();
    try {
      const utterance = tone ? makeUtterance(text, volume, tone) : makeUtterance(text, volume);
      const events = utterance as { addEventListener?: (type: string, fn: () => void) => void } | null;
      if (events && typeof events.addEventListener === 'function') {
        events.addEventListener('end', done);
        events.addEventListener('error', done);
      }
      synth.speak(utterance);
    } catch {
      // Speech failed: the text is already in the live region, so nothing is lost.
      done();
    }
  };

  const recorded = (text: string, volume: number, done: () => void, tone?: SpeechTone): boolean => {
    const url = clipFor(text);
    if (!url || !playClip) return false;
    try {
      const handle = playClip(url, volume);
      clip = handle;
      // A file that will not load falls back to the next voice instead of silence.
      handle.done.then(done, () => {
        if (clip === handle) browserVoice(text, volume, done, tone);
        else done();
      });
      return true;
    } catch {
      return false;
    }
  };

  const voice = (text: string, v: number, done: () => void, tone?: SpeechTone): void => {
    if (provider) {
      try {
        const result = provider.speak(text, tone ? { volume: v, tone } : { volume: v });
        if (result && typeof (result as Promise<void>).then === 'function') {
          (result as Promise<void>).then(done, () => {
            if (!recorded(text, v, done, tone)) browserVoice(text, v, done, tone);
          });
        }
        // A provider that returns nothing never says when it is done: the guard timer decides.
        return;
      } catch {
        // The provider failed: fall through to the next voice.
      }
    }
    if (recorded(text, v, done, tone)) return;
    browserVoice(text, v, done, tone);
  };

  const clearGuard = (my: number): void => {
    const handle = guards.get(my);
    if (handle !== undefined) timers.clear(handle);
    guards.delete(my);
  };

  const finished = (my: number): void => {
    clearGuard(my);
    if (my !== current) return; // an old line ending after it was stopped
    current = 0;
    next();
  };

  const start = (line: Line): void => {
    const my = ++token;
    current = my;
    voice(line.text, line.volume, () => finished(my), line.tone);
    // Some voices never report the end: give up on the line a while after its guess.
    if (queue && current === my) {
      guards.set(my, timers.set(() => finished(my), estimate(line.text) * GUARD_FACTOR + GUARD_EXTRA_MS));
    }
  };

  function next(): void {
    const line = waiting.shift();
    if (line) start(line);
  }

  const stopNow = (): void => {
    current = 0;
    for (const handle of guards.values()) timers.clear(handle);
    guards.clear();
    stopEverything();
  };

  return {
    say(text, how) {
      region.append(text);
      if (!how.aloud || how.volume <= 0) return;
      const line: Line = { text, volume: Math.max(0, Math.min(1, how.volume)), key: how.key, tone: how.tone };
      const mode: SpeechMode = queue ? (how.mode ?? 'wait') : 'cut-in';
      if (mode === 'cut-in') {
        // The newest line wins: stop what is being said, forget what was waiting.
        waiting = [];
        stopNow();
        start(line);
        return;
      }
      if (mode === 'latest' && line.key !== undefined) waiting = waiting.filter((w) => w.key !== line.key);
      waiting.push(line);
      while (waiting.length > maxWaiting) waiting.shift();
      if (current === 0) next();
    },
    silence() {
      waiting = [];
      stopNow();
    },
    busy: () => current !== 0 || waiting.length > 0,
  };
}

// ---- choosing a better browser voice ---------------------------------------

export interface VoiceInfo {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

export interface BrowserVoiceOptions {
  /** Voices you prefer, best first. A name matches if it contains the text, ignoring case. */
  names?: readonly string[];
  /** Language, like "en-GB". Default: the browser's language. */
  lang?: string;
  /** Speaking speed. 1 is normal. */
  rate?: number;
  pitch?: number;
}

/** Words that mark a voice as the natural-sounding kind most browsers now ship. */
const NATURAL = /natural|neural|premium|enhanced|studio/i;

/**
 * Pick the most natural voice for a language. Without preferences it favours
 * "natural" and "neural" voices over the plain robotic defaults; with
 * `names` it takes the first voice you listed that exists. Returns undefined to
 * let the browser choose.
 */
export function chooseVoice(
  voices: readonly VoiceInfo[],
  prefs: BrowserVoiceOptions = {},
  browserLang = 'en',
): VoiceInfo | undefined {
  const wanted = (prefs.lang ?? browserLang).toLowerCase();
  const primary = wanted.split('-')[0]!;
  const inLanguage = voices.filter((v) => v.lang.toLowerCase().split(/[-_]/)[0] === primary);
  if (inLanguage.length === 0) return undefined;

  for (const name of prefs.names ?? []) {
    const hit = inLanguage.find((v) => v.name.toLowerCase().includes(name.toLowerCase()));
    if (hit) return hit;
  }

  const score = (v: VoiceInfo): number =>
    (NATURAL.test(v.name) ? 4 : 0) +
    (/online/i.test(v.name) ? 1 : 0) +
    (v.lang.toLowerCase().replace('_', '-') === wanted ? 2 : 0) +
    (v.default ? 1 : 0);
  const best = [...inLanguage].sort((a, b) => score(b) - score(a))[0]!;
  return best;
}

/**
 * Wrap a real element as a live region. Lines are added as children, so a
 * screen reader announces a repeated line again; the oldest lines are removed.
 */
export function regionFromElement(el: HTMLElement, keep = 6): RegionLike {
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('role', 'log');
  return {
    append(text) {
      const line = el.ownerDocument.createElement('div');
      line.textContent = text;
      el.appendChild(line);
      while (el.childElementCount > keep) el.firstElementChild?.remove();
    },
  };
}
