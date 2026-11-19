import {
  DEFAULT_WALK_SETTINGS,
  EVENT_TYPES,
  applySetting,
  applySetup,
  bearingFrom,
  createMenuStack,
  createScanner,
  profileEntries,
  setupEntries,
  type MenuEntry,
  createWalk,
  distancesFrom,
  fewestSteps,
  generateMaze,
  indexOf,
  mergeProfile,
  proveMaze,
  speechMs,
  walkResult,
  withAcoustics,
  type Acoustics,
  type Kit,
  type Maze,
  type OutputCommand,
  type Profile,
  type ScanOption,
  type Scanner,
  type SemanticEvent,
  type Walk,
  type WalkSnapshot,
} from '@marrow/skeleton';
import { clipsBySlug, createWebAdapter, drawMenu, registerOffline } from '@marrow/skeleton/web';
import { MABEL, PASSAGE, RELICS, WARDROBE, WHISPERS, nameRooms, type Floor, type RoomInfo, type RoomKind } from './content';
import { CLOSE_RANGE, heartRate, heartWords } from './dread';
import { GUIDE, type GuideItem } from './guide';
import { FRIGHTS, createSeanceKit, type Fright } from './kit';
import { HEIGHT, WIDTH, drawScene } from './scene';
import { createView3d, type View3d } from './view3d';

function element<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`The page is missing #${id}.`);
  return el as T;
}

const canvas = element<HTMLCanvasElement>('game');
const canvas3d = element<HTMLCanvasElement>('view3d');
const viewBox = element<HTMLElement>('view');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('This browser cannot draw the game.');

const VOICE_KEY = 'seance.voice';
const SIZE_KEY = 'seance.size';
const FRIGHT_KEY = 'seance.fright';
/** House sizes: rooms along each side. Bigger houses have more rooms. */
const SIZES = { small: 6, medium: 8, large: 10 } as const;
type Size = keyof typeof SIZES;
/** Relics to find in a house. */
const RELIC_COUNT = 3;

function saved(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not saved: it still applies for this visit.
  }
}

const frightSelect = element<HTMLSelectElement>('fright');
const savedFright = saved(FRIGHT_KEY);
frightSelect.value = savedFright && (FRIGHTS as readonly string[]).includes(savedFright) ? savedFright : 'full';
const fright = (): Fright => ((FRIGHTS as readonly string[]).includes(frightSelect.value) ? (frightSelect.value as Fright) : 'full');

let kit: Kit = createSeanceKit({ fright: fright() });
let chaseKit: Kit = createSeanceKit({ fright: fright(), chase: true });

const browserVoice: { names: string[] } = { names: [] };
const savedVoice = saved(VOICE_KEY);
if (savedVoice) browserVoice.names = [savedVoice];
// Optional recordings: open the page with ?clips=voice/ to play voice/<line-name>.mp3 for each line.
// Lines with no file fall back to the browser voice. See docs/voices.md.
const clipBase = new URLSearchParams(location.search).get('clips');
const adapter = createWebAdapter({
  region: element('announcements'),
  // Story lines are long: each one finishes before the next begins, so nothing is cut off.
  voice: { browser: browserVoice, queue: true, ...(clipBase ? { clips: clipsBySlug(clipBase) } : {}) },
});

let profile: Profile = adapter.withOsPreferences(adapter.loadProfile() ?? kit.newProfile());
let mode: 'menu' | 'guide' | 'playing' = 'menu';
let walk: Walk | null = null;
let maze: Maze | null = null;
let rooms: RoomInfo[] = [];
let whisperRooms = new Map<number, string>();
let whispersHeard = 0;
/** The kinds of room Mabel has already talked about. */
const mabelSaid = new Set<RoomKind>();
let snapshot: WalkSnapshot | null = null;
let startedAt = 0;
let nextBarAt = 0;
let bar = 0;
let lockoutUntil = 0;
let games = 0;
let bestScore = 0;

const speedSelect = element<HTMLSelectElement>('speed');
const pictureBox = element<HTMLInputElement>('picture');
const voiceBox = element<HTMLInputElement>('voice');
const levelInput = element<HTMLInputElement>('level');
const sizeSelect = element<HTMLSelectElement>('size');
const voicePick = element<HTMLSelectElement>('voicepick');
const stats = element<HTMLElement>('stats');

