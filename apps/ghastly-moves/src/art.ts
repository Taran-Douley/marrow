import { PULSE_MAX_ALPHA } from '@marrow/skeleton';
import type { Scenery } from './stages';

// The look of the game, all drawn in code with canvas shapes. A gradient night sky, a moon with a soft
// glow, layers of silhouettes that drift at different speeds (parallax), a ground with texture, a ghost
// with a soft body and a wavy hem, and a lantern that glows.
//
// Rules this file keeps:
//  - Essential graphics (the obstacles, the ground line, the ghost) are drawn by the scene with the
//    theme's line colours on top of this, at 3:1 or better; text is 4.5:1. Scenery here is dark and dim.
//  - Nothing flashes. Beat pulses are `pulse` (0 to 1) times at most `PULSE_MAX_ALPHA` of opacity, and
//    `pulse` is 0 when motion is reduced.
//  - With reduced motion, everything stands still: no scrolling layers, no wobble, no bobbing.

export const WIDTH = 960;
export const HEIGHT = 540;

/** Night sky colours per place: top of the sky, then the horizon. All are dark, so text on them keeps 4.5:1. */
const SKY: Record<Scenery, readonly [string, string]> = {
  patch: ['#0e0a1c', '#3a2548'],
  moon: ['#0b0f1f', '#27304f'],
  woods: ['#08121a', '#1f3a3a'],
  gate: ['#0d0a18', '#33274d'],
  hollow: ['#0a0a14', '#2e2540'],
  mill: ['#0b0d1c', '#2c3050'],
  mist: ['#0d1118', '#2f3a44'],
  midnight: ['#07040f', '#2a1346'],
};

/** The silhouette colours, far to near: dark, and a little lighter the closer they are. */
const LAYER: Record<Scenery, readonly [string, string, string]> = {
  patch: ['#1d1430', '#170f27', '#110b1d'],
  moon: ['#1a2036', '#141a2d', '#0e1322'],
  woods: ['#10252a', '#0c1d21', '#08151a'],
  gate: ['#1d1630', '#171126', '#100c1c'],
  hollow: ['#1b1530', '#150f26', '#0f0a1c'],
  mill: ['#1c2040', '#161a35', '#10142a'],
  mist: ['#1f2a34', '#18222b', '#111a22'],
  midnight: ['#1c0f33', '#150a29', '#0e061f'],
};

const hash = (i: number, salt = 0): number => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

interface Stop {
  at: number;
  colour: string;
}

/** A gradient, or the first colour when the canvas cannot make one (a test double, say). */
function linear(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: Stop[]): CanvasGradient | string {
  const g = ctx.createLinearGradient?.(x0, y0, x1, y1);
  if (!g?.addColorStop) return stops[0]!.colour;
  for (const s of stops) g.addColorStop(s.at, s.colour);
  return g;
}

function radial(ctx: CanvasRenderingContext2D, x: number, y: number, r0: number, r1: number, stops: Stop[]): CanvasGradient | string {
  const g = ctx.createRadialGradient?.(x, y, r0, x, y, r1);
  if (!g?.addColorStop) return stops[0]!.colour;
  for (const s of stops) g.addColorStop(s.at, s.colour);
  return g;
}

