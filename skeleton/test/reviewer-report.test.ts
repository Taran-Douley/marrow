import { describe, expect, it } from 'vitest';
import {
  ESA_TAGS,
  accessibilityReport,
  createKit,
  factsFromKit,
  mergeProof,
  reviewLevel,
  reviewLevels,
  type Kit,
  type Level,
} from '../src';
import { generateLevel } from '../src/level';

const graveyard = (config: Parameters<typeof createKit>[0] = {}): Kit => {
  const kit = createKit(config);
  kit.defineObstacle('grave', { width: [0.16, 0.3] });
  kit.defineObstacle('fence', { width: [0.12, 0.24] });
  return kit;
};
const levelsOf = (kit: Kit, n: number): Level[] => Array.from({ length: n }, (_, i) => kit.generate(i + 1));

describe('the reviewer loop', () => {
  it('finds nothing in the default game at Slow, for every default reviewer', () => {
    const kit = graveyard();
    const r = reviewLevels(kit, levelsOf(kit, 40), { speed: 'slow' });
    expect(r.findings).toEqual([]);
    expect(r.summary).toBe('40 of 40 levels have no findings.');
  });

  it('reports a player who cannot keep up at Fast, names who and where, and offers a slower speed only to them', () => {
    const kit = graveyard();
    const review = reviewLevel(kit, kit.generate(3), { speed: 'fast', personas: [{ kind: 'noisy', sigmaMs: 250 }] });
    expect(review.passed).toBe(false);
    const f = review.findings[0]!;
    expect(f.cause).toMatch(/^one-switch, 250 ms timing error, level 3, obstacle \d+ \((grave|fence)\): clears it first time \d+% of the time at fast\. The take-off window is \d+ ms\.$/);
    expect(f.severity).toBe('hard');
    expect(f.repair).toMatchObject({ change: 'speed' });
    expect(f.repair!.change === 'speed' && f.repair!.effect).toMatch(/Offer (medium|slow) to this player: the chance rises from \d+% to \d+%/);
  });

  it('never offers a repair that changes the level: only a speed, or nothing', () => {
    const kit = graveyard();
    for (const level of levelsOf(kit, 15)) {
      for (const speed of ['medium', 'fast'] as const) {
        for (const f of reviewLevel(kit, level, { speed, personas: [{ kind: 'noisy', sigmaMs: 300 }] }).findings) {
          expect(['speed', 'none']).toContain(f.repair!.change);
        }
      }
    }
  });

  it('says plainly when no speed can help, and does not offer to widen the obstacle', () => {
    const kit = graveyard();
    kit.defineObstacle('crypt', { width: [1.0, 1.0] });
    const level: Level = { seed: 17, obstacles: [{ index: 0, kind: 'crypt', start: 6.5, width: 1.0 }] };
    const review = reviewLevel(kit, level, { speed: 'slow', personas: [{ kind: 'perfect' }] });
    const f = review.findings[0]!;
    expect(f.severity).toBe('blocks');
    expect(f.object).toBe('crypt');
    expect(f.repair).toMatchObject({ change: 'none' });
    expect(JSON.stringify(f.repair)).toMatch(/not offered as a repair/);
  });

  it('finds a gap for a deaf player when the captions and markers are left out, and for a blind player when sound and speech are', () => {
    const noSight = graveyard({ channels: { omit: ['captions', 'indicator'] } });
    const deaf = reviewLevel(noSight, noSight.generate(2), { personas: [{ kind: 'deaf' }] });
    expect(deaf.findings.length).toBeGreaterThan(0);
    expect(deaf.findings[0]!.cause).toMatch(/^deaf player \(sight only\), level 2, obstacle 1 \((grave|fence)\): the first beep reaches nothing they can see\./);

    const noSound = graveyard({ channels: { omit: ['sound', 'speech'] } });
    const blind = reviewLevel(noSound, noSound.generate(2), { personas: [{ kind: 'audio-only' }] });
    expect(blind.findings.some((f) => /reaches nothing they can hear/.test(f.cause))).toBe(true);
    expect(blind.findings.some((f) => /pressed early/.test(f.cause))).toBe(true);
  });

  it('a game with every channel passes the perception reviewers, for 20 levels of a lesson game too', () => {
    const kit = createKit({ lesson: { title: 'Evens', prompt: 'p', values: [1, 30], isTarget: (v) => v % 2 === 0 } });
    kit.defineObstacle('stone', { width: [0.16, 0.3] });
    const r = reviewLevels(kit, levelsOf(kit, 20), { speed: 'slow', personas: [{ kind: 'deaf' }, { kind: 'audio-only' }] });
    expect(r.findings).toEqual([]);
  });

  it('is headless and deterministic', () => {
    const kit = graveyard();
    const a = reviewLevel(kit, generateLevel(9), { speed: 'fast' });
    const b = reviewLevel(kit, generateLevel(9), { speed: 'fast' });
    expect(a).toEqual(b);
  });
});

const PASSING = [1, 2, 3, 4, 5, 6, 8, 13].map((id) => ({ id, pass: true }));