const savedSize = saved(SIZE_KEY);
sizeSelect.value = savedSize && savedSize in SIZES ? savedSize : 'medium';
const selectedSize = (): Size => (sizeSelect.value in SIZES ? (sizeSelect.value as Size) : 'medium');

// ---- settings --------------------------------------------------------------

function syncForm(): void {
  speedSelect.value = profile.speed;
  pictureBox.checked = profile.picture;
  voiceBox.checked = profile.voice;
  viewBox.hidden = !profile.picture;
}

function change(patch: Partial<Profile>): void {
  profile = mergeProfile(profile, patch);
  adapter.saveProfile(profile);
  syncForm();
}

function fillVoices(): void {
  const installed = typeof speechSynthesis !== 'undefined' ? (speechSynthesis.getVoices?.() ?? []) : [];
  const chosen = browserVoice.names[0] ?? '';
  voicePick.replaceChildren(
    new Option('Best natural voice (automatic)', ''),
    ...installed.map((v) => new Option(`${v.name} (${v.lang})`, v.name)),
  );
  voicePick.value = installed.some((v) => v.name === chosen) ? chosen : '';
}

voicePick.addEventListener('change', () => {
  browserVoice.names = voicePick.value ? [voicePick.value] : [];
  save(VOICE_KEY, voicePick.value);
  announce('menu');
});
if (typeof speechSynthesis !== 'undefined') speechSynthesis.addEventListener?.('voiceschanged', fillVoices);
sizeSelect.addEventListener('change', () => save(SIZE_KEY, sizeSelect.value));
frightSelect.addEventListener('change', () => {
  save(FRIGHT_KEY, frightSelect.value);
  kit = createSeanceKit({ fright: fright() });
  chaseKit = createSeanceKit({ fright: fright(), chase: true });
});
speedSelect.addEventListener('change', () => change({ speed: speedSelect.value as Profile['speed'] }));
pictureBox.addEventListener('change', () => change({ picture: pictureBox.checked }));
voiceBox.addEventListener('change', () => change({ voice: voiceBox.checked }));
// The Start button goes straight in: a mouse user does not need the scanning menu.
element('start').addEventListener('click', () => {
  adapter.unlock();
  unlocked = true;
  menus.close();
  if (mode === 'menu' || mode === 'guide') {
    guide = null;
    start();
  }
});

// ---- output ----------------------------------------------------------------

/** Send one event to the player. `now` is seconds since the walk began; the walk runs in real time. */
function emit(event: SemanticEvent, now: number): void {
  // Each relic hums in its own voice.
  const shown = event.type === 'relic-sense' && typeof event.data?.relic === 'number' ? { ...event, type: `relic-sense-${event.data.relic}` } : event;
  // Once the ritual is done, the music is the chase.
  const from = shown.type === EVENT_TYPES.atmosphere && snapshot?.chasing ? chaseKit : kit;
  const commands = from.render(stepByFloor(shown), profile);
  // Every sound rings like the place you are in: stone halls echo, carpet hushes, a wardrobe is dead.
  // Sounds inside you (heart, breath) do not echo.
  const inside = shown.type === 'heartbeat' || shown.type === 'heartbeat-dub' || shown.type === 'breath';
  adapter.perform(inside ? commands : withAcoustics(commands, placeNow().acoustics), { now, rate: 1 }, profile);
  if (shown.type === 'walk-step' && placeNow().floor === 'wood' && Math.random() < 0.18) {
    adapter.perform(withAcoustics(kit.render({ type: 'board-creak', at: shown.at + 0.05 }, profile), PASSAGE.acoustics), { now, rate: 1 }, profile);
  }
}

/** Where you are now, as sound: the floor under you and how the room answers. */
function placeNow(): { floor: Floor; acoustics: Acoustics } {
  const s = walk?.snapshot() ?? snapshot;
  if (s?.phase === 'hidden') return { floor: 'carpet', acoustics: WARDROBE };
  const info = s && s.room !== null ? rooms[s.room] : undefined;
  return info ? { floor: info.style.floor, acoustics: info.style.acoustics } : PASSAGE;
}

/** A footstep sounds like the floor it lands on. */
function stepByFloor(event: SemanticEvent): SemanticEvent {
  return event.type === 'walk-step' ? { ...event, type: `step-${placeNow().floor}` } : event;
}

