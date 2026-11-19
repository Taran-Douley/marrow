import { useObject, type ObjectPreset } from '../../catalogue';
import { EVENT_TYPES } from '../../channels/events';
import { createKit, type Kit, type KitConfig } from '../../kit';
import type { Level } from '../../level';
import { applySetting, applySetup, createMenuStack, profileEntries, setupEntries } from '../../menu';
import { LevelRefused, type ProofResult } from '../../proof';
import type { Run, RunSnapshot } from '../../run';
import type { Profile, SemanticEvent } from '../../types';
import { createWebAdapter, drawMenu, registerOffline, type WebAdapter } from './index';

// A whole accessible game from one call. Give it a title and some objects; it gives you the page,
// the one-switch menu and first-run setup, every channel (sound, speech, captions, the sound marker,
// vibration), a level proved before it is served, and a plain-English refusal when it is not.
//
//   createGame({ title: 'Hello', objects: [bat, stone] });
//
// Everything is optional past the title. For more control, use createKit and the web adapter directly.

export interface GameOptions {
  title: string;
  /** Ready-made objects (see the catalogue), or your own made with `preset`. */
  objects?: readonly ObjectPreset[];
  /** Anything else for the kit: your own events, a lesson, a song, timing. */
  kit?: KitConfig;
  /** Change the kit after it is made: define your own objects here. */
  setup?: (kit: Kit) => void;
  /** Where the game goes. Default: the page's <main>, or the body. */
  mount?: HTMLElement;
  /** The level to play. Default: a new one each time. */
  seed?: number | (() => number);
  /** Timing help on for a new player (they can still switch it off). Default off. */
  assist?: boolean;
}

export interface Game {
  readonly kit: Kit;
  readonly adapter: WebAdapter;
  /** The proof of the level last made: every property, passed or not. */
  proof(): readonly ProofResult[];
  /** Stop listening for presses and stop all sound. */
  stop(): void;
}

const WIDTH = 960;
const HEIGHT = 540;
const GROUND = 380;
const PX = 220;

/** Build the page the game needs, inside `mount`, unless it is already there. */
function page(mount: HTMLElement, title: string): { canvas: HTMLCanvasElement; region: HTMLElement; status: HTMLElement; voice: HTMLInputElement } {
  const doc = mount.ownerDocument;
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}): HTMLElementTagNameMap[K] =>
    Object.assign(doc.createElement(tag), props);
  if (!doc.title) doc.title = title;
  const heading = make('h1', { textContent: title });
  const help = make('p', {
    textContent:
      'Press any key, click, tap or gamepad button. That is the only control. Each choice is read out in turn: press when you hear the one you want. Escape comes back to the menu.',
  });
  const canvas = make('canvas', { width: WIDTH, height: HEIGHT });
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'The game. Everything shown here is also spoken and written.');
  canvas.style.cssText = 'display:block;width:100%;height:auto;border:2px solid #9d94b5;background:#14101f';
  const region = make('div');
  region.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
  const status = make('p');
  status.setAttribute('aria-live', 'off');
  const form = make('form');
  form.setAttribute('data-marrow-ignore', '');
  const label = make('label');
  const voice = make('input', { type: 'checkbox', id: 'marrow-voice' });
  label.append(voice, ' Built-in voice on (turn off if you use a screen reader: every line is still written for it)');
  form.append(label);
  mount.append(heading, help, canvas, region, status, form);
  return { canvas, region, status, voice };
}

