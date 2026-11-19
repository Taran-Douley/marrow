import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
  Sprite,
  TorusGeometry,
  Vector2,
  Vector3,
  type Texture,
} from 'three';
import { openings, type Cell, type Dir, type Maze } from '@marrow/skeleton';
import type { RoomInfo } from './content';
import { glow, halo, shadow } from './glow';
import { dressRooms, type Torch } from './rooms3d';

// The haunted house as a 3D world. Everything is made in code: shapes from simple geometry,
// textures painted on a canvas. The layout is plain data first (testable without a screen),
// and the three.js objects are built from it.

/** One room is this many metres across. */
export const CELL = 4;
export const WALL_HEIGHT = 3.2;
const WALL_THICKNESS = 0.35;
export const EYE_HEIGHT = 1.55;

export interface WallSegment {
  x: number;
  z: number;
  /** Size along x and z. */
  w: number;
  d: number;
}

export interface Prop {
  kind: 'frame' | 'candle' | 'crate' | 'rug' | 'bookcase' | 'barrel' | 'skull' | 'chandelier' | 'cobweb';
  x: number;
  z: number;
  /** Turn about the up axis, in radians. */
  rot: number;
  /** A number 0 to 1 for small differences (size, shade). */
  variety: number;
}

export interface HouseLayout {
  walls: WallSegment[];
  props: Prop[];
  width: number;
  depth: number;
}

export const cellCentre = (c: Cell): { x: number; z: number } => ({ x: c.x * CELL, z: c.y * CELL });

/** A small seeded random number generator. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIR_VECTOR = [
  { x: 0, z: -1 },
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
] as const;

/** The walls and furnishings of a house. The same maze always gives the same house. */
export function layoutHouse(maze: Maze): HouseLayout {
  const rand = prng(maze.seed ^ 0x9e3779b9);
  const walls: WallSegment[] = [];
  const props: Prop[] = [];
  const long = CELL + WALL_THICKNESS;

  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const here = { x, y };
      const open = openings(maze, here);
      const { x: cx, z: cz } = cellCentre(here);
      // Each wall is built once: north and west of every room, then south and east on the outer edge.
      if (!open.includes(0)) walls.push({ x: cx, z: cz - CELL / 2, w: long, d: WALL_THICKNESS });
      if (!open.includes(3)) walls.push({ x: cx - CELL / 2, z: cz, w: WALL_THICKNESS, d: long });
      if (y === maze.height - 1 && !open.includes(2)) walls.push({ x: cx, z: cz + CELL / 2, w: long, d: WALL_THICKNESS });
      if (x === maze.width - 1 && !open.includes(1)) walls.push({ x: cx + CELL / 2, z: cz, w: WALL_THICKNESS, d: long });

      // Furnishings sit against a wall, never in the middle, so the way through is always clear.
      const closed = ([0, 1, 2, 3] as Dir[]).filter((d) => !open.includes(d));
      const isStart = x === maze.start.x && y === maze.start.y;
      const isExit = x === maze.exit.x && y === maze.exit.y;
      if (closed.length > 0 && !isExit) {
        const d = closed[Math.floor(rand() * closed.length)]!;
        const v = DIR_VECTOR[d];
        const wallRoll = rand();
        if (wallRoll < 0.3 || (wallRoll >= 0.3 && wallRoll < 0.42)) {
          // A portrait, or a bookcase, flat against the wall.
          const kind = wallRoll < 0.3 ? 'frame' : 'bookcase';
          props.push({ kind, x: cx + v.x * (CELL / 2 - (kind === 'frame' ? 0.25 : 0.3)), z: cz + v.z * (CELL / 2 - (kind === 'frame' ? 0.25 : 0.3)), rot: Math.atan2(-v.x, -v.z), variety: rand() });
        }
        const cornerRoll = rand();
        if (cornerRoll < 0.34) {
          // Something in a corner of the room: a crate, a candle, a barrel or a skull.
          const side = DIR_VECTOR[((d + 1) % 4) as Dir];
          const kind = cornerRoll < 0.1 ? 'crate' : cornerRoll < 0.2 ? 'candle' : cornerRoll < 0.28 ? 'barrel' : 'skull';
          props.push({
            kind,
            x: cx + v.x * (CELL / 2 - 0.55) + side.x * (CELL / 2 - 0.6) * (rand() < 0.5 ? 1 : -1),
            z: cz + v.z * (CELL / 2 - 0.55) + side.z * (CELL / 2 - 0.6) * (rand() < 0.5 ? 1 : -1),
            rot: rand() * Math.PI,
            variety: rand(),
          });
        }
      }
      // Cobwebs where two closed walls meet, up in the corner.
      for (const d of closed) {
        const e = ((d + 1) % 4) as Dir;
        if (!closed.includes(e) || rand() > 0.7) continue;
        const a = DIR_VECTOR[d];
        const b = DIR_VECTOR[e];
        const toward = { x: -(a.x + b.x) / Math.SQRT2, z: -(a.z + b.z) / Math.SQRT2 };
        props.push({
          kind: 'cobweb',
          x: cx + (a.x + b.x) * (CELL / 2) + toward.x * 0.75,
          z: cz + (a.z + b.z) * (CELL / 2) + toward.z * 0.75,
          rot: Math.atan2(toward.x, toward.z),
          variety: rand(),
        });
      }
      // A chandelier over about half of the crossings, hanging in the middle where nothing stands.
      if (open.length >= 3 && !isExit && rand() < 0.5) props.push({ kind: 'chandelier', x: cx, z: cz, rot: rand() * Math.PI, variety: rand() });
      // A rug at each crossing, a candle at each dead end: a way to tell places apart by sight.
      if (open.length >= 3 && !isStart) props.push({ kind: 'rug', x: cx, z: cz, rot: rand() < 0.5 ? 0 : Math.PI / 2, variety: rand() });
      if (open.length === 1 && !isExit && !isStart) {
        const back = DIR_VECTOR[closed[0]!];
        props.push({ kind: 'candle', x: cx + back.x * 1.3, z: cz + back.z * 1.3, rot: 0, variety: rand() });
      }
    }
  }
  return { walls, props, width: maze.width * CELL, depth: maze.height * CELL };
}

