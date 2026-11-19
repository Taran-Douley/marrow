import { describe, expect, it } from 'vitest';
import { cuesAudible, generateMaze, proveMaze, trackClearOfCues, validateTrack, type OutputCommand, type SemanticEvent } from '@marrow/skeleton';
import { MABEL, RELICS, ROOM_STYLES, WHISPERS, nameRooms } from '../src/content';
import { GUIDE } from '../src/guide';
import { CHASE_TRACK, FRIGHTS, createSeanceKit } from '../src/kit';
import { buildHouse } from '../src/world';

const house = (seed = 3) => generateMaze(seed, { width: 8, height: 8, relics: 3 });
type Sound = Extract<OutputCommand, { channel: 'sound' }>;
const at = (type: string, data?: Record<string, unknown>, t = 0): SemanticEvent => (data ? { type, at: t, data } : { type, at: t });

describe('the ritual house', () => {
  it('every house the game serves passes the whole proof, ritual included', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const r of proveMaze(house(seed))) expect(r.pass, `house ${seed}: ${r.name}`).toBe(true);
    }
  });

  it('names every room: the entrance, the front hall, and each other room uniquely, the same way every time', () => {
    const m = house();
    const rooms = nameRooms(m);
    expect(rooms).toHaveLength(m.rooms.length);
    expect(rooms.filter((r) => r.kind === 'entrance')).toHaveLength(1);
    expect(rooms.filter((r) => r.kind === 'front-hall')).toHaveLength(1);
    expect(new Set(rooms.map((r) => r.name)).size).toBe(rooms.length);
    expect(nameRooms(m)).toEqual(rooms);
    expect(nameRooms(house(4)).map((r) => r.name)).not.toEqual(rooms.map((r) => r.name));
  });

  it('every wandering room has its own sound, a name, and a torch colour', () => {
    for (const [kind, style] of Object.entries(ROOM_STYLES)) {
      expect(style.name.length, kind).toBeGreaterThan(2);
      if (kind !== 'entrance' && kind !== 'front-hall') expect(style.sound, kind).not.toBeNull();
    }
    expect(new Set(Object.values(ROOM_STYLES).map((s) => s.light)).size).toBeGreaterThan(6);
  });

  it('the story and Mabel speak in plain words', () => {
    expect(WHISPERS.length).toBeGreaterThanOrEqual(4);
    expect(MABEL.relic('The Locket', 1, 3)).toBe('The Locket! 2 more to find, dear.');
    expect(MABEL.relic('The Locket', 2, 3)).toBe('The Locket! Just one more, dear.');
    expect(MABEL.hint('relic', 'left', 3)).toBe('I can feel a relic 3 rooms away. Go left.');
    expect(MABEL.hint('exit', 'back', 1)).toBe('The bell is 1 room away. Turn back, quickly!');
    expect(MABEL.sealed(2)).toMatch(/2 to go/);
  });

  it('the 3D house has a torch in every room, the three relics, and wardrobes where you can hide', () => {
    const m = house();
    const built = buildHouse(m, { wall: null, floor: null, ceiling: null }, nameRooms(m));
    expect(built.torches).toHaveLength(m.rooms.length);
    expect(built.relics).toHaveLength(3);
    expect(built.relics.every((r) => r.children.length > 0)).toBe(true);
  });
});

describe('the sound guide', () => {
  it('opens with Enter the house, and every other item says what its sound means and plays it', () => {
    expect(GUIDE[0]!.id).toBe('enter');
    for (const item of GUIDE.slice(1)) {
      expect(item.line.length, item.id).toBeGreaterThan(40);
      expect(item.demo.length, item.id).toBeGreaterThan(0);
    }
  });

  it('every sound it plays exists in the game', () => {
    const kit = createSeanceKit();
    for (const item of GUIDE) {
      for (const d of item.demo) {
        const type = d.type === 'relic-sense' ? 'relic-sense-0' : d.type;
        expect(kit.render(at(type, d.data)).some((c) => c.channel === 'sound'), `${item.id}: ${type}`).toBe(true);
      }
    }
  });
});

describe('fright', () => {
  it('every event reaches two senses at every fright setting', () => {
    for (const fright of FRIGHTS) {
      const r = createSeanceKit({ fright }).proveEvents();
      expect(r.counterexamples ?? [], fright).toEqual([]);
    }
  });

  it('gentle softens the scares, off removes them, and no information is lost', () => {
    const loud = (fright: (typeof FRIGHTS)[number], type: string) =>
      createSeanceKit({ fright })
        .render(at(type, { angle: 0, distance: 0.3 }))
        .filter((c): c is Sound => c.channel === 'sound')
        .reduce((m, s) => Math.max(m, s.gain), 0);
    for (const type of ['ghost-hunts', 'caught', 'ghost-searched']) {
      expect(loud('gentle', type), type).toBeLessThan(loud('full', type));
      expect(loud('off', type), type).toBeLessThan(loud('gentle', type) + 1e-9);
    }
    // The words and the touch are there at every setting.
    for (const fright of FRIGHTS) {
      const cmds = createSeanceKit({ fright }).render(at('ghost-hunts', { angle: 0, distance: 0.3 }));
      expect(cmds.some((c) => c.channel === 'captions'), fright).toBe(true);
      expect(cmds.some((c) => c.channel === 'haptics'), fright).toBe(true);
    }
  });
});

describe('sounds of the ritual', () => {
  const kit = createSeanceKit();
  it('each relic hums in its own pitch, from where it lies', () => {
    const hums = RELICS.map((_, i) => kit.render(at(`relic-sense-${i}`, { angle: 90, distance: 0.4 })).find((c): c is Sound => c.channel === 'sound')!);
    expect(new Set(hums.map((h) => h.hz)).size).toBe(3);
    expect(hums.every((h) => (h.space?.x ?? 0) > 0)).toBe(true);
  });

  it('rooms sound from where they are, quietly, and never ask anything of you', () => {
    for (const [kind, style] of Object.entries(ROOM_STYLES)) {
      if (!style.sound) continue;
      const s = kit.render(at(`room-${kind}`, { angle: -90, distance: 0.5 })).find((c): c is Sound => c.channel === 'sound')!;
      expect(s.role, kind).toBe('effect');
      expect(s.space?.x ?? 0, kind).toBeLessThan(0);
    }
  });

  it('the chase has its own driving music, valid and under the crossing bell, stepping aside for cues', () => {
    expect(() => validateTrack(CHASE_TRACK)).not.toThrow();
    const chase = createSeanceKit({ chase: true });
    const cmds = [
      ...chase.render(at('atmosphere', { bar: 0, tension: 0.6, span: 2, quiet: [[0, 2.5]], pulse: 0 })),
      ...chase.render(at('heartbeat', undefined, 0.4)),
      ...chase.render(at('exit-sense', { angle: 0, distance: 0.8 }, 0.9)),
      ...chase.render(at('walk-crossing', { count: 2 }, 1.2)),
    ];
    expect(cuesAudible(cmds).counterexamples ?? []).toEqual([]);
    expect(trackClearOfCues(cmds).counterexamples ?? []).toEqual([]);
  });
});
