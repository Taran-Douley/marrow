import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EVENT_TYPES, createChannels, createStrings, renderEvent } from '../src/channels';
import { createEventRegistry } from '../src/events';
import { createKit } from '../src/kit';
import { cueTimes, generateLevel, resolveTiming, takeoffWindow, type Level } from '../src/level';
import { defaultProfile, mergeProfile } from '../src/profile';
import { LevelRefused, proofResult, prove, refuseIfFailing } from '../src/proof';
import { createRegistry } from '../src/registry';
import { levelEvents } from '../src/schedule';
import type { Channel, OutputCommand, SemanticEvent } from '../src/types';
import { seedArb } from './helpers/arbitraries';

const byId = (results: ReturnType<typeof prove>, id: number) => results.find((r) => r.id === id)!;
const only = (cmds: OutputCommand[], channel: OutputCommand['channel']) => cmds.filter((c) => c.channel === channel);

describe('your own timing', () => {
  it('rejects numbers that cannot work, in plain words', () => {
    expect(() => resolveTiming({ airtime: 0 })).toThrow("Timing 'airtime' must be a number above zero.");
    expect(() => resolveTiming({ gap: [3, 2] })).toThrow("Timing 'gap'");
    expect(() => resolveTiming({ obstaclesPerLevel: 0 })).toThrow("'obstaclesPerLevel'");
    expect(() => resolveTiming({ rates: { slow: 0, medium: 1, fast: 1 } })).toThrow("'rates.slow'");
  });

  it('ignores undefined overrides and keeps the defaults', () => {
    expect(resolveTiming({ airtime: undefined })).toEqual(resolveTiming());
  });

  it('a longer jump can clear a wider obstacle, and the proof knows it', () => {
    const level: Level = { seed: 1, obstacles: [{ index: 0, kind: 'wall', start: 10, width: 0.9 }] };
    const reg = createRegistry();
    reg.define('wall', { width: 0.9 });
    expect(byId(prove(level, { objects: reg }), 1).pass).toBe(false); // default jump: 0.73 s
    expect(byId(prove(level, { objects: reg, timing: { airtime: 1.4 } }), 1).pass).toBe(true);
    expect(takeoffWindow(level.obstacles[0]!, resolveTiming({ airtime: 1.4 })).b).toBeGreaterThan(
      takeoffWindow(level.obstacles[0]!, resolveTiming({ airtime: 1.4 })).a,
    );
  });

  it('the counterexample uses your jump length', () => {
    const level: Level = { seed: 2, obstacles: [{ index: 0, kind: 'wall', start: 10, width: 2 }] };
    const reg = createRegistry();
    reg.define('wall', { width: 2 });
    const r = byId(prove(level, { objects: reg, timing: { airtime: 1.4 } }), 1);
    expect(r.counterexample).toBe(
      'Level 2, obstacle 1 (wall, 2.00 s wide): no take-off point clears it. One jump covers only 1.28 s.',
    );
  });

  it('(PBT) a game with its own timing passes all six properties for every level', () => {
    const timing = { airtime: 1.1, beat: 0.5, gap: [3.0, 3.6] as const, firstStart: 8 };
    const reg = createRegistry();
    reg.define('hedge', { width: [0.2, 0.4] });
    fc.assert(
      fc.property(seedArb, (seed) => {
        const level = generateLevel(seed, { kinds: reg.kinds(), timing });
        const results = prove(level, { objects: reg, timing });
        expect(results.filter((r) => !r.pass).map((r) => r.counterexample)).toEqual([]);
        expect(level.obstacles[0]!.start).toBe(8);
      }),
      { numRuns: 200 },
    );
  });

  it('scheduler beeps follow your beat length', () => {
    const timing = { beat: 0.5 };
    const level = generateLevel(4, { timing });
    const [c1, c2, c3] = cueTimes(level.obstacles[0]!, resolveTiming(timing));
    expect(c2 - c1).toBeCloseTo(0.5, 12);
    expect(c3 - c2).toBeCloseTo(0.5, 12);
    const beats = levelEvents(level, timing).filter((e) => e.type === EVENT_TYPES.beat).slice(0, 3);
    expect(beats.map((e) => e.at)).toEqual([c1, c2, c3]);
  });

  it('your own window floors replace the defaults', () => {
    const reg = createRegistry();
    reg.define('grave', { width: [0.16, 0.3] });
    const level = generateLevel(7, { kinds: reg.kinds() });
    expect(byId(prove(level, { objects: reg }), 5).pass).toBe(true);
    const strict = byId(prove(level, { objects: reg, floorsMs: { slow: 5000 } }), 5);
    expect(strict.pass).toBe(false);
    expect(strict.counterexample).toMatch(/The floor is 5000 ms\.$/);
  });
});