function announce(type: string, data?: Record<string, unknown>, aloud = true): void {
  const event: SemanticEvent = data ? { type, at: 0, data } : { type, at: 0 };
  adapter.perform(kit.render(event, profile), { now: 0, rate: 1 }, aloud ? profile : { ...profile, voice: false });
}

function say(text: string): void {
  const cmds: OutputCommand[] = [
    { channel: 'speech', senses: ['hearing'], at: 0, text },
    { channel: 'captions', senses: ['sight'], at: 0, text },
  ];
  adapter.perform(cmds, { now: 0, rate: 1 }, profile);
}

/** How long an event takes to say, by its real words. A little extra, because voices differ in speed. */
function spokenMs(event: SemanticEvent): number {
  const total = kit.render(event, profile).reduce((sum, c) => sum + (c.channel === 'speech' ? speechMs(c.text) : 0), 0);
  return Math.round(total * 1.2);
}

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** The game's own words for the walk's events: room names, Mabel, the story. */
function decorate(type: string, data: Readonly<Record<string, unknown>>): Record<string, unknown> | undefined {
  switch (type) {
    case 'walk-room': {
      const index = Number(data.room);
      const info = rooms[index];
      if (!info) return undefined;
      // A room you know gets its name only, so you are not kept waiting; the rest is said the first time.
      const parts = [`${capital(info.name)}.`];
      if (data.relicHere) parts.push('Something glows here.');
      if (data.hide && data.first) parts.push('There is a wardrobe to hide in.');
      const whisper = data.first ? whisperRooms.get(index) : undefined;
      if (whisper) {
        parts.push(`A whisper: ${whisper}`);
        whisperRooms.delete(index);
        whispersHeard += 1;
      }
      // Mabel has something to say about each kind of room, once. Never on top of a whisper.
      const aside = data.first && !whisper && !mabelSaid.has(info.kind) ? MABEL.rooms[info.kind] : undefined;
      if (aside) {
        parts.push(`Mabel: ${aside}`);
        mabelSaid.add(info.kind);
      }
      return { name: info.name, line: parts.join(' '), caption: capital(info.name) + (whisper ? `: "${whisper}"` : '') };
    }
    case 'walk-relic': {
      const relic = RELICS[Number(data.relic)]?.name ?? 'A relic';
      return { relic: capital(relic), line: MABEL.relic(capital(relic), Number(data.found), Number(data.total)) };
    }
    case 'walk-ritual':
      return { line: MABEL.ritual };
    case 'walk-sealed':
      return { line: MABEL.sealed(Number(data.left)) };
    case 'walk-hint': {
      const way = MABEL.hint(data.what === 'exit' ? 'exit' : 'relic', String(data.way), Number(data.rooms));
      // After a few catches Mabel steps in without being asked.
      return { line: data.free ? `${MABEL.offer} ${way}` : way };
    }
    case 'ghost-call': {
      const s = walk?.snapshot();
      const mood = !s ? '' : s.chasing ? ' It knows where you are!' : s.ghostMode === 'hunt' ? ' It is hunting you.' : ' It is wandering.';
      return { mood };
    }
    case 'caught':
      return { line: MABEL.caught(Number(data.catches) || 1) };
    default:
      return undefined;
  }
}

// ---- the sound guide ------------------------------------------------------------

let guide: Scanner | null = null;
let guideResumeAt = 0;
let guideLitAt = -1;

function openGuide(now: number): void {
  mode = 'guide';
  guide = createScanner({ options: GUIDE.map((g) => ({ id: g.id, label: g.label })), dwellMs: profile.dwellMs });
  const line = 'The sound guide. Choose a sound to hear it, or choose Enter the house.';
  announce('guide-line', { line });
  guideResumeAt = now + spokenMs({ type: 'guide-line', at: 0, data: { line } });
  guideLitAt = -1;
}

function guideTick(now: number): void {
  if (!guide || now < guideResumeAt) return;
  const lit = guideLitAt < 0 ? guide.start(now) : guide.tick(now);
  if (!lit) return;
  guideLitAt = now;
  const index = GUIDE.findIndex((g) => g.id === lit.id);
  announce('guide-option', { label: lit.label, index: index + 1, count: GUIDE.length });
}

