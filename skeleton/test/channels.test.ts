import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EVENT_TYPES, PHRASES, createChannels, phrase, renderEvent } from '../src/channels';
import { BEAT, cueTimes, generateLevel, idealPress } from '../src/level';
import { defaultProfile, mergeProfile } from '../src/profile';
import { createRegistry } from '../src/registry';
import { levelEvents } from '../src/schedule';
import type { OutputCommand, Profile, SemanticEvent } from '../src/types';
import { profileArb, seedArb } from './helpers/arbitraries';

function graveyard() {
  const reg = createRegistry();
  reg.define('grave', { width: [0.16, 0.3] });
  reg.define('fence', { width: [0.12, 0.24] });
  return reg;
}

const reg = graveyard();
const channels = createChannels(reg);
const beat = (object: string, n: number, at = 10): SemanticEvent => ({
  type: EVENT_TYPES.beat,
  at,
  data: { object, beat: n },
});
const approaching = (object: string, first: boolean, at = 10): SemanticEvent => ({
  type: EVENT_TYPES.approaching,
  at,
  data: { object, first },
});
const render = (e: SemanticEvent, p: Profile = defaultProfile()) => renderEvent(e, p, channels);
const only = (cmds: OutputCommand[], channel: OutputCommand['channel']) => cmds.filter((c) => c.channel === channel);

describe('sound channel (Req 3.2, 3.6)', () => {
  it('beeps on beats 1 to 3 with the object voice, and is silent on beat 4', () => {
    for (const n of [1, 2, 3]) {
      expect(only(render(beat('grave', n)), 'sound')).toEqual([
        { channel: 'sound', senses: ['hearing'], at: 10, role: 'cue', hz: 294, wave: 'triangle', gain: 1, pan: 0 },
      ]);
    }
    expect(only(render(beat('grave', 4)), 'sound')).toEqual([]);
  });

  it('uses a different pitch and timbre for the fence', () => {
    const [grave] = only(render(beat('grave', 1)), 'sound');
    const [fence] = only(render(beat('fence', 1)), 'sound');
    expect(grave).toMatchObject({ hz: 294, wave: 'triangle' });
    expect(fence).toMatchObject({ hz: 587, wave: 'sine' });
  });

  it('applies the cue volume from the profile', () => {
    const quiet = mergeProfile(defaultProfile(), { volume: { cues: 0.25 } });
    expect(only(render(beat('grave', 2), quiet), 'sound')[0]).toMatchObject({ gain: 0.25 });
  });

  it('falls back to a table voice for an unknown object instead of failing', () => {
    expect(only(render(beat('ghoul', 1)), 'sound')[0]).toMatchObject({ hz: 294, wave: 'triangle' });
  });
});

describe('speech channel (Req 4.1, 4.5, 12.1)', () => {
  const said = (e: SemanticEvent, p?: Profile) => only(render(e, p), 'speech').map((c) => (c as { text: string }).text);

  it('says the name only the first time an object is met', () => {
    expect(said(approaching('grave', true))).toEqual(['Grave ahead.']);
    expect(said(approaching('grave', false))).toEqual([]);
  });

  it('explains a fall in the plain words the spec asks for', () => {
    const fall = (reason: string): SemanticEvent => ({ type: EVENT_TYPES.fallReason, at: 1, data: { reason } });
    expect(said(fall('early'))).toEqual(['Pressed a little early.']);
    expect(said(fall('late'))).toEqual(['Pressed a little late.']);
    expect(said(fall('none'))).toEqual(['No press.']);
    expect(said(fall('banana'))).toEqual(['No press.']);
  });

  it('says hurt, level-complete and menu options, but never speaks "cleared"', () => {
    expect(said({ type: EVENT_TYPES.cleared, at: 1 })).toEqual([]);
    expect(said({ type: EVENT_TYPES.hurt, at: 1 })).toEqual(['Hurt.']);
    expect(said({ type: EVENT_TYPES.levelComplete, at: 1 })).toEqual(['Level complete.']);
    expect(said({ type: EVENT_TYPES.menuOption, at: 1, data: { label: 'Just play' } })).toEqual(['Just play']);
  });

  it('is still produced when the built-in voice is off, so aria-live gets every line (Req 4.2)', () => {
    const voiceOff = mergeProfile(defaultProfile(), { voice: false });
    expect(said(approaching('grave', true), voiceOff)).toEqual(['Grave ahead.']);
  });

  it('says nothing for events it has no line for', () => {
    expect(said({ type: 'something-else', at: 1 })).toEqual([]);
  });

  it('does not speak on beats, since speech timing is not exact enough to carry the press', () => {
    for (const n of [1, 2, 3, 4]) expect(said(beat('grave', n))).toEqual([]);
  });
});

describe('captions channel with four pips (Req 5.1-5.3)', () => {
  const captioned = (e: SemanticEvent) =>
    only(render(e), 'captions') as { text: string; pip?: number }[];

  it('lights pips 1 to 3 with the object name, and pip 4 says "Press now"', () => {
    expect(captioned(beat('grave', 1))).toMatchObject([{ text: 'Grave', pip: 1 }]);
    expect(captioned(beat('fence', 3))).toMatchObject([{ text: 'Fence', pip: 3 }]);
    expect(captioned(beat('grave', 4))).toMatchObject([{ text: 'Press now', pip: 4 }]);
  });

  it('shows the name when an obstacle approaches, every time', () => {
    expect(captioned(approaching('grave', false))).toEqual([
      { channel: 'captions', senses: ['sight'], at: 10, text: 'Grave' },
    ]);
  });

  it('shows the same words that are spoken for falls', () => {
    const fall: SemanticEvent = { type: EVENT_TYPES.fallReason, at: 1, data: { reason: 'early' } };
    expect(captioned(fall)).toMatchObject([{ text: 'Pressed a little early.' }]);
  });
});

