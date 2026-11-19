import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BED_SHARE } from '../src/channels';
import { createKit } from '../src/kit';
import { defaultProfile, mergeProfile } from '../src/profile';
import { cuesAudible } from '../src/proof';
import type { OutputCommand } from '../src/types';
import { seedArb } from './helpers/arbitraries';

// The accessibility layer must serve any genre, not only the jump game. These
// tests build three small games of different genres from configuration alone,
// with no new core code, and check that each one is heard, seen, felt, and
// checked. They do NOT prove those games finishable: that proof belongs to a
// pattern (timed press has one; aiming and navigation do not yet).

type SoundCmd = Extract<OutputCommand, { channel: 'sound' }>;
const sound = (cmds: readonly OutputCommand[]): SoundCmd[] => cmds.filter((c): c is SoundCmd => c.channel === 'sound');
const said = (cmds: readonly OutputCommand[]) => cmds.flatMap((c) => (c.channel === 'speech' ? [c.text] : []));
const shown = (cmds: readonly OutputCommand[]) => cmds.flatMap((c) => (c.channel === 'captions' ? [c.text] : []));

// ---- a shooter -------------------------------------------------------------

function shooter() {
  const kit = createKit({
    events: {
      'enemy-spotted': {
        say: '{object} {side}, {range}',
        caption: '{object} {side}',
        sound: { hz: 330, wave: 'square' },
        spatial: true,
        haptic: [40, 30, 40],
      },
      'shot-fired': { sound: { hz: 90, wave: 'triangle', shape: { hzTo: 40, seconds: 0.15 } }, haptic: [60] },
      'enemy-down': { say: 'Got it', caption: 'Hit', sound: { hz: 880, wave: 'sine' } },
      'player-hit': { say: 'Hit! {health} left', caption: 'Health {health}', haptic: [250] },
    },
  });
  kit.defineObject('wraith');
  kit.defineObject('brute', { say: 'big brute' });
  return kit;
}

describe('a shooter', () => {
  const kit = shooter();
  const spot = (x: number, distance: number) => kit.render({ type: 'enemy-spotted', at: 3, data: { object: 'wraith', x, distance } });

  it('needs no width: enemies are plain objects with their own voice, name and caption', () => {
    expect(kit.registry.get('wraith')).toMatchObject({ say: 'wraith', caption: 'Wraith' });
    expect(kit.registry.get('wraith')!.width).toBeUndefined();
    expect(kit.registry.kinds()).toEqual([]); // not obstacles: nothing to generate a jump level from
    expect(() => kit.generate(1)).toThrow('Define at least one obstacle');
  });

  it('puts an enemy where it is: left is left, right is right', () => {
    expect(sound(spot(-0.8, 0.2))[0]!.pan).toBe(-0.8);
    expect(sound(spot(0.8, 0.2))[0]!.pan).toBe(0.8);
    expect(sound(spot(0, 0.2))[0]!.pan).toBe(0);
  });

  it('far away is quieter and duller than close', () => {
    const near = sound(spot(0, 0))[0]!;
    const far = sound(spot(0, 1))[0]!;
    expect(far.gain).toBeLessThan(near.gain);
    expect(far.shape!.filterHz!).toBeLessThan(near.shape!.filterHz!);
  });

  it('says and writes where it is, so a deaf player reads what a blind player hears', () => {
    const cmds = spot(-0.8, 0.2);
    expect(said(cmds)).toEqual(['Wraith left, close']);
    expect(shown(cmds)).toEqual(['Wraith left']);
    expect(said(spot(0.9, 0.9))).toEqual(['Wraith right, far']);
    expect(said(spot(0, 0.5))).toEqual(['Wraith ahead, near']);
  });

  it('every event reaches at least two senses (a shot is a sound, a marker and a tap)', () => {
    expect(kit.proveEvents().pass).toBe(true);
  });

  it('a mono player gets everything in the centre', () => {
    const cmds = kit.render({ type: 'enemy-spotted', at: 0, data: { object: 'wraith', x: -0.9, distance: 0.1 } }, mergeProfile(defaultProfile(), { mono: true }));
    expect(sound(cmds)[0]!.pan).toBe(0);
  });

  it('fills in the data a game sends, such as health', () => {
    const cmds = kit.render({ type: 'player-hit', at: 0, data: { health: 2 } });
    expect(said(cmds)).toEqual(['Hit! 2 left']);
    expect(shown(cmds)).toEqual(['Health 2']);
  });

  it('lists the lines to record, flagging the ones filled in at play time', () => {
    const script = kit.lineScript();
    expect(script.find((l) => l.text === 'Got it')).toMatchObject({ template: false });
    expect(script.find((l) => l.text === '{object} {side}, {range}')).toMatchObject({ template: true });
    expect(script.map((l) => l.text)).not.toContain('Wraith ahead.'); // an enemy is not an obstacle
  });
});

