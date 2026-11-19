import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PULSE_MAX_ALPHA } from '@marrow/skeleton';
import { PULSE_LOOK, drawObstacleGlow, drawPortalGate, type ArtState } from '../src/art';
import { createGhastlyKit } from '../src/kit';
import { defineThrow } from '../src/objects/projectile';
import { bossTells, volleysOf } from '../src/pattern';
import { bestWords, mapLines, emptyProgress } from '../src/progress';
import { STAGES } from '../src/stages';

// The ghastly-rhythm-v2 tasks 10 to 13: the six other bosses by sound, the seen portal gate, the
// pulses on obstacles and per stage, and the best on the map.

const SEEDS = fc.integer({ min: 1, max: 1_000_000 });
const bosses = STAGES.slice(1);

describe('task 10: a pattern for each of the other six bosses', () => {
  for (const stage of bosses) {
    const pattern = stage.boss.pattern!;
    const kit = createGhastlyKit(stage, { boss: true });

    it(`${stage.boss.name} passes every proof, with 15, 16, 19, 22 and 23, on 250 seeds`, () => {
      expect(pattern).toBeDefined();
      fc.assert(
        fc.property(SEEDS, (seed) => {
          const results = kit.prove(kit.generate(seed), `${stage.boss.name} ${seed}`);
          expect(results.map((r) => r.id)).toEqual(expect.arrayContaining([15, 19, 20, 22, 23]));
          expect(results.filter((r) => !r.pass).map((r) => r.counterexample)).toEqual([]);
        }),
        { numRuns: 250 },
      );
    });

    it(`${stage.boss.name} plays its volleys in order, each after its own tell`, () => {
      const level = kit.generate(11);
      expect(volleysOf(level).map((v) => v.id)).toEqual(pattern.volleys);
      expect(bossTells(level).map((t) => t.id)).toEqual(pattern.volleys);
      expect(kit.proveEvents().pass).toBe(true);
      for (const t of pattern.throws) {
        const cmds = kit.render({ type: `boss-tell-${t.id}`, at: 0 });
        expect([...new Set(cmds.flatMap((c) => c.senses))].sort()).toEqual(['hearing', 'sight', 'touch']);
        expect(cmds.some((c) => c.channel === 'speech' && c.text === t.tell.say)).toBe(true);
      }
    });

    it(`${stage.boss.name}: the kinds differ in shape and in how they move, and each can be drawn`, () => {
      expect(new Set(pattern.throws.map((t) => t.shape)).size).toBe(pattern.throws.length);
      expect(new Set(pattern.throws.map((t) => t.motion)).size).toBe(pattern.throws.length);
      const calls: string[] = [];
      const ctx = new Proxy({}, { get: (_, k) => (k === 'canvas' ? {} : (..._a: unknown[]) => calls.push(String(k))), set: () => true }) as unknown as CanvasRenderingContext2D;
      for (const t of pattern.throws) {
        calls.length = 0;
        kit.registry.get(t.name)!.draw!(ctx, { x: 100, y: 300, width: 50, height: 74, value: 12 });
        expect(calls, t.name).toContain('fillText');
      }
    });
  }

  it('no two bosses play the same pattern, and every later boss has at least as many volleys as the Pumpkin King', () => {
    const all = STAGES.map((s) => s.boss.pattern!.volleys.join(' '));
    expect(new Set(all).size).toBe(7);
    for (const s of bosses) expect(s.boss.pattern!.volleys.length).toBeGreaterThanOrEqual(6);
  });

  it('timing does not change: every boss throw has the usual width and every press is on the beat', () => {
    for (const stage of bosses) {
      const kit = createGhastlyKit(stage, { boss: true });
      for (const o of kit.generate(3).obstacles) {
        const press = o.start + (o.width - kit.timing.airtime) / 2;
        expect(Math.abs(press / kit.timing.beat - Math.round(press / kit.timing.beat))).toBeLessThan(1e-6);
        expect(o.width).toBeGreaterThanOrEqual(0.16);
        expect(o.width).toBeLessThanOrEqual(0.3);
      }
    }
  });

  it('the introduction says how to read every kind by ear', () => {
    for (const stage of bosses) {
      const prompt = createGhastlyKit(stage, { boss: true }).lesson!.prompt;
      for (const t of stage.boss.pattern!.throws) expect(prompt).toContain(`${t.heard} means ${t.plural}`);
    }
  });

  it('defineThrow still draws the Pumpkin King bombs', () => {
    expect(typeof defineThrow).toBe('function');
    const kit = createGhastlyKit(STAGES[0]!, { boss: true });
    expect(kit.registry.get('lobbed-bomb')?.draw).toBeTypeOf('function');
  });
});

