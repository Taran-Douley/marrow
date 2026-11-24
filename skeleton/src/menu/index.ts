import { mergeProfile } from '../profile';
import { dwellFor, scanningAudible } from '../scanning';
import type { ProofResult } from '../proof';
import type { Profile, ProfilePatch } from '../types';

// A menu one switch can drive, settings included (Requirements 2 and 17). Entries light up and are
// said in turn, and one press chooses the lit one. A setting changes to its next value with each
// press, and stays lit so the new value is heard at once: press again to change it again, or wait
// and the highlight moves on. Nothing is timed: it cycles until pressed, at the player's scan speed.
//
// The menu is a pure state machine. It holds no values: each setting reads its value from the game
// every time, so a change made with a mouse in the page's own form shows up here too.

export interface MenuChoice {
  label: string;
}

export type MenuEntry =
  /** Something to do: "Play", "Settings", "Back". */
  | { kind: 'action'; id: string; label: string }
  /** A setting: "Speed: Slow". A press moves to the next choice, wrapping round. */
  | { kind: 'setting'; id: string; name: string; choices: readonly MenuChoice[]; current(): number };

export interface MenuLit {
  id: string;
  /** What is said and shown: "Play", or "Speed: Slow". */
  label: string;
  /** 1-based, for "2 of 5". */
  index: number;
  count: number;
  kind: MenuEntry['kind'];
}

export type MenuResult =
  | { kind: 'action'; id: string }
  /** A setting moved on. `choice` is the index of its new value; `lit` is the entry, lit again with it. */
  | { kind: 'changed'; id: string; choice: number; lit: MenuLit };

export interface Menu {
  readonly title: string;
  entries(): readonly MenuEntry[];
  /** Light the first entry (or `at`). Returns it, to be said. */
  start(nowMs: number, at?: string): MenuLit | null;
  /** Move the clock. Returns the newly lit entry when the highlight moves, otherwise null. */
  tick(nowMs: number): MenuLit | null;
  /** Choose the lit entry. A setting moves on and stays lit; the game applies the new choice. */
  press(nowMs: number): MenuResult | null;
  lit(): MenuLit | null;
  /** The scan speed changed: it applies from the next entry. */
  setDwell(ms: number): void;
  pause(): void;
  resume(nowMs: number): void;
}

export interface MenuOptions {
  title: string;
  entries: readonly MenuEntry[];
  dwellMs: number;
}

/** The words for an entry as it is now. */
export function entryLabel(entry: MenuEntry): string {
  if (entry.kind === 'action') return entry.label;
  const choice = entry.choices[((entry.current() % entry.choices.length) + entry.choices.length) % entry.choices.length];
  return `${entry.name}: ${choice?.label ?? ''}`;
}

export function createMenu(options: MenuOptions): Menu {
  const entries = [...options.entries];
  if (entries.length === 0) throw new Error(`Menu '${options.title}' needs at least one entry.`);
  for (const e of entries) {
    if (e.kind === 'setting' && e.choices.length < 2) throw new Error(`Menu '${options.title}': setting '${e.name}' needs at least two choices.`);
  }
  let dwell = options.dwellMs;
  let index = 0;
  let litAt = 0;
  let started = false;
  let paused = false;

  const litNow = (): MenuLit | null => {
    if (!started) return null;
    const e = entries[index]!;
    return { id: e.id, label: entryLabel(e), index: index + 1, count: entries.length, kind: e.kind };
  };

  return {
    title: options.title,
    entries: () => entries,
    start(nowMs, at) {
      started = true;
      paused = false;
      const found = at === undefined ? -1 : entries.findIndex((e) => e.id === at);
      index = found >= 0 ? found : 0;
      litAt = nowMs;
      return litNow();
    },
    tick(nowMs) {
      if (!started || paused || entries.length < 2) return null;
      if (nowMs - litAt < dwellFor({ id: '', label: entryLabel(entries[index]!) }, dwell)) return null;
      index = (index + 1) % entries.length;
      litAt = nowMs;
      return litNow();
    },
    press(nowMs) {
      if (!started) return null;
      const e = entries[index]!;
      if (e.kind === 'action') return { kind: 'action', id: e.id };
      const choice = (e.current() + 1) % e.choices.length;
      litAt = nowMs; // the new value gets its full time, so it is heard and can be changed again
      const lit = { ...litNow()!, label: `${e.name}: ${e.choices[choice]!.label}` };
      return { kind: 'changed', id: e.id, choice, lit };
    },
    lit: litNow,
    setDwell(ms) {
      dwell = ms;
    },
    pause() {
      paused = true;
    },
    resume(nowMs) {
      paused = false;
      litAt = nowMs;
    },
  };
}