/** '#rrggbb' with an opacity, as rgba(). */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, alpha))})`;
}

export interface ArtState {
  scenery: Scenery;
  /** Level time in running seconds, for scrolling. */
  t: number;
  /** Pixels per running second of the ground. */
  pxPerSec: number;
  /** Real clock, ms, for the slow wobble. */
  nowMs: number;
  reducedMotion: boolean;
  /** Beat pulse, 0 to 1 (0 when motion is reduced). */
  pulse: number;
  /** A flat background, for the high-contrast theme. */
  flat: boolean;
  background: string;
  groundY: number;
}

/** The night sky: a gradient, a few still stars, and the moon with its glow. */
export function drawSky(ctx: CanvasRenderingContext2D, s: ArtState): void {
  const [top, horizon] = SKY[s.scenery];
  ctx.fillStyle = s.flat ? s.background : linear(ctx, 0, 0, 0, s.groundY, [{ at: 0, colour: top }, { at: 1, colour: horizon }]);
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (s.flat) return;
  // Stars never twinkle: they are still.
  ctx.save();
  ctx.fillStyle = '#e8e4f4';
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.25 + hash(i, 3) * 0.4;
    const r = hash(i, 4) > 0.85 ? 1.6 : 1;
    ctx.fillRect(hash(i, 1) * WIDTH, hash(i, 2) * (s.groundY - 150), r, r);
  }
  ctx.restore();
  // The moon, with a soft glow that swells gently on the beat.
  const mx = 820;
  const my = 92;
  const big = s.scenery === 'midnight' ? 52 : 36;
  ctx.save();
  const glow = 0.22 + s.pulse * PULSE_MAX_ALPHA;
  ctx.fillStyle = radial(ctx, mx, my, big * 0.6, big * 3.4, [
    { at: 0, colour: withAlpha('#e9e4d6', glow) },
    { at: 1, colour: withAlpha('#e9e4d6', 0) },
  ]);
  ctx.beginPath();
  ctx.arc(mx, my, big * 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e9e4d6';
  ctx.beginPath();
  ctx.arc(mx, my, big, 0, Math.PI * 2);
  ctx.fill();
  // Two soft craters, in the sky's own colour, so the moon has a face and not a flat disc.
  ctx.fillStyle = withAlpha('#9a93ad', 0.35);
  ctx.beginPath();
  ctx.arc(mx - big * 0.3, my - big * 0.2, big * 0.22, 0, Math.PI * 2);
  ctx.arc(mx + big * 0.25, my + big * 0.28, big * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---- silhouettes ----------------------------------------------------------------------

type Piece = (ctx: CanvasRenderingContext2D, x: number, base: number, size: number, i: number) => void;

const pine: Piece = (ctx, x, base, h) => {
  ctx.beginPath();
  ctx.moveTo(x - h * 0.28, base);
  ctx.lineTo(x, base - h);
  ctx.lineTo(x + h * 0.28, base);
  ctx.closePath();
  ctx.fill();
};

const deadTree: Piece = (ctx, x, base, h) => {
  ctx.fillRect(x - 4, base - h, 8, h);
  ctx.lineWidth = 4;
  ctx.strokeStyle = ctx.fillStyle as string;
  ctx.beginPath();
  ctx.moveTo(x, base - h * 0.6);
  ctx.lineTo(x - h * 0.3, base - h * 0.85);
  ctx.moveTo(x, base - h * 0.75);
  ctx.lineTo(x + h * 0.28, base - h * 1.0);
  ctx.moveTo(x, base - h * 0.45);
  ctx.lineTo(x + h * 0.22, base - h * 0.62);
  ctx.stroke();
};

const grave: Piece = (ctx, x, base, h, i) => {
  const w = h * 0.55;
  if (i % 3 === 0) {
    ctx.fillRect(x - 3, base - h, 6, h);
    ctx.fillRect(x - w * 0.4, base - h * 0.75, w * 0.8, 5);
  } else {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, base);
    ctx.lineTo(x - w / 2, base - h * 0.7);
    ctx.quadraticCurveTo(x, base - h * 1.15, x + w / 2, base - h * 0.7);
    ctx.lineTo(x + w / 2, base);
    ctx.closePath();
    ctx.fill();
  }
};

const pumpkin: Piece = (ctx, x, base, h) => {
  ctx.beginPath();
  ctx.ellipse(x, base - h * 0.45, h * 0.62, h * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 2, base - h * 1.0, 4, h * 0.2);
};

const fencePost: Piece = (ctx, x, base, h) => {
  ctx.beginPath();
  ctx.moveTo(x - 5, base);
  ctx.lineTo(x - 5, base - h * 0.85);
  ctx.lineTo(x, base - h);
  ctx.lineTo(x + 5, base - h * 0.85);
  ctx.lineTo(x + 5, base);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - 40, base - h * 0.55, 40, 4);
};

const mill: Piece = (ctx, x, base, h) => {
  ctx.beginPath();
  ctx.moveTo(x - 30, base);
  ctx.lineTo(x - 20, base - h * 0.7);
  ctx.lineTo(x + 20, base - h * 0.7);
  ctx.lineTo(x + 30, base);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 26, base - h * 0.7);
  ctx.lineTo(x, base - h * 0.95);
  ctx.lineTo(x + 26, base - h * 0.7);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = ctx.fillStyle as string;
  ctx.beginPath();
  ctx.moveTo(x - h * 0.45, base - h * 0.5);
  ctx.lineTo(x + h * 0.45, base - h * 0.9);
  ctx.moveTo(x - h * 0.45, base - h * 0.9);
  ctx.lineTo(x + h * 0.45, base - h * 0.5);
  ctx.stroke();
};

const manor: Piece = (ctx, x, base, h) => {
  ctx.fillRect(x - 60, base - h * 0.6, 120, h * 0.6);
  ctx.fillRect(x - 40, base - h * 0.85, 30, h * 0.25);
  ctx.beginPath();
  ctx.moveTo(x - 66, base - h * 0.6);
  ctx.lineTo(x, base - h * 0.95);
  ctx.lineTo(x + 66, base - h * 0.6);
  ctx.fill();
  // A lit window or two, dim: scenery, never a signal.
  ctx.save();
  ctx.fillStyle = withAlpha('#f2b134', 0.3);
  ctx.fillRect(x - 28, base - h * 0.45, 10, 14);
  ctx.fillRect(x + 14, base - h * 0.35, 10, 14);
  ctx.restore();
};

const ironBar: Piece = (ctx, x, base, h) => {
  ctx.fillRect(x - 3, base - h, 6, h);
  ctx.beginPath();
  ctx.moveTo(x - 6, base - h);
  ctx.lineTo(x, base - h - 14);
  ctx.lineTo(x + 6, base - h);
  ctx.fill();
};

const MID: Record<Scenery, Piece> = { patch: deadTree, moon: grave, woods: pine, gate: ironBar, hollow: deadTree, mill: mill, mist: pine, midnight: manor };
const NEAR: Record<Scenery, Piece> = { patch: pumpkin, moon: grave, woods: pine, gate: fencePost, hollow: grave, mill: fencePost, mist: grave, midnight: fencePost };
/** How many pieces per screen width, and how tall, for the middle and near layers. */
const MID_SIZE: Record<Scenery, [number, number, number]> = {
  patch: [5, 110, 60],
  moon: [6, 60, 30],
  woods: [8, 150, 70],
  gate: [9, 170, 20],
  hollow: [5, 170, 60],
  mill: [2, 200, 60],
  mist: [7, 120, 60],
  midnight: [2, 220, 30],
};

/** Run a draw at `x` and again one tile to the right, so a layer wraps without a seam. */
function tile(offset: number, period: number, draw: (shift: number) => void): void {
  const shift = -(((offset % period) + period) % period);
  draw(shift);
  draw(shift + period);
}

/** Silhouette layers in three depths. They drift at different speeds, and stand still when motion is reduced. */
export function drawLayers(ctx: CanvasRenderingContext2D, s: ArtState): void {
  if (s.flat) return;
  const [far, mid, near] = LAYER[s.scenery];
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec;
  const base = s.groundY;
  ctx.save();
  // Far: rolling hills.
  ctx.fillStyle = far;
  tile(scroll * 0.08, WIDTH, (dx) => {
    ctx.beginPath();
    ctx.moveTo(dx, base);
    for (let x = 0; x <= WIDTH; x += 40) ctx.lineTo(dx + x, base - 70 - Math.sin((x / WIDTH) * Math.PI * 2 * 2) * 26 - Math.sin(x * 0.043) * 10);
    ctx.lineTo(dx + WIDTH, base);
    ctx.closePath();
    ctx.fill();
  });
  // Middle: the place's tall things.
  const [count, height, spread] = MID_SIZE[s.scenery];
  ctx.fillStyle = mid;
  tile(scroll * 0.22, WIDTH, (dx) => {
    for (let i = 0; i < count; i++) {
      const x = dx + ((i + 0.3 + hash(i, 5) * 0.4) / count) * WIDTH;
      MID[s.scenery](ctx, x, base - 4, height + (hash(i, 6) - 0.5) * spread, i);
    }
  });
  // Near: small things on the ground line.
  ctx.fillStyle = near;
  tile(scroll * 0.45, WIDTH, (dx) => {
    for (let i = 0; i < 9; i++) {
      const x = dx + ((i + 0.2 + hash(i, 8) * 0.6) / 9) * WIDTH;
      NEAR[s.scenery](ctx, x, base + 2, 34 + hash(i, 9) * 22, i);
    }
  });
  // Mist and midnight get low banks of fog: still, soft, never moving as a flicker.
  if (s.scenery === 'mist' || s.scenery === 'midnight') {
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = withAlpha('#9fb0c4', 0.05);
      ctx.fillRect(0, base - 30 - i * 26, WIDTH, 14);
    }
  }
  ctx.restore();
}

/** The ground: a soft gradient, the line you run on, and tufts that move with the obstacles. */
export function drawGround(ctx: CanvasRenderingContext2D, s: ArtState, colours: { panel: string; line: string }): void {
  const gy = s.groundY;
  ctx.fillStyle = s.flat ? colours.panel : linear(ctx, 0, gy, 0, HEIGHT, [{ at: 0, colour: colours.panel }, { at: 1, colour: '#0a0712' }]);
  ctx.fillRect(0, gy, WIDTH, HEIGHT - gy);
  if (!s.flat) {
    ctx.save();
    ctx.strokeStyle = withAlpha('#9d94b5', 0.22);
    ctx.lineWidth = 2;
    const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec;
    tile(scroll, 80, (dx) => {
      ctx.beginPath();
      for (let x = -80; x <= WIDTH + 80; x += 80) {
        ctx.moveTo(dx + x, gy + 10);
        ctx.lineTo(dx + x - 5, gy + 3);
        ctx.moveTo(dx + x + 6, gy + 10);
        ctx.lineTo(dx + x + 9, gy + 4);
        ctx.moveTo(dx + x - 30, gy + 34);
        ctx.lineTo(dx + x + 6, gy + 34);
      }
      ctx.stroke();
    });
    ctx.restore();
  }
  // The line you run on is an essential graphic: the theme's line colour, solid, 3px.
  ctx.strokeStyle = colours.line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, gy);
  ctx.lineTo(WIDTH, gy);
  ctx.stroke();
}

export interface GhostLook {
  x: number;
  y: number;
  halfWidth: number;
  nowMs: number;
  reducedMotion: boolean;
  faded: boolean;
  streak: number;
  pulse: number;
  lantern: string;
  line: string;
}

/**
 * The ghost: a soft body, a hem that waves, and big eyes. The lantern beside it glows with a radial light
 * that grows with the streak and swells softly on the beat. Drawn at (x, y), the middle of the body.
 */
export function drawGhost(ctx: CanvasRenderingContext2D, g: GhostLook): void {
  const w = Math.max(g.halfWidth, 16) + 6;
  const wave = (i: number): number => (g.reducedMotion ? 0 : Math.sin(g.nowMs / 180 + i * 1.7) * 3);
  const lx = g.x + 32;
  const ly = g.y + 8;
  // Lantern light first, behind everything.
  const radius = 34 + Math.min(g.streak, 10) * 5;
  ctx.save();
  ctx.fillStyle = radial(ctx, lx, ly, 2, radius, [
    { at: 0, colour: withAlpha(g.lantern, 0.42 + g.pulse * PULSE_MAX_ALPHA) },
    { at: 1, colour: withAlpha(g.lantern, 0) },
  ]);
  ctx.beginPath();
  ctx.arc(lx, ly, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = g.faded ? 0.45 : 1;
  // Body: a rounded top and a wavy hem.
  ctx.fillStyle = radial(ctx, g.x - 6, g.y - 14, 4, w * 2, [
    { at: 0, colour: '#fffaf0' },
    { at: 1, colour: '#cfc6e4' },
  ]);
  ctx.beginPath();
  ctx.moveTo(g.x - w, g.y + 26);
  ctx.bezierCurveTo(g.x - w - 4, g.y - 40, g.x + w + 4, g.y - 40, g.x + w, g.y + 26);
  const waves = 4;
  for (let i = waves; i >= 0; i--) {
    const x = g.x - w + (i / waves) * 2 * w;
    ctx.quadraticCurveTo(x + w / waves, g.y + 40 + wave(i), x, g.y + 28 + wave(i + 1) * 0.5);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = g.line;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Eyes and a small round mouth.
  ctx.fillStyle = '#14101f';
  ctx.beginPath();
  ctx.ellipse(g.x - 8, g.y - 8, 4.5, 6.5, 0, 0, Math.PI * 2);
  ctx.ellipse(g.x + 8, g.y - 8, 4.5, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(g.x, g.y + 6, 3.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // The lantern itself, with a little arm.
  ctx.strokeStyle = '#14101f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(g.x + w - 4, g.y + 4);
  ctx.lineTo(lx - 6, ly - 4);
  ctx.stroke();
  ctx.fillStyle = g.lantern;
  ctx.beginPath();
  ctx.arc(lx, ly, 9 + Math.min(g.streak, 10) * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = g.line;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}
