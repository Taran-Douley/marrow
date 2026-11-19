import { describe, expect, it } from 'vitest';
import {
  BACK_ID,
  PROFILE_SETTINGS,
  SETUP_CHOICES,
  applySetting,
  applySetup,
  createMenu,
  createMenuStack,
  menuAudible,
  profileEntries,
  setupEntries,
  type MenuLit,
} from '../src/menu';
import { createKit } from '../src/kit';
import { defaultProfile } from '../src/profile';
import { dwellFor } from '../src/scanning';
import type { Profile } from '../src/types';

describe('a one-switch menu', () => {
  it('lights each entry in turn, cycles for ever, and a press chooses the lit one', () => {
    const menu = createMenu({ title: 'Start', dwellMs: 1000, entries: [{ kind: 'action', id: 'play', label: 'Play' }, { kind: 'action', id: 'help', label: 'Help' }] });
    expect(menu.start(0)?.label).toBe('Play');
    expect(menu.tick(500)).toBeNull();
    const wait = dwellFor({ id: '', label: 'Play' }, 1000);
    expect(menu.tick(wait)?.label).toBe('Help');
    expect(menu.tick(wait * 3)?.label).toBe('Play'); // wraps round
    expect(menu.press(wait * 3)).toEqual({ kind: 'action', id: 'play' });
  });

  it('a setting moves to its next value with each press and stays lit, so the new value is heard', () => {
    let speed = 0;
    const menu = createMenu({
      title: 'Settings',
      dwellMs: 1000,
      entries: [{ kind: 'setting', id: 'speed', name: 'Speed', choices: [{ label: 'Slow' }, { label: 'Fast' }], current: () => speed }],
    });
    expect(menu.start(0)?.label).toBe('Speed: Slow');
    const r = menu.press(10);
    expect(r).toMatchObject({ kind: 'changed', id: 'speed', choice: 1, lit: { label: 'Speed: Fast' } });
    speed = 1;
    expect(menu.lit()?.label).toBe('Speed: Fast');
    expect(menu.press(20)).toMatchObject({ choice: 0 }); // wraps back to Slow
  });

  it('every profile setting changes the profile, and the menu reads the value in force', () => {
    let profile: Profile = defaultProfile();
    const entries = profileEntries(() => profile);
    expect(entries).toHaveLength(PROFILE_SETTINGS.length);
    for (const e of entries) {
      if (e.kind !== 'setting') continue;
      const before = e.current();
      profile = applySetting(profile, e.id, (before + 1) % e.choices.length);
      expect(e.current(), e.id).toBe((before + 1) % e.choices.length);
    }
    expect(profile.speed).toBe('medium');
    expect(profile.voice).toBe(false);
    expect(profile.scanning).toBe(true); // never switched off from inside the scanning menu
  });

  it('every entry, at every value, can be said in full before the highlight moves (property 102)', () => {
    const profile = defaultProfile();
    for (const dwell of [1500, 2200, 6500]) {
      const menu = createMenu({ title: 'Settings', dwellMs: dwell, entries: profileEntries(() => profile) });
      expect(menuAudible(menu, dwell).pass).toBe(true);
    }
  });
});

describe('first-run setup', () => {
  it('offers five ways to play, none naming a disability, and each one finishes setup', () => {
    expect(setupEntries().map((e) => (e.kind === 'action' ? e.label : ''))).toEqual(['Just play', 'Play by sound', 'Play by sight', 'More time', 'More settings']);
    const words = SETUP_CHOICES.map((c) => `${c.label} ${c.says}`).join(' ').toLowerCase();
    for (const w of ['blind', 'deaf', 'disab', 'impair']) expect(words).not.toContain(w);
    for (const c of SETUP_CHOICES) expect(applySetup(defaultProfile(), c.id)!.profile.setupDone).toBe(true);
    expect(applySetup(defaultProfile(), 'setup:time')!.profile).toMatchObject({ speed: 'slow', dwellMs: 3000 });
    expect(applySetup(defaultProfile(), 'setup:more')!.more).toBe(true);
  });

  it('each choice reaches two senses: spoken, shown, ticked and buzzed (property 14)', () => {
    const kit = createKit();
    for (const e of setupEntries()) {
      const out = kit.render({ type: 'menu-option', at: 0, data: { label: e.kind === 'action' ? e.label : '' } });
      const channels = new Set(out.map((c) => c.channel));
      for (const c of ['speech', 'captions', 'sound', 'haptics', 'indicator'] as const) expect(channels.has(c), `${c}`).toBe(true);
    }
  });
});

describe('menus inside menus', () => {
  it('a sub-menu starts with Back, says its title with the first entry, and Back returns to where you were', () => {
    const said: { lit: MenuLit; opening?: string | undefined }[] = [];
    const stack = createMenuStack({ dwellMs: () => 1000, say: (lit, opening) => said.push({ lit, opening }) });
    stack.open({ title: 'Ghastly Moves', entries: [{ kind: 'action', id: 'play', label: 'Play' }, { kind: 'action', id: 'settings', label: 'Settings' }] }, 0);
    expect(said.at(-1)).toMatchObject({ lit: { label: 'Play' }, opening: 'Ghastly Moves.' });
    for (let t = 0; t < 20_000 && stack.top()!.lit()!.id !== 'settings'; t += 50) stack.tick(t);
    expect(stack.press(20_000)).toEqual({ kind: 'action', id: 'settings' });
    stack.open({ title: 'Settings', entries: profileEntries(defaultProfile) }, 20_000);
    expect(stack.view()!.labels[0]).toBe('Back');
    expect(said.at(-1)).toMatchObject({ lit: { id: BACK_ID }, opening: 'Settings.' });
    expect(stack.press(20_010)).toBeNull(); // Back is handled by the stack
    expect(stack.top()!.title).toBe('Ghastly Moves');
    expect(stack.top()!.lit()!.id).toBe('settings');
  });
});