/** Property 102 for a menu: every entry, at every value, can be said in full while it is lit. */
export function menuAudible(menu: Menu, dwellMs: number): ProofResult {
  const options = menu.entries().flatMap((e) =>
    e.kind === 'action' ? [{ id: e.id, label: e.label }] : e.choices.map((c, i) => ({ id: `${e.id}#${i}`, label: `${e.name}: ${c.label}` })),
  );
  return scanningAudible(options, dwellMs, menu.title);
}

// ---- the player's own settings, ready to put in a menu ---------------------------

/** One profile setting: its choices, and how each changes the profile. */
interface ProfileSetting {
  id: string;
  name: string;
  choices: readonly { label: string; patch: ProfilePatch; is(p: Profile): boolean }[];
}

const DWELLS = [1500, 2200, 3000, 4500, 6500] as const;
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;

/** Every setting a player can change with one switch. Scanning itself is left to the page's form, so it can never be switched off by mistake. */
export const PROFILE_SETTINGS: readonly ProfileSetting[] = [
  {
    id: 'speed',
    name: 'Game speed',
    choices: (['slow', 'medium', 'fast'] as const).map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1), patch: { speed: s }, is: (p: Profile) => p.speed === s })),
  },
  {
    id: 'dwell',
    name: 'Scan speed',
    choices: DWELLS.map((ms) => ({ label: `${ms / 1000} seconds`, patch: { dwellMs: ms }, is: (p: Profile) => p.dwellMs === ms })),
  },
  {
    id: 'voice',
    name: 'Voice',
    choices: [
      { label: 'On', patch: { voice: true }, is: (p: Profile) => p.voice },
      { label: 'Off, for screen readers', patch: { voice: false }, is: (p: Profile) => !p.voice },
    ],
  },
  {
    id: 'picture',
    name: 'Picture',
    choices: [
      { label: 'On', patch: { picture: true }, is: (p: Profile) => p.picture },
      { label: 'Off, play by sound', patch: { picture: false }, is: (p: Profile) => !p.picture },
    ],
  },
  {
    id: 'music',
    name: 'Music',
    choices: [
      { label: 'Full', patch: { volume: { music: 1 } }, is: (p: Profile) => near(p.volume.music, 1) },
      { label: 'Normal', patch: { volume: { music: 0.85 } }, is: (p: Profile) => near(p.volume.music, 0.85) },
      { label: 'Quiet', patch: { volume: { music: 0.6 } }, is: (p: Profile) => near(p.volume.music, 0.6) },
      { label: 'Off', patch: { volume: { music: 0 } }, is: (p: Profile) => near(p.volume.music, 0) },
    ],
  },
  {
    id: 'text',
    name: 'Text size',
    choices: [1, 1.5, 2].map((n) => ({ label: n === 1 ? 'Normal' : n === 1.5 ? 'Large' : 'Largest', patch: { textScale: n }, is: (p: Profile) => near(p.textScale, n) })),
  },
  {
    id: 'contrast',
    name: 'Contrast',
    choices: [
      { label: 'Normal', patch: { theme: 'default' }, is: (p: Profile) => p.theme === 'default' },
      { label: 'High', patch: { theme: 'high-contrast' }, is: (p: Profile) => p.theme === 'high-contrast' },
    ],
  },
  {
    id: 'colours',
    name: 'Colours',
    choices: [
      { label: 'Normal', patch: { palette: 'default' }, is: (p: Profile) => p.palette === 'default' },
      { label: 'Colour-blind safe', patch: { palette: 'colourblind' }, is: (p: Profile) => p.palette === 'colourblind' },
    ],
  },
  {
    id: 'motion',
    name: 'Motion',
    choices: [
      { label: 'Full', patch: { reducedMotion: false }, is: (p: Profile) => !p.reducedMotion },
      { label: 'Reduced', patch: { reducedMotion: true }, is: (p: Profile) => p.reducedMotion },
    ],
  },
  {
    id: 'announce',
    name: 'Announcements',
    choices: [
      { label: 'Normal', patch: { announce: 'normal' }, is: (p: Profile) => p.announce === 'normal' },
      { label: 'Detailed, every little thing', patch: { announce: 'detailed' }, is: (p: Profile) => p.announce === 'detailed' },
      { label: 'Minimal, only what matters now', patch: { announce: 'minimal' }, is: (p: Profile) => p.announce === 'minimal' },
    ],
  },
  {
    id: 'coach',
    name: 'Coach',
    choices: [0, 1000, 2000, 3000].map((ms) => ({
      label: ms === 0 ? 'Off' : `${ms / 1000} ${ms === 1000 ? 'second' : 'seconds'} early`,
      patch: { coachLeadMs: ms },
      is: (p: Profile) => p.coachLeadMs === ms,
    })),
  },
  {
    id: 'mono',
    name: 'Sound',
    choices: [
      { label: 'Stereo', patch: { mono: false }, is: (p: Profile) => !p.mono },
      { label: 'Mono', patch: { mono: true }, is: (p: Profile) => p.mono },
    ],
  },
];