// ---- movement helpers (pure) ------------------------------------------------

/** The camera's turn about the up axis, in radians. Facing 0 is north (-z); a quarter turn per facing; `lookDeg` turns further right. */
export const yawFor = (facing: Dir, lookDeg = 0): number => (-(facing * 90 + lookDeg) * Math.PI) / 180;

/** The shortest signed turn from one angle to another, in radians. */
export function shortestAngle(from: number, to: number): number {
  const full = Math.PI * 2;
  return ((((to - from) % full) + full + Math.PI) % full) - Math.PI;
}

/** Move a number toward a target with a smooth ease. `rate` is how fast, per second. */
export const ease = (current: number, target: number, dt: number, rate: number): number =>
  current + (target - current) * (1 - Math.exp(-Math.max(0, dt) * rate));

// ---- painted textures -------------------------------------------------------

export interface HouseTextures {
  wall: Texture | null;
  floor: Texture | null;
  ceiling: Texture | null;
  /** A cobweb with clear gaps. */
  web?: Texture | null;
  /** A woven rug with a border and a pattern. */
  rug?: Texture | null;
  /** Dark wood grain, for panelling and door frames. */
  wood?: Texture | null;
}

function paint(size: number, draw: (g: CanvasRenderingContext2D) => void, repeat: [number, number]): Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  // A page without a working 2D canvas (a test, an old browser) gets plain colours instead.
  if (!g || typeof g.createLinearGradient !== 'function') return null;
  try {
    draw(g);
  } catch {
    return null;
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function speckle(g: CanvasRenderingContext2D, size: number, rand: () => number, count: number, light: string, dark: string): void {
  for (let i = 0; i < count; i++) {
    g.fillStyle = rand() < 0.5 ? light : dark;
    g.globalAlpha = 0.05 + rand() * 0.12;
    g.fillRect(rand() * size, rand() * size, 1 + rand() * 3, 1 + rand() * 3);
  }
  g.globalAlpha = 1;
}

/** Paint the wall, floor and ceiling. Returns nulls where there is no canvas, and the house is then plain-coloured. */
export function paintTextures(seed = 1): HouseTextures {
  const rand = prng(seed);
  const wall = paint(
    256,
    (g) => {
      g.fillStyle = '#4a3b4d';
      g.fillRect(0, 0, 256, 256);
      const rows = 8;
      const h = 256 / rows;
      for (let r = 0; r < rows; r++) {
        const offset = r % 2 === 0 ? 0 : 32;
        for (let c = -1; c < 5; c++) {
          const shade = 70 + Math.floor(rand() * 30);
          g.fillStyle = `rgb(${shade + 8},${shade - 6},${shade + 16})`;
          g.fillRect(c * 64 + offset + 2, r * h + 2, 60, h - 4);
        }
      }
      g.fillStyle = '#1b1520';
      for (let r = 0; r <= rows; r++) g.fillRect(0, r * h - 1, 256, 3);
      speckle(g, 256, rand, 500, '#c9bfd6', '#0d0912');
      // Damp stains, running down from the top.
      const stain = g.createLinearGradient(0, 0, 0, 256);
      stain.addColorStop(0, 'rgba(10,6,16,0.35)');
      stain.addColorStop(0.5, 'rgba(10,6,16,0)');
      g.fillStyle = stain;
      g.fillRect(0, 0, 256, 256);
    },
    [1, 1],
  );
  const floor = paint(
    256,
    (g) => {
      g.fillStyle = '#2a1d1a';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 8; i++) {
        const shade = 44 + Math.floor(rand() * 26);
        g.fillStyle = `rgb(${shade + 14},${shade},${shade - 8})`;
        g.fillRect(i * 32 + 1, 0, 30, 256);
        // Grain along the board, and a knot now and then.
        g.lineWidth = 1;
        for (let k = 0; k < 5; k++) {
          const gx = i * 32 + 3 + rand() * 26;
          g.strokeStyle = rand() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,225,190,0.08)';
          g.beginPath();
          g.moveTo(gx, 0);
          for (let y = 0; y < 256; y += 16) g.lineTo(gx + Math.sin(y * 0.06 + k) * 1.4, y);
          g.stroke();
        }
        if (rand() < 0.4) {
          g.strokeStyle = 'rgba(10,5,3,0.6)';
          const kx = i * 32 + 8 + rand() * 16;
          const ky = rand() * 256;
          for (let r = 2; r <= 5; r += 1.5) {
            g.beginPath();
            g.ellipse(kx, ky, r * 0.8, r * 1.6, 0, 0, Math.PI * 2);
            g.stroke();
          }
        }
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.fillRect(i * 32 - 1, 0, 3, 256);
        for (let k = 0; k < 3; k++) g.fillRect(i * 32 + 2, rand() * 256, 28, 2);
      }
      speckle(g, 256, rand, 400, '#a08a74', '#0d0805');
    },
    [CELL / 2, CELL / 2],
  );
  const ceiling = paint(
    128,
    (g) => {
      g.fillStyle = '#1c1722';
      g.fillRect(0, 0, 128, 128);
      speckle(g, 128, rand, 200, '#8f84a0', '#050308');
    },
    [CELL, CELL],
  );
  // A cobweb: threads fanning down from the top middle, joined by sagging rings. Clear everywhere else.
  const web = paint(
    256,
    (g) => {
      g.clearRect(0, 0, 256, 256);
      g.strokeStyle = 'rgba(235,235,245,0.85)';
      g.lineWidth = 1.4;
      const spokes = 9;
      for (let i = 0; i < spokes; i++) {
        const a = (-0.5 + i / (spokes - 1)) * Math.PI * 0.95; // fan of angles, 0 straight down
        g.beginPath();
        g.moveTo(128, 0);
        g.lineTo(128 + Math.sin(a) * 250, Math.cos(a) * 250);
        g.stroke();
      }
      for (let ring = 1; ring <= 6; ring++) {
        const r = ring * 38;
        g.beginPath();
        for (let i = 0; i < spokes; i++) {
          const a = (-0.5 + i / (spokes - 1)) * Math.PI * 0.95;
          const x = 128 + Math.sin(a) * r;
          const y = Math.cos(a) * r;
          if (i === 0) g.moveTo(x, y);
          else {
            const pa = (-0.5 + (i - 0.5) / (spokes - 1)) * Math.PI * 0.95;
            g.quadraticCurveTo(128 + Math.sin(pa) * r * 0.9, Math.cos(pa) * r * 0.9, x, y); // each thread sags toward the corner
          }
        }
        g.stroke();
      }
    },
    [1, 1],
  );
  // A rug: a deep red field, a gold border, a diamond in the middle, and a worn, fringed edge.
  const rug = paint(
    128,
    (g) => {
      g.fillStyle = '#4a1220';
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#b8903c';
      g.lineWidth = 4;
      g.strokeRect(8, 8, 112, 112);
      g.lineWidth = 2;
      g.strokeStyle = '#7a2a3a';
      g.strokeRect(16, 16, 96, 96);
      g.fillStyle = '#7a2a3a';
      g.beginPath();
      g.moveTo(64, 26);
      g.lineTo(102, 64);
      g.lineTo(64, 102);
      g.lineTo(26, 64);
      g.closePath();
      g.fill();
      g.strokeStyle = '#b8903c';
      g.stroke();
      g.fillStyle = '#b8903c';
      g.beginPath();
      g.arc(64, 64, 7, 0, Math.PI * 2);
      g.fill();
      speckle(g, 128, rand, 300, '#d9c29a', '#12060a');
      g.fillStyle = '#d9c9a8';
      for (let x = 2; x < 128; x += 5) {
        g.fillRect(x, 0, 2, 4);
        g.fillRect(x, 124, 2, 4);
      }
    },
    [1, 1],
  );
  // Dark wood with long grain, for panelling and frames.
  const wood = paint(
    128,
    (g) => {
      g.fillStyle = '#34200f';
      g.fillRect(0, 0, 128, 128);
      for (let k = 0; k < 26; k++) {
        g.strokeStyle = rand() < 0.5 ? 'rgba(0,0,0,0.3)' : 'rgba(210,160,110,0.09)';
        g.lineWidth = 1 + rand();
        const y = rand() * 128;
        g.beginPath();
        g.moveTo(0, y);
        for (let x = 0; x <= 128; x += 16) g.lineTo(x, y + Math.sin(x * 0.07 + k) * 2.2);
        g.stroke();
      }
      speckle(g, 128, rand, 120, '#b08a60', '#080402');
    },
    [1, 1],
  );
  return { wall, floor, ceiling, web, rug, wood };
}

