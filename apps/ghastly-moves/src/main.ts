import {
  EVENT_TYPES,
  LevelRefused,
  applySetting,
  applySetup,
  createMenuStack,
  profileEntries,
  setupEntries,
  type MenuEntry,
  createSessionLog,
  mergeProfile,
  speechMs,
  type Attempt,
  type Kit,
  type Level,
  type OutputCommand,
  type Profile,
  type Run,
  type RunSnapshot,
  type SemanticEvent,
} from '@marrow/skeleton';
import { clipsBySlug, createWebAdapter, drawMenu, registerOffline } from '@marrow/skeleton/web';
import { createGhastlyKit } from './kit';
import { TABLES } from './lessons';
import { drawMap } from './map';
import { describeNext, itemsWon, mapLines, nextStage, parseProgress, withBoss, withRank, type Progress } from './progress';
import { HEIGHT, WIDTH, drawScene, type BossState } from './scene';
import { STAGES, needed, stageById, type Stage } from './stages';

function element<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`The page is missing #${id}.`);
  return el as T;
}

const canvas = element<HTMLCanvasElement>('game');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('This browser cannot draw the game.');

const DEFAULT_TABLE = 3;
const VOICE_KEY = 'ghastly.voice';
const TABLE_KEY = 'ghastly.table';
const STAGE_KEY = 'ghastly.stage';
const PROGRESS_KEY = 'ghastly.progress';

/** Read a saved choice, if storage lets us. A blocked or empty store just means the default. */
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

const tableSelect = element<HTMLSelectElement>('table');
tableSelect.replaceChildren(...TABLES.map((n) => new Option(`${n} times table`, String(n))));
const savedTable = Number(saved(TABLE_KEY));
tableSelect.value = String((TABLES as readonly number[]).includes(savedTable) ? savedTable : DEFAULT_TABLE);
const selectedTable = (): number => Number(tableSelect.value) || DEFAULT_TABLE;

// ---- the story -------------------------------------------------------------

let progress: Progress = parseProgress(saved(PROGRESS_KEY));
const persist = (): void => save(PROGRESS_KEY, JSON.stringify(progress));

const stageSelect = element<HTMLSelectElement>('stage');
const mapList = element<HTMLElement>('map');

function fillStages(): void {
  const keep = stageSelect.value;
  stageSelect.replaceChildren(
    new Option('Free practice (use the times table below)', ''),
    ...STAGES.map((s) => {
      const rank = progress.best[String(s.id)];
      const done = progress.cleared.includes(s.id) ? ', boss beaten' : '';
      return new Option(`Stage ${s.id}: ${s.name}, ${s.rule}${done}${rank ? `, best rank ${rank}` : ''}`, String(s.id));
    }),
  );
  stageSelect.value = keep;
  mapList.replaceChildren(...mapLines(progress).map((line) => Object.assign(document.createElement('li'), { textContent: line })));
}
fillStages();
// A saved choice wins, including "free practice" (empty). Otherwise the story picks up at the next stage.
const savedStage = saved(STAGE_KEY);
stageSelect.value = savedStage !== null ? (savedStage === '' || stageById(Number(savedStage)) ? savedStage : '') : String(nextStage(progress)?.id ?? 1);
const selectedStage = (): Stage | undefined => stageById(Number(stageSelect.value));

type Kind = 'practice' | 'stage' | 'boss';

let kit: Kit = createGhastlyKit(selectedStage() ?? selectedTable());
let stage: Stage | undefined;
let kind: Kind = 'practice';
let upNext: Kind = 'stage';
let bossTries = 0;
let popup: { text: string; at: number } | null = null;
let hud = '';
const log = createSessionLog();

// Which browser voice speaks. Empty means "pick the most natural one". A game could instead plug in
// its own AI voice or recordings with `voice: { provider }` or `voice: { clips }`; see docs/voices.md.
const browserVoice: { names: string[] } = { names: [] };
const savedVoice = saved(VOICE_KEY);
if (savedVoice) browserVoice.names = [savedVoice];
// Optional recordings: open the page with ?clips=voice/ to play voice/<line-name>.mp3 for each line.
// Lines with no file fall back to the browser voice. See docs/voices.md.
const clipBase = new URLSearchParams(location.search).get('clips');
const adapter = createWebAdapter({
  region: element('announcements'),
  voice: { browser: browserVoice, ...(clipBase ? { clips: clipsBySlug(clipBase) } : {}) },
});

