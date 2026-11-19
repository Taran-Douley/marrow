import {
  AdditiveBlending,
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { openings, type Cell, type Dir, type Maze } from '@marrow/skeleton';
import type { RoomInfo, RoomKind } from './content';
import { halo } from './glow';
import { CELL, WALL_HEIGHT, cellCentre } from './world';

// Each room has its own furniture, its own torch colour and its own sound (see content.ts). The
// middle of every room is kept clear, so the way through is never blocked and the view is never
// boxed in. Everything is made from simple shapes, in code.

const DIR_VECTOR = [
  { x: 0, z: -1 },
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
] as const;

export interface Torch {
  x: number;
  y: number;
  z: number;
  colour: number;
  flame: Mesh;
}

export interface RoomDressing {
  torches: Torch[];
  /** One per relic, in the maze's order, so a found relic can be put away. */
  relics: Group[];
}

const mat = (color: number, roughness = 0.8, emissive = 0, emissiveIntensity = 0): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness, metalness: 0, emissive, emissiveIntensity });

const box = (w: number, h: number, depth: number, material: MeshStandardMaterial, x = 0, y = h / 2, z = 0): Mesh => {
  const m = new Mesh(new BoxGeometry(w, h, depth), material);
  m.position.set(x, y, z);
  return m;
};

/** Spots around a room's edge, against its closed walls (or in its corners if every side is open). */
function spots(maze: Maze, cell: Cell, count: number): { x: number; z: number; rot: number }[] {
  const open = openings(maze, cell);
  const closed = ([0, 1, 2, 3] as Dir[]).filter((d) => !open.includes(d));
  const out: { x: number; z: number; rot: number }[] = [];
  for (let i = 0; i < count; i++) {
    if (closed.length > 0) {
      const d = closed[i % closed.length]!;
      const v = DIR_VECTOR[d];
      const side = DIR_VECTOR[((d + 1) % 4) as Dir];
      const along = (Math.floor(i / closed.length) % 2 === 0 ? 1 : -1) * 1.05;
      out.push({ x: v.x * 1.45 + side.x * along, z: v.z * 1.45 + side.z * along, rot: Math.atan2(-v.x, -v.z) });
    } else {
      const a = Math.PI / 4 + (i % 4) * (Math.PI / 2);
      out.push({ x: Math.cos(a) * 1.5, z: Math.sin(a) * 1.5, rot: -a + Math.PI / 2 });
    }
  }
  return out;
}

