import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preset } from '@marrow/skeleton/catalogue';

// The hello example, played the way a player would: one key, the setup, the menu, a proved level.
// And the same call with a broken object: the level is refused, with the reason said and shown.

const MAIN = readFileSync(join(__dirname, '..', 'src', 'main.ts'), 'utf8');

let clock = 1000;
let frames: FrameRequestCallback[] = [];

function stubBrowser(): string[] {
  document.body.innerHTML = '<main></main>';
  localStorage.clear();
  clock = 1000;
  frames = [];
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => void frames.push(cb));
  const spoken: string[] = [];
  vi.stubGlobal('speechSynthesis', { speak: (u: { text: string }) => void spoken.push(u.text), cancel: () => undefined, getVoices: () => [] });
  vi.stubGlobal('SpeechSynthesisUtterance', class { volume = 1; rate = 1; pitch = 1; constructor(public text: string) {} });
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (o, p: string) => (p === 'measureText' ? () => ({ width: 10 }) : p in o ? o[p] : () => undefined),
    set: (o, p: string, v) => ((o[p] = v), true),
  });
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
  return spoken;
}

const run = (ms: number): void => {
  for (const end = clock + ms; clock < end; ) {
    clock += 50;
    vi.advanceTimersByTime(50);
    const now = frames;
    frames = [];
    for (const f of now) f(clock);
  }
};
const key = (): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }));
};
const said = (): string[] => [...document.querySelectorAll('[aria-live="polite"] div')].map((d) => d.textContent ?? '');
const waitFor = (re: RegExp): void => {
  for (let i = 0; i < 600 && !re.test(said().at(-1) ?? ''); i++) run(100);
  expect(said().at(-1)).toMatch(re);
};

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('examples/hello', () => {
  it('is ten lines or fewer', () => {
    expect(MAIN.trim().split('\n').length).toBeLessThanOrEqual(10);
  });

  it('one key: setup, the menu, then a level that passed the proof', async () => {
    stubBrowser();
    await import('../src/main');
    expect(document.querySelector('h1')?.textContent).toBe('Hello, Marrow');
    expect(said().at(-1)).toBe('Hello, Marrow. Press any key to begin.');
    key();
    expect(said().at(-1)).toBe('Welcome. How would you like to play? Just play');
    key();
    expect(said().at(-1)).toBe('Just play. Everything is on. Hello, Marrow. Play');
    key();
    run(200);
    expect(document.body.textContent).toMatch(/Level \d+: passed all \d+ proof properties, so it can be finished with one switch\./);
    expect(said().join(' | ')).toMatch(/Hello, Marrow\. Three beeps, then press on the fourth beat\./);
    run(15_000);
    expect(said().join(' | ')).toMatch(/Bat ahead|Stone ahead/);
  });

  it('a broken object: the level is refused, and the reason is said and shown', async () => {
    stubBrowser();
    const { createGame } = await import('@marrow/skeleton/web');
    const crypt = preset({ name: 'crypt', kind: 'obstacle', width: [1, 1], say: 'crypt', caption: 'Crypt', sound: { hz: 330, wave: 'sine' }, haptic: [80], from: 'a test' });
    createGame({ title: 'Broken', objects: [crypt], seed: 17 });
    key();
    key(); // Just play
    waitFor(/^Play$/);
    key();
    expect(document.body.textContent).toMatch(/Level 17 refused\. Level 17, obstacle 1 \(crypt, 1\.00 s wide\): no take-off point clears it\. One jump covers only 0\.73 s\./);
    expect(said().at(-1)).toMatch(/^This level cannot be played\. Level 17, obstacle 1 \(crypt, 1\.00 s wide\): no take-off point clears it\./);
  });
});