let profile: Profile = adapter.withOsPreferences(adapter.loadProfile() ?? kit.newProfile());
let mode: 'menu' | 'card' | 'playing' = 'menu';
let run: Run | null = null;
let level: Level | null = null;
let lastSnapshot: RunSnapshot | null = null;
let falling = false;
let lockoutUntil = 0;
let attemptsAtStart = 0;

const speedSelect = element<HTMLSelectElement>('speed');
const pictureBox = element<HTMLInputElement>('picture');
const voiceBox = element<HTMLInputElement>('voice');
// Timing help: a press any time in the countdown counts, and the move is made on the beat. The maths is still yours.
const ASSIST_KEY = 'ghastly.assist';
const assistBox = element<HTMLInputElement>('assist');
assistBox.checked = saved(ASSIST_KEY) === 'on';
assistBox.addEventListener('change', () => save(ASSIST_KEY, assistBox.checked ? 'on' : 'off'));
const levelInput = element<HTMLInputElement>('level');
const voicePick = element<HTMLSelectElement>('voicepick');
const stats = element<HTMLElement>('stats');

// ---- settings --------------------------------------------------------------

function syncForm(): void {
  speedSelect.value = profile.speed;
  pictureBox.checked = profile.picture;
  voiceBox.checked = profile.voice;
  canvas.hidden = !profile.picture;
}

function change(patch: Partial<Profile>): void {
  profile = mergeProfile(profile, patch);
  adapter.saveProfile(profile);
  syncForm();
}

/** List the voices this browser has. They often arrive a moment after the page loads. */
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
  announceMenu(); // say something at once, so you can hear the voice you just chose
});
if (typeof speechSynthesis !== 'undefined') speechSynthesis.addEventListener?.('voiceschanged', fillVoices);

tableSelect.addEventListener('change', () => save(TABLE_KEY, tableSelect.value));
stageSelect.addEventListener('change', () => {
  save(STAGE_KEY, stageSelect.value);
  bossTries = 0;
});
speedSelect.addEventListener('change', () => change({ speed: speedSelect.value as Profile['speed'] }));
pictureBox.addEventListener('change', () => change({ picture: pictureBox.checked }));
voiceBox.addEventListener('change', () => change({ voice: voiceBox.checked }));
// The Start button plays at once: a mouse user does not need the scanning menu.
element('start').addEventListener('click', () => {
  adapter.unlock();
  soundUnlocked = true;
  menus.close();
  play();
});
element('download').addEventListener('click', downloadCsv);

// ---- output ----------------------------------------------------------------

const rate = (): number => kit.timing.rates[profile.speed];

/** Send one event through the channels to the player. `now` is level time in running seconds. */
function emit(event: SemanticEvent, now: number): void {
  adapter.perform(kit.render(event, profile), { now, rate: rate() }, profile);
  if (event.type === EVENT_TYPES.fallReason) {
    falling = true;
    // The reason and the lesson are heard in full before the countdown comes back.
    run?.holdForWords(performance.now(), wordsMs(event));
  }
  if (boss && stage) bossReacts(event, now);
  // A word above the ghost, so the judgement is seen as well as heard. It is shown still, never flashed.
  if (event.type === EVENT_TYPES.judged) {
    const grade = String(event.data?.grade ?? '');
    popup = { text: grade === 'perfect' ? 'Perfect!' : grade === 'good' ? 'Good' : 'Ok', at: performance.now() };
  }
}

// ---- the boss fight ----------------------------------------------------------

/** The boss's state while a fight is on. Every right move is a hit. At zero the boss falls. */
let boss: BossState | null = null;
let bossDown = false;
/** How long before the first beep the boss throws, in running seconds, so the whoosh never sits on a beep. */
const THROW_LEAD = 0.3;