function guidePress(now: number): void {
  if (!guide || now < guideResumeAt || guideLitAt < 0) return;
  const chosen = guide.press();
  const item = GUIDE.find((g) => g.id === chosen?.id);
  if (!item) return;
  if (item.id === 'enter') {
    guide = null;
    start();
    return;
  }
  playGuide(item, now);
}

function playGuide(item: GuideItem, now: number): void {
  announce('guide-line', { line: item.line });
  const delay = spokenMs({ type: 'guide-line', at: 0, data: { line: item.line } }) / 1000;
  item.demo.forEach((d, i) => {
    const type = d.type === 'relic-sense' ? 'relic-sense-0' : d.type;
    const event: SemanticEvent = d.data ? { type, at: delay + d.at, data: d.data } : { type, at: delay + d.at };
    adapter.perform(kit.render(event, profile), { now: 0, rate: 1 }, profile);
    void i;
  });
  const last = Math.max(0, ...item.demo.map((d) => d.at));
  guideResumeAt = now + (delay + last + 1.5) * 1000;
  guideLitAt = -1; // read the list again from the top
  guide = createScanner({ options: GUIDE.map((g): ScanOption => ({ id: g.id, label: g.label })), dwellMs: profile.dwellMs });
}

// ---- playing ---------------------------------------------------------------

