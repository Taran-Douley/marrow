import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createKit } from '../src/kit';
import { linesInScript, noHoldOrChord, noUnsafeFlashing, repairsKeepTheLevel, themesHaveContrast } from '../src/proof';
import type { OutputCommand } from '../src/types';

const flash = (at: number): OutputCommand => ({ channel: 'indicator', senses: ['sight'], at, flash: true });

describe('presentation proofs', () => {
  it('property 7 passes a normal countdown and catches a burst, with a plain counterexample', () => {
    expect(noUnsafeFlashing([0, 0.4, 0.8, 1.2].map(flash), 1).pass).toBe(true);
    const r = noUnsafeFlashing([0, 0.2, 0.4, 0.6].map(flash), 1);
    expect(r.pass).toBe(false);
    expect(r.counterexample).toBe('Level: 4 flashes within one second, from 0.00 s. The limit is 3.');
    // Markers lit together are one flash.
    expect(noUnsafeFlashing([0, 0.4, 0.8, 0.8, 0.81].map(flash), 1).pass).toBe(true);
  });

  it('property 7: with reduced motion nothing may flash', () => {
    expect(noUnsafeFlashing([flash(1)], 1, true).counterexample).toMatch(/motion is reduced, but the sound marker still flashes 1 times/);
  });

  it('property 9 passes every built-in theme and catches a low-contrast restyle', () => {
    expect(themesHaveContrast().pass).toBe(true);
    const r = themesHaveContrast({ grey: { text: '#555555', background: '#444444' } });
    expect(r.counterexample).toMatch(/^Your theme 'grey': text \(#555555\) on background \(#444444\) is 1\.\d\d:1\. It needs 4\.5:1\.$/);
  });

  it('property 10: one tap of anything is one press, and key repeat adds none', () => {
    expect(noHoldOrChord().pass).toBe(true);
  });

  it('property 11 names a line that is not in the script', () => {
    const r = linesInScript(['Grave ahead.', 'Watch out!'], [{ text: '{name} ahead.' }]);
    expect(r.counterexamples).toEqual(['Game: "Watch out!" is spoken but is not in the line script, so it cannot be recorded or translated.']);
  });

  it('property 12 refuses a repair that changes the level', () => {
    const kit = createKit();
    kit.defineObstacle('grave', { width: [0.16, 0.3] });
    const level = kit.generate(3);
    expect(repairsKeepTheLevel(level, structuredClone(level), [{ change: 'speed', to: 'slow' }]).pass).toBe(true);
    const wider = structuredClone(level);
    wider.obstacles[0]!.width = 0.1;
    expect(repairsKeepTheLevel(level, wider, []).counterexample).toMatch(/the level changed after a repair/);
  });

  it('a kit passes every presentation property on any seed (property-based)', () => {
    const kit = createKit({ events: { intro: { say: 'Welcome, {name}.', caption: 'Welcome' } } });
    kit.defineObstacle('grave', { width: [0.16, 0.3] });
    kit.defineObstacle('fence', { width: [0.12, 0.24] });
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), (seed) => {
        const results = kit.provePresentation(kit.generate(seed));
        expect(results.filter((r) => !r.pass).map((r) => r.counterexample)).toEqual([]);
        expect(results.map((r) => r.id).sort((a, b) => a - b)).toEqual([7, 8, 9, 10, 11]);
      }),
      { numRuns: 40 },
    );
  });
});
