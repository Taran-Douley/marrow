import {
  DEFAULT_WALK_SETTINGS,
  runLengthWords,
  EVENT_TYPES,
  applySetting,
  applySetup,
  bearingFrom,
  createMenuStack,
  PROFILE_SETTINGS,
  createScanner,
  profileEntries,
  setupEntries,
  type MenuEntry,
  createWalk,
  distancesFrom,
  indexOf,
  mergeProfile,
  totalSpokenMs,
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
import { NARRATOR_BROWSER_VOICES, clipsBySlug, createVoiceClips, createWebAdapter, drawMenu, registerOffline } from '@marrow/skeleton/web';
import { MABEL, PASSAGE, RELICS, ROOM_EVENT_STYLES, SEARCH_LINES, WARDROBE, WHISPERS, nameRooms, sideWord, type Floor, type RoomInfo, type RoomKind } from './content';
import { CLOSE_RANGE, heartRate, heartWords } from './dread';
import { GUIDE, type GuideItem } from './guide';
import { FRIGHTS, createSeanceKit, type Fright } from './kit';
import {
  NO_PERK_ID,
  NO_PERK_LABEL,
  PERK_KEY,
  PERK_PLAY,
  perkChoiceIntro,
  perkChosen,
  perkOffer,
  perkOptionLabel,
  perkStartLine,
  perksFor,
  readPerk,
  type PerkWords,
} from './perks';
import {
  CATCHES_KEY,
  CATCH_LIMIT,
  HOUSE_SIZES,
  RUN_KEY,
  caughtEndCaption,
  caughtEndLine,
  readCatchesEnd,
  readRunCounter,
  runFacts,
  serveHouse,
  type RunEnd,
  type Size,
} from './runs';
import { drawNoiseMeter, gutterDark } from './risk-view';
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

// The narrator's recorded voice is a young British woman, so the browser voice that covers the lines with no
// recording is the closest British English female voice the browser has.
const browserVoice: { names: string[]; lang: string } = { names: [...NARRATOR_BROWSER_VOICES], lang: 'en-GB' };
const savedVoice = saved(VOICE_KEY);
if (savedVoice) browserVoice.names = [savedVoice];
// Recordings: voice/manifest.json (made by `npm run voice`) is loaded if it exists; a line with no clip falls
// back to the browser voice. Opening the page with ?clips=voice/ also finds clips by line name. See docs/voices.md.
const clipBase = new URLSearchParams(location.search).get('clips');
const voiceClips = createVoiceClips({ ...(clipBase ? { fallback: clipsBySlug(clipBase) } : {}) });
const adapter = createWebAdapter({
  region: element('announcements'),
  // Story lines are long: each one finishes before the next begins, so nothing is cut off.
  voice: { browser: browserVoice, queue: true, clips: (text) => voiceClips.lookup(text) },
});

let profile: Profile = adapter.withOsPreferences(adapter.loadProfile() ?? kit.newProfile());
/** 'ended' is the moment after a run: one press enters a new house. */
let mode: 'menu' | 'guide' | 'playing' | 'ended' | 'perk' = 'menu';
/** The perks the last run's relics give. The player chooses one by scanning before the next house. */
let pendingPerks: PerkWords[] = [];
let walk: Walk | null = null;
let maze: Maze | null = null;
let rooms: RoomInfo[] = [];
let whisperRooms = new Map<number, string>();
let whispersHeard = 0;
/** The kinds of room Mabel has already talked about. */
const mabelSaid = new Set<RoomKind>();
let snapshot: WalkSnapshot | null = null;
/** When the lights last guttered, in performance time, or -Infinity. */
let gutterAt = -Infinity;
let startedAt = 0;
let nextBarAt = 0;
let bar = 0;
let lockoutUntil = 0;
let runNumber = 0;
let runSeed = 0;
let runEnded = false;
let escapes = 0;
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
sizeSelect.value = savedSize && savedSize in HOUSE_SIZES ? savedSize : 'medium';
const selectedSize = (): Size => (sizeSelect.value in HOUSE_SIZES ? (sizeSelect.value as Size) : 'medium');

// Catches end a run (on by default). Turning it off plays with no limit on catches.
const catchesBox = element<HTMLInputElement>('catches');
catchesBox.checked = readCatchesEnd(saved);
const catchesEnd = (): boolean => catchesBox.checked;
function setCatchesEnd(on: boolean): void {
  catchesBox.checked = on;
  save(CATCHES_KEY, on ? 'on' : 'off');
}
catchesBox.addEventListener('change', () => save(CATCHES_KEY, catchesBox.checked ? 'on' : 'off'));
// The house number is the run counter: it moves on by itself after each run.
// ?level= picks the first house of a visit; after that the counter leads.
const urlLevel = Math.floor(Number(new URLSearchParams(location.search).get('level')));
levelInput.value = String(Number.isFinite(urlLevel) && urlLevel >= 1 ? urlLevel : readRunCounter(saved));

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
  if (mode === 'menu' || mode === 'guide' || mode === 'ended' || mode === 'perk') {
    guide = null;
    start();
  }
});

