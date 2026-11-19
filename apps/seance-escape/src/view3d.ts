import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  PointsMaterial,
  FogExp2,
  HemisphereLight,
  PerspectiveCamera,
  PointLight,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from 'three';
import type { Maze, WalkSnapshot } from '@marrow/skeleton';
import type { RoomInfo } from './content';
import { CELL, EYE_HEIGHT, buildHouse, cellCentre, ease, paintTextures, shortestAngle, yawFor, type House } from './world';

// The first-person view. It only shows what the walk already says: the camera goes where the
// player goes, and at a crossing it turns to face the option that is lit, so the picture follows
// the voice. Nothing here is needed to play. With reduced motion the camera cuts instead of gliding
// and the lantern does not flicker.

export interface ViewOptions {
  reducedMotion: boolean;
  /** Real ms per room walked, so the glide takes as long as the step. */
  stepMs: number;
}

export interface View3d {
  /** Move the camera and lights to match the walk. Call every frame, then `render`. */
  update(snapshot: WalkSnapshot, nowMs: number, options: ViewOptions): void;
  render(): void;
  resize(): void;
  dispose(): void;
}

/** Wrap a distance from the player into [-size/2, size/2), so a field of specks follows the player forever. */
export const wrapRelative = (value: number, size: number): number => (((value + size / 2) % size) + size) % size - size / 2;

const DUST_COUNT = 160;
const DUST_BOX = 14;

