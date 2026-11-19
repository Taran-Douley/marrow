// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Loads the real page and main.ts in a simulated browser, with fakes for canvas, audio and speech.
// It checks the wiring only. It cannot judge how anything looks or sounds. A real player must.

const PAGE = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const MENU = 'Séance Escape. Press any key to begin. Escape comes back here.';

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  state = 'running';
  tones: number[] = [];
  createOscillator() {
    const tones = this.tones;
    return {
      type: '',
      frequency: {
        set value(v: number) {
          tones.push(v);
        },
      },
      connect: () => undefined,
      start: () => undefined,
      stop: () => undefined,
    };
  }
  createGain() {
    return { gain: { value: 0, setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined }, connect: () => undefined };
  }
  resume() {
    return undefined;
  }
}

interface Booted {
  frames(ms: number): void;
  key(code: string, key?: string): void;
  region(): string[];
  stats(): string;
  contexts: FakeAudioContext[];
  spoken: string[];
  utterances: { text: string; voice?: { name: string } }[];
  clock: { ms: number };
}

/** Listeners a booted page added to window, so each test can remove them and not leak into the next. */
const added: [string, EventListenerOrEventListenerObject][] = [];

async function boot(search = '', voices: { name: string; lang: string; default?: boolean }[] = []): Promise<Booted> {
  vi.resetModules();
  const realAdd = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation(((type: string, fn: EventListenerOrEventListenerObject, opts?: unknown) => {
    added.push([type, fn]);
    realAdd(type, fn, opts as never);
  }) as never);
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(PAGE)![1]!.replace(/<script[\s\S]*?<\/script>/g, '');
  window.history.replaceState({}, '', `/${search}`);
  localStorage.clear();

  const clock = { ms: 1000 };
  vi.spyOn(performance, 'now').mockImplementation(() => clock.ms);

  const queue: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => void queue.push(cb));

  const contexts: FakeAudioContext[] = [];
  vi.stubGlobal(
    'AudioContext',
    class extends FakeAudioContext {
      constructor() {
        super();
        contexts.push(this);
      }
    },
  );
  const spoken: string[] = [];
  const utterances: Booted['utterances'] = [];
  vi.stubGlobal('speechSynthesis', {
    speak: (u: { text: string; voice?: { name: string } }) => {
      spoken.push(u.text);
      utterances.push(u);
    },
    cancel: () => undefined,
    getVoices: () => voices,
  });
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      volume = 1;
      voice?: { name: string };
      lang = '';
      rate = 1;
      pitch = 1;
      constructor(public text: string) {}
    },
  );

  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (obj, prop: string) => (prop === 'measureText' ? () => ({ width: 10 }) : prop in obj ? obj[prop] : () => undefined),
    set: (obj, prop: string, v) => ((obj[prop] = v), true),
  });
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;

  await import('../src/main');

  const runFrames = (): void => {
    const batch = queue.splice(0);
    for (const cb of batch) cb(clock.ms);
  };
  return {
    clock,
    contexts,
    spoken,
    utterances,
    frames(ms) {
      for (let spent = 0; spent < ms; spent += 16) {
        clock.ms += 16;
        vi.advanceTimersByTime(16); // timed speech and captions must move with the simulated clock
        runFrames();
      }
    },
    key(code, key = code) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, key }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code, key }));
    },
    region: () => [...document.getElementById('announcements')!.children].map((c) => c.textContent ?? ''),
    stats: () => document.getElementById('stats')!.textContent ?? '',
  };
}

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
afterEach(() => {
  for (const [type, fn] of added.splice(0)) window.removeEventListener(type, fn);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});


/** Open the sound guide, wait for "Enter the house" to be read, and press. */
function enterHouse(page: Booted): void {
  page.key('Space', ' ');
  for (let i = 0; i < 400 && !page.region().some((l) => l === 'Enter the house'); i++) page.frames(50);
  expect(page.region()).toContain('Enter the house');
  page.key('Space', ' ');
}

describe('Séance Escape page', () => {
  it('shows the menu in writing before any press, without speaking it', async () => {
    const page = await boot();
    expect(page.region()).toContain(MENU);
    expect(page.spoken).toEqual([]);
  });

  it('the first press opens the sound guide, read out one by one, with Enter the house first', async () => {
    const page = await boot();
    page.key('Space', ' ');
    page.frames(12_000);
    const said = page.region().join(' | ');
    expect(said).toMatch(/The sound guide\./);
    expect(said).toMatch(/Enter the house/);
    expect(page.spoken.some((s) => /sound guide/.test(s))).toBe(true);
  });

  it('choosing a sound in the guide says what it means', async () => {
    const page = await boot();
    page.key('Space', ' ');
    for (let i = 0; i < 600 && !page.region().some((l) => l === 'Hear a room'); i++) page.frames(50);
    page.key('Space', ' ');
    page.frames(300);
    expect(page.region().join(' | ')).toMatch(/When you reach a room, a bell rings and its name is said/);
  });

  it('entering the house: Mabel introduces it, and the walk begins', async () => {
    const page = await boot('?level=3');
    enterHouse(page);
    page.frames(3000);
    const text = page.region().join(' | ');
    expect(text).toMatch(/I'm Mabel/);
    expect(text).toMatch(/Find three relics/);
    expect(page.contexts.length).toBe(1);
  });

  it('every room is named, its ways are read out, and nothing is chosen for the player', async () => {
    const page = await boot('?level=3');
    enterHouse(page);
    page.frames(60_000);
    const said = page.spoken.join(' | '); // the text log keeps only the last few lines, so read what was spoken
    expect(said).toMatch(/The (Entrance Hall|Library|Study|Cellar|Chapel|Kitchen|Nursery|Ballroom|Gallery|Conservatory)/);
    expect(said).toMatch(/Ahead|Left|Right|Turn back/);
    expect(said).toMatch(/Ask Mabel/);
    expect(said).not.toMatch(/You escaped/);
  });

  it('Escape comes back to the menu', async () => {
    const page = await boot('?level=3');
    enterHouse(page);
    page.frames(2000);
    page.key('Escape', 'Escape');
    expect(page.region().at(-1)).toBe(MENU);
  });

  it('the fright setting is saved', async () => {
    const page = await boot();
    const fright = document.getElementById('fright') as HTMLSelectElement;
    fright.value = 'off';
    fright.dispatchEvent(new Event('change'));
    expect(localStorage.getItem('seance.fright')).toBe('off');
    expect(page.stats()).toMatch(/No games yet/);
  });
});