describe('your own proof properties', () => {
  const reg = createRegistry();
  reg.define('grave', { width: [0.16, 0.3] });
  const level = generateLevel(3, { kinds: reg.kinds() });

  const noTwoGravesInARow = (lv: Level) => {
    const problems = lv.obstacles
      .filter((o, i) => i > 0 && o.kind === lv.obstacles[i - 1]!.kind)
      .map((o) => `Level ${lv.seed}, obstacle ${o.index + 1}: two ${o.kind}s in a row.`);
    return proofResult(100, 'No repeats', problems);
  };

  it('runs after the built-in properties and reports like them', () => {
    const results = prove(level, { objects: reg, extra: [(lv) => noTwoGravesInARow(lv)] });
    expect(results.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 100]);
    expect(byId(results, 100).pass).toBe(false);
    expect(byId(results, 100).counterexample).toMatch(/^Level 3, obstacle 2: two graves in a row\.$/);
  });

  it('can refuse a level on its own', () => {
    expect(() => refuseIfFailing(level, { objects: reg, extra: [(lv) => noTwoGravesInARow(lv)] })).toThrow(LevelRefused);
    expect(() => refuseIfFailing(level, { objects: reg })).not.toThrow();
  });
});

describe('your own words and translations', () => {
  const reg = createRegistry();
  reg.define('grave', { width: 0.2 });
  const approaching: SemanticEvent = { type: EVENT_TYPES.approaching, at: 1, data: { object: 'grave', first: true } };
  const said = (cmds: OutputCommand[]) => only(cmds, 'speech').map((c) => (c as { text: string }).text);
  const shown = (cmds: OutputCommand[]) => only(cmds, 'captions').map((c) => (c as { text: string }).text);

  it('rewords any line, keeping the rest', () => {
    const channels = createChannels(reg, { strings: createStrings({ approaching: 'Careful, {name} coming' }) });
    const cmds = renderEvent(approaching, defaultProfile(), channels);
    expect(said(cmds)).toEqual(['Careful, grave coming']);
    const fall: SemanticEvent = { type: EVENT_TYPES.fallReason, at: 1, data: { reason: 'late' } };
    expect(said(renderEvent(fall, defaultProfile(), channels))).toEqual(['Pressed a little late.']);
  });

  it('translates speech and captions together', () => {
    const channels = createChannels(reg, {
      strings: createStrings({ fallEarly: 'Demasiado pronto.', pressNow: 'Ahora' }),
    });
    const fall: SemanticEvent = { type: EVENT_TYPES.fallReason, at: 1, data: { reason: 'early' } };
    const cmds = renderEvent(fall, defaultProfile(), channels);
    expect(said(cmds)).toEqual(['Demasiado pronto.']);
    expect(shown(cmds)).toEqual(['Demasiado pronto.']);
    const four: SemanticEvent = { type: EVENT_TYPES.beat, at: 2, data: { object: 'grave', beat: 4 } };
    expect(shown(renderEvent(four, defaultProfile(), channels))).toEqual(['Ahora']);
  });

  it('refuses a line that does not exist or is empty, because a silent gap is a bug', () => {
    expect(() => createStrings({ nope: 'x' } as never)).toThrow("Unknown line 'nope'");
    expect(() => createStrings({ cleared: '   ' })).toThrow("The line 'cleared' cannot be empty.");
  });
});