function readSeed(): number {
  const fromUrl = new URLSearchParams(location.search).get('level');
  const n = Math.floor(Number(fromUrl ?? levelInput.value));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Build the house for a seed. A small house may not fit a fair ritual for every seed, so try the next. */
function buildHouse(seed: number, side: number): Maze | null {
  for (let i = 0; i < 10; i++) {
    try {
      return generateMaze(seed + i * 1009, { width: side, height: side, relics: RELIC_COUNT });
    } catch {
      // try the next
    }
  }
  return null;
}

function start(): void {
  const seed = readSeed();
  const side = SIZES[selectedSize()];
  const house = buildHouse(seed, side);
  if (!house) {
    say(`House ${seed} could not be built fairly at this size. Try a larger house.`);
    mode = 'menu';
    return;
  }
  // The game never serves a house the proof refuses.
  const failing = proveMaze(house, `House ${seed}`).filter((r) => !r.pass);
  if (failing.length > 0) {
    say(failing[0]?.counterexample ?? `House ${seed} failed the proof.`);
    mode = 'menu';
    return;
  }
  kit = createSeanceKit({ fright: fright() });
  chaseKit = createSeanceKit({ fright: fright(), chase: true });
  adapter.cancelPending({ silence: true });
  adapter.visual.reset();
  maze = house;
  rooms = nameRooms(house);
  // The whispers are in rooms spread through the house, never the start or the hall.
  const spots = rooms.map((r, i) => ({ r, i })).filter(({ r }) => r.kind !== 'entrance' && r.kind !== 'front-hall');
  whisperRooms = new Map(WHISPERS.map((line, n) => [spots[Math.floor((n * spots.length) / WHISPERS.length)]?.i ?? -1, line] as const).filter(([i]) => i >= 0));
  whispersHeard = 0;
  mabelSaid.clear();
  lastRoom = null;
  lastGhost = '';
  nextMoanAt = performance.now() + 4000;
  nextGustAt = performance.now() + 6000;
  nextThunderAt = performance.now() + 20000;
  nextBreathAt = 0;
  // The first-person 3D view, if this browser can do it. Otherwise (or with ?view=2d) the flat map, which plays the same.
  closeView();
  if (new URLSearchParams(location.search).get('view') !== '2d') view = createView3d(canvas3d, house, rooms);
  canvas3d.hidden = !view;
  viewBox.classList.toggle('has3d', view !== null);
  mode = 'playing';
  startedAt = performance.now();
  nextBarAt = startedAt;
  bar = 0;
  distanceKey = '';
  wasClose = false;
  nextHeartAt = startedAt;
  roomSoundAt.clear();
  const intro = { type: 'intro', at: 0, data: { line: MABEL.intro } };
  walk = createWalk({
    maze: house,
    speed: profile.speed,
    startMs: startedAt,
    dwellMs: profile.dwellMs,
    emit,
    decorate,
    settings: { hintLabel: 'Ask Mabel' },
    // The walk waits for each spoken line to finish before it reads out the options.
    speechMs: (event) => spokenMs(event),
    quietMs: spokenMs(intro),
  });
  snapshot = walk.snapshot();
  announce('intro', intro.data);
}

function finish(): void {
  if (!maze || !walk) return;
  const s = walk.snapshot();
  const result = walkResult(maze, s);
  games += 1;
  bestScore = Math.max(bestScore, result.score);
  stats.textContent = `${games} escapes. Best score ${bestScore}. Last: rank ${result.rank}, ${s.steps} steps (the best way is ${fewestSteps(maze)}), caught ${s.catches} times, ${whispersHeard} of ${WHISPERS.length} whispers.`;
  walk = null;
  mode = 'menu';
  lockoutUntil = performance.now() + 1500;
  setTimeout(() => {
    if (mode === 'menu') {
      announce('summary', { rank: result.rank, score: result.score, catches: s.catches, whispers: whispersHeard, whisperTotal: WHISPERS.length });
    }
  }, 2200);
}

let view: View3d | null = null;
function closeView(): void {
  view?.dispose();
  view = null;
  canvas3d.hidden = true;
  viewBox.classList.remove('has3d');
}

function toMenu(): void {
  closeView();
  mode = 'menu';
  walk = null;
  guide = null;
  snapshot = null;
  adapter.cancelPending({ silence: true });
  menus.close();
  if (profile.scanning && unlocked) openMenus(performance.now());
  else announce('menu');
}

// ---- the one-switch menu ------------------------------------------------------------

/**
 * Everything can be done with one switch: the menu lights each entry in turn and says it, and a press
 * chooses. Settings change with each press and say their new value. The first time, a short setup asks
 * how you like to play. The page's form does the same for mouse and keyboard.
 */
const menus = createMenuStack({
  dwellMs: () => profile.dwellMs,
  say: (lit, opening) => announce(EVENT_TYPES.menuOption, { label: opening ? `${opening} ${lit.label}` : lit.label, index: lit.index, count: lit.count }),
});
let unlocked = false;

const SIZE_NAMES: readonly Size[] = ['small', 'medium', 'large'];
function mainEntries(): MenuEntry[] {
  return [
    { kind: 'action', id: 'enter', label: 'Enter the house' },
    { kind: 'action', id: 'guide', label: 'Sound guide' },
    {
      kind: 'setting',
      id: 'size',
      name: 'House size',
      choices: SIZE_NAMES.map((s) => ({ label: capital(s) })),
      current: () => SIZE_NAMES.indexOf(selectedSize()),
    },
    {
      kind: 'setting',
      id: 'fright',
      name: 'Fright',
      choices: [{ label: 'Full, jump scares' }, { label: 'Gentle, softer scares' }, { label: 'Off, no jump scares' }],
      current: () => FRIGHTS.indexOf(fright()),
    },
    { kind: 'action', id: 'settings', label: 'Settings' },
  ];
}

const MAIN_TITLE = 'Séance Escape.';
function openMenus(now: number): void {
  menus.close();
  if (!profile.setupDone) menus.open({ title: 'Welcome. How would you like to play?', entries: setupEntries() }, now);
  else menus.open({ title: MAIN_TITLE, entries: mainEntries() }, now);
}

function setProfile(next: Profile): void {
  profile = next;
  adapter.saveProfile(profile);
  syncForm();
}

function menuPress(now: number): void {
  const r = menus.press(now);
  if (!r) return;
  if (r.kind === 'action') {
    if (r.id === 'enter') {
      menus.close();
      start();
    } else if (r.id === 'guide') {
      menus.close();
      openGuide(now);
    } else if (r.id === 'settings') {
      menus.open({ title: 'Settings', entries: profileEntries(() => profile) }, now);
    } else if (r.id.startsWith('setup:')) {
      const done = applySetup(profile, r.id)!;
      setProfile(done.profile);
      menus.close();
      menus.open({ title: MAIN_TITLE, entries: mainEntries() }, now, undefined, done.says || undefined);
      if (done.more) menus.open({ title: 'Settings', entries: profileEntries(() => profile) }, now);
    }
    return;
  }
  if (r.id === 'size') {
    sizeSelect.value = SIZE_NAMES[r.choice]!;
    save(SIZE_KEY, sizeSelect.value);
  } else if (r.id === 'fright') {
    frightSelect.value = FRIGHTS[r.choice]!;
    frightSelect.dispatchEvent(new Event('change'));
  } else {
    setProfile(applySetting(profile, r.id, r.choice));
  }
}

function press(): void {
  const now = performance.now();
  if (now < lockoutUntil) return;
  adapter.unlock();
  unlocked = true;
  if (mode === 'menu' && profile.scanning) {
    // With scanning (the default), the first press opens the menu and the next ones choose.
    if (menus.top()) menuPress(now);
    else openMenus(now);
  } else if (mode === 'menu') openGuide(now);
  else if (mode === 'guide') guidePress(now);
  else walk?.press(now);
}

// ---- dread ---------------------------------------------------------------------

let distance = Infinity;
let distanceKey = '';
let nextHeartAt = 0;
let wasClose = false;

/** How many rooms away the phantom is, along the passages. Worked out once per move. */
function phantomRooms(s: WalkSnapshot, house: Maze): number {
  const key = `${s.cell.x},${s.cell.y}:${s.ghost.x},${s.ghost.y}`;
  if (key !== distanceKey) {
    distanceKey = key;
    const d = distancesFrom(house, s.cell)[indexOf(house, s.ghost)] ?? -1;
    distance = d < 0 ? Infinity : d;
  }
  return distance;
}

/** Your heartbeat, faster as the phantom nears; and a sting the moment it is right behind you. */
function dread(now: number): void {
  if (!walk || !snapshot || !maze) return;
  const d = snapshot.phase === 'caught' ? Infinity : phantomRooms(snapshot, maze);
  const at = (now - startedAt) / 1000;
  const close = d <= CLOSE_RANGE;
  if (close && !wasClose) emit({ type: 'ghost-close', at }, at);
  wasClose = close;
  const bpm = heartRate(d);
  if (bpm === 0) {
    nextHeartAt = now;
    return;
  }
  if (now < nextHeartAt) return;
  emit({ type: 'heartbeat', at }, at);
  emit({ type: 'heartbeat-dub', at: at + 0.17 }, at);
  nextHeartAt = now + 60_000 / bpm;
}

// ---- the rooms' own sounds ---------------------------------------------------------

/** Rooms are heard from this many rooms away, so you can find your way by ear. */
const ROOM_HEARD = 3;
const roomSoundAt = new Map<number, number>();

function roomSounds(now: number): void {
  if (!walk || !snapshot || !maze) return;
  const from = distancesFrom(maze, snapshot.cell);
  const near = rooms
    .map((info, i) => ({ info, i, d: from[indexOf(maze!, maze!.rooms[i]!)] ?? -1 }))
    .filter((r) => r.info.style.sound && r.d >= 0 && r.d <= ROOM_HEARD)
    .sort((a, b) => a.d - b.d)
    .slice(0, 2); // never more than two at once, so the house stays readable
  const at = (now - startedAt) / 1000;
  for (const r of near) {
    if (now < (roomSoundAt.get(r.i) ?? 0)) continue;
    const b = bearingFrom(snapshot.cell, snapshot.facing, maze.rooms[r.i]!);
    emit({ type: `room-${r.info.kind}`, at, data: { angle: b.angle, distance: Math.min(1, (r.d + 0.5) / (ROOM_HEARD + 1)) } }, at);
    roomSoundAt.set(r.i, now + r.info.style.sound!.every * 1000);
  }
}

/**
 * The house under the walk: wind, a slow music box and a drone, a bar every two seconds. Far from the
 * phantom it plays out. When a cue can sound (the ways are being read, or your heart is beating) the
 * music steps aside, so you hear what matters. In the chase it is the chase.
 */
function atmosphere(now: number): void {
  if (!walk || !snapshot || !maze || now < nextBarAt) return;
  const d = phantomRooms(snapshot, maze);
  const tension = snapshot.chasing ? 0.6 : Math.max(0.1, Math.min(1, 1 - (d - 1) / (DEFAULT_WALK_SETTINGS.hearRange + 3)));
  const at = (now - startedAt) / 1000;
  const cuesMaySound = snapshot.phase !== 'walking' || snapshot.chasing || heartRate(d) > 0;
  const quiet = cuesMaySound ? [[at, at + 2.5]] : [];
  emit({ type: EVENT_TYPES.atmosphere, at, data: { bar, tension, span: 2, quiet, pulse: 0 } }, at);
  bar += 1;
  nextBarAt = now + 2000;
}

// ---- the house is alive ------------------------------------------------------------

let lastRoom: number | null = null;
let lastGhost = '';
let nextMoanAt = 0;
let nextGustAt = 0;
let nextThunderAt = 0;
let nextBreathAt = 0;
/** The phantom's feet are heard from this many rooms away. */
const GHOST_STEPS_HEARD = 4;

const between = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);