/** The boss reacts to the fight: it throws as each projectile comes, groans when hit, laughs at a mistake. */
function bossReacts(event: SemanticEvent, now: number): void {
  if (!boss || !stage || bossDown) return;
  const realNow = performance.now();
  const say = (type: string, at: number, data?: Record<string, unknown>): void => {
    const e: SemanticEvent = data ? { type, at, data } : { type, at };
    adapter.perform(kit.render(e, profile), { now, rate: rate() }, profile);
  };
  if (event.type === EVENT_TYPES.approaching) {
    const at = Math.max(now, event.at - THROW_LEAD);
    say('boss-throw', at);
    boss.throwAt = realNow + ((at - now) / rate()) * 1000;
  } else if (event.type === EVENT_TYPES.judged || event.type === EVENT_TYPES.passed) {
    boss.health = Math.max(0, boss.health - 1);
    boss.hurtAt = realNow;
    say('boss-hurt', event.at, { boss: boss.name, left: boss.health });
    if (boss.health === 0) bossDown = true; // the frame loop ends the fight once the hit has landed
  } else if (event.type === EVENT_TYPES.fallReason) {
    boss.laughAt = realNow;
    say('boss-laugh', event.at);
  }
}

/** How long an event's words take to say, with a little to spare, because voices differ in speed. */
function wordsMs(event: SemanticEvent): number {
  const ms = kit.render(event, profile).reduce((sum, c) => sum + (c.channel === 'speech' ? speechMs(c.text) : 0), 0);
  return ms === 0 ? 0 : Math.round(ms * 1.2) + 300;
}

/** Say something that is not part of a level, such as the menu or a result. */
function announce(type: string, data?: Record<string, unknown>, aloud = true): void {
  const event: SemanticEvent = data ? { type, at: 0, data } : { type, at: 0 };
  adapter.perform(kit.render(event, profile), { now: 0, rate: 1 }, aloud ? profile : { ...profile, voice: false });
}

/** The menu line: the story says where you are; free practice just says to start. */
function announceMenu(aloud = true): void {
  if (selectedStage()) announce('story-menu', { where: describeNext(progress) }, aloud);
  else announce('menu', undefined, aloud);
}

/** Plain text to speech, captions and the log, for messages the kit has no event for. */
function say(text: string): void {
  const cmds: OutputCommand[] = [
    { channel: 'speech', senses: ['hearing'], at: 0, text },
    { channel: 'captions', senses: ['sight'], at: 0, text },
  ];
  adapter.perform(cmds, { now: 0, rate: 1 }, profile);
}

// ---- playing ---------------------------------------------------------------

