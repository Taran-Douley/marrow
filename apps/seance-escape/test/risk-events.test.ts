import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  EVENT_FLICKER_MAX_HZ,
  NOISE,
  ROOM_EVENTS,
  proveMaze,
  simulateRitual,
  type OutputCommand,
  type SemanticEvent,
} from '@marrow/skeleton';
import { MABEL, NOISE_WORDS, ROOM_EVENT_STYLES, SEARCH_LINES, sideWord } from '../src/content';
import { createSeanceKit, FRIGHTS } from '../src/kit';
import { GUTTER_HZ, GUTTER_MS, gutterDark, meterView } from '../src/risk-view';
import { CATCH_LIMIT, STANDARD_SIZE, serveHouse } from '../src/runs';

// Stage 2 (risk and noise) and stage 3 (room events) of the seance-runs spec, from the player's side:
// every cost is told, every noise and every event is heard, seen and said, and the houses served stay proven.

const kit = createSeanceKit();
const at = (type: string, data?: Record<string, unknown>): SemanticEvent => (data ? { type, at: 0, data } : { type, at: 0 });
const channels = (cmds: OutputCommand[]): Set<string> => new Set(cmds.map((c) => c.channel));
const profile = kit.newProfile();

describe('every room event is heard, seen and said (3.1)', () => {
  it('the app has a style for every event of the skeleton\'s table, and no spare ones', () => {
    expect(Object.keys(ROOM_EVENT_STYLES).sort()).toEqual(ROOM_EVENTS.map((e) => e.id).sort());
    expect(ROOM_EVENTS.length).toBeGreaterThanOrEqual(8);
  });

  it('each has a sound, a caption and a spoken line, never colour alone and never sound alone', () => {
    for (const def of ROOM_EVENTS) {
      const style = ROOM_EVENT_STYLES[def.id]!;
      expect(style.caption.length, def.id).toBeGreaterThan(3);
      expect(style.line.length, def.id).toBeGreaterThan(10);
      const cmds = kit.render(at('room-event-' + def.id, { line: style.line, caption: style.caption, angle: 30, distance: 0.5 }), profile);
      const seen = channels(cmds);
      expect(seen.has('sound'), `${def.id} sound`).toBe(true);
      expect(seen.has('captions'), `${def.id} caption`).toBe(true);
      expect(seen.has('speech'), `${def.id} speech`).toBe(true);
    }
  });

  it('a scary event has a softer line, and Fright softens its sound; Off makes it a plain chime', () => {
    for (const def of ROOM_EVENTS.filter((e) => e.scary)) {
      const style = ROOM_EVENT_STYLES[def.id]!;
      // Door slams and chains are loud on purpose, and their line is the information. Every scary event still has a soft line.
      expect(style.soft, def.id).toBeTruthy();
      const sound = (fright: (typeof FRIGHTS)[number]) =>
        createSeanceKit({ fright })
          .render(at('room-event-' + def.id, { line: style.line, caption: style.caption, angle: 0, distance: 0.5 }), profile)
          .find((c): c is Extract<OutputCommand, { channel: 'sound' }> => c.channel === 'sound')!;
      const full = sound('full');
      const gentle = sound('gentle');
      const off = sound('off');
      expect(gentle.gain, def.id).toBeLessThan(full.gain);
      expect(off.hz, def.id).toBe(330);
      expect(off.gain, def.id).toBeLessThanOrEqual(0.3);
    }
  });

  it('nothing flashes more than 3 times a second, and with reduced motion nothing flickers', () => {
    expect(GUTTER_HZ).toBeLessThanOrEqual(EVENT_FLICKER_MAX_HZ);
    expect(EVENT_FLICKER_MAX_HZ).toBeLessThanOrEqual(3);
    // Count how often the darkness swings back up in each second.
    const peaks = (reduced: boolean): number => {
      const samples: number[] = [];
      for (let ms = 0; ms < GUTTER_MS; ms += 10) samples.push(gutterDark(ms, reduced));
      let n = 0;
      for (let i = 1; i < samples.length - 1; i++) if (samples[i]! > samples[i - 1]! && samples[i]! >= samples[i + 1]!) n += 1;
      return n;
    };
    expect(peaks(false) / (GUTTER_MS / 1000)).toBeLessThanOrEqual(3);
    // Reduced motion: one slow dim and recover, no wavering.
    expect(peaks(true)).toBeLessThanOrEqual(1);
    for (let ms = 0; ms < GUTTER_MS; ms += 10) {
      expect(gutterDark(ms, false)).toBeLessThanOrEqual(0.6);
      expect(gutterDark(ms, false)).toBeGreaterThanOrEqual(0);
    }
    expect(gutterDark(-5, false)).toBe(0);
    expect(gutterDark(GUTTER_MS + 1, false)).toBe(0);
  });

  it('the event with a visual is the one that dims the room, and every other is sound, caption and speech', () => {
    expect(Object.entries(ROOM_EVENT_STYLES).filter(([, s]) => s.visual).map(([id]) => id)).toEqual(['lights-gutter']);
  });
});