// ---- the three.js world -----------------------------------------------------

export interface House {
  group: Group;
  /** The phantom, to be moved by the view. */
  phantom: Group;
  phantomLight: PointLight;
  /** The glow around the phantom. */
  phantomAura: Sprite;
  /** The rest of its glow (outer halo, floor pool), tinted with the aura. */
  phantomGlow: (Sprite | Mesh)[];
  exitLight: PointLight;
  bell: Mesh;
  /** A torch in every room, so the view can light the nearest. */
  torches: Torch[];
  /** The relics, in the maze's order, to put away once found. */
  relics: Group[];
  /** The number of things drawn, for tests and for care about speed. */
  stats: { walls: number; props: number };
}

/** The bell: a lathe shape, from its rim up to the top. */
function bellGeometry(): LatheGeometry {
  const profile = [
    [0.34, 0],
    [0.3, 0.05],
    [0.24, 0.2],
    [0.17, 0.36],
    [0.1, 0.46],
    [0.05, 0.52],
    [0.0, 0.54],
  ].map(([r, y]) => new Vector2(r, y));
  return new LatheGeometry(profile, 20);
}

/** The phantom: a sheet with a wavering hem. */
function phantomGeometry(): LatheGeometry {
  const profile: Vector2[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = t * 1.5;
    const radius = i === steps ? 0 : 0.14 + 0.34 * Math.sin(Math.min(1, t * 1.15 + 0.1) * Math.PI * 0.62) + (t < 0.2 ? 0.08 * Math.sin(t * 40) : 0);
    profile.push(new Vector2(Math.max(0, radius), y));
  }
  return new LatheGeometry(profile, 24);
}