function readSeed(): number {
  const fromUrl = new URLSearchParams(location.search).get('level');
  const n = Math.floor(Number(fromUrl ?? levelInput.value));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

const isRight = (a: Attempt): boolean => a.result === 'cleared' || a.result === 'passed';

/** "Right" counts a question once: a stone you got wrong at first is not right, even if you got it on the retry. */
function rightCount(total: number): number {
  const mine = log.entries().slice(attemptsAtStart);
  const missed = new Set(mine.filter((a) => !isRight(a)).map((a) => a.obstacle));
  return total - missed.size;
}

function start(what: Kind): void {
  const story = selectedStage();
  kind = what !== 'practice' && story ? what : 'practice';
  stage = kind === 'practice' ? undefined : story;
  kit = createGhastlyKit(stage ?? selectedTable(), { boss: kind === 'boss' });
  popup = null;
  hud = '';
  const seed = readSeed() + (kind === 'boss' ? 7919 + bossTries : 0);
  const count = stage ? (kind === 'boss' ? stage.boss.count : stage.count) : undefined;
  try {
    // The game never serves a level the proof refuses (Requirement 8.9).
    level = kit.refuseIfFailing(kit.generate(seed, count ? { count } : {}), `Level ${seed}`);
  } catch (error) {
    if (error instanceof LevelRefused) {
      say(error.message);
      return;
    }
    throw error;
  }
  adapter.cancelPending({ silence: true });
  adapter.visual.reset();
  musicKit = null; // the level brings its own music; the map's tune starts again afterwards
  falling = false;
  lastSnapshot = null;
  attemptsAtStart = log.entries().length;
  mode = 'playing';
  const total = level.obstacles.length;
  run = kit.run({
    level,
    speed: profile.speed,
    picture: profile.picture,
    assist: assistBox.checked,
    coachLeadMs: profile.coachLeadMs,
    startReal: performance.now(),
    emit,
    onAttempt: (attempt: Attempt) => {
      log.record(attempt);
      showStats();

    },
    onRestart: () => {
      adapter.cancelPending(); // sounds scheduled for the old try no longer apply
      falling = false;
    },
  });
  if (kind === 'boss' && stage) {
    boss = { look: stage.boss.look, name: stage.boss.name, health: needed(stage.boss), max: needed(stage.boss), throwAt: -1e9, hurtAt: -1e9, laughAt: -1e9 };
    bossDown = false;
    const intro = { boss: stage.boss.name, need: needed(stage.boss), total, prompt: kit.lesson?.prompt ?? '' };
    announce('boss-intro', intro);
    run.holdForWords(performance.now(), wordsMs({ type: 'boss-intro', at: 0, data: intro }));
  } else {
    boss = null;
    announce('intro', { prompt: kit.lesson?.prompt ?? '' });
    // The first countdown waits until the rule has been said.
    run.holdForWords(performance.now(), wordsMs({ type: 'intro', at: 0, data: { prompt: kit.lesson?.prompt ?? '' } }));
  }
}

/** The level was finished: let its last chime and "Level complete" play, then give the result. */
function finish(): void {
  const score = run?.snapshot().score ?? 0;
  const total = level?.obstacles.length ?? 0;
  const right = rightCount(total);
  const rank = level ? kit.rank(level, score).rank : 'C';
  const played = stage;
  const was = kind;
  lastSnapshot = run?.snapshot() ?? null;
  mode = 'menu';
  run = null;
  falling = false;
  hud = '';
  lockoutUntil = performance.now() + 1500; // a stray press must not restart at once

  if (was === 'stage' && played) {
    progress = withRank(progress, played.id, rank);
    persist();
    fillStages();
    mode = 'card';
    upNext = 'boss';
    setTimeout(() => {
      if (mode === 'card') {
        announce('stage-clear', { place: played.name, right, total, rank, taunt: played.boss.taunt, boss: played.boss.name });
      }
    }, 1200);
  } else if (was === 'boss' && played) {
    const need = needed(played.boss);
    const hits = boss ? boss.max - boss.health : right;
    const won = hits >= need;
    boss = null;
    bossDown = false;
    if (won) {
      progress = withBoss(withRank(progress, played.id, rank), played.id);
      persist();
      bossTries = 0;
      const next = nextStage(progress);
      if (next) {
        stageSelect.value = String(next.id);
        save(STAGE_KEY, stageSelect.value);
      }
      fillStages();
    } else {
      bossTries += 1;
      mode = 'card';
      upNext = 'boss';
    }
    setTimeout(() => {
      if (mode === 'playing') return;
      if (won) {
        announce('boss-won', { boss: played.boss.name, item: played.boss.item.name, blurb: played.boss.item.blurb });
      } else {
        announce('boss-lost', { boss: played.boss.name, hits, need });
      }
    }, 1200);
  } else {
    setTimeout(() => {
      if (mode === 'menu') announce('summary', { rank, score, right, total });
    }, 1200);
  }
}

/** Escape: stop everything and come back to the start. */
function toMenu(): void {
  mode = 'menu';
  run = null;
  lastSnapshot = null;
  falling = false;
  hud = '';
  adapter.cancelPending({ silence: true });
  menus.close();
  if (profile.scanning && soundUnlocked) openMenus(performance.now());
  else announceMenu();
}

// ---- the one-switch menu ------------------------------------------------------------

/**
 * Everything on the page can be done with one switch: the menu lights each entry in turn and says
 * it, and a press chooses. Settings change with each press and say their new value. The first time,
 * a short setup asks how you like to play. The page's form does the same for mouse and keyboard.
 */
const menus = createMenuStack({
  dwellMs: () => profile.dwellMs,
  say: (lit, opening) => announce(EVENT_TYPES.menuOption, { label: opening ? `${opening} ${lit.label}` : lit.label, index: lit.index, count: lit.count }),
});

function mainEntries(): MenuEntry[] {
  return [
    { kind: 'action', id: 'play', label: 'Play' },
    {
      kind: 'setting',
      id: 'stage',
      name: 'Stage',
      choices: [{ label: 'Free practice' }, ...STAGES.map((st) => ({ label: `${st.id}, ${st.name}, ${st.rule}` }))],
      current: () => (selectedStage() ? STAGES.indexOf(selectedStage()!) + 1 : 0),
    },
    {
      kind: 'setting',
      id: 'table',
      name: 'Practice table',
      choices: TABLES.map((t) => ({ label: `${t} times` })),
      current: () => Math.max(0, (TABLES as readonly number[]).indexOf(selectedTable())),
    },
    { kind: 'setting', id: 'assist', name: 'Timing help', choices: [{ label: 'Off' }, { label: 'On, press any time in the countdown' }], current: () => (assistBox.checked ? 1 : 0) },
    { kind: 'action', id: 'settings', label: 'Settings' },
  ];
}

/** The main menu's title: where the story is. Said once, as the menu opens. */
const mainTitle = (): string => `Ghastly Moves. ${describeNext(progress)}`;

function openMenus(now: number): void {
  menus.close();
  if (!profile.setupDone) menus.open({ title: 'Welcome. How would you like to play?', entries: setupEntries() }, now);
  else menus.open({ title: mainTitle(), entries: mainEntries() }, now);
}

function menuPress(now: number): void {
  const r = menus.press(now);
  if (!r) return;
  if (r.kind === 'action') {
    if (r.id === 'play') {
      menus.close();
      play();
    } else if (r.id === 'settings') {
      menus.open({ title: 'Settings', entries: profileEntries(() => profile) }, now);
    } else if (r.id.startsWith('setup:')) {
      const done = applySetup(profile, r.id)!;
      setProfile(done.profile);
      menus.close();
      // What the choice did is said first, in the same line as the menu, so nothing cuts it off.
      menus.open({ title: mainTitle(), entries: mainEntries() }, now, undefined, done.says || undefined);
      if (done.more) menus.open({ title: 'Settings', entries: profileEntries(() => profile) }, now);
    }
    return;
  }
  if (r.id === 'stage') {
    stageSelect.value = r.choice === 0 ? '' : String(STAGES[r.choice - 1]!.id);
    save(STAGE_KEY, stageSelect.value);
    bossTries = 0;
  } else if (r.id === 'table') {
    tableSelect.value = String(TABLES[r.choice]);
    save(TABLE_KEY, tableSelect.value);
  } else if (r.id === 'assist') {
    assistBox.checked = r.choice === 1;
    save(ASSIST_KEY, assistBox.checked ? 'on' : 'off');
  } else {
    setProfile(applySetting(profile, r.id, r.choice));
  }
}

function setProfile(next: Profile): void {
  profile = next;
  adapter.saveProfile(profile);
  syncForm();
}

/** Play: a story stage opens with a card that tells where you are, then the next press begins. */
function play(): void {
  const story = selectedStage();
  if (story) {
    kit = createGhastlyKit(story);
    mode = 'card';
    upNext = 'stage';
    announce('story-card', { story: story.story, rule: story.rule });
  } else {
    start('practice');
  }
}

function press(): void {
  const now = performance.now();
  if (now < lockoutUntil) return;
  adapter.unlock();
  soundUnlocked = true;
  if (mode === 'playing') {
    run?.press(now);
    return;
  }
  if (mode === 'card') {
    start(upNext);
    return;
  }
  // From the menu: with scanning (the default), the first press opens the menu and the next ones choose.
  if (profile.scanning) {
    if (menus.top()) menuPress(now);
    else openMenus(now);
    return;
  }
  play();
}

function showStats(): void {
  const s = log.summary();
  const offset = s.meanAbsOffsetMs === null ? 'n/a' : `${Math.round(s.meanAbsOffsetMs)} ms`;
  stats.textContent = `${s.attempts} attempts, ${s.cleared} right, ${s.falls} mistakes. Average distance from the beat: ${offset}.`;
}

function downloadCsv(): void {
  const blob = new Blob([log.toCsv()], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ghastly-moves-results-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ---- the loop --------------------------------------------------------------

// ---- music between levels -------------------------------------------------------

/**
 * On the map and the story cards, the next place's tune plays, so the mood is there before the level.
 * Nothing is timed here, so there are no cues for it to cover; it waits until the player's first
 * press, because browsers allow sound only after one.
 */
let musicKit: { id: number; kit: Kit } | null = null;
let musicStartReal = 0;
let nextBarReal = 0;
let musicBar = 0;
let soundUnlocked = false;

function menuMusic(nowReal: number): void {
  if (!soundUnlocked) return;
  const place = (mode === 'card' && stage) || selectedStage() || nextStage(progress);
  if (!place) return;
  const wanted = upNext === 'boss' && mode === 'card' ? -place.id : place.id; // the boss card plays the boss's tune
  if (musicKit?.id !== wanted) {
    musicKit = { id: wanted, kit: createGhastlyKit(place, { boss: wanted < 0 }) };
    musicStartReal = nowReal;
    nextBarReal = nowReal;
    musicBar = 0;
  }
  if (nowReal < nextBarReal) return;
  const r = musicKit.kit.timing.rates[profile.speed];
  const at = ((nowReal - musicStartReal) / 1000) * r;
  const bar = { type: EVENT_TYPES.atmosphere, at, data: { bar: musicBar, tension: 0.15, span: 2, quiet: [], pulse: 0 } };
  adapter.perform(musicKit.kit.render(bar, profile), { now: at, rate: r }, profile);
  musicBar += 1;
  nextBarReal += (2 / r) * 1000;
}

/**
 * While the level stands still (resting after a fall, or waiting for words to finish), its own music
 * would stop with it. So the band plays on, on the real clock, in a calm breakdown: no drums, and no
 * countdown is running, so there is nothing for it to cover.
 */
let holdBarReal = 0;
let holdBar = 0;
let holding = false;
function holdMusic(nowReal: number, held: boolean): void {
  if (!held) {
    holding = false;
    return;
  }
  if (!holding) {
    holding = true;
    holdBarReal = nowReal + 400; // let the level's last bar ring out first
    holdBar = 0;
  }
  if (nowReal < holdBarReal) return;
  const r = rate();
  const at = (nowReal / 1000) * r; // any steady clock will do: nothing else is on it
  const bar = { type: EVENT_TYPES.atmosphere, at, data: { bar: holdBar, tension: 0.2, span: 2, quiet: [], pulse: at % kit.timing.beat, energy: 0.15 } };
  adapter.perform(kit.render(bar, profile), { now: at, rate: r }, profile);
  holdBar += 1;
  holdBarReal += (2 / r) * 1000;
}

function frame(): void {
  adapter.poll();
  const now = performance.now();
  if (run && mode === 'playing') {
    run.advance(now);
    lastSnapshot = run.snapshot();
    holdMusic(now, lastSnapshot.held);
    // The boss falls as soon as its last hit has landed; otherwise the fight ends with the level.
    if (bossDown && boss && now - boss.hurtAt > 700) {
      adapter.cancelPending();
      finish();
    } else if (lastSnapshot.phase === 'done') finish();
  } else {
    menuMusic(now);
    if (mode === 'menu') menus.tick(now);
  }
  if (profile.picture) {
    if (mode === 'playing') {
      drawScene(ctx!, kit, profile, {
        snapshot: lastSnapshot,
        level,
        nowMs: now,
        falling,
        title: kit.lesson?.title ?? '',
        scenery: stage?.scenery ?? 'moon',
        popup,
        hud,
        items: itemsWon(progress).map((i) => i.id),
        boss,
      });
    } else {
      drawMap(ctx!, profile, { progress, selected: selectedStage()?.id ?? 0, nowMs: now });
      const view = mode === 'menu' ? menus.view() : null;
      if (view) drawMenu(ctx!, profile, { x: WIDTH - 440, y: 20, width: 420, height: HEIGHT - 150 }, view);
    }
    adapter.drawCaptionBox(ctx!, profile, { x: 40, y: HEIGHT - 110, width: WIDTH - 80, height: 90 });
  }
  requestAnimationFrame(frame);
}

adapter.bind({ onPress: press, onEscape: toMenu });
syncForm();
fillVoices();
announceMenu(false); // written, not spoken: browsers allow speech only after a press
requestAnimationFrame(frame);

// Keep the built game in the browser, so it works with no network after the first visit.
if (import.meta.env.PROD) void registerOffline();
