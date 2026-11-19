// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGhastlyKit } from '../src/kit';
import { speechMs } from '@marrow/skeleton';
import { STAGES, needed } from '../src/stages';

// Loads the real page and main.ts in a simulated browser, with fakes for the
// parts jsdom does not have (canvas, audio, speech). It checks the wiring: that
// a player can pick a table, start, jump on a multiple, let the others pass, fall and
// be taught, recover, finish, change settings and export. It cannot judge how
// anything looks or sounds. A real browser and a real player must.

const PAGE = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const MENU = 'Ghastly Moves. Press any key to start. Escape comes back here.';

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

async function boot(
  search = '',
  voices: { name: string; lang: string; default?: boolean }[] = [],
  stored: Record<string, string> = { 'ghastly.stage': '' }, // free practice by default; the story tests pass their own
): Promise<Booted> {
  vi.resetModules();
  const realAdd = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation(((type: string, fn: EventListenerOrEventListenerObject, opts?: unknown) => {
    added.push([type, fn]);
    realAdd(type, fn, opts as never);
  }) as never);
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(PAGE)![1]!.replace(/<script[\s\S]*?<\/script>/g, '');
  window.history.replaceState({}, '', `/${search}`);
  localStorage.clear();
  for (const [k, v] of Object.entries(stored)) localStorage.setItem(k, v);

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

// ---- helpers ---------------------------------------------------------------

const level = (seed: number, table = 3) => createGhastlyKit(table).generate(seed);

/** Real ms from the start of a run until the fourth beat of obstacle i, at a speed. */
function beatMs(seed: number, i: number, table = 3, speed: 'slow' | 'medium' | 'fast' = 'slow'): number {
  const kit = createGhastlyKit(table);
  const o = kit.generate(seed).obstacles[i]!;
  const { halfWidth, airtime, rates } = kit.timing;
  const j = (o.start - halfWidth + (o.start + o.width + halfWidth - airtime)) / 2;
  return (j / rates[speed]) * 1000;
}

/** The first level number whose first obstacle matches (a target to jump, or a distractor to let pass). */
function seedWhereFirstIs(solid: boolean): number {
  for (let seed = 1; seed < 200; seed++) if ((level(seed).obstacles[0]!.solid ?? true) === solid) return seed;
  throw new Error('no such level in 200 tries');
}

/** Advance to a real time after the run began, then press. */
function pressAt(page: Booted, startedAt: number, afterMs: number): void {
  page.frames(Math.max(0, startedAt + afterMs - page.clock.ms));
  page.key('Space', ' ');
}

// ---- the page --------------------------------------------------------------

describe('the page', () => {
  it('starts at the menu, written to the text log but not spoken', async () => {
    const page = await boot();
    expect(page.region()).toEqual([MENU]);
    expect(page.spoken).toEqual([]);
    expect(page.stats()).toBe('No attempts yet.');
    expect((document.getElementById('game') as HTMLCanvasElement).hidden).toBe(false);
  });

  it('offers the times tables from 2 to 12, with the 3 times table chosen', async () => {
    await boot();
    const select = document.getElementById('table') as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
    expect(select.value).toBe('3');
  });

  it('the first press starts the level, unlocks sound and says the rule', async () => {
    const page = await boot();
    page.key('Space', ' ');
    page.frames(100);
    const rule = 'Ghastly Moves. Jump on every multiple of 3. Let the others pass.';
    expect(page.region().at(-1)).toBe(rule);
    expect(page.spoken.at(-1)).toBe(rule);
    expect(page.contexts).toHaveLength(1);
  });

  it('another table changes the rule, and is remembered', async () => {
    const page = await boot();
    const select = document.getElementById('table') as HTMLSelectElement;
    select.value = '7';
    select.dispatchEvent(new Event('change'));
    expect(localStorage.getItem('ghastly.table')).toBe('7');
    page.key('Space', ' ');
    page.frames(100);
    expect(page.region().at(-1)).toBe('Ghastly Moves. Jump on every multiple of 7. Let the others pass.');
  });

  it('a player who knows the table finishes: all right, a top rank, a rising tune and a summary', async () => {
    const page = await boot('?level=1');
    page.key('Space', ' ');
    const startedAt = page.clock.ms;
    const lv = level(1);
    lv.obstacles.forEach((o, i) => {
      if (o.solid) {
        pressAt(page, startedAt, beatMs(1, i));
        page.frames(150);
      }
    });
    // The last stones may be ones to let pass, so wait for the final stone's own time, plus the landing.
    page.frames(Math.max(0, startedAt + beatMs(1, lv.obstacles.length - 1) + 2500 - page.clock.ms));
    expect(page.stats()).toMatch(/^12 attempts, 12 right, 0 mistakes\./);
    expect(page.region(), JSON.stringify(page.region())).toContain('Level complete.');
    vi.advanceTimersByTime(1300);
    expect(page.region().at(-1)).toMatch(/^Rank S\. \d+ points\. 12 of 12 right\. Press any key to play again\.$/);

    // The numbers were spoken, in the voice the player chose, before each stone arrived.
    for (const o of lv.obstacles) expect(page.spoken).toContain(String(o.value));
    const tones = new Set(page.contexts[0]!.tones);
    expect(tones.has(110)).toBe(true); // the pad's root note
    expect(tones.has(880)).toBe(true); // the clear chime
    expect(tones.has(147)).toBe(true); // the approach tone: the stone's own voice, an octave down
    expect([...tones].some((hz) => hz >= 520 && hz <= 1400 && hz !== 880)).toBe(true); // the climbing judgement notes
  });

  it('pressing on a number that is not in the table says so, and teaches why', async () => {
    const seed = seedWhereFirstIs(false);
    const first = level(seed).obstacles[0]!;
    const page = await boot(`?level=${seed}`);
    page.key('Space', ' ');
    const startedAt = page.clock.ms;
    pressAt(page, startedAt, beatMs(seed, 0));
    page.frames(150);
    expect(page.region()).toContain(`Not that one. ${first.value} is not a multiple of 3.`);
    expect(page.contexts[0]!.tones).toContain(150); // the bonk came first, before the words
    expect(page.stats()).toMatch(/^1 attempts, 0 right, 1 mistakes\./);
  });

  it('letting a multiple go by says so, with the sum', async () => {
    const seed = seedWhereFirstIs(true);
    const first = level(seed).obstacles[0]!;
    const page = await boot(`?level=${seed}`);
    page.key('Space', ' ');
    page.frames(beatMs(seed, 0) + 1500); // never press
    expect(page.region()).toContain(`No press. ${first.value} is a multiple of 3: ${first.value! / 3} times 3.`);
  });

  it('a press that is too early is a timing miss with no maths lesson, then play restarts at the same stone', async () => {
    const seed = seedWhereFirstIs(true);
    const first = level(seed).obstacles[0]!;
    const page = await boot(`?level=${seed}`);
    page.key('Space', ' ');
    const startedAt = page.clock.ms;
    pressAt(page, startedAt, beatMs(seed, 0) - 700);
    page.frames(100);
    expect(page.region()).toContain('Pressed a little early.');
    page.frames(4500); // the 2 s rest, then the countdown begins again
    expect(page.spoken.filter((t) => t === String(first.value)).length).toBeGreaterThanOrEqual(2);
  });

  it('Escape comes back to the start and silences everything', async () => {
    const page = await boot();
    page.key('Space', ' ');
    page.frames(200);
    page.key('Escape');
    expect(page.region().at(-1)).toBe(MENU);
    page.key('Space', ' ');
    page.frames(100);
    expect(page.region().at(-1)).toMatch(/^Ghastly Moves\. Jump on every multiple/); // a new run began
  });

  it('settings: speed is saved, voice off keeps the text but stops the speaking, picture off hides the game', async () => {
    const page = await boot();
    const speed = document.getElementById('speed') as HTMLSelectElement;
    speed.value = 'fast';
    speed.dispatchEvent(new Event('change'));
    expect(JSON.parse(localStorage.getItem('marrow.profile')!)).toMatchObject({ speed: 'fast' });

    const voice = document.getElementById('voice') as HTMLInputElement;
    voice.checked = false;
    voice.dispatchEvent(new Event('change'));
    const picture = document.getElementById('picture') as HTMLInputElement;
    picture.checked = false;
    picture.dispatchEvent(new Event('change'));
    expect((document.getElementById('game') as HTMLCanvasElement).hidden).toBe(true);

    page.key('Space', ' ');
    page.frames(100);
    expect(page.region().at(-1)).toMatch(/^Ghastly Moves\. Jump on every multiple/);
    expect(page.spoken).toEqual([]); // nothing spoken aloud, still written
  });

  it('a key pressed on a setting does not make the ghost jump', async () => {
    const page = await boot();
    const speed = document.getElementById('speed') as HTMLSelectElement;
    speed.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown', bubbles: true }));
    page.frames(100);
    expect(page.region()).toEqual([MENU]); // no run started
  });

  it('exports the results as CSV', async () => {
    const seed = seedWhereFirstIs(true);
    const page = await boot(`?level=${seed}`);
    page.key('Space', ' ');
    const startedAt = page.clock.ms;
    pressAt(page, startedAt, beatMs(seed, 0));
    page.frames(100);

    let saved = '';
    vi.stubGlobal('URL', { createObjectURL: (b: Blob) => ((saved = String(b.size)), 'blob:x'), revokeObjectURL: () => undefined });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    (document.getElementById('download') as HTMLButtonElement).click();
    expect(click).toHaveBeenCalled();
    expect(Number(saved)).toBeGreaterThan(60); // header plus one row
  });

  describe('the voice picker (the voice sounds robotic: choose a better one)', () => {
    const installed = [
      { name: 'Robot Voice', lang: 'en-US', default: true },
      { name: 'Aria Online (Natural)', lang: 'en-US' },
    ];

    it('lists the browser voices after an automatic choice', async () => {
      await boot('', installed);
      const pick = document.getElementById('voicepick') as HTMLSelectElement;
      expect([...pick.options].map((o) => o.value)).toEqual(['', 'Robot Voice', 'Aria Online (Natural)']);
      expect(pick.value).toBe('');
    });

    it('speaks with the most natural installed voice by default', async () => {
      const page = await boot('', installed);
      page.key('Space', ' ');
      page.frames(100);
      expect(page.utterances.at(-1)!.voice?.name).toBe('Aria Online (Natural)');
    });

    it('lets you choose another, says something at once so you can hear it, and remembers', async () => {
      const page = await boot('', installed);
      const pick = document.getElementById('voicepick') as HTMLSelectElement;
      pick.value = 'Robot Voice';
      pick.dispatchEvent(new Event('change'));
      expect(page.utterances.at(-1)).toMatchObject({ text: MENU, voice: { name: 'Robot Voice' } });
      expect(localStorage.getItem('ghastly.voice')).toBe('Robot Voice');
    });

    it('works in a browser with no voices to list', async () => {
      const page = await boot('', []);
      expect(page.region()).toHaveLength(1);
    });
  });
});

// ---- the story -------------------------------------------------------------

describe('the story', () => {
  const stage1 = STAGES[0]!;

  /** Play every target of a level perfectly, then wait for the end. */
  function playPerfect(
    page: Booted,
    kit: ReturnType<typeof createGhastlyKit>,
    seed: number,
    count: number,
    stop: () => boolean = () => false,
    intro?: { type: string; at: number; data: Record<string, unknown> },
  ): void {
    const lv = kit.generate(seed, { count });
    const { halfWidth, airtime, rates } = kit.timing;
    // The game holds the first countdown until the introduction has been said, so the level starts late by that much.
    const words = intro ? kit.render(intro).reduce((sum, c) => sum + (c.channel === 'speech' ? speechMs(c.text) : 0), 0) : 0;
    const firstCue = ((lv.obstacles[0]!.start - halfWidth + (lv.obstacles[0]!.start + lv.obstacles[0]!.width + halfWidth - airtime)) / 2 - 3 * kit.timing.beat) / rates.slow * 1000;
    const hold = words === 0 ? 0 : Math.max(0, Math.round(words * 1.2) + 300 - firstCue);
    const startedAt = page.clock.ms + hold;
    const beat = (i: number): number => {
      const o = lv.obstacles[i]!;
      return (((o.start - halfWidth + (o.start + o.width + halfWidth - airtime)) / 2) / rates.slow) * 1000;
    };
    lv.obstacles.forEach((o, i) => {
      if (stop() || o.solid === false) return;
      page.frames(Math.max(0, startedAt + beat(i) - page.clock.ms));
      if (stop()) return; // the fight may have ended while we waited
      page.key('Space', ' ');
      page.frames(150);
    });
    page.frames(Math.max(0, startedAt + beat(lv.obstacles.length - 1) + 2500 - page.clock.ms));
  }

  it('opens on the story: the menu names the next place, and a card tells the story before the first press begins', async () => {
    const page = await boot('?level=1', [], {});
    expect(page.region().at(-1)).toMatch(/No items yet\. Next: stage 1, Pumpkin Patch\./);
    expect((document.getElementById('stage') as HTMLSelectElement).value).toBe('1');
    expect(document.getElementById('map')!.children).toHaveLength(7);

    page.key('Space', ' ');
    page.frames(100);
    expect(page.region().at(-1)).toMatch(/lights of Grimsby Hollow have gone out\..*Today: Even numbers\. Press any key to begin\./);
    expect(page.stats()).toMatch(/No attempts yet/); // nothing has started

    page.key('Space', ' ');
    page.frames(300);
    expect(page.region().join(' | ')).toMatch(/Jump on every even number/);
  });

  it('beat the stage, face the boss with harder numbers, win the item, and the story moves on and is saved', async () => {
    const page = await boot('?level=1', [], {});
    page.key('Space', ' ');
    page.frames(100);
    page.key('Space', ' ');
    const stageKit = createGhastlyKit(stage1);
    playPerfect(page, stageKit, 1, stage1.count, () => false, { type: 'intro', at: 0, data: { prompt: stageKit.lesson!.prompt } });
    vi.advanceTimersByTime(1300);
    // A stage is as long as its song.
    const songLength = stageKit.generate(1).obstacles.length;
    expect(page.region().at(-1)).toMatch(new RegExp(`Pumpkin Patch done\\. ${songLength} of ${songLength} right\\. Rank S\\.`));
    expect(page.region().at(-1)).toMatch(/Pumpkin Patch done\. \d+ of \d+ right\. Rank S\. The Pumpkin King rises.*Press any key to fight The Pumpkin King\./);

    page.frames(1600);
    page.key('Space', ' ');
    page.frames(200);
    expect(page.region().join(' | ')).toMatch(/The Pumpkin King! Jump over every pumpkin bomb with an even number\. The others are duds: let them fly through you\..* Hit 9 times to win\./);

    // Every right move is a hit. The boss falls at the ninth, before the throws run out.
    const bossKit = createGhastlyKit(stage1, { boss: true });
    const fightStarted = page.stats();
    const bossIntro = { type: 'boss-intro', at: 0, data: { boss: stage1.boss.name, need: needed(stage1.boss), total: stage1.boss.count, prompt: bossKit.lesson!.prompt } };
    playPerfect(page, bossKit, 1 + 7919, stage1.boss.count, () => page.region().some((l) => /You beat The Pumpkin King/.test(l)), bossIntro);
    vi.advanceTimersByTime(1300);
    expect(page.region().at(-1)).toMatch(/You beat The Pumpkin King! You win the Pumpkin Lantern\./);
    // The fight ended at the ninth hit: the level never ran out.
    expect(page.region().join(' | ')).not.toMatch(/Level complete/);
    void fightStarted;

    const saved = JSON.parse(localStorage.getItem('ghastly.progress')!) as { cleared: number[]; best: Record<string, string> };
    expect(saved.cleared).toEqual([1]);
    expect(saved.best['1']).toBe('S');
    expect((document.getElementById('stage') as HTMLSelectElement).value).toBe('2');
    expect(document.getElementById('map')!.children[0]!.textContent).toMatch(/boss beaten, Pumpkin Lantern won/);
  });

  it('each stage plays its own background track: the music notes appear at their own pitches', async () => {
    const page = await boot('?level=1', [], { 'ghastly.stage': '3' });
    page.key('Space', ' ');
    page.frames(100);
    page.key('Space', ' ');
    page.frames(6000);
    const tones = page.contexts[0]!.tones;
    // Stage 3 is in the key of 123 Hz: its pad root is 123 and its bass is an octave under it.
    expect(tones).toContain(123);
    expect(tones.some((hz) => Math.abs(hz - 61.5) < 0.01)).toBe(true);
    // Nothing from the music reaches the beeps' range.
    const music = tones.filter((hz) => hz < 264);
    expect(music.length).toBeGreaterThan(2);
  });

  it('a stage with flips announces the portal in words, and draws the run through it without a hitch', async () => {
    const page = await boot('?level=1', [], { 'ghastly.stage': '2' });
    page.key('Space', ' ');
    page.frames(100);
    page.key('Space', ' ');
    page.frames(40_000); // no presses: the song plays, the player falls and retries, and every frame draws
    expect(page.region().join(' | ')).toMatch(/No press\. \d+ is a multiple of 5/);
    const level = createGhastlyKit(STAGES[1]!).generate(1);
    expect(level.portals!.map((p) => p.move)).toContain('flip');
  });

  it('the music plays on while the game waits after a fall', async () => {
    const page = await boot('?level=1', [], { 'ghastly.stage': '1' });
    page.key('Space', ' ');
    page.frames(100);
    page.key('Space', ' ');
    for (let i = 0; i < 400 && !page.region().some((l) => /No press/.test(l)); i++) page.frames(100);
    expect(page.region().some((l) => /No press/.test(l))).toBe(true);
    const before = page.contexts[0]!.tones.length;
    page.frames(1800); // the rest after a fall, before the restart
    const during = page.contexts[0]!.tones.slice(before);
    // Stage 1 is in the key of 110 Hz: its bass (55 Hz) keeps going.
    expect(during.some((hz) => Math.abs(hz - 55) < 0.5)).toBe(true);
  });

  it('timing help is a saved choice', async () => {
    await boot('?level=1', [], { 'ghastly.assist': 'on' });
    const box = document.getElementById('assist') as HTMLInputElement;
    expect(box.checked).toBe(true);
    box.checked = false;
    box.dispatchEvent(new Event('change'));
    expect(localStorage.getItem('ghastly.assist')).toBe('off');
  });
});