// ---- an open world ---------------------------------------------------------

function openWorld() {
  const kit = createKit({
    events: {
      'landmark-near': { say: '{object} {side}', caption: '{object}', sound: { hz: 520, wave: 'sine' }, spatial: true, haptic: [30] },
      'region-enter': { say: 'Entering {name}', caption: '{name}', haptic: [80, 40, 80] },
      // A beacon you follow: it slides to the centre as you face the right way.
      beacon: {
        sound: { hz: 440, wave: 'sine', gain: 0.2, role: 'approach', shape: { hzTo: 660, panTo: 0, span: 3, filterHz: 500, filterTo: 3000 } },
        caption: 'Beacon',
      },
    },
  });
  kit.defineObject('well');
  kit.defineObject('tower', { say: 'old tower' });
  return kit;
}

describe('an open world', () => {
  const kit = openWorld();

  it('announces a landmark with its direction', () => {
    const cmds = kit.render({ type: 'landmark-near', at: 0, data: { object: 'tower', x: 0.6, distance: 0.3 } });
    expect(said(cmds)).toEqual(['Tower right']);
    expect(sound(cmds)[0]!.pan).toBe(0.6);
  });

  it('announces a new region by voice, caption and a pattern you can feel', () => {
    const cmds = kit.render({ type: 'region-enter', at: 0, data: { name: 'the marsh' } });
    expect(said(cmds)).toEqual(['The marsh'.replace('The marsh', 'Entering the marsh')]);
    expect(shown(cmds)).toEqual(['The marsh']);
    expect(cmds.filter((c) => c.channel === 'haptics')).toMatchObject([{ pattern: [80, 40, 80] }]);
  });

  it('a following beacon is one gliding sound, not a stream of events', () => {
    const [tone] = sound(kit.render({ type: 'beacon', at: 0, data: { x: 0.9 } }));
    expect(tone).toMatchObject({ role: 'approach', hz: 440 });
    expect(tone!.shape).toMatchObject({ hzTo: 660, panTo: 0, span: 3 });
  });

  it('every event reaches two senses', () => {
    expect(kit.proveEvents().pass).toBe(true);
  });
});

// ---- a platformer ----------------------------------------------------------

