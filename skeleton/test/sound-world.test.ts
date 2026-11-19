import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BAR_SECONDS, EVENT_TYPES } from '../src/channels';
import { createKit, type Kit } from '../src/kit';
import { cueTimes, idealPress, takeoffWindow } from '../src/level';
import { defaultProfile, mergeProfile } from '../src/profile';
import { cuesAudible } from '../src/proof';
import type { OutputCommand, Profile, SemanticEvent } from '../src/types';
import { profileArb, seedArb } from './helpers/arbitraries';

type SoundCmd = Extract<OutputCommand, { channel: 'sound' }>;
const sounds = (cmds: OutputCommand[]): SoundCmd[] => cmds.filter((c): c is SoundCmd => c.channel === 'sound');
const senses = (cmds: OutputCommand[]) => new Set(cmds.flatMap((c) => c.senses));

function makeKit(config: Parameters<typeof createKit>[0] = {}): Kit {
  const kit = createKit(config);
  kit.defineObstacle('grave', { width: [0.16, 0.3] });
  kit.defineObstacle('fence', { width: [0.12, 0.24] });
  return kit;
}

const kit = makeKit();
const approaching = (span = 1.2): SemanticEvent => ({
  type: EVENT_TYPES.approaching,
  at: 10,
  data: { object: 'grave', first: false, span },
});

describe('the approach tone: the wait gets a shape', () => {
  it('comes in from the right and reaches the centre exactly as the press arrives', () => {
    const [tone] = sounds(kit.render(approaching(1.2)));
    expect(tone).toMatchObject({ role: 'approach', pan: 0.8, wave: 'triangle' });
    expect(tone!.hz).toBe(294 / 2); // the grave's voice, an octave down
    expect(tone!.shape).toMatchObject({ panTo: 0, hzTo: (294 / 2) * 1.5, filterHz: 300, filterTo: 2200, span: 1.2 });
  });

  it('is much quieter than the beep, so the beep stays the cue', () => {
    const [tone] = sounds(kit.render(approaching()));
    expect(tone!.gain).toBeCloseTo(0.2, 9);
  });

  it('stays in the centre for mono players', () => {
    const mono = mergeProfile(defaultProfile(), { mono: true });
    const [tone] = sounds(kit.render(approaching(), mono));
    expect(tone!.pan).toBe(0);
    expect(tone!.shape?.panTo).toBeUndefined();
  });

  it('can be switched off by the developer', () => {
    expect(sounds(makeKit({ audio: { approach: false } }).render(approaching()))).toEqual([]);
  });

  it('is scheduled with the right length for every obstacle', () => {
    const level = kit.generate(3);
    const events = kit.levelEvents(level).filter((e) => e.type === EVENT_TYPES.approaching);
    for (const [i, e] of events.entries()) {
      const o = level.obstacles[i]!;
      expect((e.data as { span: number }).span).toBeCloseTo(idealPress(o, kit.timing) - cueTimes(o, kit.timing)[0], 12);
    }
  });
});

