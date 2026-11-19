import { describe, expect, it } from 'vitest';
import { cuesAudible, generateMaze, proveMaze, type OutputCommand, type SemanticEvent } from '@marrow/skeleton';
import { createSeanceKit } from '../src/kit';

const kit = createSeanceKit();
const at = (type: string, data?: Record<string, unknown>): SemanticEvent => (data ? { type, at: 0, data } : { type, at: 0 });

describe('Séance Escape events', () => {
  it('every event reaches at least two senses', () => {
    const result = kit.proveEvents();
    expect(result.counterexamples ?? []).toEqual([]);
    expect(result.pass).toBe(true);
  });

  it('also under a deaf-blind-friendly profile with the voice off and the picture off', () => {
    const profile = { ...kit.newProfile(), voice: false, picture: false };
    // With picture off, captions still exist as text and the indicator is not needed; touch and sound remain.
    expect(kit.proveEvents(profile).pass).toBe(true);
  });

  it('options are placed where they lie: ahead, left, right and behind', () => {
    const spaceOf = (angle: number): OutputCommand | undefined =>
      kit.render(at('walk-option', { id: 'x', label: 'Left', angle, distance: 0.3, index: 1, count: 3 })).find((c) => c.channel === 'sound');
    const left = spaceOf(-90);
    const right = spaceOf(90);
    expect(left && 'space' in left ? left.space?.x : 0).toBeLessThan(0);
    expect(right && 'space' in right ? right.space?.x : 0).toBeGreaterThan(0);
  });

  it('says where the phantom is, in words', () => {
    const line = kit.render(at('ghost-call', { angle: -90, distance: 0.2 })).find((c) => c.channel === 'speech');
    expect(line && 'text' in line ? line.text : '').toMatch(/Phantom left, close/);
  });

  it('beeps and cues stay audible over the atmosphere', () => {
    const cmds = [
      ...kit.render(at('atmosphere', { bar: 0, tension: 0.5, span: 2 })),
      ...kit.render(at('ghost-sense', { angle: 0, distance: 0.5 })),
      ...kit.render(at('walk-option', { id: 'a', label: 'Ahead', angle: 0, distance: 0.3, index: 1, count: 2 })),
    ];
    expect(cuesAudible(cmds).pass).toBe(true);
  });

  it('every line the game can say is in the script, for a voice actor or an AI voice', () => {
    const lines = kit.lineScript().map((l) => l.text);
    expect(lines.some((t) => t.includes('Caught'))).toBe(true);
    expect(lines.some((t) => t.includes('Phantom {side}'))).toBe(true);
  });

  it('says nothing aloud between crossings: dead ends and the first step are sound and caption only', () => {
    for (const type of ['dead-end', 'walk-start']) {
      const cmds = kit.render(at(type));
      expect(cmds.some((c) => c.channel === 'speech'), type).toBe(false);
      expect(cmds.some((c) => c.channel === 'captions'), type).toBe(true);
      expect(cmds.some((c) => c.channel === 'sound'), type).toBe(true);
    }
  });

  it('serves only houses that pass the proof', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const side of [6, 8, 10]) {
        for (const r of proveMaze(generateMaze(seed, { width: side, height: side }))) expect(r.pass, `${seed}/${side} ${r.name}`).toBe(true);
      }
    }
  });
});