/**
 * Menu entries for the player's settings. `profile` is read each time, so the menu always says the
 * value now in force. Apply a change with `applySetting`.
 */
export function profileEntries(profile: () => Profile, only?: readonly string[]): MenuEntry[] {
  return PROFILE_SETTINGS.filter((s) => !only || only.includes(s.id)).map((s) => ({
    kind: 'setting',
    id: `profile:${s.id}`,
    name: s.name,
    choices: s.choices.map((c) => ({ label: c.label })),
    current: () => Math.max(0, s.choices.findIndex((c) => c.is(profile()))),
  }));
}

/** The profile after a setting from `profileEntries` changed. Other ids leave it as it was. */
export function applySetting(profile: Profile, id: string, choice: number): Profile {
  const setting = PROFILE_SETTINGS.find((s) => `profile:${s.id}` === id);
  const c = setting?.choices[choice];
  return c ? mergeProfile(profile, c.patch) : profile;
}

// ---- first-run setup (Requirement 17) ------------------------------------------------

/**
 * The five ways to play, offered once, the first time. They say how to play, never why: nobody names
 * a disability. Each one is a change to the profile; "More settings" opens the settings menu.
 */
export const SETUP_CHOICES = [
  { id: 'setup:just-play', label: 'Just play', patch: {} as ProfilePatch, says: 'Everything is on.' },
  {
    id: 'setup:sound',
    label: 'Play by sound',
    patch: { voice: true, volume: { music: 0.6, speech: 1, cues: 1 } } as ProfilePatch,
    says: 'The voice says everything. Headphones help.',
  },
  { id: 'setup:sight', label: 'Play by sight', patch: { textScale: 1.5 } as ProfilePatch, says: 'Large captions, and a marker for every sound.' },
  { id: 'setup:time', label: 'More time', patch: { speed: 'slow', dwellMs: 3000 } as ProfilePatch, says: 'Slow speed, and slower scanning.' },
  { id: 'setup:more', label: 'More settings', patch: {} as ProfilePatch, says: '' },
] as const;

export function setupEntries(): MenuEntry[] {
  return SETUP_CHOICES.map((c) => ({ kind: 'action', id: c.id, label: c.label }));
}

