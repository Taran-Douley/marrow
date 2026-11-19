#!/usr/bin/env node
// A black-box accessibility audit for any built browser game.
//
//   node benchmark/audit.mjs <built folder> [--name "My game"] [--json out.json]
//
// It loads the game's built page in a simulated browser (jsdom) with fakes for sound, speech,
// gamepads and the screen, plays it with presses, and checks 14 things a player can observe. It
// knows nothing about Marrow, so it scores a game made with the kit and one made without it by the
// same rules. That is what makes it fair for the with/without benchmark.
//
// What it cannot do: hear, see or judge. It counts that sounds start, words are spoken and text
// appears; it cannot tell whether a beep is clear or a caption is readable. It is a floor, not a
// verdict, and it does not replace testing with disabled players.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require('jsdom');

export const CHECKS = [
  { id: 'lang', name: 'Page language is set', rule: 'The page says its language, so a screen reader reads it in the right voice.' },
  { id: 'live-region', name: 'Has a live text region', rule: 'There is an aria-live (or status/log/alert) region for screen readers.' },
  { id: 'any-key', name: 'Any key works', rule: 'An ordinary key (J) makes the game respond: "any key is the switch".' },
  { id: 'click', name: 'A click works', rule: 'A click on the game makes it respond.' },
  { id: 'touch', name: 'A tap works', rule: 'A tap on the game (the events a phone sends) makes it respond.' },
  { id: 'gamepad', name: 'Reads gamepads', rule: 'The game asks the browser for gamepads while it runs.' },
  { id: 'no-repeat', name: 'Ignores key repeat', rule: 'Holding a key (repeat events) does no more than doing nothing.' },
  { id: 'tab', name: 'Leaves Tab alone', rule: 'Tab is not taken over, so keyboard users can reach the controls.' },
  { id: 'speech-text', name: 'Speech is also written', rule: 'Every spoken line also appears as text for screen readers and deaf players.' },
  { id: 'voice-off', name: 'Voice can be turned off', rule: 'There is a control to turn the game\u2019s own voice off, for screen-reader users.' },
  { id: 'sound-text', name: 'Sound is also shown', rule: 'When the game plays sounds, it also shows text, so nothing is by sound alone.' },
  { id: 'reduced-motion', name: 'Asks about reduced motion', rule: 'The game checks the player\u2019s reduced-motion setting.' },
  { id: 'focus', name: 'Visible keyboard focus', rule: 'The page styles keyboard focus so it can be seen.' },
  { id: 'gentle-failure', name: 'No game over', rule: 'Playing badly for a minute never shows "game over" or counts lives.' },
];

// ---- the fake browser ---------------------------------------------------------------------------

function deepProxy() {
  const fn = function () {};
  return new Proxy(fn, {
    get(target, prop) {
      if (prop === 'measureText') return () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
      if (prop === 'getImageData' || prop === 'createImageData') return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
      if (prop === 'canvas') return undefined;
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop in target) return target[prop];
      return deepProxy();
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
    apply() {
      return deepProxy();
    },
  });
}

function makeAudio(record) {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const node = () => {
    const store = {};
    return new Proxy(store, {
      get(t, prop) {
        if (prop in t) return t[prop];
        if (prop === 'start') return () => void record.audioStarts++;
        if (prop === 'connect') return (other) => other;
        if (prop === 'disconnect' || prop === 'stop' || prop === 'setPosition' || prop === 'setOrientation') return () => {};
        if (prop === 'then') return undefined;
        const p = param();
        t[prop] = p;
        return p;
      },
      set(t, prop, value) {
        t[prop] = value;
        return true;
      },
    });
  };
  return class FakeAudioContext {
    constructor() {
      record.audioContexts++;
      this.currentTime = 0;
      this.sampleRate = 44100;
      this.state = 'running';
      this.destination = node();
      this.listener = node();
    }
    createOscillator() { return node(); }
    createGain() { return node(); }
    createStereoPanner() { return node(); }
    createPanner() { return node(); }
    createBiquadFilter() { return node(); }
    createDynamicsCompressor() { return node(); }
    createConvolver() { return node(); }
    createDelay() { return node(); }
    createAnalyser() { return node(); }
    createBufferSource() { return node(); }
    createMediaElementSource() { return node(); }
    createBuffer(channels, length) { return { length, duration: length / 44100, numberOfChannels: channels, getChannelData: () => new Float32Array(Math.min(length, 1 << 20)) }; }
    decodeAudioData() { return Promise.resolve(this.createBuffer(1, 1)); }
    resume() { return Promise.resolve(); }
    suspend() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
    addEventListener() {}
    removeEventListener() {}
  };
}

