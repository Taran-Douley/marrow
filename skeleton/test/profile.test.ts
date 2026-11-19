import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  defaultProfile,
  mergeProfile,
  parseProfile,
  serialiseProfile,
  withOsPreferences,
} from '../src/profile';
import { profileArb } from './helpers/arbitraries';

describe('profile defaults (Req 11.1)', () => {
  it('starts on Slow, scanning on, every channel on, nothing hidden', () => {
    const p = defaultProfile();
    expect(p.speed).toBe('slow');
    expect(p.scanning).toBe(true);
    expect(p.picture).toBe(true);
    expect(p.holdToConfirm).toBe(false);
    expect(Object.values(p.channels).every(Boolean)).toBe(true);
  });
});

describe('profile persistence', () => {
  it('(PBT) any valid profile survives serialise then parse', () => {
    fc.assert(
      fc.property(profileArb, (p) => {
        expect(parseProfile(serialiseProfile(p))).toEqual(p);
      }),
    );
  });

  it('falls back to defaults for garbage, never throws (Req 11.3)', () => {
    for (const bad of [null, undefined, 42, 'not json', '{', '[]', '{"speed":"warp"}']) {
      expect(() => parseProfile(bad)).not.toThrow();
    }
    expect(parseProfile('{')).toEqual(defaultProfile());
    expect(parseProfile('{"speed":"warp"}').speed).toBe('slow');
  });

  it('(PBT) parsing arbitrary JSON always yields an in-range profile', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (junk) => {
        const p = parseProfile(junk);
        expect(p.dwellMs).toBeGreaterThanOrEqual(500);
        expect(p.dwellMs).toBeLessThanOrEqual(10000);
        expect(p.textScale).toBeGreaterThanOrEqual(1);
        expect(p.textScale).toBeLessThanOrEqual(3);
        for (const v of Object.values(p.volume)) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }),
    );
  });

  it('clamps out-of-range numbers', () => {
    const p = parseProfile({ dwellMs: 1, textScale: 99, volume: { cues: 5, speech: -2 } });
    expect(p.dwellMs).toBe(500);
    expect(p.textScale).toBe(3);
    expect(p.volume.cues).toBe(1);
    expect(p.volume.speech).toBe(0);
  });
});

describe('mergeProfile', () => {
  it('merges nested volume and channels without touching the base', () => {
    const base = defaultProfile();
    const next = mergeProfile(base, { volume: { music: 0 }, channels: { haptics: false }, speed: 'fast' });
    expect(next.volume).toEqual({ cues: 1, speech: 1, music: 0 });
    expect(next.channels.haptics).toBe(false);
    expect(next.channels.sound).toBe(true);
    expect(next.speed).toBe('fast');
    expect(base.speed).toBe('slow');
    expect(base.channels.haptics).toBe(true);
  });

  it('ignores undefined fields in a patch', () => {
    const next = mergeProfile(defaultProfile(), { speed: undefined, volume: { cues: undefined } });
    expect(next.speed).toBe('slow');
    expect(next.volume.cues).toBe(1);
  });
});

describe('OS preferences (Req 11.2, 17.6)', () => {
  it('reduces motion if either the OS or the player asks', () => {
    const base = defaultProfile();
    expect(withOsPreferences(base, { reducedMotion: true }).reducedMotion).toBe(true);
    expect(withOsPreferences({ ...base, reducedMotion: true }, { reducedMotion: false }).reducedMotion).toBe(true);
    expect(withOsPreferences(base, {}).reducedMotion).toBe(false);
  });

  it('switches to high contrast only while the theme is still default', () => {
    const base = defaultProfile();
    expect(withOsPreferences(base, { highContrast: true }).theme).toBe('high-contrast');
    expect(withOsPreferences({ ...base, theme: 'high-contrast' }, { highContrast: false }).theme).toBe('high-contrast');
  });
});