// ---- output ----------------------------------------------------------------

/** Send one event to the player. `now` is seconds since the walk began; the walk runs in real time. */
function emit(event: SemanticEvent, now: number): void {
  // Each relic hums in its own voice.
  let shown = event.type === 'relic-sense' && typeof event.data?.relic === 'number' ? { ...event, type: `relic-sense-${event.data.relic}` } : event;
  // Each room event and each band of the noise meter has its own sound, caption and line.
  if (event.type === 'room-event') {
    const id = String(event.data?.id);
    shown = { ...event, type: `room-event-${id}` };
    // The lights gutter: the room dims for a moment (never a flash; see risk-view.ts).
    if (ROOM_EVENT_STYLES[id]?.visual === 'gutter') gutterAt = performance.now();
  } else if (event.type === 'noise-meter') {
    shown = { ...event, type: `noise-meter-${String(event.data?.band).replace(' ', '-')}` };
  }
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
  // Words plus any character's signature sound before them.
  const total = totalSpokenMs(kit.render(event, profile));
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
      return { line: data.free ? `${MABEL.offer} ${way}` : data.perk ? `${way} ${PERK_PLAY.freeListen}` : way };
    }
    case 'room-event': {
      const style = ROOM_EVENT_STYLES[String(data.id)];
      if (!style) return undefined;
      // The scary ones are softened with the Fright setting. Their information is never taken away.
      let line = fright() !== 'full' && style.soft ? style.soft : style.line;
      if (data.effect === 'hint') line += ' ' + MABEL.hint(data.what === 'exit' ? 'exit' : 'relic', String(data.way), Number(data.rooms));
      if (data.effect === 'ghost-place') line += ` The phantom is ${sideWord(Number(data.angle))}, ${Number(data.rooms)} rooms away.`
      // Heard from somewhere in the room, or from the phantom if the event tells where it is.
      const hash = [...String(data.id)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 300, 7);
      const angle = typeof data.angle === 'number' ? data.angle : hash - 150;
      return { line, caption: style.caption, angle, distance: 0.5 };
    }
    case 'walk-search': {
      if (data.result === 'relic') {
        const way = MABEL.hint('relic', String(data.way), Number(data.rooms));
        return { line: SEARCH_LINES.relic(way), caption: 'Search: a note points the way' };
      }
      if (data.result === 'trail') {
        return { line: SEARCH_LINES.trail(Number(data.angle), Number(data.rooms), data.near === true), caption: data.near === true ? 'Search: scuff marks, the phantom is near' : 'Search: old scuff marks' };
      }
      return { line: SEARCH_LINES.nothing, caption: 'Search: only dust' };
    }
    case 'ghost-call': {
      const s = walk?.snapshot();
      const mood = !s ? '' : s.chasing ? ' It knows where you are!' : s.ghostMode === 'hunt' ? ' It is hunting you.' : ' It is wandering.';
      return { mood };
    }
    case 'walk-listen':
      return data.free === true ? { summary: `${String(data.summary)} ${PERK_PLAY.freeListen}` } : undefined;
    case 'caught': {
      // Second chance: the first catch does not count, and Mabel says so.
      if (data.forgiven === true) return { line: PERK_PLAY.forgiven };
      const n = Number(data.catches) || 1;
      return { line: catchesEnd() && n >= CATCH_LIMIT ? MABEL.lastCatch : MABEL.caught(n) };
    }
    default:
      return undefined;
  }
}