describe('the body of the player: jump, landing, stumble', () => {
  const jumped: SemanticEvent = { type: EVENT_TYPES.jumped, at: 5, data: { index: 0 } };
  const landed: SemanticEvent = { type: EVENT_TYPES.landed, at: 6 };
  const fell: SemanticEvent = { type: EVENT_TYPES.fallReason, at: 7, data: { reason: 'late' } };

  it('a press is heard at once as a whoosh, and felt as a tap', () => {
    const cmds = kit.render(jumped);
    const [whoosh] = sounds(cmds);
    expect(whoosh).toMatchObject({ role: 'effect', shape: { noise: true, seconds: 0.28 } });
    expect(cmds.filter((c) => c.channel === 'haptics')).toMatchObject([{ pattern: [40] }]);
    expect(senses(cmds)).toEqual(new Set(['hearing', 'touch', 'sight'])); // the marker lights too
  });

  it('a landing is a low thud you can feel, never speech', () => {
    const cmds = kit.render(landed);
    expect(sounds(cmds)).toMatchObject([{ role: 'effect', hz: 95, shape: { hzTo: 45 } }]);
    expect(cmds.filter((c) => c.channel === 'speech')).toEqual([]);
    expect(senses(cmds)).toEqual(new Set(['hearing', 'touch']));
  });

  it('a fall is a bonk first, then the reason in words, a long buzz and a caption', () => {
    const cmds = kit.render(fell);
    expect(sounds(cmds)).toMatchObject([{ role: 'effect', hz: 150, wave: 'triangle' }]);
    expect(cmds.filter((c) => c.channel === 'speech')).toMatchObject([{ text: 'Pressed a little late.' }]);
    expect(cmds.filter((c) => c.channel === 'haptics')).toMatchObject([{ pattern: [250] }]);
    expect(senses(cmds)).toEqual(new Set(['hearing', 'sight', 'touch']));
  });

  it('the developer can drop the effects and keep everything else', () => {
    const quiet = makeKit({ audio: { effects: false } });
    expect(sounds(quiet.render(jumped))).toEqual([]);
    expect(sounds(quiet.render(fell))).toEqual([]);
    expect(quiet.render(fell).some((c) => c.channel === 'speech')).toBe(true);
  });
});

describe('the wind and the pad underneath', () => {
  const bar = (tension: number, n = 0): SemanticEvent => ({
    type: EVENT_TYPES.atmosphere,
    at: n * BAR_SECONDS,
    data: { bar: n, tension, span: BAR_SECONDS },
  });
  const roles = (cmds: OutputCommand[]) => sounds(cmds).map((c) => `${c.role}:${c.hz}`);

  it('is wind plus a root note when calm', () => {
    expect(roles(kit.render(bar(0.1)))).toEqual(['ambience:0', 'music:110']);
  });

  it('adds a fifth as danger rises, then an octave', () => {
    expect(roles(kit.render(bar(0.5)))).toEqual(['ambience:0', 'music:110', 'music:165']);
    expect(roles(kit.render(bar(0.9)))).toEqual(['ambience:0', 'music:110', 'music:165', 'music:220']);
  });

  it('the wind opens up with danger and moves from side to side', () => {
    const calm = sounds(kit.render(bar(0, 0)))[0]!;
    const tense = sounds(kit.render(bar(1, 1)))[0]!;
    expect(tense.shape!.filterHz).toBeGreaterThan(calm.shape!.filterHz!);
    expect(calm.pan).toBe(-0.5);
    expect(tense.pan).toBe(0.5);
  });

  it('is silent when the player turns the music down to zero', () => {
    const none = mergeProfile(defaultProfile(), { volume: { music: 0 } });
    expect(sounds(kit.render(bar(0.9), none)).every((c) => c.gain === 0)).toBe(true);
  });

  it('can be switched off in parts, and retuned, by the developer', () => {
    expect(roles(makeKit({ audio: { ambience: false } }).render(bar(0.1)))).toEqual(['music:110']);
    expect(roles(makeKit({ audio: { music: false } }).render(bar(0.1)))).toEqual(['ambience:0']);
    expect(roles(makeKit({ audio: { keyHz: 98 } }).render(bar(0.5)))).toEqual(['ambience:0', 'music:98', 'music:147']);
  });

  it('carries no information, so it asks for no caption, speech or buzz', () => {
    const cmds = kit.render(bar(0.9));
    expect(cmds.every((c) => c.channel === 'sound')).toBe(true);
  });

  it('the schedule has one bar every two seconds, from the start to just past the last obstacle', () => {
    const level = kit.generate(4);
    const bars = kit.levelEvents(level).filter((e) => e.type === EVENT_TYPES.atmosphere);
    expect(bars[0]!.at).toBe(0);
    bars.forEach((b, i) => expect(b.at).toBe(i * BAR_SECONDS));
    const last = level.obstacles.at(-1)!;
    expect(bars.at(-1)!.at).toBeGreaterThanOrEqual(last.start);
    for (const b of bars) {
      const t = (b.data as { tension: number }).tension;
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
    }
  });

  it('danger grows as the next press gets closer, and falls to calm after the last obstacle', () => {
    // Sampled once per bar on purpose: a faster pulse could be mistaken for a rhythm against the beeps.
    const level = kit.generate(4);
    const presses = level.obstacles.map((o) => idealPress(o, kit.timing));
    const bars = kit.levelEvents(level).filter((e) => e.type === EVENT_TYPES.atmosphere);
    for (const b of bars) {
      const next = presses.find((p) => p > b.at);
      const expected = next === undefined ? 0.1 : Math.max(0, Math.min(1, 1 - (next - b.at) / 3.5));
      expect((b.data as { tension: number }).tension).toBeCloseTo(expected, 12);
    }
    expect((bars.at(-1)!.data as { tension: number }).tension).toBe(0.1);
    // Two bars before the same press: the nearer one is the tenser.
    const p = presses[3]!;
    const before = bars.filter((b) => b.at < p && b.at > presses[2]!).map((b) => (b.data as { tension: number }).tension);
    expect([...before].sort((x, y) => x - y)).toEqual(before);
  });
});