/** The furniture for one kind of room, placed around its edge. */
function furnish(kind: RoomKind, maze: Maze, cell: Cell, light: number): Group {
  const g = new Group();
  const wood = mat(0x3a2414, 0.7);
  const dark = mat(0x1d1612, 0.8);
  const iron = new MeshStandardMaterial({ color: 0x2a2826, roughness: 0.5, metalness: 0.7 });
  const place = (item: Group | Mesh, s: { x: number; z: number; rot: number }): void => {
    item.position.x += s.x;
    item.position.z += s.z;
    item.rotation.y = s.rot;
    g.add(item);
  };
  const at = spots(maze, cell, 4);
  const item = (): Group => new Group();

  switch (kind) {
    case 'library':
      for (const s of at.slice(0, 3)) {
        const shelf = item();
        shelf.add(box(1.6, 2.4, 0.36, wood));
        for (let r = 0; r < 4; r++) shelf.add(box(1.4, 0.36, 0.1, mat([0x6b2a2a, 0x2a4a5e, 0x4b5a2a, 0x5a3a1c][r]!, 0.9), 0, 0.4 + r * 0.55, 0.17));
        place(shelf, s);
      }
      break;
    case 'study': {
      const desk = item();
      desk.add(box(1.4, 0.08, 0.7, wood, 0, 0.78), box(0.08, 0.78, 0.08, wood, -0.6, 0.39, -0.28), box(0.08, 0.78, 0.08, wood, 0.6, 0.39, 0.28));
      desk.add(box(0.5, 0.04, 0.35, mat(0xd8cfb8), 0.1, 0.84)); // papers
      place(desk, at[0]!);
      const clock = item();
      clock.add(box(0.55, 2.1, 0.35, dark));
      const face = new Mesh(new CircleGeometry(0.2, 20), mat(0xe9e0c8, 0.6));
      face.position.set(0, 1.7, 0.18);
      clock.add(face);
      place(clock, at[1]!);
      break;
    }
    case 'cellar':
      for (const s of at.slice(0, 3)) {
        const barrel = new Mesh(new CylinderGeometry(0.35, 0.32, 0.85, 14), wood);
        barrel.position.y = 0.42;
        place(barrel, s);
      }
      {
        const puddle = new Mesh(new CircleGeometry(0.7, 20), new MeshStandardMaterial({ color: 0x14202e, roughness: 0.05, metalness: 0.6 }));
        puddle.rotation.x = -Math.PI / 2;
        puddle.position.set(at[3]!.x * 0.6, 0.012, at[3]!.z * 0.6);
        g.add(puddle);
      }
      break;
    case 'chapel': {
      const altar = item();
      altar.add(box(1.5, 0.9, 0.6, mat(0x5b4d5e, 0.9)));
      for (let i = -2; i <= 2; i++) {
        const candle = new Mesh(new CylinderGeometry(0.03, 0.035, 0.22, 8), mat(0xe9dfc8, 0.6));
        candle.position.set(i * 0.25, 1.01, 0);
        const flame = new Mesh(new SphereGeometry(0.035, 6, 6), new MeshBasicMaterial({ color: 0xffc46b }));
        flame.position.set(i * 0.25, 1.16, 0);
        altar.add(candle, flame);
      }
      place(altar, at[0]!);
      for (const s of at.slice(1, 3)) place(box(1.4, 0.5, 0.45, wood), s); // pews
      break;
    }
    case 'kitchen': {
      const hearth = item();
      hearth.add(box(1.6, 1.3, 0.5, mat(0x4a3a36, 0.95)));
      const fire = new Mesh(new PlaneGeometry(0.9, 0.5), new MeshBasicMaterial({ color: 0xff6a20 }));
      fire.position.set(0, 0.35, 0.26);
      hearth.add(fire);
      place(hearth, at[0]!);
      const table = item();
      table.add(box(1.2, 0.08, 0.8, wood, 0, 0.8), box(0.08, 0.8, 0.08, wood, -0.5, 0.4, -0.3), box(0.08, 0.8, 0.08, wood, 0.5, 0.4, 0.3));
      table.add(new Mesh(new CylinderGeometry(0.15, 0.12, 0.2, 10), iron));
      table.children.at(-1)!.position.set(0.2, 0.94, 0);
      place(table, at[1]!);
      break;
    }
    case 'nursery': {
      const cradle = item();
      cradle.add(box(0.9, 0.45, 0.5, mat(0xd8c8b0, 0.8), 0, 0.45));
      const rocker = new Mesh(new TorusGeometry(0.45, 0.03, 6, 20, Math.PI), wood);
      rocker.rotation.set(Math.PI, 0, 0);
      rocker.position.y = 0.25;
      cradle.add(rocker);
      place(cradle, at[0]!);
      const horse = item();
      horse.add(box(0.6, 0.3, 0.2, mat(0x8a3a2a, 0.8), 0, 0.6), box(0.15, 0.35, 0.15, mat(0x8a3a2a, 0.8), 0.3, 0.85));
      place(horse, at[1]!);
      for (let i = 0; i < 3; i++) g.add(box(0.2, 0.2, 0.2, mat([0xc0392b, 0x2a6ab0, 0xd9a441][i]!, 0.7), at[2]!.x * 0.8 + i * 0.25, 0.1, at[2]!.z * 0.8));
      break;
    }
    case 'ballroom': {
      const piano = item();
      piano.add(box(1.5, 1.0, 0.6, mat(0x0f0b0a, 0.3)));
      piano.add(box(1.3, 0.04, 0.2, mat(0xeee8dc, 0.4), 0, 0.75, 0.35));
      place(piano, at[0]!);
      const rug = new Mesh(new PlaneGeometry(2.8, 2.8), mat(0x4a1830, 1));
      rug.rotation.x = -Math.PI / 2;
      rug.position.y = 0.014;
      g.add(rug);
      break;
    }
    case 'gallery':
      for (const s of at) {
        const frame = item();
        frame.add(box(0.9, 1.2, 0.08, mat(0x6b4a1c, 0.5), 0, 1.7));
        frame.add(box(0.7, 0.95, 0.02, mat([0x3a4a5a, 0x5a3a3a, 0x3a5a3a, 0x4a3a5a][at.indexOf(s)]!, 0.9), 0, 1.7, 0.05));
        place(frame, s);
      }
      break;
    case 'conservatory':
      for (const s of at.slice(0, 3)) {
        const plant = item();
        plant.add(new Mesh(new CylinderGeometry(0.25, 0.2, 0.4, 10), mat(0x7a4a2a, 0.9)));
        plant.children[0]!.position.y = 0.2;
        const leaves = new Mesh(new ConeGeometry(0.45, 1.3, 8), mat(0x2f5a32, 0.9));
        leaves.position.y = 1.05;
        plant.add(leaves);
        place(plant, s);
      }
      break;
    case 'entrance': {
      const stand = item();
      stand.add(box(0.08, 1.8, 0.08, wood, 0, 0.9), box(0.5, 0.05, 0.05, wood, 0, 1.75));
      place(stand, at[0]!);
      const mat2 = new Mesh(new PlaneGeometry(1.6, 1.0), mat(0x3a2a1a, 1));
      mat2.rotation.x = -Math.PI / 2;
      mat2.position.y = 0.013;
      g.add(mat2);
      break;
    }
    case 'front-hall': {
      const rug = new Mesh(new PlaneGeometry(2.6, 2.6), mat(0x5a1626, 1));
      rug.rotation.x = -Math.PI / 2;
      rug.position.y = 0.014;
      g.add(rug);
      break;
    }
  }
  // A faint wash of the room's own colour on the floor, so each room reads as a place.
  const wash = new Mesh(new CircleGeometry(1.8, 24), new MeshBasicMaterial({ color: light, transparent: true, opacity: 0.06, blending: AdditiveBlending, depthWrite: false }));
  wash.rotation.x = -Math.PI / 2;
  wash.position.y = 0.02;
  g.add(wash);
  return g;
}