describe('a platformer', () => {
  function platformer() {
    const kit = createKit({
      timing: { airtime: 1.1, beat: 0.45, gap: [3, 3.6] }, // a floatier jump and a wider rhythm
      events: { 'coin-collected': { say: 'Coin', caption: 'Coin', sound: { hz: 1200, wave: 'sine' } } },
    });
    kit.defineObstacle('pit', { width: [0.3, 0.5] });
    kit.defineObstacle('spikes', { width: [0.15, 0.3] });
    kit.defineObject('coin');
    return kit;
  }

  it('is the timed-press pattern with its own jump: the finishability proof applies and passes', () => {
    const kit = platformer();
    fc.assert(
      fc.property(seedArb, (seed) => {
        expect(kit.prove(kit.generate(seed)).filter((r) => !r.pass).map((r) => r.counterexample)).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it('coins are objects, not obstacles, so they never become part of a jump level', () => {
    const kit = platformer();
    expect(new Set(kit.generate(1).obstacles.map((o) => o.kind))).toEqual(new Set(['pit', 'spikes']));
    expect(kit.proveEvents().pass).toBe(true);
  });

  it('the proof catches a pit that is barely clearable: jumpable, but under the 650 ms floor at Slow', () => {
    const kit = platformer();
    kit.defineObstacle('wide-pit', { width: 0.6 }); // 0.38 s window / 0.6 = 633 ms
    const level = kit.generate(2);
    const floor = kit.prove(level).find((r) => r.id === 5)!;
    expect(floor.pass).toBe(false);
    expect(floor.counterexample).toMatch(/is only 633 ms at Slow\. The floor is 650 ms\.$/);
  });

  it('refuses a pit the platformer cannot clear, in its own numbers', () => {
    const kit = platformer();
    kit.defineObstacle('chasm', { width: 2 });
    const level = kit.generate(3);
    expect(kit.prove(level).find((r) => r.id === 1)!.counterexample).toMatch(/One jump covers only 0\.98 s\.$/);
  });
});

// ---- the check works for any genre -----------------------------------------

describe('the two-senses check (proof property 8)', () => {
  it('catches an event that reaches only one sense, and says how to fix it', () => {
    const kit = createKit({
      events: { 'door-opens': { sound: { hz: 300, wave: 'sine' } } },
      channels: { omit: ['indicator', 'captions', 'speech', 'haptics'] }, // only sound is left
    });
    const result = kit.proveEvents();
    expect(result.pass).toBe(false);
    // Taking channels away also leaves the built-in events short, so there is more than one problem.
    expect(result.counterexamples).toContain(
      "Event 'door-opens' reaches only hearing. Give it a caption, speech, a vibration or a sound so a second sense gets it.",
    );
    expect(result.failures).toBe(result.counterexamples!.length);
  });

  it('catches an event declared with nothing at all', () => {
    const result = createKit({ events: { 'ghost-event': {} } }).proveEvents();
    expect(result.pass).toBe(false);
    expect(result.counterexample).toMatch(/^Event 'ghost-event' reaches no sense\./);
  });

  it('a sound alone is enough when the visual marker is left on, because every sound lights it', () => {
    expect(createKit({ events: { ding: { sound: { hz: 600, wave: 'sine' } } } }).proveEvents().pass).toBe(true);
  });

  it('judges the profile in force: with captions, marker and haptics turned off by the player, a sound-only event fails', () => {
    const kit = createKit({ events: { ding: { sound: { hz: 600, wave: 'sine' } } } });
    const off = mergeProfile(defaultProfile(), { channels: { captions: false, indicator: false, haptics: false, speech: false } });
    expect(kit.proveEvents(off).pass).toBe(false);
  });

  it('the built-in events all pass, including the silent fourth beat (a caption and a tap)', () => {
    const kit = createKit();
    kit.defineObstacle('grave', { width: 0.2 });
    expect(kit.proveEvents().pass).toBe(true);
  });
});

// ---- your own sounds for the built-in moments ------------------------------

describe('your own recipes for the built-in sounds', () => {
  const jumped = { type: 'jumped', at: 0 };

  it('replaces the whoosh with your own sound, keeping what you leave out', () => {
    const kit = createKit({ audio: { recipes: { jumped: { hz: 700, wave: 'square', gain: 0.5, shape: { seconds: 0.4, noise: false } } } } });
    const [s] = sound(kit.render(jumped));
    expect(s).toMatchObject({ hz: 700, wave: 'square', gain: 0.5, role: 'effect' });
    expect(s!.shape).toMatchObject({ seconds: 0.4, noise: false });
  });

  it('is scaled by the player cue volume', () => {
    const kit = createKit({ audio: { recipes: { landed: { gain: 0.5 } } } });
    const quiet = mergeProfile(defaultProfile(), { volume: { cues: 0.4 } });
    expect(sound(kit.render({ type: 'landed', at: 0 }, quiet))[0]!.gain).toBeCloseTo(0.2, 12);
  });

  it('never lets the approach tone get louder than its share, so the beeps stay on top', () => {
    const kit = createKit({ audio: { recipes: { approach: { gain: 50 } } } });
    kit.defineObstacle('grave', { width: [0.16, 0.3] });
    const cmds = kit.render({ type: 'obstacle-approaching', at: 0, data: { object: 'grave', span: 1.2 } });
    expect(sound(cmds)[0]!.gain).toBeCloseTo(BED_SHARE.approach, 12);
  });

  it('(PBT) the beeps stay at least 6 dB over everything, even with extreme recipes', () => {
    const kit = createKit({ audio: { recipes: { approach: { gain: 99, hz: 100 }, fall: { gain: 99 } } } });
    kit.defineObstacle('grave', { width: [0.16, 0.3] });
    fc.assert(
      fc.property(seedArb, (seed) => {
        expect(cuesAudible(kit.renderLevel(kit.generate(seed))).pass).toBe(true);
      }),
      { numRuns: 50 },
    );
  });

  it('mono keeps a recipe in the centre', () => {
    const kit = createKit({ audio: { recipes: { approach: { shape: { panTo: 0.9 } } } } });
    kit.defineObstacle('grave', { width: 0.2 });
    const mono = mergeProfile(defaultProfile(), { mono: true });
    const [s] = sound(kit.render({ type: 'obstacle-approaching', at: 0, data: { object: 'grave', span: 1.2 } }, mono));
    expect(s!.pan).toBe(0);
    expect(s!.shape!.panTo).toBeUndefined();
  });
});