/**
 * The sounds that make the house feel lived in (or died in): a door as you enter a room, the phantom's
 * feet and moan from where it is, wind, far thunder, and your breath while you hide. The phantom's
 * sounds carry where it is; the rest is the house.
 */
function livingHouse(now: number): void {
  if (!walk || !snapshot || !maze) return;
  const s = snapshot;
  const at = (now - startedAt) / 1000;
  if (s.room !== lastRoom) {
    if (s.room !== null && s.phase !== 'caught') emit({ type: 'door', at }, at);
    lastRoom = s.room;
  }
  if (s.phase !== 'caught') {
    const d = phantomRooms(s, maze);
    const b = bearingFrom(s.cell, s.facing, s.ghost);
    const ghostKey = `${s.ghost.x},${s.ghost.y}`;
    if (ghostKey !== lastGhost) {
      if (lastGhost !== '' && d <= GHOST_STEPS_HEARD) {
        emit({ type: 'ghost-step', at, data: { angle: b.angle, distance: Math.min(1, d / (GHOST_STEPS_HEARD + 1)) } }, at);
      }
      lastGhost = ghostKey;
    }
    if (now >= nextMoanAt && d <= DEFAULT_WALK_SETTINGS.hearRange + 1) {
      emit({ type: 'ghost-moan', at, data: { angle: b.angle, distance: Math.min(1, d / (DEFAULT_WALK_SETTINGS.hearRange + 2)) } }, at);
      const hunting = s.chasing || s.ghostMode === 'hunt';
      nextMoanAt = now + (hunting ? between(3500, 5500) : between(7000, 11000));
    }
  }
  if (now >= nextGustAt) {
    emit({ type: 'gust', at, data: { angle: between(-180, 180), distance: between(0.3, 0.8) } }, at);
    nextGustAt = now + between(8000, 15000);
  }
  if (now >= nextThunderAt) {
    emit({ type: 'thunder', at }, at);
    nextThunderAt = now + between(25000, 50000);
  }
  if (s.phase === 'hidden') {
    if (now >= nextBreathAt) {
      emit({ type: 'breath', at }, at);
      nextBreathAt = now + 3200;
    }
  } else {
    nextBreathAt = 0;
  }
}

