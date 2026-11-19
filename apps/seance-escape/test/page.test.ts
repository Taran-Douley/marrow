// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultProfile } from '@marrow/skeleton';

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

async function boot(search = '', voices: { name: string; lang: string; default?: boolean }[] = [], profile?: string): Promise<Booted> {
  vi.resetModules();
  const realAdd = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation(((type: string, fn: EventListenerOrEventListenerObject, opts?: unknown) => {
    added.push([type, fn]);
    realAdd(type, fn, opts as never);
  }) as never);
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(PAGE)![1]!.replace(/<script[\s\S]*?<\/script>/g, '');
  window.history.replaceState({}, '', `/${search}`);
  localStorage.clear();
  // Most tests press straight in. The menu test passes a profile with scanning on.
  localStorage.setItem('marrow.profile', profile ?? JSON.stringify({ ...defaultProfile(), scanning: false, setupDone: true }));

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
  vi.doUnmock('@marrow/skeleton');
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

  it('one switch does everything: setup, a house setting, then into the house', async () => {
    const page = await boot('?level=3', [], JSON.stringify(defaultProfile()));
    const waitFor = (re: RegExp): void => {
      for (let i = 0; i < 800 && !re.test(page.region().at(-1) ?? ''); i++) page.frames(100);
      expect(page.region().at(-1)).toMatch(re);
    };
    page.key('Space', ' ');
    page.frames(100);
    expect(page.region().at(-1)).toBe('Welcome. How would you like to play? Just play');
    waitFor(/^Play by sound$/);
    page.key('Space', ' ');
    page.frames(100);
    expect(page.region().at(-1)).toBe('Play by sound. The voice says everything. Headphones help. Séance Escape. Enter the house');
    waitFor(/^Fright: Full, jump scares$/);
    page.key('Space', ' ');
    page.frames(100);
    expect(page.region().at(-1)).toBe('Fright: Gentle, softer scares');
    expect(localStorage.getItem('seance.fright')).toBe('gentle');
    waitFor(/^Enter the house$/);
    page.key('Space', ' ');
    page.frames(15_000);
    expect(page.spoken.join(' | ')).toMatch(/I'm Mabel/);
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

describe('the run loop', () => {
  /** Make the walk report three catches once `catchesNow.on` is set, as if the phantom had caught the player three times. */
  const catchesNow = { on: false };
  function threeCatches(): void {
    catchesNow.on = false;
    vi.doMock('@marrow/skeleton', async (original) => {
      const real = await original<typeof import('@marrow/skeleton')>();
      return {
        ...real,
        createWalk: (options: Parameters<typeof real.createWalk>[0]) => {
          const walk = real.createWalk(options);
          return { ...walk, snapshot: () => ({ ...walk.snapshot(), catches: catchesNow.on ? 3 : walk.snapshot().catches }) };
        },
      };
    });
  }
  const houseNumber = (): number => Number((document.getElementById('level') as HTMLInputElement).value);

  it('each run is a new house: the house number moves on and is saved', async () => {
    const page = await boot('?level=3');
    expect(houseNumber()).toBe(3);
    enterHouse(page);
    page.frames(3000);
    const first = houseNumber();
    expect(first).toBeGreaterThan(3); // the house served was number first - 1 or later, and the next run starts after it
    expect(localStorage.getItem('seance.run')).toBe(String(first));
  });

  it('three catches end the run gently, and one press enters a new house', async () => {
    threeCatches();
    const page = await boot('?level=3');
    enterHouse(page);
    page.frames(3000);
    const before = houseNumber();
    catchesNow.on = true;
    page.frames(60_000);
    const said = page.spoken.join(' | ');
    expect(said).toMatch(/The house lets you go\. You found 0 of 3 relics\./);
    expect(said).toMatch(/Press any key to enter a new house/);
    expect(said).not.toMatch(/game over/i);
    expect(page.region().join(' | ')).toMatch(/The house lets you go/);
    expect(page.stats()).toMatch(/the house let you go/);
    // One press: a new house, with Mabel introducing it again.
    catchesNow.on = false;
    const intros = page.spoken.filter((s) => /I'm Mabel/.test(s)).length;
    page.key('Space', ' ');
    page.frames(3000);
    expect(page.spoken.filter((s) => /I'm Mabel/.test(s)).length).toBe(intros + 1);
    expect(houseNumber()).toBeGreaterThan(before);
  });

  it('with "Catches end a run" off, three catches do not end it', async () => {
    threeCatches();
    const page = await boot('?level=3');
    const box = document.getElementById('catches') as HTMLInputElement;
    expect(box.checked).toBe(true);
    box.checked = false;
    box.dispatchEvent(new Event('change'));
    expect(localStorage.getItem('seance.catches')).toBe('off');
    enterHouse(page);
    page.frames(3000);
    catchesNow.on = true;
    page.frames(60_000);
    expect(page.spoken.join(' | ')).not.toMatch(/The house lets you go/);
  });

  it('the setting is reached with one switch, and says its new value', async () => {
    const page = await boot('?level=3', [], JSON.stringify(defaultProfile()));
    const waitFor = (re: RegExp): void => {
      for (let i = 0; i < 1200 && !re.test(page.region().at(-1) ?? ''); i++) page.frames(100);
      expect(page.region().at(-1)).toMatch(re);
    };
    page.key('Space', ' ');
    page.frames(100);
    waitFor(/^Play by sound$/);
    page.key('Space', ' ');
    page.frames(100);
    waitFor(/^Catches end a run: On: three catches end a run$/);
    page.key('Space', ' ');
    page.frames(100);
    expect(page.region().at(-1)).toBe('Catches end a run: Off: no limit');
    expect(localStorage.getItem('seance.catches')).toBe('off');
    expect((document.getElementById('catches') as HTMLInputElement).checked).toBe(false);
  });
});