// ---- choosing a perk ------------------------------------------------------------
//
// One switch, no time limit: each perk is lit in turn and said with what it does; the list goes round until one is
// chosen. The last choice is "No perk". Chosen, it is saved for the next run only, and that run starts at once.

let perkScan: Scanner | null = null;
let perkResumeAt = 0;
let perkLitAt = -1;
let perkOptions: PerkWords[] = [];

function openPerkChoice(now: number): void {
  mode = 'perk';
  perkOptions = pendingPerks;
  const options: ScanOption[] = [
    ...perkOptions.map((p) => ({ id: p.id, label: perkOptionLabel(p) })),
    { id: NO_PERK_ID, label: NO_PERK_LABEL },
  ];
  perkScan = createScanner({ options, dwellMs: profile.dwellMs });
  const line = perkChoiceIntro(perkOptions.length);
  announce('guide-line', { line });
  perkResumeAt = now + spokenMs({ type: 'guide-line', at: 0, data: { line } });
  perkLitAt = -1;
}

function perkTick(now: number): void {
  if (!perkScan || now < perkResumeAt) return;
  const lit = perkLitAt < 0 ? perkScan.start(now) : perkScan.tick(now);
  if (!lit) return;
  perkLitAt = now;
  const count = perkOptions.length + 1;
  const index = perkOptions.findIndex((p) => p.id === lit.id);
  announce('guide-option', { label: lit.label, index: (index < 0 ? perkOptions.length : index) + 1, count });
}

