import { describe, expect, it } from 'vitest';
import { generateMaze, openings, type Maze } from '@marrow/skeleton';
import { CELL, buildHouse, cellCentre, ease, layoutHouse, shortestAngle, yawFor } from '../src/world';
import { MAX_FLICKER_HZ, fastestFlickerHz, lookAngleOf, wrapRelative } from '../src/view3d';
import { nameRooms } from '../src/content';

describe('the 3D house layout', () => {
  it('is the same house for the same seed, and a different one for another', () => {
    expect(layoutHouse(generateMaze(5))).toEqual(layoutHouse(generateMaze(5)));
    expect(layoutHouse(generateMaze(5))).not.toEqual(layoutHouse(generateMaze(6)));
  });

  it('puts a wall exactly where the maze has no passage, so every way you can walk is open', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const maze = generateMaze(seed);
      const layout = layoutHouse(maze);
      const hasWall = (x: number, z: number): boolean => layout.walls.some((w) => Math.abs(w.x - x) < 0.01 && Math.abs(w.z - z) < 0.01);
      for (let y = 0; y < maze.height; y++) {
        for (let x = 0; x < maze.width; x++) {
          const { x: cx, z: cz } = cellCentre({ x, y });
          const open = openings(maze, { x, y });
          expect(hasWall(cx, cz - CELL / 2), `seed ${seed} (${x},${y}) north`).toBe(!open.includes(0));
          expect(hasWall(cx - CELL / 2, cz), `seed ${seed} (${x},${y}) west`).toBe(!open.includes(3));
          if (y === maze.height - 1) expect(hasWall(cx, cz + CELL / 2)).toBe(!open.includes(2));
          if (x === maze.width - 1) expect(hasWall(cx + CELL / 2, cz)).toBe(!open.includes(1));
        }
      }
    }
  });

  it('keeps furnishings out of the middle of every room, so the way through is clear', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const layout = layoutHouse(generateMaze(seed));
      for (const p of layout.props) {
        if (p.kind === 'rug' || p.kind === 'chandelier') continue; // a rug lies flat, and a chandelier hangs overhead
        const cx = Math.round(p.x / CELL) * CELL;
        const cz = Math.round(p.z / CELL) * CELL;
        expect(Math.hypot(p.x - cx, p.z - cz), `${p.kind} in seed ${seed}`).toBeGreaterThan(0.9);
      }
    }
  });

  it('has a good mix of furnishings across houses, with cobwebs in corners and chandeliers over crossings', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const maze = generateMaze(seed);
      for (const p of layoutHouse(maze).props) {
        seen.add(p.kind);
        const here = { x: Math.round(p.x / CELL), y: Math.round(p.z / CELL) };
        if (p.kind === 'chandelier') expect(openings(maze, here).length, `chandelier seed ${seed}`).toBeGreaterThanOrEqual(3);
        if (p.kind === 'cobweb') {
          // A cobweb is off-centre by a diagonal: it sits in a corner of its room.
          const room = { x: Math.round(p.x / CELL), y: Math.round(p.z / CELL) };
          expect(Math.hypot(p.x - room.x * CELL, p.z - room.y * CELL)).toBeGreaterThan(1.8);
        }
      }
    }
    for (const kind of ['frame', 'bookcase', 'barrel', 'skull', 'candle', 'crate', 'rug', 'chandelier', 'cobweb']) expect(seen.has(kind), kind).toBe(true);
  });

  it('builds the world without a screen: walls, floor, ceiling, props, the bell and the phantom', () => {
    const maze = generateMaze(9);
    const house = buildHouse(maze, { wall: null, floor: null, ceiling: null });
    expect(house.stats.walls).toBeGreaterThan(maze.width * maze.height * 0.5);
    expect(house.group.children.length).toBeGreaterThan(house.stats.props);
    const exit = cellCentre(maze.exit);
    expect(house.bell.position.x).toBe(exit.x);
    expect(house.bell.position.z).toBe(exit.z);
    const ghost = cellCentre(maze.ghost);
    expect(house.phantom.position.x).toBe(ghost.x);
    expect(house.phantom.position.z).toBe(ghost.z);
  });

  it('builds houses of every size the game offers', () => {
    for (const side of [6, 8, 10]) {
      const maze: Maze = generateMaze(3, { width: side, height: side });
      expect(() => buildHouse(maze, { wall: null, floor: null, ceiling: null })).not.toThrow();
    }
  });
});