describe('visual sound indicator (Req 3a.6, 5.6)', () => {
  const indicator = (e: SemanticEvent, p?: Profile) => only(render(e, p), 'indicator');

  it('fires with every beep and not on the silent fourth beat', () => {
    expect(indicator(beat('grave', 1))).toHaveLength(1);
    expect(indicator(beat('grave', 3))).toHaveLength(1);
    expect(indicator(beat('grave', 4))).toHaveLength(0);
  });

  it('is steady, not flashing, when motion is reduced', () => {
    const calm = mergeProfile(defaultProfile(), { reducedMotion: true });
    expect(indicator(beat('grave', 1), calm)).toMatchObject([{ flash: false }]);
    expect(indicator(beat('grave', 1))).toMatchObject([{ flash: true }]);
  });
});

describe('channels follow the profile (Req 3a.2, 3a.4)', () => {
  it('drops a turned-off channel and keeps the rest', () => {
    const noSound = mergeProfile(defaultProfile(), { channels: { sound: false } });
    const cmds = render(beat('grave', 1), noSound);
    expect(only(cmds, 'sound')).toEqual([]);
    expect(only(cmds, 'captions')).toHaveLength(1);
    expect(only(cmds, 'indicator')).toHaveLength(1);
  });

  it('gives nothing when every channel is off', () => {
    const none = mergeProfile(defaultProfile(), {
      channels: { sound: false, speech: false, captions: false, indicator: false, haptics: false },
    });
    expect(render(beat('grave', 1), none)).toEqual([]);
  });

  it('(PBT) every command matches its channel and sense, under any profile', () => {
    const senseOf = { sound: 'hearing', speech: 'hearing', captions: 'sight', indicator: 'sight', haptics: 'touch' } as const;
    fc.assert(
      fc.property(profileArb, seedArb, (profile, seed) => {
        const level = generateLevel(seed, { kinds: reg.kinds() });
        for (const e of levelEvents(level)) {
          for (const cmd of renderEvent(e, profile, channels)) {
            expect(profile.channels[cmd.channel]).toBe(true);
            expect(cmd.senses).toEqual([senseOf[cmd.channel]]);
            expect(cmd.at).toBe(e.at);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('(PBT) with sound and captions on, every beep reaches two senses (hearing and sight)', () => {
    fc.assert(
      fc.property(profileArb, seedArb, (base, seed) => {
        const profile = mergeProfile(base, { channels: { sound: true, captions: true } });
        for (const e of levelEvents(generateLevel(seed, { kinds: reg.kinds() }))) {
          if (e.type !== EVENT_TYPES.beat) continue;
          const beatNumber = (e.data as { beat: number }).beat;
          if (beatNumber === 4) continue;
          const senses = new Set(renderEvent(e, profile, channels).flatMap((c) => c.senses));
          expect(senses.has('hearing') && senses.has('sight')).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe('phrases (Req 4.5)', () => {
  it('fills slots and starts with a capital', () => {
    expect(phrase('approaching', { name: 'fence' })).toBe('Fence ahead.');
    expect(phrase('pressNow')).toBe('Press now');
  });

  it('keeps every line short: under 8 words', () => {
    for (const text of Object.values(PHRASES)) {
      expect(text.split(/\s+/).length).toBeLessThan(8);
    }
  });
});

describe('level scheduler (Req 3.2, 3.3)', () => {
  const level = generateLevel(3, { kinds: reg.kinds() });
  const events = levelEvents(level);
  const countdown = (list: SemanticEvent[]) => list.filter((e) => e.type !== EVENT_TYPES.atmosphere);

  it('makes five countdown events per obstacle, and all events come in time order', () => {
    expect(countdown(events)).toHaveLength(level.obstacles.length * 5);
    for (let i = 1; i < events.length; i++) expect(events[i]!.at).toBeGreaterThanOrEqual(events[i - 1]!.at);
  });

  it('puts beeps at J-3, J-2, J-1 beats and the press at J', () => {
    for (const o of level.obstacles) {
      const times = events
        .filter((e) => e.type === EVENT_TYPES.beat && (e.data as { index: number }).index === o.index)
        .map((e) => e.at);
      const [c1, c2, c3] = cueTimes(o);
      expect(times).toEqual([c1, c2, c3, idealPress(o)]);
      expect(times[3]! - times[2]!).toBeCloseTo(BEAT, 12);
    }
  });

  it('marks only the first obstacle of each kind as a first meeting', () => {
    const firsts = events
      .filter((e) => e.type === EVENT_TYPES.approaching && (e.data as { first: boolean }).first)
      .map((e) => (e.data as { object: string }).object);
    expect(new Set(firsts).size).toBe(firsts.length);
    expect(firsts.length).toBe(new Set(level.obstacles.map((o) => o.kind)).size);
  });

  it('(PBT) the countdown never starts before the level does', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        for (const e of countdown(levelEvents(generateLevel(seed, { kinds: reg.kinds() })))) {
          expect(e.at).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 },
    );
  });
});