describe('your own sounds', () => {
  it('uses your voices, in your order, for objects that set no sound', () => {
    const reg = createRegistry({
      voices: [
        { label: 'my low', hz: 200, wave: 'sine' },
        { label: 'my high', hz: 900, wave: 'square' },
      ],
      haptics: [[10], [20, 20, 20]],
    });
    expect(reg.define('a', { width: 0.2 })).toMatchObject({ sound: { hz: 200, wave: 'sine' }, haptic: [10] });
    expect(reg.define('b', { width: 0.2 })).toMatchObject({ sound: { hz: 900, wave: 'square' }, haptic: [20, 20, 20] });
    expect(() => reg.define('c', { width: 0.2 })).toThrow(/no unused voice left/);
  });

  it('the beeps use your voices', () => {
    const reg = createRegistry({ voices: [{ label: 'v', hz: 333, wave: 'sine' }] });
    reg.define('a', { width: 0.2 });
    const beat: SemanticEvent = { type: EVENT_TYPES.beat, at: 1, data: { object: 'a', beat: 1 } };
    const [beep] = only(renderEvent(beat, defaultProfile(), createChannels(reg)), 'sound');
    expect(beep).toMatchObject({ hz: 333, wave: 'sine' });
  });
});

describe('your own game events', () => {
  const events = createEventRegistry();
  events.define('door-opens', {
    say: '{name} opens',
    caption: 'Door: {name}',
    sound: { hz: 660, wave: 'sine', gain: 0.5 },
    haptic: [80, 40, 80],
  });
  events.define('quiet-thing'); // declared with no presentation
  const reg = createRegistry();
  const channels = createChannels(reg, { events });
  const door: SemanticEvent = { type: 'door-opens', at: 5, data: { name: 'Gate' } };

  it('reaches every channel you gave it something for', () => {
    const cmds = renderEvent(door, defaultProfile(), channels);
    expect(only(cmds, 'speech')).toMatchObject([{ text: 'Gate opens' }]);
    expect(only(cmds, 'captions')).toMatchObject([{ text: 'Door: Gate' }]);
    expect(only(cmds, 'sound')).toMatchObject([{ hz: 660, wave: 'sine', gain: 0.5, role: 'cue' }]);
    expect(only(cmds, 'indicator')).toHaveLength(1); // every sound has a visual marker
    expect(only(cmds, 'haptics')).toMatchObject([{ pattern: [80, 40, 80] }]);
    expect(new Set(cmds.flatMap((c) => c.senses)).size).toBe(3);
  });

  it('scales your sound by the player cue volume and respects reduced motion', () => {
    const profile = mergeProfile(defaultProfile(), { volume: { cues: 0.5 }, reducedMotion: true });
    const cmds = renderEvent(door, profile, channels);
    expect(only(cmds, 'sound')).toMatchObject([{ gain: 0.25 }]);
    expect(only(cmds, 'indicator')).toMatchObject([{ flash: false }]);
  });

  it('renders nothing for an event declared without a presentation', () => {
    expect(renderEvent({ type: 'quiet-thing', at: 1 }, defaultProfile(), channels)).toEqual([]);
  });

  it('cannot change what a built-in event does', () => {
    const sneaky = createEventRegistry();
    sneaky.define(EVENT_TYPES.hurt, { say: 'something else' });
    const cmds = renderEvent({ type: EVENT_TYPES.hurt, at: 1 }, defaultProfile(), createChannels(reg, { events: sneaky }));
    expect(only(cmds, 'speech')).toMatchObject([{ text: 'Hurt.' }]);
  });

  it('rejects a presentation with empty text or a bad pitch', () => {
    const e = createEventRegistry();
    expect(() => e.define('a', { say: ' ' })).toThrow("Event 'a' has an empty say.");
    expect(() => e.define('b', { sound: { hz: 0, wave: 'sine' } })).toThrow("Event 'b' needs a sound pitch");
  });
});

describe('your own channels', () => {
  const reg = createRegistry();
  reg.define('grave', { width: 0.2 });
  const beat: SemanticEvent = { type: EVENT_TYPES.beat, at: 1, data: { object: 'grave', beat: 1 } };

  it('leaves a channel out', () => {
    const cmds = renderEvent(beat, defaultProfile(), createChannels(reg, { omit: ['sound', 'haptics'] }));
    expect(only(cmds, 'sound')).toEqual([]);
    expect(only(cmds, 'haptics')).toEqual([]);
    expect(only(cmds, 'captions')).toHaveLength(1);
  });

  it('swaps a channel for yours', () => {
    const glow: Channel = {
      id: 'indicator',
      render: (event) => [{ channel: 'indicator', senses: ['sight'], at: event.at, flash: false }],
    };
    const channels = createChannels(reg, { replace: { indicator: glow } });
    expect(channels.map((c) => c.id)).toEqual(['sound', 'speech', 'captions', 'indicator', 'haptics']);
    expect(only(renderEvent(beat, defaultProfile(), channels), 'indicator')).toMatchObject([{ flash: false }]);
  });
});