/** A tall wardrobe to hide in. */
function wardrobe(): Group {
  const g = new Group();
  const wood = mat(0x2a1a10, 0.7);
  g.add(box(1.0, 2.3, 0.6, wood));
  g.add(box(0.02, 2.0, 0.02, mat(0x0a0705), 0, 1.15, 0.31)); // the gap between the doors
  g.add(box(0.05, 0.12, 0.05, new MeshStandardMaterial({ color: 0xb08a3a, metalness: 0.8, roughness: 0.3 }), 0.08, 1.2, 0.32));
  return g;
}

const RELIC_LOOKS = [
  { colour: 0xe8edf5, glow: 0xbfd6ff },
  { colour: 0xd9a441, glow: 0xffd27a },
  { colour: 0xb06bd0, glow: 0xd99aff },
] as const;

/** A relic on a small stand, glowing so it can be seen across the room. */
function relic(index: number): Group {
  const look = RELIC_LOOKS[index % RELIC_LOOKS.length]!;
  const g = new Group();
  g.add(box(0.5, 0.9, 0.5, mat(0x3a3440, 0.9)));
  const glowMat = new MeshStandardMaterial({ color: look.colour, emissive: look.glow, emissiveIntensity: 1.4, roughness: 0.3, metalness: 0.5 });
  let piece: Mesh;
  if (index === 0) piece = new Mesh(new CylinderGeometry(0.06, 0.07, 0.4, 10), glowMat); // the candle
  else if (index === 1) piece = new Mesh(new TorusGeometry(0.12, 0.035, 8, 20), glowMat); // the locket
  else piece = new Mesh(new ConeGeometry(0.16, 0.12, 3), glowMat); // the planchette
  piece.position.y = 1.1;
  g.add(piece);
  const h = halo(look.glow, 1.2, 0.6);
  h.position.y = 1.1;
  g.add(h);
  return g;
}

/** Dress every room: its furniture, a torch on a wall, a wardrobe where you can hide, and the relics. */
export function dressRooms(group: Group, maze: Maze, rooms: readonly RoomInfo[]): RoomDressing {
  const torches: Torch[] = [];
  const relics: Group[] = maze.relics.map(() => new Group());
  maze.rooms.forEach((cell, i) => {
    const info = rooms[i];
    if (!info) return;
    const { x, z } = cellCentre(cell);
    const furniture = furnish(info.kind, maze, cell, info.style.light);
    furniture.position.set(x, 0, z);
    group.add(furniture);

    // A torch on a closed wall (or at a corner), throwing the room's own colour.
    const open = openings(maze, cell);
    const wall = ([0, 1, 2, 3] as Dir[]).find((d) => !open.includes(d));
    const v = wall === undefined ? { x: 0.7, z: 0.7 } : DIR_VECTOR[wall];
    const tx = x + v.x * (CELL / 2 - 0.22);
    const tz = z + v.z * (CELL / 2 - 0.22);
    const ty = WALL_HEIGHT * 0.62;
    const bracket = new Mesh(new BoxGeometry(0.08, 0.4, 0.08), new MeshStandardMaterial({ color: 0x1a1816, metalness: 0.7, roughness: 0.4 }));
    bracket.position.set(tx, ty - 0.2, tz);
    const flame = new Mesh(new SphereGeometry(0.09, 8, 8), new MeshBasicMaterial({ color: info.style.light }));
    flame.position.set(tx, ty + 0.05, tz);
    const h = halo(info.style.light, 0.9, 0.7);
    h.position.copy(flame.position);
    group.add(bracket, flame, h);
    torches.push({ x: tx, y: ty, z: tz, colour: info.style.light, flame });

    // A wardrobe in a room with somewhere to hide.
    if (maze.hides.some((c) => c.x === cell.x && c.y === cell.y)) {
      const s = spots(maze, cell, 4)[3]!;
      const w = wardrobe();
      w.position.set(x + s.x, 0, z + s.z);
      w.rotation.y = s.rot;
      group.add(w);
    }
  });
  maze.relics.forEach((cell, i) => {
    const { x, z } = cellCentre(cell);
    const s = spots(maze, cell, 4)[2]!;
    const r = relic(i);
    r.position.set(x + s.x * 0.8, 0, z + s.z * 0.8);
    relics[i] = r;
    group.add(r);
  });
  return { torches, relics };
}