/** Apply a setup choice. Returns the new profile and what to say; `more` means open the settings menu. */
export function applySetup(profile: Profile, id: string): { profile: Profile; says: string; more: boolean } | null {
  const c = SETUP_CHOICES.find((x) => x.id === id);
  if (!c) return null;
  const more = c.id === 'setup:more';
  return { profile: mergeProfile(profile, { ...c.patch, setupDone: true }), says: more ? '' : `${c.label}. ${c.says}`, more };
}

// ---- menus inside menus ------------------------------------------------------------

/** The id of the "Back" entry a sub-menu gets first, so leaving it is always one press away. */
export const BACK_ID = 'menu:back';

export interface MenuStackOptions {
  /** The player's scan speed now. */
  dwellMs(): number;
  /**
   * Say and show a lit entry. `opening` is the menu's title when the menu has just opened: say it
   * first, in the same line ("Settings. Back"), so nothing cuts it off.
   */
  say(lit: MenuLit, opening?: string): void;
}

export interface MenuStack {
  /** Open a menu on top. A sub-menu (any menu after the first) gets a "Back" entry first. */
  open(options: Omit<MenuOptions, 'dwellMs'>, nowMs: number, at?: string, intro?: string): void;
  /** Close the top menu and return to the one under it, at the entry that opened it. */
  back(nowMs: number): void;
  /** Close every menu. */
  close(): void;
  tick(nowMs: number): void;
  /** A press. "Back" is handled here; anything else is the game's to act on. */
  press(nowMs: number): MenuResult | null;
  top(): Menu | null;
  /** For drawing: the top menu's title, its entries' words now, and which is lit (0-based). */
  view(): { title: string; labels: string[]; lit: number } | null;
}

/** End a title with a full stop, so "Settings" and "Back" are said as "Settings. Back". */
const sentence = (text: string | undefined): string | undefined =>
  text === undefined || text.trim() === '' ? undefined : /[.?!:]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;

export function createMenuStack(options: MenuStackOptions): MenuStack {
  const stack: { menu: Menu; from?: string | undefined }[] = [];
  const titleMs = (title: string): number => 400 + 65 * title.length;

  const show = (menu: Menu, nowMs: number, at?: string, intro?: string): void => {
    // The first entry waits while the title (and any line before it) is said, then gets its full time.
    const opening = sentence(at ? intro : intro ? `${intro} ${menu.title}` : menu.title);
    const lit = menu.start(nowMs + (opening ? titleMs(opening) : 0), at);
    if (lit) options.say(lit, opening);
  };

  return {
    open(o, nowMs, at, intro) {
      const sub = stack.length > 0;
      const entries: MenuEntry[] = sub ? [{ kind: 'action', id: BACK_ID, label: 'Back' }, ...o.entries] : [...o.entries];
      const menu = createMenu({ ...o, entries, dwellMs: options.dwellMs() });
      stack.push({ menu, from: stack.at(-1)?.menu.lit()?.id });
      show(menu, nowMs, at, intro);
    },
    back(nowMs) {
      if (stack.length < 2) return;
      const { from } = stack.pop()!;
      const under = stack.at(-1)!.menu;
      under.setDwell(options.dwellMs());
      const lit = under.start(nowMs, from);
      if (lit) options.say(lit, sentence(under.title));
    },
    close() {
      stack.length = 0;
    },
    tick(nowMs) {
      const top = stack.at(-1)?.menu;
      if (!top) return;
      top.setDwell(options.dwellMs());
      const lit = top.tick(nowMs);
      if (lit) options.say(lit);
    },
    press(nowMs) {
      const top = stack.at(-1)?.menu;
      if (!top) return null;
      const result = top.press(nowMs);
      if (!result) return null;
      if (result.kind === 'action' && result.id === BACK_ID) {
        this.back(nowMs);
        return null;
      }
      if (result.kind === 'changed') options.say(result.lit);
      return result;
    },
    top: () => stack.at(-1)?.menu ?? null,
    view() {
      const top = stack.at(-1)?.menu;
      if (!top) return null;
      const lit = top.lit();
      return { title: top.title, labels: top.entries().map(entryLabel), lit: lit ? lit.index - 1 : -1 };
    },
  };
}