function makeDust(): { points: Points; update(x: number, z: number, t: number, calm: boolean): void } {
  const base = new Float32Array(DUST_COUNT * 3);
  let seed = 12345;
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < DUST_COUNT; i++) {
    base[i * 3] = rand() * 1000;
    base[i * 3 + 1] = 0.2 + rand() * 2.7;
    base[i * 3 + 2] = rand() * 1000;
  }
  const positions = new Float32Array(DUST_COUNT * 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const material = new PointsMaterial({
    color: 0xffe2b0,
    size: 0.04,
    transparent: true,
    opacity: 0.55,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return {
    points,
    update(x, z, t, calm) {
      for (let i = 0; i < DUST_COUNT; i++) {
        const drift = calm ? 0 : Math.sin(t * 0.25 + i) * 0.25;
        positions[i * 3] = x + wrapRelative(base[i * 3]! + drift - x, DUST_BOX);
        positions[i * 3 + 1] = base[i * 3 + 1]! + (calm ? 0 : Math.sin(t * 0.3 + i * 1.7) * 0.12);
        positions[i * 3 + 2] = z + wrapRelative(base[i * 3 + 2]! + drift - z, DUST_BOX);
      }
      geometry.attributes.position!.needsUpdate = true;
    },
  };
}

/** The angle of the lit option from straight ahead, in degrees. 0 when nothing is lit or the option has no direction. */
export function lookAngleOf(snapshot: Pick<WalkSnapshot, 'phase' | 'options' | 'lit'>): number {
  if (snapshot.phase !== 'choosing' || !snapshot.lit) return 0;
  return snapshot.options.find((o) => o.id === snapshot.lit)?.angle ?? 0;
}

/**
 * Start the 3D view on a canvas, or return null when this browser cannot do WebGL. The game
 * then falls back to the flat map, so nothing depends on the 3D view.
 */
export function createView3d(canvas: HTMLCanvasElement, maze: Maze, rooms?: readonly RoomInfo[]): View3d | null {
  let renderer: WebGLRenderer;
  try {
    const probe = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!probe || typeof (probe as WebGLRenderingContext).getParameter !== 'function' || !(probe as WebGLRenderingContext).getParameter(0x1f02)) {
      return null;
    }
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2));
  renderer.setSize(canvas.width, canvas.height, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new Scene();
  scene.background = new Color(0x020105);
  // Dark: the house is lit only by its torches, your lantern, and the phantom's own glow.
  scene.fog = new FogExp2(0x030208, 0.08);
  scene.add(new HemisphereLight(0x1c2240, 0x0a0606, 0.12));

  const textures = paintTextures(maze.seed);
  const house: House = buildHouse(maze, textures, rooms);

  // A few torch lights, moved each frame to the torches nearest you. Many lights would slow the
  // picture, and a far torch is lost in the fog anyway; its flame still glows.
  const TORCH_LIGHTS = 6;
  const torchLights = Array.from({ length: TORCH_LIGHTS }, () => {
    const l = new PointLight(0xff9a4a, 0, 7, 2);
    scene.add(l);
    return l;
  });
  scene.add(house.group);

  const camera = new PerspectiveCamera(72, canvas.width / canvas.height, 0.05, 80);
  camera.rotation.order = 'YXZ';
  const lantern = new PointLight(0xffb057, 15, 10, 2);
  camera.add(lantern);
  lantern.position.set(0.28, -0.25, -0.5); // held a little to the right and below the eyes
  scene.add(camera);

  const start = cellCentre(maze.start);
  const pos = { x: start.x, z: start.z, yaw: 0, moved: 0 };
  const ghost = { x: house.phantom.position.x, z: house.phantom.position.z };

  // Dust in the lantern light. The specks have fixed places in the house and are recycled around
  // the player, so they slide past as you walk. They only drift on their own when motion is allowed.
  const dust = makeDust();
  scene.add(dust.points);
  let lastMs: number | null = null;
  let dim = 1;

  return {
    update(s, nowMs, options) {
      const first = lastMs === null;
      const dt = lastMs === null ? 0 : Math.min(0.1, (nowMs - lastMs) / 1000);
      lastMs = nowMs;
      const t = nowMs / 1000;
      const calm = options.reducedMotion;

      // Where the camera goes: the room the player is in. A long jump (after being caught) is a cut, not a glide.
      const target = cellCentre(s.cell);
      const dx = target.x - pos.x;
      const dz = target.z - pos.z;
      const dist = Math.hypot(dx, dz);
      const cut = calm || dist > CELL * 1.3;
      if (cut) {
        pos.x = target.x;
        pos.z = target.z;
      } else if (dist > 1e-3) {
        const speed = (CELL / Math.max(0.2, options.stepMs / 1000)) * 1.05; // arrive just as the next step begins
        const move = Math.min(dist, speed * dt);
        pos.x += (dx / dist) * move;
        pos.z += (dz / dist) * move;
        pos.moved += move;
      }

      // Where it looks: the way you face, turned toward the option that is lit.
      const wantYaw = yawFor(s.facing, lookAngleOf(s));
      pos.yaw = calm || first ? wantYaw : pos.yaw + shortestAngle(pos.yaw, wantYaw) * (1 - Math.exp(-dt * 7));
      const bob = calm || dist < 1e-3 ? 0 : Math.sin((pos.moved / (CELL / 2)) * Math.PI * 2) * 0.035;
      camera.position.set(pos.x, EYE_HEIGHT + bob, pos.z);
      camera.rotation.y = pos.yaw;

      // The lantern dims while you are caught, and flickers a little otherwise.
      dim = ease(dim, s.phase === 'caught' ? 0.15 : 1, dt || 1, 4);
      const flicker = calm ? 1 : 1 + 0.06 * Math.sin(t * 13) + 0.04 * Math.sin(t * 7.3 + 1);
      lantern.intensity = 15 * dim * flicker;

      // The nearest torches, flickering, each in its room's own colour.
      const byDistance = [...house.torches].sort((a, b) => Math.hypot(a.x - pos.x, a.z - pos.z) - Math.hypot(b.x - pos.x, b.z - pos.z));
      torchLights.forEach((light, i) => {
        const torch = byDistance[i];
        if (!torch) {
          light.intensity = 0;
          return;
        }
        light.position.set(torch.x, torch.y, torch.z);
        light.color.setHex(torch.colour);
        const wobble = calm ? 1 : 1 + 0.12 * Math.sin(t * 9 + i * 1.7) + 0.08 * Math.sin(t * 23 + i);
        light.intensity = 7 * wobble;
        torch.flame.scale.setScalar(calm ? 1 : 0.9 + 0.2 * Math.abs(Math.sin(t * 11 + i)));
      });

      // A relic, once found, is gone from its stand.
      house.relics.forEach((r, i) => {
        const cell = maze.relics[i];
        r.visible = cell !== undefined && s.relicsLeft.some((c) => c.x === cell.x && c.y === cell.y);
      });

      // The phantom drifts toward where it is, faces you, and its light grows as it nears.
      const g = cellCentre(s.ghost);
      ghost.x = calm ? g.x : ease(ghost.x, g.x, dt, 2.5);
      ghost.z = calm ? g.z : ease(ghost.z, g.z, dt, 2.5);
      const p = house.phantom;
      p.position.set(ghost.x, 0.15 + (calm ? 0 : 0.1 * Math.sin(t * 2)), ghost.z);
      p.rotation.y = Math.atan2(pos.x - ghost.x, pos.z - ghost.z);
      const near = Math.max(0, 1 - Math.hypot(pos.x - ghost.x, pos.z - ghost.z) / (CELL * 6));
      // Wandering it glows ice blue. Hunting, it burns red: you can see that it knows.
      const hunting = s.ghostMode === 'hunt' || s.chasing;
      const hue = hunting ? 0xff3d5a : 0x7fd4ff;
      house.phantomLight.color.setHex(hue);
      (house.phantomAura.material as { color: Color }).color.setHex(hue);
      house.phantomLight.intensity = 4 + 18 * near;
      const pulse = calm ? 1 : 1 + 0.15 * Math.sin(t * (hunting ? 9 : 3));
      house.phantomAura.scale.setScalar(3.4 * pulse);

      dust.update(pos.x, pos.z, t, calm);

      // The bell glows steadily; it sways only when motion is allowed.
      house.bell.rotation.z = calm ? 0 : 0.06 * Math.sin(t * 1.7);
      house.exitLight.intensity = 14 + (calm ? 0 : 2 * Math.sin(t * 5));
    },
    render() {
      renderer.render(scene, camera);
    },
    resize() {
      renderer.setSize(canvas.width, canvas.height, false);
      camera.aspect = canvas.width / canvas.height;
      camera.updateProjectionMatrix();
    },
    dispose() {
      scene.traverse((o) => {
        const mesh = o as { geometry?: { dispose(): void }; material?: { dispose(): void } | { dispose(): void }[] };
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      textures.wall?.dispose();
      textures.floor?.dispose();
      textures.ceiling?.dispose();
      textures.web?.dispose();
      renderer.dispose();
    },
  };
}