describe('the beeps always win (proof property 13, Req 18.5)', () => {
  it('(PBT) under any seed and any volume mix, every beep is at least 6 dB over what is under it', () => {
    fc.assert(
      fc.property(seedArb, profileArb, (seed, profile) => {
        const cmds = kit.renderLevel(kit.generate(seed), profile);
        const result = cuesAudible(cmds);
        expect(result.counterexample).toBeUndefined();
        expect(result.pass).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('(PBT) it holds with the world at full tilt: music loud, cues quiet', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 1, max: 100 }), (seed, cues) => {
        const profile = mergeProfile(defaultProfile(), { volume: { cues: cues / 100, music: 1 } });
        expect(cuesAudible(kit.renderLevel(kit.generate(seed), profile)).pass).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('can fail: a pad that is too loud is caught, in plain words', () => {
    const cmds: OutputCommand[] = [
      { channel: 'sound', senses: ['hearing'], at: 10, role: 'cue', hz: 294, wave: 'triangle', gain: 0.5, pan: 0 },
      { channel: 'sound', senses: ['hearing'], at: 9, role: 'music', hz: 110, wave: 'sine', gain: 0.4, pan: 0, shape: { span: 2 } },
    ];
    const result = cuesAudible(cmds);
    expect(result.pass).toBe(false);
    expect(result.counterexample).toBe(
      'The beep at 10.00 s plays at 0.50, but the sounds under it add up to 0.40. A beep must be at least 6 dB louder than what is under it.',
    );
  });

  it('a bed that has already ended does not count, and a silent beep is not judged', () => {
    const cmds: OutputCommand[] = [
      { channel: 'sound', senses: ['hearing'], at: 10, role: 'cue', hz: 294, wave: 'triangle', gain: 0.5, pan: 0 },
      { channel: 'sound', senses: ['hearing'], at: 5, role: 'music', hz: 110, wave: 'sine', gain: 0.9, pan: 0, shape: { span: 2 } },
      { channel: 'sound', senses: ['hearing'], at: 11, role: 'cue', hz: 294, wave: 'triangle', gain: 0, pan: 0 },
      { channel: 'sound', senses: ['hearing'], at: 11, role: 'ambience', hz: 0, wave: 'sine', gain: 0.9, pan: 0, shape: { span: 2, noise: true } },
    ];
    expect(cuesAudible(cmds).pass).toBe(true);
  });

  it('(PBT) mono players never get a sound off to one side', () => {
    fc.assert(
      fc.property(seedArb, profileArb, (seed, profile) => {
        const mono: Profile = { ...profile, mono: true };
        for (const c of sounds(kit.renderLevel(kit.generate(seed), mono))) {
          expect(c.pan).toBe(0);
          expect(c.shape?.panTo === undefined || c.shape.panTo === 0).toBe(true);
        }
      }),
      { numRuns: 50 },
    );
  });
});

describe('the run emits the player-body events', () => {
  it('a jump is followed by the clear, then the landing, and nothing after a restart', () => {
    const level = kit.generate(2);
    const seen: { type: string; at: number }[] = [];
    let clock = 0;
    const run = kit.run({
      level,
      speed: 'slow',
      startReal: 0,
      emit: (e) => seen.push({ type: e.type, at: e.at }),
    });
    const { a, b } = takeoffWindow(level.obstacles[0]!, kit.timing);
    while (run.snapshot().t < (a + b) / 2 && run.snapshot().phase === 'play') run.advance((clock += 5));
    run.press(clock);
    while (run.snapshot().t < (a + b) / 2 + 1.5) run.advance((clock += 5));
    const body = seen.filter((e) => ['jumped', 'cleared', 'landed'].includes(e.type));
    expect(body.map((e) => e.type)).toEqual(['jumped', 'cleared', 'landed']);
    expect(body[2]!.at - body[0]!.at).toBeCloseTo(kit.timing.airtime, 9);
  });
});

describe('the line script: what to record', () => {
  const k = makeKit({ events: { intro: { say: 'Welcome to the yard.', caption: 'Welcome' }, score: { say: '{points} points' } } });
  const script = k.lineScript();
  const texts = script.map((l) => l.text);

  it('lists every line the game can speak, once each', () => {
    expect(texts).toEqual(
      expect.arrayContaining([
        'Grave ahead.',
        'Fence ahead.',
        'Pressed a little early.',
        'Pressed a little late.',
        'No press.',
        'Hurt.',
        'Level complete.',
        'Welcome to the yard.',
        '{points} points',
      ]),
    );
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('leaves out lines that are only shown, never spoken', () => {
    expect(texts).not.toContain('Cleared.');
    expect(texts).not.toContain('Press now');
  });

  it('marks lines with {slots} as templates that cannot be a fixed recording', () => {
    expect(script.find((l) => l.text === '{points} points')).toMatchObject({ template: true });
    expect(script.find((l) => l.text === 'Grave ahead.')).toMatchObject({ template: false });
  });

  it('(consistency) every fixed line the channels really speak is in the script', () => {
    const profile = defaultProfile();
    const spoken = new Set<string>();
    const collect = (cmds: OutputCommand[]) =>
      cmds.forEach((c) => c.channel === 'speech' && spoken.add(c.text));
    for (const name of k.registry.names()) {
      collect(k.render({ type: EVENT_TYPES.approaching, at: 0, data: { object: name, first: true } }, profile));
    }
    for (const reason of ['early', 'late', 'none']) {
      collect(k.render({ type: EVENT_TYPES.fallReason, at: 0, data: { reason } }, profile));
    }
    collect(k.render({ type: EVENT_TYPES.hurt, at: 0 }, profile));
    collect(k.render({ type: EVENT_TYPES.levelComplete, at: 0 }, profile));
    collect(k.render({ type: 'intro', at: 0 }, profile));
    for (const line of spoken) expect(texts, `"${line}" is spoken but not in the script`).toContain(line);
  });

  it('follows your own wording and translations', () => {
    const es = makeKit({ strings: { approaching: '{name} adelante.', fallEarly: 'Demasiado pronto.' } });
    const t = es.lineScript().map((l) => l.text);
    expect(t).toContain('Grave adelante.');
    expect(t).toContain('Demasiado pronto.');
    expect(t).not.toContain('Pressed a little early.');
  });
});
