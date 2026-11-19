import { describe, expect, it } from 'vitest';
import { CATALOGUE, catalogueMarkdown, preset, useObject } from '../src/catalogue';
import { createKit } from '../src/kit';

describe('the catalogue', () => {
  it('every ready-made object has a sound, words, a caption and a vibration, and a unique name', () => {
    expect(new Set(CATALOGUE.map((p) => p.name)).size).toBe(CATALOGUE.length);
    for (const p of CATALOGUE) {
      expect(p.say.length, p.name).toBeGreaterThan(0);
      expect(p.caption.length, p.name).toBeGreaterThan(0);
      expect(p.sound.hz, p.name).toBeGreaterThan(0);
      expect(p.haptic.length, p.name).toBeGreaterThan(0);
    }
  });

  it('each obstacle, alone in a kit, makes levels that pass the whole proof, and every event reaches two senses', () => {
    for (const p of CATALOGUE) {
      const kit = createKit();
      useObject(kit, p);
      if (p.kind === 'obstacle') {
        for (const seed of [1, 2, 3]) expect(kit.prove(kit.generate(seed)).filter((r) => !r.pass).map((r) => r.counterexample), p.name).toEqual([]);
      }
      expect(kit.proveEvents().pass, p.name).toBe(true);
      expect(kit.registry.get(p.name)).toMatchObject({ say: p.say, caption: p.caption, sound: p.sound, haptic: p.haptic });
    }
  });

  it('any part can be changed, and a broken preset is refused in plain words', () => {
    const kit = createKit();
    expect(useObject(kit, CATALOGUE[0]!, { width: [0.2, 0.25] }).width).toEqual([0.2, 0.25]);
    expect(() => preset({ ...CATALOGUE[0]!, name: 'Big Crypt' })).toThrow(/lower case letters, digits and hyphens/);
    expect(() => preset({ ...CATALOGUE[0]!, width: undefined })).toThrow(/an obstacle needs a width/);
  });

  it('matches docs/catalogue.md (run `npm run catalogue --workspace skeleton` to rewrite it)', async () => {
    await expect(catalogueMarkdown()).toMatchFileSnapshot('../../docs/catalogue.md');
  });
});