/** A canvas that records the text drawn on it. */
function recorder(): { ctx: CanvasRenderingContext2D; texts: string[]; calls: string[] } {
  const texts: string[] = [];
  const calls: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_, k) => (...a: unknown[]) => {
        calls.push(String(k));
        if (k === 'fillText') texts.push(String(a[0]));
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, texts, calls };
}

describe('task 11: a seen portal gate', () => {
  it('stages 2 to 7 have portals, and each gate names the new mode in words', () => {
    const words = { jump: 'Jump mode', flip: 'Flip mode', switch: 'Gate mode' } as const;
    for (const s of STAGES.slice(1)) {
      const level = createGhastlyKit(s).generate(2);
      expect(level.portals!.length, s.name).toBeGreaterThan(0);
      for (const p of level.portals!) {
        const { ctx, texts } = recorder();
        drawPortalGate(ctx, { x: 300, groundY: 400, move: p.move, label: words[p.move], text: '#fff', panel: '#000', line: '#fff', accent: '#fa0', font: '18px x' });
        expect(texts).toEqual([words[p.move]]);
      }
    }
  });

  it('stage 1 has no portals, so no gate', () => {
    expect(createGhastlyKit(STAGES[0]!).generate(2).portals ?? []).toEqual([]);
  });
});

describe('task 12: pulses on the obstacles and a look for each stage', () => {
  const art = (pulse: number): ArtState => ({ scenery: 'moon', t: 0, pxPerSec: 220, nowMs: 0, reducedMotion: pulse === 0, pulse, flat: false, background: '#000', groundY: 400 });

  it('an obstacle glow draws only while there is a pulse, and never with reduced motion', () => {
    const none = recorder();
    drawObstacleGlow(none.ctx, art(0), 100, 300, 50);
    expect(none.calls).toEqual([]);
    const some = recorder();
    drawObstacleGlow(some.ctx, art(0.8), 100, 300, 50);
    expect(some.calls).toContain('fill');
  });

  it('each stage has its own pulse colour, and a full pulse changes luminance by less than 0.1 on black and on white', () => {
    const channel = (v: number): number => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const lum = (hex: string): number => {
      const n = parseInt(hex.slice(1), 16);
      return 0.2126 * channel(((n >> 16) & 255) / 255) + 0.7152 * channel(((n >> 8) & 255) / 255) + 0.0722 * channel((n & 255) / 255);
    };
    const used = new Set<string>();
    for (const s of STAGES) {
      const look = PULSE_LOOK[s.scenery];
      used.add(look.colour);
      for (const bg of ['#000000', '#ffffff']) expect(PULSE_MAX_ALPHA * Math.abs(lum(look.colour) - lum(bg)), `${s.name} on ${bg}`).toBeLessThan(0.1);
    }
    expect(used.size).toBe(new Set(STAGES.map((s) => s.scenery)).size);
  });
});

describe('task 13: the best on the story map', () => {
  it('says each stage best and boss best in words, and nothing for a stage not yet played', () => {
    expect(bestWords({ '2': 62, '2b': 40 }, 2)).toBe('Best run 62%. Boss best 40%.');
    expect(bestWords({ '2': 62 }, 2)).toBe('Best run 62%.');
    expect(bestWords({}, 2)).toBe('');
    const lines = mapLines(emptyProgress(), { '2': 62, '2b': 40 });
    expect(lines[1]).toMatch(/Best run 62%\. Boss best 40%\.$/);
    expect(lines[0]).not.toMatch(/Best run/);
  });
});
