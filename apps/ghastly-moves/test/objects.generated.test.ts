// Made by scripts/wire-objects.mjs. Do not edit.
import { describe, expect, it } from 'vitest';
import { createKit } from '@marrow/skeleton';
import { catalogueMarkdown, useObject } from '@marrow/skeleton/catalogue';
import { OBJECTS } from '../src/objects/index.generated';

describe('ghastly-moves: objects wired from src/objects', () => {
  it('every object has a sound, words, a caption and a buzz, and every event reaches two senses', () => {
    for (const o of OBJECTS) {
      const kit = createKit();
      useObject(kit, o);
      expect(kit.proveEvents().counterexamples ?? [], o.name).toEqual([]);
    }
  });

  it('every obstacle, alone, makes levels that pass the whole proof', () => {
    for (const o of OBJECTS.filter((x) => x.kind === 'obstacle')) {
      const kit = createKit();
      useObject(kit, o);
      for (let seed = 1; seed <= 20; seed++) {
        const failing = kit.prove(kit.generate(seed), `Level ${seed}`).filter((r) => !r.pass);
        expect(failing.map((r) => r.counterexample), o.name).toEqual([]);
      }
    }
  });

  it('the list of objects in docs/ is up to date', async () => {
    const heading = { title: 'Objects in ghastly-moves', made: 'Made by scripts/wire-objects.mjs from apps/ghastly-moves/src/objects/, never by hand.' };
    await expect(catalogueMarkdown(OBJECTS, heading)).toMatchFileSnapshot('../../../docs/objects-ghastly-moves.md');
  });
});