describe('dust', () => {
  it('wraps a distance into a box around the player', () => {
    expect(wrapRelative(0, 14)).toBe(0);
    expect(wrapRelative(8, 14)).toBeCloseTo(-6);
    expect(wrapRelative(-8, 14)).toBeCloseTo(6);
    for (const v of [-1234.5, -7, 7, 3, 999.9]) {
      const w = wrapRelative(v, 14);
      expect(w).toBeGreaterThanOrEqual(-7);
      expect(w).toBeLessThan(7);
    }
  });
});

describe('camera maths', () => {
  it('faces each direction, and turns toward an option on the right by turning clockwise', () => {
    expect(yawFor(0)).toBeCloseTo(0);
    expect(yawFor(1)).toBeCloseTo(-Math.PI / 2);
    expect(yawFor(2)).toBeCloseTo(-Math.PI);
    // Facing north, the option on the right is east: the same as facing east.
    expect(yawFor(0, 90)).toBeCloseTo(yawFor(1));
    expect(yawFor(1, -90)).toBeCloseTo(yawFor(0));
  });

  it('turns the short way round', () => {
    expect(shortestAngle(0, Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2);
    expect(shortestAngle(3, 3.5)).toBeCloseTo(0.5);
    expect(Math.abs(shortestAngle(-3, 3))).toBeLessThan(Math.PI);
  });

  it('eases toward a target and never past it', () => {
    let v = 0;
    for (let i = 0; i < 60; i++) v = ease(v, 10, 1 / 60, 5);
    expect(v).toBeGreaterThan(5);
    expect(v).toBeLessThan(10);
    expect(ease(1, 5, 0, 5)).toBe(1);
  });

  it('looks at the lit option only while choosing', () => {
    const options = [
      { id: 'dir:1', label: 'Right', angle: 90 },
      { id: 'listen', label: 'Listen' },
    ];
    expect(lookAngleOf({ phase: 'choosing', options, lit: 'dir:1' })).toBe(90);
    expect(lookAngleOf({ phase: 'choosing', options, lit: 'listen' })).toBe(0);
    expect(lookAngleOf({ phase: 'walking', options, lit: 'dir:1' })).toBe(0);
    expect(lookAngleOf({ phase: 'choosing', options, lit: null })).toBe(0);
  });
});

describe('the look of the house', () => {
  const plain = { wall: null, floor: null, ceiling: null };

  it('has wainscoting, skirting, door frames and soft shadows, each as one instanced mesh for the whole house', () => {
    const maze = generateMaze(9, { width: 12, height: 10, relics: 3 });
    const house = buildHouse(maze, plain);
    const instanced = house.group.children.filter((c) => (c as { isInstancedMesh?: boolean }).isInstancedMesh);
    // walls, beams, three trims, posts, lintels, shadow blots
    expect(instanced.length).toBeGreaterThanOrEqual(8);
    expect(house.phantomGlow).toHaveLength(2);
  });

  it('keeps the number of things drawn modest for a laptop, in the standard house', () => {
    for (const seed of [1, 2, 3]) {
      const maze = generateMaze(seed, { width: 12, height: 10, relics: 3 });
      const house = buildHouse(maze, plain, nameRooms(maze));
      let drawn = 0;
      house.group.traverse((o) => {
        const d = o as { isMesh?: boolean; isSprite?: boolean; isInstancedMesh?: boolean; visible: boolean };
        if ((d.isMesh || d.isSprite) && d.visible) drawn += 1;
      });
      expect(drawn, `seed ${seed}`).toBeLessThan(1500);
    }
  });

  it('nothing flickers more than three times a second', () => {
    expect(fastestFlickerHz()).toBeLessThanOrEqual(MAX_FLICKER_HZ);
  });
});