export function createGame(options: GameOptions): Game {
  const doc = document;
  const mount = options.mount ?? doc.querySelector('main') ?? doc.body;
  if (!doc.body.style.background) doc.body.style.cssText = 'margin:0;background:#14101f;color:#f4efe6;font:1.125rem/1.5 "Atkinson Hyperlegible","Segoe UI",system-ui,sans-serif';
  const el = page(mount, options.title);

  const kit = createKit({
    coach: true,
    ...options.kit,
    events: {
      intro: { say: `${options.title}. Three beeps, then press on the fourth beat.`, caption: 'Press on the fourth beat' },
      menu: { say: `${options.title}. Press any key to begin.`, caption: 'Press any key to begin' },
      done: { say: 'You made it! {score} points. Press any key to play again.', caption: '{score} points' },
      refused: { say: 'This level cannot be played. {reason}', caption: 'Level refused: {reason}' },
      ...options.kit?.events,
    },
  });
  for (const o of options.objects ?? []) useObject(kit, o);
  options.setup?.(kit);

  const adapter = createWebAdapter({ region: el.region });
  const ctx = el.canvas.getContext('2d');
  let profile: Profile = adapter.withOsPreferences(adapter.loadProfile() ?? kit.newProfile());
  let mode: 'menu' | 'playing' = 'menu';
  let run: Run | null = null;
  let level: Level | null = null;
  let snap: RunSnapshot | null = null;
  let proof: readonly ProofResult[] = [];
  let unlocked = false;
  let stopped = false;

  const rate = (): number => kit.timing.rates[profile.speed];
  const emit = (event: SemanticEvent, now: number): void => adapter.perform(kit.render(event, profile), { now, rate: rate() }, profile);
  const announce = (type: string, data?: Record<string, unknown>): void =>
    adapter.perform(kit.render(data ? { type, at: 0, data } : { type, at: 0 }, profile), { now: 0, rate: 1 }, profile);

  const setProfile = (next: Profile): void => {
    profile = next;
    adapter.saveProfile(profile);
    el.voice.checked = profile.voice;
  };
  el.voice.checked = profile.voice;
  el.voice.addEventListener('change', () => setProfile({ ...profile, voice: el.voice.checked }));

  const menus = createMenuStack({
    dwellMs: () => profile.dwellMs,
    say: (lit, opening) => announce(EVENT_TYPES.menuOption, { label: opening ? `${opening} ${lit.label}` : lit.label }),
  });
  // Timing help: a press anywhere in the countdown counts. The player's choice is saved; the game sets the start.
  const ASSIST_KEY = 'marrow.assist';
  const storedAssist = ((): string | null => {
    try {
      return localStorage.getItem(ASSIST_KEY);
    } catch {
      return null;
    }
  })();
  let assist = storedAssist === null ? options.assist === true : storedAssist === 'on';
  const main = {
    title: options.title,
    entries: [
      { kind: 'action' as const, id: 'play', label: 'Play' },
      { kind: 'setting' as const, id: 'assist', name: 'Timing help', choices: [{ label: 'Off' }, { label: 'On, press any time in the countdown' }], current: () => (assist ? 1 : 0) },
      { kind: 'action' as const, id: 'settings', label: 'Settings' },
    ],
  };
  const settings = (): { title: string; entries: ReturnType<typeof profileEntries> } => ({ title: 'Settings', entries: profileEntries(() => profile) });

  /** Make a level and prove it. A level that fails is refused, and the reason is said and shown. */
  function play(): void {
    const seed = typeof options.seed === 'function' ? options.seed() : (options.seed ?? Math.floor(Math.random() * 100_000) + 1);
    if (kit.registry.kinds().length === 0) {
      el.status.textContent = 'Add an obstacle to play: for example objects: [stone].';
      return announce('refused', { reason: 'There is nothing to jump yet.' });
    }
    const made = kit.generate(seed);
    proof = kit.prove(made, `Level ${seed}`);
    try {
      level = kit.refuseIfFailing(made, `Level ${seed}`);
    } catch (error) {
      if (!(error instanceof LevelRefused)) throw error;
      const reason = error.failures[0]?.counterexample ?? 'It failed the proof.';
      el.status.textContent = `Level ${seed} refused. ${reason}`;
      menus.open(main, performance.now(), undefined, `This level cannot be played. ${reason}`);
      return;
    }
    el.status.textContent = `Level ${seed}: passed all ${proof.length} proof properties, so it can be finished with one switch.`;
    adapter.cancelPending({ silence: true });
    mode = 'playing';
    run = kit.run({ level, speed: profile.speed, startReal: performance.now(), emit, coachLeadMs: profile.coachLeadMs, assist });
    announce('intro');
  }

  function press(): void {
    const now = performance.now();
    adapter.unlock();
    unlocked = true;
    if (mode === 'playing') return run?.press(now);
    if (!profile.scanning) return play();
    if (!menus.top()) {
      if (profile.setupDone) menus.open(main, now);
      else menus.open({ title: 'Welcome. How would you like to play?', entries: setupEntries() }, now);
      return;
    }
    const r = menus.press(now);
    if (!r) return;
    if (r.kind === 'changed' && r.id === 'assist') {
      assist = r.choice === 1;
      try {
        localStorage.setItem(ASSIST_KEY, assist ? 'on' : 'off');
      } catch {
        // not saved: it still applies for this visit
      }
      return;
    }
    if (r.kind === 'changed') return setProfile(applySetting(profile, r.id, r.choice));
    if (r.id === 'play') {
      menus.close();
      play();
    } else if (r.id === 'settings') {
      menus.open(settings(), now);
    } else if (r.id.startsWith('setup:')) {
      const done = applySetup(profile, r.id)!;
      setProfile(done.profile);
      menus.close();
      menus.open(main, now, undefined, done.says || undefined);
      if (done.more) menus.open(settings(), now);
    }
  }

  function toMenu(): void {
    mode = 'menu';
    run = null;
    adapter.cancelPending({ silence: true });
    menus.close();
    if (unlocked && profile.scanning) menus.open(main, performance.now());
    else announce('menu');
  }

  function draw(): void {
    if (!ctx) return;
    ctx.fillStyle = '#14101f';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#9d94b5';
    ctx.fillRect(0, GROUND, WIDTH, 4);
    if (mode === 'playing' && level && snap) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 16px "Atkinson Hyperlegible", system-ui, sans-serif';
      for (const o of level.obstacles) {
        const x = 160 + (o.start - snap.t) * PX;
        const w = Math.max(o.width * PX, 30);
        if (x < -60 || x > WIDTH) continue;
        ctx.fillStyle = '#c9c0d8';
        ctx.fillRect(x, GROUND - 60, w, 60);
        ctx.fillStyle = '#14101f';
        ctx.fillText(kit.registry.get(o.kind)?.caption ?? o.kind, x + w / 2, GROUND - 30, w - 4); // the word, not only a shape
      }
      const u = snap.lastJumpAt === null ? -1 : (snap.t - snap.lastJumpAt) / kit.timing.airtime;
      const lift = u >= 0 && u <= 1 ? 4 * 110 * u * (1 - u) : 0;
      ctx.fillStyle = '#f2b134';
      ctx.beginPath();
      ctx.arc(160, GROUND - 26 - lift, 24, 0, Math.PI * 2);
      ctx.fill();
    }
    const view = mode === 'menu' ? menus.view() : null;
    if (view) drawMenu(ctx, profile, { x: 260, y: 30, width: 440, height: 300 }, view);
    adapter.drawCaptionBox(ctx, profile, { x: 40, y: HEIGHT - 110, width: WIDTH - 80, height: 90 });
  }

  function frame(): void {
    if (stopped) return;
    adapter.poll();
    const now = performance.now();
    if (mode === 'menu') menus.tick(now);
    if (run && mode === 'playing') {
      run.advance(now);
      snap = run.snapshot();
      if (snap.phase === 'done') {
        mode = 'menu';
        run = null;
        announce('done', { score: snap.score });
      }
    }
    el.canvas.hidden = !profile.picture;
    if (profile.picture) draw();
    requestAnimationFrame(frame);
  }

  const unbind = adapter.bind({ onPress: press, onEscape: toMenu });
  announce('menu');
  requestAnimationFrame(frame);
  // Offline after the first visit, when the build made a service worker (the offline Vite plugin).
  if (typeof location !== 'undefined' && location.protocol.startsWith('http') && !/localhost|127\.0\.0\.1/.test(location.hostname)) void registerOffline().catch(() => undefined);

  return {
    kit,
    adapter,
    proof: () => proof,
    stop() {
      stopped = true;
      unbind();
      adapter.dispose();
    },
  };
}