describe('createKit: everything in one place', () => {
  it('with no config behaves like the defaults', () => {
    const kit = createKit();
    expect(kit.newProfile()).toEqual(defaultProfile());
    expect(kit.timing).toEqual(resolveTiming());
  });

  it('builds a different game from config alone', () => {
    const kit = createKit({
      timing: { airtime: 1.2, beat: 0.5, gap: [3.2, 3.8] },
      strings: { approaching: 'Watch out: {name}' },
      voices: [
        { label: 'a', hz: 250, wave: 'sine' },
        { label: 'b', hz: 700, wave: 'square' },
      ],
      defaults: { speed: 'medium', textScale: 1.5, volume: { music: 0 } },
      events: { 'coin-collected': { say: 'Coin', caption: 'Coin', sound: { hz: 1200, wave: 'sine' } } },
      properties: [(lv) => proofResult(100, 'At most 20 obstacles', lv.obstacles.length <= 20 ? [] : ['Too many.'])],
    });
    kit.defineObstacle('hedge', { width: [0.2, 0.5] });
    kit.defineObstacle('pit', { width: [0.4, 0.7] });

    const profile = kit.newProfile();
    expect(profile).toMatchObject({ speed: 'medium', textScale: 1.5, volume: { cues: 1, speech: 1, music: 0 } });

    const level = kit.generate(11);
    const results = kit.prove(level);
    expect(results.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 100]);
    expect(results.every((r) => r.pass)).toBe(true);
    expect(kit.refuseIfFailing(level)).toBe(level);

    const approaching = kit.levelEvents(level).find((e) => e.type === EVENT_TYPES.approaching)!;
    expect(only(kit.render(approaching, profile), 'speech')).toMatchObject([{ text: expect.stringMatching(/^Watch out: /) }]);
    expect(only(kit.render({ type: 'coin-collected', at: 1 }, profile), 'sound')).toMatchObject([{ hz: 1200 }]);
    expect(kit.registry.get('hedge')!.sound).toMatchObject({ hz: 250, wave: 'sine' });
  });

  it('refuses an obstacle that this game cannot clear, with a reason in its own numbers', () => {
    const kit = createKit({ timing: { airtime: 1.2 } });
    kit.defineObstacle('wall', { width: 3 });
    const level = kit.generate(5);
    expect(() => kit.refuseIfFailing(level, 'Level 5')).toThrow(LevelRefused);
    expect(byId(kit.prove(level, 'Level 5'), 1).counterexample).toMatch(/One jump covers only 1\.08 s\.$/);
  });

  it('keeps two kits apart', () => {
    const a = createKit();
    const b = createKit();
    a.defineObstacle('grave', { width: 0.2 });
    expect(b.registry.names()).toEqual([]);
  });

  it('asks for an obstacle before generating, in plain words', () => {
    expect(() => createKit().generate(1)).toThrow('Define at least one obstacle before generating a level.');
  });

  it('rejects bad config early', () => {
    expect(() => createKit({ timing: { beat: -1 } })).toThrow("Timing 'beat'");
    expect(() => createKit({ strings: { hurt: '' } })).toThrow("The line 'hurt' cannot be empty.");
    expect(() => createKit({ events: { x: { sound: { hz: -5, wave: 'sine' } } } })).toThrow("Event 'x'");
  });

  it('(PBT) any valid player profile still works with a customised kit', () => {
    const kit = createKit({ strings: { approaching: 'Ahead: {name}' } });
    kit.defineObstacle('grave', { width: [0.16, 0.3] });
    fc.assert(
      fc.property(seedArb, (seed) => {
        const level = kit.generate(seed);
        for (const e of kit.levelEvents(level)) {
          for (const cmd of kit.render(e, kit.newProfile())) expect(cmd.at).toBe(e.at);
        }
      }),
      { numRuns: 50 },
    );
  });
});
