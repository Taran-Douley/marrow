import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { HAPTIC_TABLE, RegistrationError, VOICE_TABLE, createRegistry } from '../src/registry';

describe('defineObstacle defaults (Req 6.1-6.5)', () => {
  it('needs only a name and a width', () => {
    const reg = createRegistry();
    const grave = reg.define('grave', { width: [0.16, 0.3] });
    expect(grave.say).toBe('grave');
    expect(grave.caption).toBe('Grave');
    expect(grave.sound).toEqual({ hz: 294, wave: 'triangle' }); // low hum
    expect(grave.haptic).toEqual(HAPTIC_TABLE[0]);
    expect(grave.draw).toBeNull(); // adapter draws the placeholder
    expect(grave.autoSound).toBe(true);
  });

  it('turns names like "stone-crypt" into plain words', () => {
    const def = createRegistry().define('stone-crypt', { width: 0.2 });
    expect(def.say).toBe('stone crypt');
    expect(def.caption).toBe('Stone crypt');
  });

  it('keeps what the developer supplies', () => {
    const draw = () => undefined;
    const def = createRegistry().define('bat', {
      width: 0.1,
      say: 'bat overhead',
      caption: 'Bat!',
      sound: { hz: 900, wave: 'sine' },
      haptic: [30],
      draw,
    });
    expect(def).toMatchObject({ say: 'bat overhead', caption: 'Bat!', haptic: [30], autoSound: false });
    expect(def.sound).toEqual({ hz: 900, wave: 'sine' });
    expect(def.draw).toBe(draw);
  });

  it('accepts a single width as a fixed range', () => {
    expect(createRegistry().define('post', { width: 0.2 }).width).toEqual([0.2, 0.2]);
  });
});

describe('automatic voices (Req 3.1, 3.4)', () => {
  it('gives the first three objects different pitch AND different timbre', () => {
    const reg = createRegistry();
    const defs = ['a', 'b', 'c'].map((n) => reg.define(n, { width: 0.2 }));
    const hz = new Set(defs.map((d) => d.sound.hz));
    const waves = new Set(defs.map((d) => d.sound.wave));
    expect(hz.size).toBe(3);
    expect(waves.size).toBe(3);
    expect(reg.sharedTimbres()).toEqual([]);
  });

  it('gives the grave a low hum and the fence a high chime, as in tech.md', () => {
    const reg = createRegistry();
    expect(reg.define('grave', { width: 0.2 }).sound).toEqual({ hz: 294, wave: 'triangle' });
    expect(reg.define('fence', { width: 0.2 }).sound).toEqual({ hz: 587, wave: 'sine' });
  });

  it('reports a shared timbre for the fourth voice instead of hiding it', () => {
    // The table has four voices but only three basic wave shapes.
    const reg = createRegistry();
    ['a', 'b', 'c'].forEach((n) => reg.define(n, { width: 0.2 }));
    const fourth = reg.define('d', { width: 0.2 });
    expect(fourth.sound.hz).toBe(784);
    expect(fourth.sharesTimbre).toBe(true);
    expect(reg.sharedTimbres()).toEqual([['a', 'd']]);
  });

  it('refuses a fifth automatic voice and says what to do (Req 3.4)', () => {
    const reg = createRegistry();
    ['a', 'b', 'c', 'd'].forEach((n) => reg.define(n, { width: 0.2 }));
    expect(() => reg.define('e', { width: 0.2 })).toThrow(/no unused voice left/);
    expect(() => reg.define('e', { width: 0.2, sound: { hz: 523, wave: 'sine' } })).not.toThrow();
  });

  it('(PBT) every automatic voice comes from the table and pitches never repeat', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: VOICE_TABLE.length }), (count) => {
        const reg = createRegistry();
        const defs = Array.from({ length: count }, (_, i) => reg.define(`obj${i}`, { width: 0.2 }));
        expect(new Set(defs.map((d) => d.sound.hz)).size).toBe(count);
        for (const d of defs) {
          expect(VOICE_TABLE.some((v) => v.hz === d.sound.hz && v.wave === d.sound.wave)).toBe(true);
        }
      }),
    );
  });

  it('gives automatic voices different vibration patterns', () => {
    const reg = createRegistry();
    const patterns = ['a', 'b', 'c', 'd'].map((n) => JSON.stringify(reg.define(n, { width: 0.2 }).haptic));
    expect(new Set(patterns).size).toBe(4);
  });
});

describe('refusing incomplete objects (Req 6.6)', () => {
  it('names the missing output', () => {
    const reg = createRegistry();
    expect(() => reg.define('x', { width: 0.2, say: '  ' })).toThrow("Object 'x' has no spoken name.");

    const missingOf = (fn: () => unknown): unknown => {
      try {
        fn();
      } catch (e) {
        expect(e).toBeInstanceOf(RegistrationError);
        return { missing: (e as RegistrationError).missing, message: (e as Error).message };
      }
      throw new Error('expected the definition to be refused');
    };

    expect(missingOf(() => reg.define('y', { width: 0.2, say: '', caption: '' }))).toEqual({
      missing: ['say', 'caption'],
      message: "Object 'y' has no spoken name and no caption.",
    });
    expect(missingOf(() => reg.define('z', { width: 0.2, sound: { hz: 0, wave: 'sine' } }))).toEqual({
      missing: ['sound'],
      message: "Object 'z' has no sound.",
    });
    expect(reg.names()).toEqual([]); // nothing half-registered
  });

  it('rejects empty names, duplicates and bad widths', () => {
    const reg = createRegistry();
    expect(() => reg.define('  ', { width: 0.2 })).toThrow(/needs a name/);
    reg.define('grave', { width: 0.2 });
    expect(() => reg.define('grave', { width: 0.2 })).toThrow(/already defined/);
    expect(() => reg.define('a', { width: 0 })).toThrow(/width above zero/);
    expect(() => reg.define('b', { width: [0.3, 0.1] })).toThrow(/width above zero/);
    expect(() => reg.define('c', { width: Number.NaN })).toThrow(/width above zero/);
  });

  it('lets a too-wide object register: the proof, not the registry, judges widths', () => {
    expect(() => createRegistry().define('crypt', { width: [0.9, 1.0] })).not.toThrow();
  });
});

describe('registry as a level source', () => {
  it('exposes width ranges for the generator', () => {
    const reg = createRegistry();
    reg.define('grave', { width: [0.16, 0.3] });
    reg.define('fence', { width: [0.12, 0.24] });
    expect(reg.kinds()).toEqual([
      { name: 'grave', width: [0.16, 0.3] },
      { name: 'fence', width: [0.12, 0.24] },
    ]);
    expect(reg.get('fence')?.caption).toBe('Fence');
    expect(reg.get('nope')).toBeUndefined();
  });
});