// ---- the loop --------------------------------------------------------------

function frame(): void {
  adapter.poll();
  const now = performance.now();
  if (mode === 'guide') guideTick(now);
  if (mode === 'menu') menus.tick(now);
  if (walk && mode === 'playing') {
    walk.advance(now);
    snapshot = walk.snapshot();
    atmosphere(now);
    dread(now);
    roomSounds(now);
    livingHouse(now);
    if (snapshot.phase === 'escaped') finish();
  }
  if (profile.picture) {
    if (view && snapshot) {
      view.update(snapshot, now, { reducedMotion: profile.reducedMotion, stepMs: DEFAULT_WALK_SETTINGS.stepMs[profile.speed] });
      view.render();
    }
    const heart = walk && snapshot && maze ? heartWords(heartRate(phantomRooms(snapshot, maze))) : '';
    const room = snapshot && snapshot.room !== null ? capital(rooms[snapshot.room]?.name ?? '') : '';
    drawScene(ctx!, profile, { maze, snapshot, nowMs: now, sight: 2, title: 'Séance Escape', heart, room }, view !== null);
    const menuView = mode === 'menu' ? menus.view() : null;
    if (menuView) drawMenu(ctx!, profile, { x: WIDTH / 2 - 230, y: 70, width: 460, height: HEIGHT - 200 }, menuView);
    adapter.drawCaptionBox(ctx!, profile, { x: 40, y: HEIGHT - 110, width: WIDTH - 80, height: 90 });
  }
  requestAnimationFrame(frame);
}

adapter.bind({ onPress: press, onEscape: toMenu });
syncForm();
fillVoices();
announce('menu', undefined, false);
requestAnimationFrame(frame);

// Keep the built game in the browser, so it works with no network after the first visit.
if (import.meta.env.PROD) void registerOffline();