export function buildHouse(maze: Maze, textures: HouseTextures, rooms?: readonly RoomInfo[]): House {
  const layout = layoutHouse(maze);
  const group = new Group();

  // The painted bricks double as a bump map, so the lantern picks out the mortar as it passes.
  const wallMat = new MeshStandardMaterial({
    color: textures.wall ? 0xffffff : 0x4a3b4d,
    map: textures.wall,
    bumpMap: textures.wall,
    bumpScale: 1.6,
    roughness: 0.92,
    metalness: 0,
  });
  const floorMat = new MeshStandardMaterial({
    color: textures.floor ? 0xffffff : 0x2a1d1a,
    map: textures.floor,
    bumpMap: textures.floor,
    bumpScale: 0.8,
    roughness: 0.55, // old varnish: the lantern leaves a soft shine on the boards
    metalness: 0.05,
  });
  const ceilMat = new MeshStandardMaterial({ color: textures.ceiling ? 0xffffff : 0x1c1722, map: textures.ceiling, roughness: 1 });

  // Walls: one instanced box for every wall.
  const wallMesh = new InstancedMesh(new BoxGeometry(1, 1, 1), wallMat, Math.max(1, layout.walls.length));
  const m = new Matrix4();
  const q = new Quaternion();
  layout.walls.forEach((w, i) => {
    m.compose(new Vector3(w.x, WALL_HEIGHT / 2, w.z), q, new Vector3(w.w, WALL_HEIGHT, w.d));
    wallMesh.setMatrixAt(i, m);
  });
  wallMesh.count = layout.walls.length;
  wallMesh.instanceMatrix.needsUpdate = true;
  group.add(wallMesh);

  // Floor and ceiling.
  const centreX = layout.width / 2 - CELL / 2;
  const centreZ = layout.depth / 2 - CELL / 2;
  const floor = new Mesh(new PlaneGeometry(layout.width + CELL, layout.depth + CELL), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(centreX, 0, centreZ);
  textures.floor?.repeat.set(maze.width * 2 + 2, maze.height * 2 + 2);
  group.add(floor);
  const ceiling = new Mesh(new PlaneGeometry(layout.width + CELL, layout.depth + CELL), ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(centreX, WALL_HEIGHT, centreZ);
  textures.ceiling?.repeat.set(maze.width * 4 + 4, maze.height * 4 + 4);
  group.add(ceiling);

  // Dark beams across the ceiling, one room in two, so the rooms have a rhythm and the ceiling has depth.
  const beamMat = new MeshStandardMaterial({ color: 0x24160d, roughness: 0.8 });
  const beams: { x: number; z: number; alongX: boolean }[] = [];
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) if ((x + y) % 2 === 0) beams.push({ x: x * CELL, z: y * CELL, alongX: (x + y) % 4 === 0 });
  }
  const beamMesh = new InstancedMesh(new BoxGeometry(1, 1, 1), beamMat, Math.max(1, beams.length));
  beams.forEach((b, i) => {
    m.compose(
      new Vector3(b.x, WALL_HEIGHT - 0.14, b.z),
      q,
      b.alongX ? new Vector3(CELL, 0.28, 0.3) : new Vector3(0.3, 0.28, CELL),
    );
    beamMesh.setMatrixAt(i, m);
  });
  beamMesh.count = beams.length;
  beamMesh.instanceMatrix.needsUpdate = true;
  group.add(beamMesh);

  // Wainscoting: a dark wood panel low on every wall, a rail on top and a skirting board at the foot.
  // Three instanced meshes for the whole house, sharing one material.
  const panelMat = new MeshStandardMaterial({ color: textures.wood ? 0xffffff : 0x34200f, map: textures.wood ?? null, roughness: 0.65, metalness: 0 });
  const boxGeo = new BoxGeometry(1, 1, 1);
  const trim = (height: number, y: number, extra: number): InstancedMesh => {
    const mesh = new InstancedMesh(boxGeo, panelMat, Math.max(1, layout.walls.length));
    layout.walls.forEach((w, i) => {
      m.compose(new Vector3(w.x, y, w.z), q, new Vector3(w.w + (w.w > w.d ? 0 : extra), height, w.d + (w.d > w.w ? 0 : extra)));
      mesh.setMatrixAt(i, m);
    });
    mesh.count = layout.walls.length;
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  };
  group.add(trim(1.0, 0.5, 0.1), trim(0.07, 1.04, 0.16), trim(0.2, 0.1, 0.16));

  // Door frames at the openings of every room: two posts and a lintel, drawn once per opening.
  const frames: { x: number; z: number; alongX: boolean }[] = [];
  const framed = new Set<string>();
  for (const room of maze.rooms) {
    for (const d of openings(maze, room)) {
      const n = { x: room.x + DIR_VECTOR[d].x, y: room.y + DIR_VECTOR[d].z };
      const key = [Math.min(room.x, n.x), Math.min(room.y, n.y), d % 2].join(',');
      if (framed.has(key)) continue;
      framed.add(key);
      const c = cellCentre(room);
      frames.push({ x: c.x + (DIR_VECTOR[d].x * CELL) / 2, z: c.z + (DIR_VECTOR[d].z * CELL) / 2, alongX: d % 2 === 0 });
    }
  }
  const postMesh = new InstancedMesh(boxGeo, panelMat, Math.max(1, frames.length * 2));
  const lintelMesh = new InstancedMesh(boxGeo, panelMat, Math.max(1, frames.length));
  frames.forEach((f, i) => {
    // The doorway is 2.2 m wide: along x for a north or south opening, along z for east or west.
    for (const side of [-1, 1]) {
      m.compose(new Vector3(f.x + (f.alongX ? side * 1.2 : 0), 1.25, f.z + (f.alongX ? 0 : side * 1.2)), q, new Vector3(0.2, 2.5, 0.2));
      postMesh.setMatrixAt(i * 2 + (side + 1) / 2, m);
    }
    m.compose(new Vector3(f.x, 2.55, f.z), q, f.alongX ? new Vector3(2.6, 0.22, 0.24) : new Vector3(0.24, 0.22, 2.6));
    lintelMesh.setMatrixAt(i, m);
  });
  postMesh.count = frames.length * 2;
  lintelMesh.count = frames.length;
  postMesh.instanceMatrix.needsUpdate = true;
  lintelMesh.instanceMatrix.needsUpdate = true;
  group.add(postMesh, lintelMesh);

  // Furnishings.
  const wood = new MeshStandardMaterial({ color: 0x3a2616, roughness: 0.7 });
  const canvasMat = new MeshStandardMaterial({ color: 0x7c6a5a, roughness: 0.9 });
  const candleMat = new MeshStandardMaterial({ color: 0xe9dfc8, roughness: 0.6 });
  const flameMat = new MeshBasicMaterial({ color: 0xffc46b });
  const rugMat = new MeshStandardMaterial({ color: textures.rug ? 0xffffff : 0x5a1626, map: textures.rug ?? null, roughness: 1 });
  const crateGeo = new BoxGeometry(0.8, 0.8, 0.8);
  const frameGeo = new BoxGeometry(1.0, 1.3, 0.08);
  const paintingGeo = new PlaneGeometry(0.8, 1.1);
  const candleGeo = new CylinderGeometry(0.05, 0.06, 0.32, 10);
  const flameGeo = new SphereGeometry(0.045, 8, 8);
  const rugGeo = new PlaneGeometry(2.6, 1.5);
  const iron = new MeshStandardMaterial({ color: 0x23211f, roughness: 0.55, metalness: 0.7 });
  const bone = new MeshStandardMaterial({ color: 0xd9d2bf, roughness: 0.8 });
  const flameOff = new MeshBasicMaterial({ color: 0x050407 });
  const bookMats = [0x6b2a2a, 0x2a4a5e, 0x4b5a2a, 0x5a3a1c, 0x3b2a5a].map((c) => new MeshStandardMaterial({ color: c, roughness: 0.9 }));
  const bookcaseGeo = new BoxGeometry(1.8, 2.2, 0.34);
  const booksGeo = new BoxGeometry(1.6, 0.4, 0.1);
  const barrelGeo = new CylinderGeometry(0.34, 0.3, 0.8, 14);
  const bandGeo = new CylinderGeometry(0.355, 0.355, 0.05, 14);
  const skullGeo = new SphereGeometry(0.11, 10, 10);
  const jawGeo = new BoxGeometry(0.1, 0.05, 0.08);
  const socketGeo = new BoxGeometry(0.11, 0.03, 0.03);
  const ringGeo = new TorusGeometry(0.45, 0.03, 8, 22);
  const chainGeo = new CylinderGeometry(0.012, 0.012, 0.9, 5);
  const stubGeo = new CylinderGeometry(0.03, 0.035, 0.16, 8);
  const webGeo = new PlaneGeometry(1.5, 1.5);
  const webMat = new MeshBasicMaterial({
    color: 0xe8e8f4,
    map: textures.web ?? null,
    transparent: true,
    opacity: textures.web ? 0.9 : 0.12,
    side: DoubleSide,
    depthWrite: false,
    fog: true,
  });
  for (const p of layout.props) {
    const item = new Group();
    item.position.set(p.x, 0, p.z);
    item.rotation.y = p.rot;
    if (p.kind === 'frame') {
      const frame = new Mesh(frameGeo, wood);
      frame.position.y = 1.7;
      const painting = new Mesh(paintingGeo, canvasMat);
      painting.position.set(0, 1.7, 0.045);
      painting.scale.setScalar(0.85 + p.variety * 0.2);
      item.add(frame, painting);
    } else if (p.kind === 'crate') {
      const crate = new Mesh(crateGeo, wood);
      crate.position.y = 0.4;
      crate.scale.set(0.8 + p.variety * 0.5, 0.8 + p.variety * 0.4, 0.8 + p.variety * 0.5);
      crate.position.y = 0.4 * crate.scale.y;
      item.add(crate);
    } else if (p.kind === 'candle') {
      const candle = new Mesh(candleGeo, candleMat);
      candle.position.y = 0.16;
      const flame = new Mesh(flameGeo, flameMat);
      flame.position.y = 0.36;
      item.add(candle, flame);
    } else if (p.kind === 'bookcase') {
      const body = new Mesh(bookcaseGeo, wood);
      body.position.y = 1.1;
      item.add(body);
      // Three shelves of books, each a different dull colour.
      for (let row = 0; row < 3; row++) {
        const books = new Mesh(booksGeo, bookMats[Math.floor((p.variety * 7 + row * 2) % bookMats.length)]!);
        books.position.set(0, 0.55 + row * 0.62, 0.17);
        item.add(books);
      }
    } else if (p.kind === 'barrel') {
      const barrel = new Mesh(barrelGeo, wood);
      barrel.position.y = 0.4;
      const band = new Mesh(bandGeo, iron);
      band.position.y = 0.2;
      const band2 = new Mesh(bandGeo, iron);
      band2.position.y = 0.62;
      item.add(barrel, band, band2);
    } else if (p.kind === 'skull') {
      const skull = new Mesh(skullGeo, bone);
      skull.position.y = 0.12;
      const jaw = new Mesh(jawGeo, bone);
      jaw.position.set(0, 0.04, 0.05);
      const sockets = new Mesh(socketGeo, flameOff);
      sockets.position.set(0, 0.14, 0.08);
      item.add(skull, jaw, sockets);
    } else if (p.kind === 'chandelier') {
      // An iron ring on three chains, with candles that burn on it.
      const ring = new Mesh(ringGeo, iron);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = WALL_HEIGHT - 0.9;
      item.add(ring);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        const chain = new Mesh(chainGeo, iron);
        chain.position.set(Math.sin(a) * 0.2, WALL_HEIGHT - 0.45, Math.cos(a) * 0.2);
        item.add(chain);
      }
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const stub = new Mesh(stubGeo, candleMat);
        stub.position.set(Math.sin(a) * 0.45, WALL_HEIGHT - 0.8, Math.cos(a) * 0.45);
        const flame = new Mesh(flameGeo, flameMat);
        flame.position.set(Math.sin(a) * 0.45, WALL_HEIGHT - 0.64, Math.cos(a) * 0.45);
        item.add(stub, flame);
      }
    } else if (p.kind === 'cobweb') {
      const web = new Mesh(webGeo, webMat);
      web.position.y = WALL_HEIGHT - 0.78;
      web.scale.setScalar(0.85 + p.variety * 0.3);
      item.add(web);
    } else {
      const rug = new Mesh(rugGeo, rugMat);
      rug.rotation.x = -Math.PI / 2;
      rug.position.y = 0.015;
      item.add(rug);
    }
    group.add(item);
  }

  // Cheap fake shadows: one soft dark blot under each standing thing, all in one instanced mesh.
  const blotSize: Partial<Record<Prop['kind'], number>> = { crate: 1.5, candle: 0.6, barrel: 1.2, skull: 0.5, bookcase: 2.4 };
  const blots = layout.props.filter((p) => blotSize[p.kind] !== undefined);
  const blotMat = new MeshBasicMaterial({ color: 0x000000, map: shadow(), transparent: true, opacity: shadow() ? 0.9 : 0.3, depthWrite: false });
  const blotMesh = new InstancedMesh(new PlaneGeometry(1, 1), blotMat, Math.max(1, blots.length));
  const flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
  blots.forEach((p, i) => {
    const s = blotSize[p.kind]!;
    m.compose(new Vector3(p.x, 0.011, p.z), flat, new Vector3(s, s, 1));
    blotMesh.setMatrixAt(i, m);
  });
  blotMesh.count = blots.length;
  blotMesh.instanceMatrix.needsUpdate = true;
  group.add(blotMesh);

  // The bell at the exit: hung from a beam, glowing, with a pool of light on the floor.
  const exit = cellCentre(maze.exit);
  const bell = new Mesh(
    bellGeometry(),
    new MeshStandardMaterial({ color: 0xd9a441, emissive: 0xff9a2e, emissiveIntensity: 0.7, roughness: 0.35, metalness: 0.8, side: DoubleSide }),
  );
  bell.position.set(exit.x, 1.9, exit.z);
  group.add(bell);
  const beam = new Mesh(new BoxGeometry(1.4, 0.12, 0.12), wood);
  beam.position.set(exit.x, 2.5, exit.z);
  group.add(beam);
  const chain = new Mesh(new CylinderGeometry(0.015, 0.015, 0.1, 6), wood);
  chain.position.set(exit.x, 2.45, exit.z);
  group.add(chain);
  const pool = new Mesh(
    new CircleGeometry(1.4, 28),
    new MeshBasicMaterial({ color: 0xffa03c, transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(exit.x, 0.02, exit.z);
  group.add(pool);
  const exitLight = new PointLight(0xffa24a, 16, 11, 2);
  exitLight.position.set(exit.x, 1.9, exit.z);
  group.add(exitLight);

  // Each room dressed in its own way, lit by its own torch; wardrobes; the relics.
  const dressing = rooms ? dressRooms(group, maze, rooms) : { torches: [], relics: [] };

  // The phantom: the brightest thing in the house. It glows through the fog, so you see it coming.
  const phantom = new Group();
  const sheet = new Mesh(
    phantomGeometry(),
    new MeshStandardMaterial({
      color: 0xe8f6ff,
      emissive: 0x7fd4ff,
      emissiveIntensity: 1.9,
      transparent: true,
      opacity: 0.88,
      roughness: 0.4,
      side: DoubleSide,
      fog: false,
    }),
  );
  const aura = halo(0x7fd4ff, 3.4, 0.55);
  aura.position.y = 0.9;
  const core = halo(0xe8f6ff, 1.6, 0.6);
  core.position.y = 1.1;
  // A wide, faint outer glow, and a pool of light on the floor under it, so it lights the boards it passes over.
  const outer = halo(0x7fd4ff, 7, 0.16);
  outer.position.y = 0.9;
  const poolMap = glow();
  const pool2 = new Mesh(
    new PlaneGeometry(4.2, 4.2),
    new MeshBasicMaterial({ color: 0x7fd4ff, ...(poolMap ? { map: poolMap } : {}), transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false }),
  );
  pool2.rotation.x = -Math.PI / 2;
  pool2.position.y = -0.13;
  phantom.add(outer, pool2, aura, core);
  const eyeMat = new MeshBasicMaterial({ color: 0x05030a, fog: false });
  const eyeGeo = new SphereGeometry(0.06, 8, 8);
  const eyeL = new Mesh(eyeGeo, eyeMat);
  const eyeR = new Mesh(eyeGeo, eyeMat);
  eyeL.scale.set(0.9, 1.7, 0.6);
  eyeR.scale.set(0.9, 1.7, 0.6);
  eyeL.position.set(-0.13, 1.2, 0.3);
  eyeR.position.set(0.13, 1.2, 0.3);
  phantom.add(sheet, eyeL, eyeR);
  const phantomLight = new PointLight(0x7fd4ff, 10, 10, 2);
  phantomLight.position.set(0, 1, 0);
  phantom.add(phantomLight);
  const ghost = cellCentre(maze.ghost);
  phantom.position.set(ghost.x, 0.2, ghost.z);
  group.add(phantom);

  return {
    group,
    phantom,
    phantomLight,
    phantomAura: aura,
    phantomGlow: [outer, pool2],
    exitLight,
    bell,
    torches: dressing.torches,
    relics: dressing.relics,
    stats: { walls: layout.walls.length, props: layout.props.length },
  };
}
