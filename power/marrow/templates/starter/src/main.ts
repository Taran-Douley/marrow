import {
  EVENT_TYPES,
  LevelRefused,
  applySetting,
  applySetup,
  createKit,
  createMenuStack,
  profileEntries,
  setupEntries,
  type Level,
  type Profile,
  type Run,
  type RunSnapshot,
  type SemanticEvent,
} from '@marrow/skeleton';
import { createWebAdapter, drawMenu, registerOffline } from '@marrow/skeleton/web';

// A whole accessible game, in one file. Change anything: the kit does the accessibility.
//
// 1. Say what is in the game (obstacles) and what happens (events).
// 2. Make a level. The proof checks it can be finished with one switch, or refuses it.
// 3. Play it: every event is heard, read, shown and felt, by the player's own settings.

// ---- 1. the game ------------------------------------------------------------------

const kit = createKit({
  coach: true, // a spoken heads-up before each countdown, if the player wants it
  events: {
    intro: { say: 'Bat Dash. Three beeps, then press on the fourth beat to jump.', caption: 'Press on the fourth beat' },
    menu: { say: 'Bat Dash. Press any key to begin.', caption: 'Press any key to begin' },
    done: { say: 'You made it! {score} points. Press any key to play again.', caption: '{score} points' },
  },
});
kit.defineObstacle('bat', { width: [0.12, 0.24] }); // a sound, a spoken name, a caption and a buzz, all automatic
kit.defineObstacle('rock', { width: [0.16, 0.3] });

// ---- the page -----------------------------------------------------------------------

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const adapter = createWebAdapter({ region: document.getElementById('announcements')! });
let profile: Profile = adapter.withOsPreferences(adapter.loadProfile() ?? kit.newProfile());
let mode: 'menu' | 'playing' = 'menu';
let run: Run | null = null;
let level: Level | null = null;
let snap: RunSnapshot | null = null;
let unlocked = false;

const rate = (): number => kit.timing.rates[profile.speed];
const emit = (event: SemanticEvent, now: number): void => adapter.perform(kit.render(event, profile), { now, rate: rate() }, profile);
const announce = (type: string, data?: Record<string, unknown>): void =>
  adapter.perform(kit.render(data ? { type, at: 0, data } : { type, at: 0 }, profile), { now: 0, rate: 1 }, profile);

// ---- 2 and 3. a proved level, played --------------------------------------------------

function play(): void {
  const seed = Math.floor(Math.random() * 100_000) + 1;
  try {
    level = kit.refuseIfFailing(kit.generate(seed), `Level ${seed}`); // never serve a level the proof refuses
  } catch (error) {
    if (error instanceof LevelRefused) return announce('menu');
    throw error;
  }
  adapter.cancelPending({ silence: true });
  mode = 'playing';
  run = kit.run({ level, speed: profile.speed, startReal: performance.now(), emit, coachLeadMs: profile.coachLeadMs });
  announce('intro');
}

// ---- one switch does everything: a scanned menu, settings and first-run setup -----------

const menus = createMenuStack({
  dwellMs: () => profile.dwellMs,
  say: (lit, opening) => announce(EVENT_TYPES.menuOption, { label: opening ? `${opening} ${lit.label}` : lit.label }),
});
const mainMenu = { title: 'Bat Dash', entries: [{ kind: 'action' as const, id: 'play', label: 'Play' }, { kind: 'action' as const, id: 'settings', label: 'Settings' }] };

const voiceBox = document.getElementById('voice') as HTMLInputElement;
function setProfile(next: Profile): void {
  profile = next;
  adapter.saveProfile(profile);
  voiceBox.checked = profile.voice;
}
voiceBox.checked = profile.voice;
voiceBox.addEventListener('change', () => setProfile({ ...profile, voice: voiceBox.checked }));

function press(): void {
  const now = performance.now();
  adapter.unlock(); // browsers allow sound only after a press
  unlocked = true;
  if (mode === 'playing') return run?.press(now);
  if (!menus.top()) {
    if (profile.setupDone) menus.open(mainMenu, now);
    else menus.open({ title: 'Welcome. How would you like to play?', entries: setupEntries() }, now);
    return;
  }
  const r = menus.press(now);
  if (!r) return;
  if (r.kind === 'changed') return setProfile(applySetting(profile, r.id, r.choice));
  if (r.id === 'play') {
    menus.close();
    play();
  } else if (r.id === 'settings') {
    menus.open({ title: 'Settings', entries: profileEntries(() => profile) }, now);
  } else if (r.id.startsWith('setup:')) {
    const done = applySetup(profile, r.id)!;
    setProfile(done.profile);
    menus.close();
    menus.open(mainMenu, now, undefined, done.says || undefined);
    if (done.more) menus.open({ title: 'Settings', entries: profileEntries(() => profile) }, now);
  }
}

function toMenu(): void {
  mode = 'menu';
  run = null;
  adapter.cancelPending({ silence: true });
  menus.close();
  if (unlocked) menus.open(mainMenu, performance.now());
}

// ---- drawing: plain shapes. The picture only repeats what is heard and written. --------

const GROUND = 380;
function draw(now: number): void {
  ctx.fillStyle = '#14101f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#9d94b5';
  ctx.fillRect(0, GROUND, canvas.width, 4);
  if (mode === 'playing' && level && snap) {
    for (const o of level.obstacles) {
      const x = 160 + (o.start - snap.t) * 220;
      if (x < -40 || x > canvas.width) continue;
      ctx.fillStyle = o.kind === 'bat' ? '#c9c0d8' : '#8b8799';
      ctx.fillRect(x, GROUND - 60, o.width * 220, 60);
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
  adapter.drawCaptionBox(ctx, profile, { x: 40, y: canvas.height - 110, width: canvas.width - 80, height: 90 });
  void now;
}

function frame(): void {
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
  canvas.hidden = !profile.picture;
  if (profile.picture) draw(now);
  requestAnimationFrame(frame);
}

adapter.bind({ onPress: press, onEscape: toMenu });
announce('menu');
requestAnimationFrame(frame);
if (import.meta.env.PROD) void registerOffline();