class Clock {
  constructor() {
    this.now = 1000;
    this.timers = [];
    this.frames = [];
    this.nextId = 1;
  }
  setTimeout(fn, ms = 0, ...args) {
    const id = this.nextId++;
    this.timers.push({ id, at: this.now + Math.max(0, Number(ms) || 0), fn: () => fn(...args) });
    return id;
  }
  setInterval(fn, ms = 0, ...args) {
    const id = this.nextId++;
    const every = Math.max(1, Number(ms) || 1);
    this.timers.push({ id, at: this.now + every, every, fn: () => fn(...args) });
    return id;
  }
  clear(id) {
    this.timers = this.timers.filter((t) => t.id !== id);
  }
  frame(fn) {
    const id = this.nextId++;
    this.frames.push({ id, fn });
    return id;
  }
  cancelFrame(id) {
    this.frames = this.frames.filter((f) => f.id !== id);
  }
}

async function load(dir, record) {
  const indexPath = join(dir, 'index.html');
  if (!existsSync(indexPath)) throw new Error(`No index.html in ${dir}. Point the audit at the built folder (for Vite, dist/).`);
  const html = readFileSync(indexPath, 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi)].map((m) => m[1]);
  const inline = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).filter((s) => s.trim());
  const css = [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]);
  const clean = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');

  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push(String(e?.message ?? e)));
  const dom = new JSDOM(clean, { url: 'https://game.test/', runScripts: 'outside-only', pretendToBeVisual: false, virtualConsole });
  const { window } = dom;
  const clock = new Clock();

  window.setTimeout = (fn, ms, ...a) => clock.setTimeout(fn, ms, ...a);
  window.setInterval = (fn, ms, ...a) => clock.setInterval(fn, ms, ...a);
  window.clearTimeout = (id) => clock.clear(id);
  window.clearInterval = (id) => clock.clear(id);
  window.requestAnimationFrame = (fn) => clock.frame(fn);
  window.cancelAnimationFrame = (id) => clock.cancelFrame(id);
  Object.defineProperty(window.performance, 'now', { value: () => clock.now, configurable: true });
  window.AudioContext = makeAudio(record);
  window.webkitAudioContext = window.AudioContext;
  window.speechSynthesis = {
    speak(u) { record.spoken.push(String(u?.text ?? '')); },
    cancel() {},
    pause() {},
    resume() {},
    getVoices: () => [],
    speaking: false,
    pending: false,
    paused: false,
    addEventListener() {},
    removeEventListener() {},
    onvoiceschanged: null,
  };
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; this.volume = 1; this.rate = 1; this.pitch = 1; this.lang = ''; } addEventListener() {} };
  window.matchMedia = (query) => {
    record.mediaQueries.push(String(query));
    return { matches: false, media: String(query), onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false };
  };
  Object.defineProperty(window.navigator, 'getGamepads', { value: () => { record.gamepadPolls++; return []; }, configurable: true });
  Object.defineProperty(window.navigator, 'vibrate', { value: () => true, configurable: true });
  window.HTMLCanvasElement.prototype.getContext = function (type) {
    return type === '2d' ? deepProxy() : null; // no WebGL here: a 3D game should fall back, or say it cannot run
  };
  window.HTMLCanvasElement.prototype.toDataURL = () => 'data:,';
  window.HTMLMediaElement.prototype.play = function () { record.audioStarts++; return Promise.resolve(); };
  window.HTMLMediaElement.prototype.pause = function () {};
  window.Audio = class extends window.HTMLAudioElement {};
  window.addEventListener('error', (e) => errors.push(String(e?.message ?? e)));

  // Text that appears in a live region, as it appears.
  const liveSelector = '[aria-live]:not([aria-live="off"]), [role="status"], [role="log"], [role="alert"]';
  const observer = new window.MutationObserver((mutations) => {
    for (const m of mutations) {
      const region = (m.target.nodeType === 1 ? m.target : m.target.parentElement)?.closest?.(liveSelector);
      if (!region) continue;
      if (m.type === 'characterData') record.liveTexts.push(m.target.textContent ?? '');
      for (const n of m.addedNodes ?? []) record.liveTexts.push(n.textContent ?? '');
    }
  });
  observer.observe(window.document, { subtree: true, childList: true, characterData: true });

  for (const code of inline) {
    try { window.eval(code); } catch (e) { errors.push(String(e?.message ?? e)); }
  }
  for (const src of scripts) {
    const path = join(dir, src.replace(/^\.?\//, ''));
    if (!existsSync(path)) { errors.push(`Script not found: ${src}`); continue; }
    try { window.eval(readFileSync(path, 'utf8')); } catch (e) { errors.push(`Could not run ${src}: ${e?.message ?? e}`); }
  }
  const cssText = [
    ...[...window.document.querySelectorAll('style')].map((s) => s.textContent ?? ''),
    ...css.map((href) => { const p = join(dir, href.replace(/^\.?\//, '')); return existsSync(p) ? readFileSync(p, 'utf8') : ''; }),
  ].join('\n');

  const settle = () => new Promise((r) => setImmediate(r));
  const advance = async (ms) => {
    const end = clock.now + ms;
    while (clock.now < end) {
      clock.now += 16;
      let guard = 0;
      for (;;) {
        const due = clock.timers.filter((t) => t.at <= clock.now).sort((a, b) => a.at - b.at)[0];
        if (!due || guard++ > 500) break;
        if (due.every) due.at += due.every;
        else clock.timers = clock.timers.filter((t) => t !== due);
        try { due.fn(); } catch (e) { errors.push(String(e?.message ?? e)); }
      }
      const frames = clock.frames.splice(0);
      for (const f of frames) {
        try { f.fn(clock.now); } catch (e) { errors.push(String(e?.message ?? e)); }
      }
      await settle();
    }
  };
  await settle();
  await advance(500);
  return { window, dom, errors, cssText, advance, observer };
}

// ---- playing ------------------------------------------------------------------------------------

const outputs = (r) => r.audioStarts + r.spoken.length + r.liveTexts.length;

function key(window, code, keyName, opts = {}) {
  const target = window.document.activeElement && window.document.activeElement !== window.document.body ? window.document.activeElement : window.document.body;
  const down = new window.KeyboardEvent('keydown', { code, key: keyName, bubbles: true, cancelable: true, ...opts });
  target.dispatchEvent(down);
  target.dispatchEvent(new window.KeyboardEvent('keyup', { code, key: keyName, bubbles: true, cancelable: true }));
  return down;
}

function gameSurface(window) {
  return window.document.querySelector('canvas:not([hidden])') ?? window.document.querySelector('canvas') ?? window.document.body;
}

function pointer(window, target, pointerType) {
  const P = window.PointerEvent ?? window.MouseEvent;
  const opts = { bubbles: true, cancelable: true, clientX: 100, clientY: 100, button: 0, pointerType, isPrimary: true };
  target.dispatchEvent(new P('pointerdown', opts));
  if (pointerType === 'touch') target.dispatchEvent(new window.Event('touchstart', { bubbles: true, cancelable: true }));
  else target.dispatchEvent(new window.MouseEvent('mousedown', opts));
  target.dispatchEvent(new P('pointerup', opts));
  if (pointerType === 'touch') target.dispatchEvent(new window.Event('touchend', { bubbles: true, cancelable: true }));
  else target.dispatchEvent(new window.MouseEvent('mouseup', opts));
  target.dispatchEvent(new window.MouseEvent('click', opts));
}

function freshRecord() {
  return { audioStarts: 0, audioContexts: 0, spoken: [], liveTexts: [], mediaQueries: [], gamepadPolls: 0 };
}

/** Run one session: load the game, do something, close it. */
async function session(dir, play) {
  const record = freshRecord();
  let page;
  try {
    page = await load(dir, record);
    return { record, ...(await play(page, record)), errors: page.errors, cssText: page.cssText, document: page.window.document };
  } finally {
    page?.observer.disconnect();
    page?.window.close();
  }
}

/** Measure how much happens in a stretch of time after doing something. */
async function measure(page, record, ms, act) {
  const before = { out: outputs(record), audio: record.audioStarts, speech: record.spoken.length, live: record.liveTexts.length };
  act?.();
  await page.advance(ms);
  return {
    out: outputs(record) - before.out,
    audio: record.audioStarts - before.audio,
    speech: record.spoken.length - before.speech,
    live: record.liveTexts.length - before.live,
  };
}

const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();

// ---- the audit ----------------------------------------------------------------------------------

export async function audit(dir, name = dir) {
  const results = new Map();
  const set = (id, pass, note) => results.set(id, { pass, note });

  // Session 1: hold keys (repeat only), then press J, then Tab, then play badly for a minute.
  const a = await session(dir, async (page, record) => {
    const idle = await measure(page, record, 3000);
    const repeatOnly = await measure(page, record, 3000, () => {
      for (let i = 0; i < 20; i++) {
        const target = page.window.document.body;
        target.dispatchEvent(new page.window.KeyboardEvent('keydown', { code: 'KeyJ', key: 'j', repeat: true, bubbles: true, cancelable: true }));
      }
      // The key is let go, as a real one would be, so the next press starts clean.
      page.window.document.body.dispatchEvent(new page.window.KeyboardEvent('keyup', { code: 'KeyJ', key: 'j', bubbles: true, cancelable: true }));
    });
    const press = await measure(page, record, 3000, () => key(page.window, 'KeyJ', 'j'));
    const tab = key(page.window, 'Tab', 'Tab');
    const play = await measure(page, record, 60_000);
    const text = norm([...record.liveTexts, page.window.document.body.textContent ?? ''].join(' '));
    return { idle, repeatOnly, press, tabPrevented: tab.defaultPrevented, play, text };
  });

  const doc = a.document;
  const lang = doc.documentElement.getAttribute('lang');
  set('lang', Boolean(lang && lang.trim()), lang ? `lang="${lang}"` : 'The <html> element has no lang attribute.');
  const live = doc.querySelectorAll('[aria-live]:not([aria-live="off"]), [role="status"], [role="log"], [role="alert"]').length;
  set('live-region', live > 0, live > 0 ? `${live} live region(s).` : 'No aria-live, status, log or alert region.');
  set('any-key', a.press.out > a.idle.out, `After J: ${a.press.out} outputs in 3 s, against ${a.idle.out} when idle.`);
  set('no-repeat', a.repeatOnly.out <= a.idle.out, `20 repeat-only key events: ${a.repeatOnly.out} outputs in 3 s, against ${a.idle.out} when idle.`);
  set('tab', !a.tabPrevented, a.tabPrevented ? 'The game called preventDefault on Tab.' : 'Tab was left to the browser.');
  set('gamepad', a.record.gamepadPolls > 0, a.record.gamepadPolls > 0 ? `navigator.getGamepads was called ${a.record.gamepadPolls} times.` : 'navigator.getGamepads was never called.');
  const motion = a.record.mediaQueries.some((q) => /prefers-reduced-motion/.test(q));
  set('reduced-motion', motion, motion ? 'Queried prefers-reduced-motion.' : 'Never asked for prefers-reduced-motion.');
  const liveSet = norm(a.record.liveTexts.join(' \u2022 '));
  const spoken = [...new Set(a.record.spoken.map(norm).filter(Boolean))];
  const unwritten = spoken.filter((s) => !liveSet.includes(s));
  set(
    'speech-text',
    spoken.length > 0 && unwritten.length === 0,
    spoken.length === 0 ? 'The game never spoke, so there was nothing to mirror (no voice at all is not a pass).' : unwritten.length === 0 ? `All ${spoken.length} spoken lines also appeared as live text.` : `${unwritten.length} of ${spoken.length} spoken lines never appeared as live text, e.g. "${unwritten[0]}".`,
  );
  const totalAudio = a.record.audioStarts;
  const totalLive = a.record.liveTexts.length;
  set(
    'sound-text',
    totalAudio === 0 ? totalLive > 0 : totalLive > 0,
    totalAudio === 0 ? `No sounds played; ${totalLive} live text updates.` : `${totalAudio} sounds and ${totalLive} live text updates.`,
  );
  const failure = /\bgame over\b|\byou (died|lose|lost)\b|\blives?\s*(left|:|remaining)|\bno lives\b/i.exec(a.text);
  set('gentle-failure', !failure, failure ? `Showed "${failure[0]}" after a minute of play.` : 'No "game over" or lives after a minute of play.');
  const focus = /:focus(-visible)?[^{]*\{[^}]*\b(outline|box-shadow)\s*:\s*(?!\s|none\b|0\b)[^;}]+/i.test(a.cssText);
  set('focus', focus, focus ? 'The page styles :focus or :focus-visible with an outline or shadow.' : 'No visible :focus style found (or focus outlines are removed).');
  const controls = [...doc.querySelectorAll('input, select, button, [role="switch"], [role="checkbox"]')];
  const labelOf = (el) =>
    norm([el.getAttribute('aria-label') ?? '', el.closest('label')?.textContent ?? '', el.id ? doc.querySelector(`label[for="${el.id}"]`)?.textContent ?? '' : '', el.textContent ?? '', el.getAttribute('title') ?? ''].join(' '));
  const voice = controls.find((el) => /\b(voice|speech|narrat|read aloud|text to speech|tts|screen reader)/.test(labelOf(el)));
  set('voice-off', Boolean(voice), voice ? `Control: "${labelOf(voice).slice(0, 60)}".` : 'No control labelled voice, speech or narration.');

  // Sessions 2 and 3: a click, then a tap, each on a fresh page.
  for (const [id, type] of [['click', 'mouse'], ['touch', 'touch']]) {
    const s = await session(dir, async (page, record) => {
      const idle = await measure(page, record, 3000);
      const after = await measure(page, record, 3000, () => pointer(page.window, gameSurface(page.window), type));
      return { idle, after };
    });
    set(id, s.after.out > s.idle.out, `After a ${id === 'click' ? 'click' : 'tap'}: ${s.after.out} outputs in 3 s, against ${s.idle.out} when idle.`);
  }

  const checks = CHECKS.map((c) => ({ ...c, ...results.get(c.id) }));
  const passed = checks.filter((c) => c.pass).length;
  return { name, dir, passed, total: checks.length, checks, errors: [...new Set(a.errors)].slice(0, 5) };
}

export function toMarkdown(result) {
  const rows = result.checks.map((c) => `| ${c.pass ? 'Pass' : '**Fail**'} | ${c.name} | ${c.note.replace(/\|/g, '/')} |`);
  return [
    `### ${result.name}: ${result.passed} of ${result.total}`,
    '',
    '| Result | Check | What happened |',
    '|---|---|---|',
    ...rows,
    ...(result.errors.length ? ['', `Errors while running: ${result.errors.map((e) => `\`${e.slice(0, 120)}\``).join('; ')}`] : []),
    '',
  ].join('\n');
}

const here = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dir = args.find((a, i) => !a.startsWith('--') && !['--name', '--json'].includes(args[i - 1] ?? ''));
  if (!dir) {
    console.error('Usage: node benchmark/audit.mjs <built folder> [--name "My game"] [--json out.json]');
    process.exit(2);
  }
  const nameAt = args.indexOf('--name');
  const jsonAt = args.indexOf('--json');
  const result = await audit(resolve(dir), nameAt >= 0 ? args[nameAt + 1] : dir);
  console.log(toMarkdown(result));
  if (jsonAt >= 0) writeFileSync(resolve(args[jsonAt + 1]), JSON.stringify(result, null, 2));
  void here;
  void readdirSync;
}