describe('the accessibility report', () => {
  it('names all 24 ESA tags exactly once, each as supported, to check, or not claimed', () => {
    expect(new Set(ESA_TAGS).size).toBe(24);
    const r = accessibilityReport({ channels: ['sound', 'speech', 'captions', 'indicator', 'haptics'], proof: PASSING, narratesMenus: true });
    const all = [...r.supported, ...r.check, ...r.notClaimed].map((e) => e.tag).sort();
    expect(all).toEqual([...ESA_TAGS].sort());
  });

  it('claims input and sound tags only because the proof passes, and says why', () => {
    const r = accessibilityReport({ game: 'Ghastly Moves', channels: ['sound', 'speech', 'captions', 'indicator', 'haptics'], proof: PASSING, narratesMenus: true });
    const supported = r.supported.map((e) => e.tag);
    expect(supported).toEqual(
      expect.arrayContaining(['Mono Sound', 'Narrated Menus', 'Playable without Button Holds', 'Playable without Rapid Button Presses', 'Playable with Keyboard Only', 'Playable without Motion Controls', 'Playable without Touch Controls', 'Camera Comfort']),
    );
    expect(supported).not.toContain('Surround Sound');
    expect(r.supported.find((e) => e.tag === 'Playable without Button Holds')!.note).toMatch(/timing proof \(1 to 6\) passes/);
  });

  it('does not claim a tag whose proof is failing (14.3)', () => {
    const proof = PASSING.map((p) => (p.id === 3 ? { ...p, pass: false, name: 'Unambiguous cues' } : p));
    const r = accessibilityReport({ channels: ['sound', 'speech', 'captions'], proof, narratesMenus: true });
    const held = r.notClaimed.find((e) => e.tag === 'Playable without Button Holds')!;
    expect(held.note).toMatch(/proof property 3 \(Unambiguous cues\) is failing/);
    expect(r.supported.map((e) => e.tag)).not.toContain('Playable with Keyboard Only');

    const noCues = accessibilityReport({ channels: ['sound'], proof: PASSING.map((p) => (p.id === 13 ? { ...p, pass: false } : p)), spatialEvents: true, directionalSound: true });
    expect(noCues.supported.map((e) => e.tag)).not.toContain('Stereo Sound');
    expect(noCues.supported.map((e) => e.tag)).not.toContain('Surround Sound');
  });

  it('does not claim a tag whose channel is off', () => {
    const r = accessibilityReport({ channels: ['captions'], proof: PASSING, narratesMenus: true });
    expect(r.supported.map((e) => e.tag)).not.toContain('Mono Sound');
    expect(r.supported.map((e) => e.tag)).not.toContain('Narrated Menus');
    expect(r.notClaimed.find((e) => e.tag === 'Narrated Menus')!.note).toBe('The speech channel is off.');
  });

  it('claims no input tag with no finishability proof at all', () => {
    const r = accessibilityReport({ channels: ['sound', 'speech'], proof: [] });
    expect(r.supported.map((e) => e.tag)).not.toContain('Playable with Keyboard Only');
    expect(r.notClaimed.find((e) => e.tag === 'Playable with Keyboard Only')!.note).toMatch(/no finishability proof was given/);
  });

  it('uses the house proof for a navigation game, and claims surround sound only when sound has direction', () => {
    const nav = [201, 202, 203, 204, 102, 8, 13].map((id) => ({ id, pass: true }));
    const r = accessibilityReport({ channels: ['sound', 'speech', 'captions'], proof: nav, spatialEvents: true, directionalSound: true, narratesMenus: true, cameraMotion: true });
    const names = r.supported.map((e) => e.tag);
    expect(names).toEqual(expect.arrayContaining(['Surround Sound', 'Stereo Sound', 'Playable with Keyboard Only']));
    expect(r.supported.find((e) => e.tag === 'Playable with Keyboard Only')!.note).toMatch(/house proof \(201 to 204\)/);
    expect(r.check.map((e) => e.tag)).toContain('Camera Comfort');
  });

  it('never says a game is fully accessible, and says what a person must still check', () => {
    const r = accessibilityReport({ channels: ['sound', 'speech', 'captions', 'indicator', 'haptics'], proof: PASSING, narratesMenus: true });
    expect(`${r.statement}\n${r.markdown}`).not.toMatch(/fully accessible/i);
    expect(r.statement).toMatch(/does not replace testing with disabled players/);
    expect(r.markdown).toMatch(/^# Accessibility features: This game/);
    expect(r.markdown).toContain('## Provided, to confirm');
  });

  it('builds the facts from a real kit and merges proof across levels, worst result wins', () => {
    const kit = graveyard({ events: { 'wail': { say: 'Wail {side}', caption: 'Wail', sound: { hz: 200, wave: 'sine' }, spatial: true }, menu: { say: 'Menu', caption: 'Menu' } } });
    const runs = levelsOf(kit, 5).map((l) => kit.prove(l));
    const proof = mergeProof(runs);
    expect(proof.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6]);
    const facts = factsFromKit(kit, proof);
    expect(facts.spatialEvents).toBe(true);
    expect(facts.narratesMenus).toBe(true);
    expect(facts.channels).toEqual(['sound', 'speech', 'captions', 'indicator', 'haptics']);
    expect(mergeProof([[{ id: 1, name: 'a', pass: true }], [{ id: 1, name: 'a', pass: false }]])).toEqual([{ id: 1, name: 'a', pass: false }]);
  });
});