function perkPress(now: number): void {
  if (!perkScan || now < perkResumeAt || perkLitAt < 0) return;
  const chosen = perkScan.press();
  if (!chosen) return;
  const perk = perkOptions.find((p) => p.id === chosen.id) ?? null;
  save(PERK_KEY, perk ? perk.id : '');
  perkScan = null;
  say(perkChosen(perk));
  // The words are said while the house loads; the introduction follows them.
  start();
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

/** Where this run starts looking for a house: the house number (the run counter), or `?level=` for the first run of a visit. */
function readSeed(): number {
  const n = Math.floor(Number(levelInput.value));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** The sizes' lengths: only the standard house is held to 5 to 8 minutes. The others are the player's choice. */
const lengthNote = (size: Size): string => (size === 'small' ? ' This is a small house: a shorter run.' : size === 'large' ? ' This is a large house: a longer run.' : '');

function start(): void {
  const firstSeed = readSeed();
  const size = selectedSize();
  // Every run is a new house. Each is proven before it is served; one that fails is skipped, and the skip is logged.
  const served = serveHouse(firstSeed, size, (skip) => console.info(`Séance Escape: house ${skip.seed} skipped, not served. ${skip.reason}`));
  if (!served) {
    say(`No fair house could be found from number ${firstSeed}. Try another house number or size.`);
    mode = 'menu';
    return;
  }
  const house = served.maze;
  // The run counter moves on, so the next run is a new house, even after a reload.
  const next = served.seed + 1;
  levelInput.value = String(next);
  save(RUN_KEY, String(next));
  runNumber += 1;
  runSeed = served.seed;  kit = createSeanceKit({ fright: fright() });
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
  nextMoanAt = performance.now() + 4000;
  nextGustAt = performance.now() + 6000;
  nextThunderAt = performance.now() + 20000;
  nextBreathAt = 0;
  gutterAt = -Infinity;
  // The first-person 3D view, if this browser can do it. Otherwise (or with ?view=2d) the flat map, which plays the same.
  closeView();
  if (new URLSearchParams(location.search).get('view') !== '2d') view = createView3d(canvas3d, house, rooms);
  canvas3d.hidden = !view;
  viewBox.classList.toggle('has3d', view !== null);
  mode = 'playing';
  startedAt = performance.now();
  runEnded = false;
  nextBarAt = startedAt;
  bar = 0;
  distanceKey = '';
  wasClose = false;
  nextHeartAt = startedAt;
  roomSoundAt.clear();
  // A perk chosen at the end of the last run applies to this run only: it is read, then cleared, so it cannot carry on.
  const perk = readPerk(saved);
  if (perk) save(PERK_KEY, '');
  pendingPerks = [];
  const intro = { type: 'intro', at: 0, data: { line: MABEL.intro + lengthNote(size) + (perk ? perkStartLine(perk) : '') } };
  walk = createWalk({
    maze: house,
    speed: profile.speed,
    startMs: startedAt,
    dwellMs: profile.dwellMs,
    emit,
    decorate,
    perk,
    settings: { hintLabel: 'Ask Mabel: the phantom moves once', freeHintLabel: 'Ask Mabel: free this once, the phantom does not move' },
    // The walk waits for each spoken line to finish before it reads out the options.
    speechMs: (event) => spokenMs(event),
    quietMs: spokenMs(intro),
  });
  snapshot = walk.snapshot();
  announce('intro', intro.data);
}

/** What the run was, for its end. */
function runEndFacts(how: RunEnd['how']): RunEnd | null {
  if (!maze || !walk) return null;
  const s = walk.snapshot();
  const rooms = maze.rooms.filter((r) => s.visited[indexOf(maze!, r)]).length;
  return { how, relicsFound: s.relicsFound, relicsTotal: maze.relics.length, rooms, ms: Math.round(performance.now() - startedAt), catches: s.catches };
}

/** Which perks the relics found in this run give: a relic's number in RELICS is its perk's number in the table. */
function earnedPerks(): PerkWords[] {
  if (!maze || !walk) return [];
  const left = walk.snapshot().relicsLeft;
  const found = maze.relics.map((r, i) => i).filter((i) => !left.some((c) => c.x === maze!.relics[i]!.x && c.y === maze!.relics[i]!.y));
  return perksFor(found);
}

function finish(): void {
  const end = runEndFacts('escaped');
  if (!maze || !walk || !end || runEnded) return;
  runEnded = true;
  pendingPerks = earnedPerks();
  const s = walk.snapshot();
  const result = walkResult(maze, s);
  games += 1;
  escapes += 1;
  bestScore = Math.max(bestScore, result.score);
  stats.textContent = `${games} runs, ${escapes} escapes. Best score ${bestScore}. Last: house ${runSeed}, escaped, rank ${result.rank}, ${runLengthWords(end.ms)}, caught ${s.catches} times, ${whispersHeard} of ${WHISPERS.length} whispers.`;
  walk = null;
  mode = 'ended';
  lockoutUntil = performance.now() + 1500;
  setTimeout(() => {
    if (mode === 'ended') {
      announce('summary', {
        facts: `${runFacts(end)} ${perkOffer(end.relicsFound)}`,
        time: runLengthWords(end.ms),
        rank: result.rank,
        score: result.score,
        catches: s.catches,
        whispers: whispersHeard,
        whisperTotal: WHISPERS.length,
      });
    }
  }, 2200);
}

/** Three catches end the run, told gently: the house lets you go. One press enters a new house. */
function endRunCaught(): void {
  const end = runEndFacts('caught');
  if (!maze || !walk || !end || runEnded) return;
  runEnded = true;
  pendingPerks = earnedPerks();
  games += 1;
  stats.textContent = `${games} runs, ${escapes} escapes. Best score ${bestScore}. Last: house ${runSeed}, the house let you go, ${end.relicsFound} of ${end.relicsTotal} relics, ${runLengthWords(end.ms)}.`;
  walk = null;
  mode = 'ended';
  lockoutUntil = performance.now() + 1500;
  // Let the last catch be heard first.
  setTimeout(() => {
    if (mode === 'ended') announce('run-end', { line: caughtEndLine(end), caption: caughtEndCaption(end) });
  }, 3200);
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
  perkScan = null;
  pendingPerks = [];
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
      choices: [{ label: 'Small: a shorter run' }, { label: 'Medium: 5 to 8 minutes' }, { label: 'Large: a longer run' }],
      current: () => SIZE_NAMES.indexOf(selectedSize()),
    },
    {
      kind: 'setting',
      id: 'fright',
      name: 'Fright',
      choices: [{ label: 'Full, jump scares' }, { label: 'Gentle, softer scares' }, { label: 'Off, no jump scares' }],
      current: () => FRIGHTS.indexOf(fright()),
    },
    {
      kind: 'setting',
      id: 'catches',
      name: 'Catches end a run',
      choices: [{ label: 'On: three catches end a run' }, { label: 'Off: no limit' }],
      current: () => (catchesEnd() ? 0 : 1),
    },
    { kind: 'action', id: 'settings', label: 'Settings' },
  ];
}