describe('noise is told in three ways (2.2)', () => {
  it('each band is sounded, written and said, and says what it means', () => {
    for (const band of ['quiet', 'loud', 'very-loud']) {
      const seen = channels(kit.render(at(`noise-meter-${band}`, { level: 2, band }), profile));
      expect(seen.has('sound'), band).toBe(true);
      expect(seen.has('captions'), band).toBe(true);
      expect(seen.has('speech'), band).toBe(true);
    }
    expect(NOISE_WORDS['very loud'].say).toMatch(/very loud/i);
    expect(meterView(0).label).toBe('Noise: quiet');
    expect(meterView(NOISE.search).label).toBe('Noise: very loud');
    // The meter is words and bars together: more noise, more bars.
    expect([0, 1, 2, 3].map((l) => meterView(l).bars)).toEqual([1, 1, 2, 3]);
  });

  it('the phantom hearing a noise is sounded from where it is, with a caption and a line', () => {
    const cmds = kit.render(at('ghost-heard', { angle: -70, distance: 0.4 }), profile);
    for (const c of ['sound', 'speech', 'captions']) expect(channels(cmds).has(c), c).toBe(true);
    const sound = cmds.find((c): c is Extract<OutputCommand, { channel: 'sound' }> => c.channel === 'sound')!;
    expect(sound.space?.x ?? 0).toBeLessThan(0);
    const step = kit.render(at('ghost-step', { angle: 80, distance: 0.3 }), profile).find((c) => c.channel === 'sound') as Extract<OutputCommand, { channel: 'sound' }>;
    expect(step.space?.x ?? 0).toBeGreaterThan(0);
  });

  it('a search is sounded, written and said, whatever it turns up', () => {
    for (const line of [SEARCH_LINES.nothing, SEARCH_LINES.relic(MABEL.hint('relic', 'left', 4)), SEARCH_LINES.trail(-90, 3, true), SEARCH_LINES.trail(0, 9, false)]) {
      const seen = channels(kit.render(at('walk-search', { line, caption: 'Search' }), profile));
      expect(seen.has('sound') && seen.has('captions') && seen.has('speech')).toBe(true);
      expect(line).toMatch(/loud/);
    }
    expect(sideWord(-90)).toBe('to your left');
    expect(sideWord(180)).toBe('behind you');
  });

  it('the kit still reaches two senses with every event (property 8)', () => {
    expect(kit.proveEvents().pass).toBe(true);
    for (const fright of FRIGHTS) expect(createSeanceKit({ fright }).proveEvents().pass, fright).toBe(true);
  });
});

describe('the houses served stay proven with the costs and noise in force (2.3, 3.2)', () => {
  it('every served house passes 201 to 207, and its best route is never caught however it pays the costs', () => {
    let counter = 1;
    const SERVED = 60;
    for (let i = 0; i < SERVED; i++) {
      const served = serveHouse(counter, STANDARD_SIZE)!;
      counter = served.seed + 1;
      const results = proveMaze(served.maze, `House ${served.seed}`, { runLength: true });
      expect(results.map((r) => r.id)).toEqual([201, 202, 203, 204, 205, 206, 207]);
      for (const r of results) expect(r.pass, `house ${served.seed}: ${r.id} ${r.name}`).toBe(true);
      for (const searches of [[], [0], [1], [0, 1]]) {
        expect(simulateRitual(served.maze, { searches }).caught, `house ${served.seed} ${JSON.stringify(searches)}`).toBe(false);
      }
    }
  });

  it('three catches still end a run', () => {
    expect(CATCH_LIMIT).toBe(3);
  });

  it('events never change what a house is: serving a house twice gives the same house', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), (seed) => {
        const a = serveHouse(seed, 'medium')!;
        expect(JSON.stringify(a.maze)).toBe(JSON.stringify(serveHouse(seed, 'medium')!.maze));
      }),
      { numRuns: 20 },
    );
  });
});