const MAIN_TITLE = 'Séance Escape.';
/** Every player setting except the coach, which is for timed games. */
const SEANCE_SETTINGS = PROFILE_SETTINGS.map((s) => s.id).filter((id) => id !== 'coach');
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
      menus.open({ title: 'Settings', entries: profileEntries(() => profile, SEANCE_SETTINGS) }, now);
    } else if (r.id.startsWith('setup:')) {
      const done = applySetup(profile, r.id)!;
      setProfile(done.profile);
      menus.close();
      menus.open({ title: MAIN_TITLE, entries: mainEntries() }, now, undefined, done.says || undefined);
      if (done.more) menus.open({ title: 'Settings', entries: profileEntries(() => profile, SEANCE_SETTINGS) }, now);
    }
    return;
  }
  if (r.id === 'size') {
    sizeSelect.value = SIZE_NAMES[r.choice]!;
    save(SIZE_KEY, sizeSelect.value);
  } else if (r.id === 'fright') {
    frightSelect.value = FRIGHTS[r.choice]!;
    frightSelect.dispatchEvent(new Event('change'));
  } else if (r.id === 'catches') {
    setCatchesEnd(r.choice === 0);
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
  } else if (mode === 'ended') {
    // One press, any key: the next run, in a new house. With relics found, the perk is chosen first.
    guide = null;
    if (pendingPerks.length > 0) openPerkChoice(now);
    else start();
  } else if (mode === 'perk') perkPress(now);
  else if (mode === 'menu') openGuide(now);
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
let nextMoanAt = 0;
let nextGustAt = 0;
let nextThunderAt = 0;
let nextBreathAt = 0;

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
    // Its feet are sounded by the walk itself, from where it is, each time it moves (see `ghost-step`).
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
  if (mode === 'perk') perkTick(now);
  if (mode === 'menu') menus.tick(now);
  if (walk && mode === 'playing') {
    walk.advance(now);
    snapshot = walk.snapshot();
    atmosphere(now);
    dread(now);
    roomSounds(now);
    livingHouse(now);
    if (snapshot.phase === 'escaped') finish();
    else if (catchesEnd() && snapshot.catches >= CATCH_LIMIT) endRunCaught();
  }
  if (profile.picture) {
    if (view && snapshot) {
      view.update(snapshot, now, { reducedMotion: profile.reducedMotion, stepMs: DEFAULT_WALK_SETTINGS.stepMs[profile.speed] });
      view.render();
    }
    const heart = walk && snapshot && maze ? heartWords(heartRate(phantomRooms(snapshot, maze))) : '';
    const room = snapshot && snapshot.room !== null ? capital(rooms[snapshot.room]?.name ?? '') : '';
    drawScene(ctx!, profile, { maze, snapshot, nowMs: now, sight: 2, title: 'Séance Escape', heart, room }, view !== null);
    // The noise you are making, in bars and words; and the room dimming when the lights gutter (still when motion is reduced).
    if (walk && snapshot && mode === 'playing') {
      const dark = gutterDark(now - gutterAt, profile.reducedMotion);
      if (dark > 0) {
        ctx!.fillStyle = `rgba(4, 2, 8, ${dark.toFixed(3)})`
        ctx!.fillRect(0, 0, WIDTH, HEIGHT);
      }
      drawNoiseMeter(ctx!, snapshot.noise, WIDTH - 232 - 40, HEIGHT - 110 - 34 - 8);
    }
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
void voiceClips.load(); // recordings, if voice/manifest.json exists
if (import.meta.env.PROD) void registerOffline();
