import { blit, hash, linear, radial, tile, withAlpha, type Ctx } from './gfx';
import type { ArtState } from './art';

// Stage 1, the Pumpkin Patch, drawn in code. One cold hue (deep blue-violet night), small warm lights
// (pumpkin glow, a church window, the lantern), and depth by layers and fog:
//
//   sky + moon + moon shafts
//   far     hill, church spire, dead tree          (lightest, lowest contrast)
//   fog
//   hills   a second, nearer ridge with distant lit pumpkins
//   mid     fence and leaning scarecrows
//   fog
//   near    vines and pumpkins on the ground line, some lit
//   (obstacles, ghost)
//   front   dark silhouette vines and a gate post at the screen edges, then a vignette
//
// Each static layer is painted once to an offscreen canvas and then blitted with an offset. Everything
// stands still with reduced motion. Nothing flashes: the only slow change is a firefly's glow, at under
// a tenth of a hertz.

const W = 960;
const H = 540;
const BASE = 400;
const MOON = { x: 600, y: 104 };

const COLD = {
  skyTop: '#060919',
  skyMid: '#111743',
  skyHorizon: '#2b2a5e',
  far: '#272f66',
  farLow: '#1b2252',
  hills: '#1a2050',
  mid: '#111638',
  near: '#0b0e26',
  front: '#03040b',
  rim: '#5b6cb0',
  fog: '#8e9be0',
  amber: '#ffa940',
};

/** Draw a shape twice: first shifted up and right in the moon's rim colour, then in its own colour on top. */
function rimmed(c: Ctx, body: string, rim: string, draw: (c: Ctx) => void): void {
  c.save();
  c.translate(1.6, -1.6);
  c.fillStyle = rim;
  c.strokeStyle = rim;
  draw(c);
  c.restore();
  c.fillStyle = body;
  c.strokeStyle = body;
  draw(c);
}

/** A ridge height at x that repeats exactly every W px (whole numbers of cycles), so a layer tiles without a seam. */
function ridge(x: number, base: number, a: number[], k: number[], p: number[]): number {
  let y = base;
  for (let i = 0; i < a.length; i++) y -= a[i]! * Math.sin((2 * Math.PI * k[i]! * x) / W + p[i]!);
  return y;
}

function ridgePath(c: Ctx, top: (x: number) => number, bottom: number): void {
  c.beginPath();
  c.moveTo(0, bottom);
  for (let x = 0; x <= W; x += 12) c.lineTo(x, top(x));
  c.lineTo(W, bottom);
  c.closePath();
}

// ---- the sky --------------------------------------------------------------------

/** Night sky, still stars, the moon (a big one for the boss's arena) and long soft shafts of moonlight. */
export function drawPatchSky(ctx: Ctx, s: ArtState): void {
  ctx.fillStyle = linear(ctx, 0, 0, 0, BASE, [
    { at: 0, colour: COLD.skyTop },
    { at: 0.55, colour: COLD.skyMid },
    { at: 1, colour: COLD.skyHorizon },
  ]);
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.fillStyle = '#dfe3ff';
  for (let i = 0; i < 46; i++) {
    ctx.globalAlpha = 0.2 + hash(i, 3) * 0.4;
    const r = hash(i, 4) > 0.88 ? 1.7 : 1;
    ctx.fillRect(hash(i, 1) * W, hash(i, 2) * (BASE - 190), r, r);
  }
  ctx.restore();
  // The moon, its halo swelling a little on the beat (never more than PULSE_MAX_ALPHA, none with reduced motion).
  const mx = s.arena ? 520 : MOON.x;
  const my = s.arena ? 175 : MOON.y;
  const r = s.arena ? 78 : 38;
  ctx.save();
  ctx.fillStyle = radial(ctx, mx, my, r * 0.7, r * 3.6, [
    { at: 0, colour: withAlpha('#c9d2ff', 0.3 + s.pulse * 0.1) },
    { at: 1, colour: withAlpha('#c9d2ff', 0) },
  ]);
  ctx.beginPath();
  ctx.arc(mx, my, r * 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = radial(ctx, mx - r * 0.3, my - r * 0.3, 2, r * 1.2, [
    { at: 0, colour: '#f3f1e4' },
    { at: 1, colour: '#cfd3e6' },
  ]);
  ctx.beginPath();
  ctx.arc(mx, my, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = withAlpha('#8d93b8', 0.4);
  ctx.beginPath();
  ctx.arc(mx - r * 0.32, my - r * 0.18, r * 0.2, 0, Math.PI * 2);
  ctx.arc(mx + r * 0.26, my + r * 0.3, r * 0.14, 0, Math.PI * 2);
  ctx.arc(mx + r * 0.1, my - r * 0.45, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  // A few thin clouds across the moon, in the sky's own colour, so it is not a flat disc.
  ctx.fillStyle = withAlpha(COLD.skyMid, 0.55);
  ctx.beginPath();
  ctx.ellipse(mx - r * 0.2, my + r * 0.55, r * 1.2, r * 0.1, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Shafts of moonlight through the mist: three long, soft slants.
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const spread = 70 + i * 40;
    const bx = mx - 140 - i * 170;
    ctx.fillStyle = linear(ctx, mx, my, bx, BASE, [
      { at: 0, colour: withAlpha('#b9c4ff', 0.09) },
      { at: 1, colour: withAlpha('#b9c4ff', 0) },
    ]);
    ctx.beginPath();
    ctx.moveTo(mx - 10, my + r * 0.5);
    ctx.lineTo(mx + 14, my + r * 0.5);
    ctx.lineTo(bx + spread, BASE);
    ctx.lineTo(bx - spread * 0.4, BASE);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---- far layer: the hill, the church, the dead tree -----------------------------------

const FAR = { a: [26, 12, 5], k: [2, 5, 11], p: [0.6, 1.9, 0.3] };
const farY = (x: number): number => ridge(x, BASE - 138, FAR.a, FAR.k, FAR.p);

function branch(c: Ctx, x: number, y: number, angle: number, len: number, width: number, depth: number, seed: number): void {
  if (depth === 0 || len < 4) return;
  const x2 = x + Math.cos(angle) * len;
  const y2 = y + Math.sin(angle) * len;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo((x + x2) / 2 + (hash(seed, 1) - 0.5) * len * 0.3, (y + y2) / 2, x2, y2);
  c.stroke();
  const n = hash(seed, 2) > 0.45 ? 2 : 3;
  for (let i = 0; i < n; i++) {
    const turn = (i - (n - 1) / 2) * 0.62 + (hash(seed, 3 + i) - 0.5) * 0.35;
    branch(c, x2, y2, angle + turn, len * (0.66 + hash(seed, 7 + i) * 0.12), width * 0.68, depth - 1, seed * 3 + i + 1);
  }
}

function paintFar(c: Ctx): void {
  c.fillStyle = linear(c, 0, BASE - 190, 0, BASE, [
    { at: 0, colour: COLD.far },
    { at: 1, colour: COLD.farLow },
  ]);
  ridgePath(c, farY, BASE);
  c.fill();
  // Rim light along the ridge, on the side the moon lights.
  c.strokeStyle = withAlpha(COLD.rim, 0.45);
  c.lineWidth = 1.6;
  c.beginPath();
  for (let x = 0; x <= W; x += 12) (x === 0 ? c.moveTo(x, farY(x) - 0.5) : c.lineTo(x, farY(x) - 0.5));
  c.stroke();
  // The church: nave, tower, spire, a lancet window with a small warm light.
  const cx = 290;
  const cy = farY(cx) + 4;
  rimmed(c, COLD.far, withAlpha(COLD.rim, 0.6), (g) => {
    g.fillRect(cx - 46, cy - 38, 62, 38);
    g.beginPath();
    g.moveTo(cx - 50, cy - 38);
    g.lineTo(cx - 15, cy - 56);
    g.lineTo(cx + 20, cy - 38);
    g.fill();
    g.fillRect(cx + 14, cy - 92, 24, 92);
    g.beginPath();
    g.moveTo(cx + 11, cy - 92);
    g.lineTo(cx + 26, cy - 150);
    g.lineTo(cx + 41, cy - 92);
    g.fill();
    g.fillRect(cx + 25, cy - 162, 2, 14);
    g.fillRect(cx + 21, cy - 158, 10, 2);
  });
  c.fillStyle = radial(c, cx - 22, cy - 22, 1, 20, [
    { at: 0, colour: withAlpha(COLD.amber, 0.5) },
    { at: 1, colour: withAlpha(COLD.amber, 0) },
  ]);
  c.beginPath();
  c.arc(cx - 22, cy - 22, 20, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = withAlpha('#ffc470', 0.8);
  c.beginPath();
  c.moveTo(cx - 25, cy - 12);
  c.lineTo(cx - 25, cy - 26);
  c.quadraticCurveTo(cx - 22, cy - 32, cx - 19, cy - 26);
  c.lineTo(cx - 19, cy - 12);
  c.fill();
  // The dead tree on the same hill.
  const tx = 700;
  const ty = farY(tx) + 6;
  c.strokeStyle = COLD.far;
  c.fillStyle = COLD.far;
  branch(c, tx, ty, -Math.PI / 2 + 0.05, 46, 9, 6, 5);
  c.strokeStyle = withAlpha(COLD.rim, 0.4);
  c.save();
  c.translate(1.4, -1.4);
  c.globalCompositeOperation = 'destination-over';
  branch(c, tx, ty, -Math.PI / 2 + 0.05, 46, 9, 6, 5);
  c.restore();
}

// ---- second ridge, with lights far away --------------------------------------------

const HILLS = { a: [20, 9, 4], k: [3, 7, 13], p: [2.2, 0.4, 1.1] };
const hillY = (x: number): number => ridge(x, BASE - 76, HILLS.a, HILLS.k, HILLS.p);

function paintHills(c: Ctx): void {
  c.fillStyle = COLD.hills;
  ridgePath(c, hillY, BASE);
  c.fill();
  c.strokeStyle = withAlpha(COLD.rim, 0.3);
  c.lineWidth = 1.4;
  c.beginPath();
  for (let x = 0; x <= W; x += 12) (x === 0 ? c.moveTo(x, hillY(x) - 0.5) : c.lineTo(x, hillY(x) - 0.5));
  c.stroke();
  // Rows of far pumpkins on the hill: tiny warm lights.
  for (let i = 0; i < 9; i++) {
    const x = 40 + (i / 9) * (W - 80) + hash(i, 12) * 40;
    const y = hillY(x) + 10 + hash(i, 13) * 14;
    c.fillStyle = radial(c, x, y, 1, 16, [
      { at: 0, colour: withAlpha(COLD.amber, 0.38) },
      { at: 1, colour: withAlpha(COLD.amber, 0) },
    ]);
    c.beginPath();
    c.arc(x, y, 16, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = withAlpha('#d9792b', 0.75);
    c.beginPath();
    c.ellipse(x, y, 4.5, 3.6, 0, 0, Math.PI * 2);
    c.fill();
  }
}

// ---- mid layer: fence and scarecrows ---------------------------------------------------

function scarecrow(g: Ctx, x: number, base: number, lean: number, h: number): void {
  g.save();
  g.translate(x, base);
  g.rotate(lean);
  g.lineCap = 'round';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, -h);
  g.stroke();
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(-h * 0.42, -h * 0.72);
  g.lineTo(h * 0.42, -h * 0.7);
  g.stroke();
  // Ragged straw at the hands, and a torn coat.
  g.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(side * h * 0.42, -h * 0.71);
      g.lineTo(side * (h * 0.42 + 8 + i * 2), -h * 0.71 + (i - 2) * 6);
      g.stroke();
    }
  }
  g.beginPath();
  g.moveTo(-h * 0.2, -h * 0.74);
  g.lineTo(h * 0.2, -h * 0.74);
  g.lineTo(h * 0.15, -h * 0.4);
  g.lineTo(h * 0.07, -h * 0.34);
  g.lineTo(0, -h * 0.42);
  g.lineTo(-h * 0.08, -h * 0.33);
  g.lineTo(-h * 0.16, -h * 0.4);
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(0, -h * 0.9, h * 0.12, 0, Math.PI * 2);
  g.fill();
  // A floppy hat.
  g.beginPath();
  g.ellipse(0, -h * 1.0, h * 0.24, h * 0.04, 0, 0, Math.PI * 2);
  g.moveTo(-h * 0.12, -h * 1.0);
  g.quadraticCurveTo(-h * 0.06, -h * 1.22, h * 0.14, -h * 1.12);
  g.lineTo(h * 0.12, -h * 1.0);
  g.fill();
  g.restore();
}

function paintMid(c: Ctx): void {
  const lit = withAlpha(COLD.rim, 0.5);
  // Fence: leaning posts and two rails across the whole tile.
  rimmed(c, COLD.mid, lit, (g) => {
    g.fillRect(0, BASE - 46, W, 4);
    g.fillRect(0, BASE - 24, W, 4);
    for (let i = 0; i < 14; i++) {
      const x = 30 + i * 68 + (hash(i, 20) - 0.5) * 18;
      if (Math.abs(x - 240) < 40 || Math.abs(x - 690) < 40) continue;
      const h = 54 + hash(i, 21) * 22;
      g.save();
      g.translate(x, BASE);
      g.rotate((hash(i, 22) - 0.5) * 0.28);
      g.beginPath();
      g.moveTo(-5, 0);
      g.lineTo(-5, -h);
      g.lineTo(0, -h - 9);
      g.lineTo(5, -h);
      g.lineTo(5, 0);
      g.closePath();
      g.fill();
      g.restore();
    }
    scarecrow(g, 240, BASE, -0.1, 118);
    scarecrow(g, 690, BASE, 0.14, 104);
  });
}

// ---- near layer: vines and pumpkins --------------------------------------------------------

function pumpkinShape(g: Ctx, x: number, y: number, r: number): void {
  // Three overlapping lobes make the ribbed gourd.
  g.beginPath();
  g.ellipse(x, y, r * 0.62, r * 0.82, 0, 0, Math.PI * 2);
  g.ellipse(x - r * 0.5, y + r * 0.04, r * 0.55, r * 0.76, 0, 0, Math.PI * 2);
  g.ellipse(x + r * 0.5, y + r * 0.04, r * 0.55, r * 0.76, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(x - r * 0.07, y - r * 1.05, r * 0.14, r * 0.3);
}

function curl(g: Ctx, x: number, y: number, size: number, dir: number): void {
  g.lineWidth = 2;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x, y);
  g.bezierCurveTo(x + dir * size, y - size * 0.2, x + dir * size * 1.1, y - size * 1.2, x + dir * size * 0.3, y - size * 1.1);
  g.bezierCurveTo(x - dir * size * 0.2, y - size, x, y - size * 0.6, x + dir * size * 0.3, y - size * 0.6);
  g.stroke();
}

function paintNear(c: Ctx): void {
  const lit = withAlpha(COLD.rim, 0.55);
  // A creeping vine along the ground with leaves and curls.
  rimmed(c, COLD.near, lit, (g) => {
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, BASE + 1);
    for (let x = 0; x <= W; x += 40) g.lineTo(x, BASE - 6 - Math.sin((x / W) * Math.PI * 6) * 5);
    g.stroke();
    for (let i = 0; i < 14; i++) {
      const x = 20 + i * 68 + hash(i, 30) * 20;
      const y = BASE - 6 - Math.sin((x / W) * Math.PI * 6) * 5;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 10, y - 20, x + 24, y - 8);
      g.quadraticCurveTo(x + 10, y - 2, x, y);
      g.fill();
      if (i % 3 === 0) curl(g, x + 6, y, 18, i % 2 ? 1 : -1);
    }
  });
  // Pumpkins: dark silhouettes with a rim, and some lit from inside with a halo.
  const spots: { x: number; r: number; lit: boolean }[] = [
    { x: 70, r: 22, lit: false },
    { x: 150, r: 15, lit: true },
    { x: 330, r: 26, lit: false },
    { x: 420, r: 17, lit: true },
    { x: 560, r: 21, lit: false },
    { x: 770, r: 25, lit: true },
    { x: 880, r: 18, lit: false },
  ];
  for (const p of spots) {
    const y = BASE - p.r * 0.8;
    if (p.lit) {
      c.fillStyle = radial(c, p.x, y, p.r * 0.4, p.r * 3.4, [
        { at: 0, colour: withAlpha(COLD.amber, 0.36) },
        { at: 1, colour: withAlpha(COLD.amber, 0) },
      ]);
      c.beginPath();
      c.arc(p.x, y, p.r * 3.4, 0, Math.PI * 2);
      c.fill();
    }
    if (p.lit) {
      rimmed(c, '#3a170c', withAlpha('#ffb868', 0.7), (g) => pumpkinShape(g, p.x, y, p.r));
      // Carved eyes and mouth, glowing.
      c.fillStyle = '#ffc060';
      c.beginPath();
      c.moveTo(p.x - p.r * 0.4, y - p.r * 0.15);
      c.lineTo(p.x - p.r * 0.15, y - p.r * 0.15);
      c.lineTo(p.x - p.r * 0.28, y - p.r * 0.45);
      c.moveTo(p.x + p.r * 0.4, y - p.r * 0.15);
      c.lineTo(p.x + p.r * 0.15, y - p.r * 0.15);
      c.lineTo(p.x + p.r * 0.28, y - p.r * 0.45);
      c.moveTo(p.x - p.r * 0.38, y + p.r * 0.2);
      c.quadraticCurveTo(p.x, y + p.r * 0.55, p.x + p.r * 0.38, y + p.r * 0.2);
      c.quadraticCurveTo(p.x, y + p.r * 0.36, p.x - p.r * 0.38, y + p.r * 0.2);
      c.fill();
    } else {
      rimmed(c, COLD.near, lit, (g) => pumpkinShape(g, p.x, y, p.r));
    }
    c.strokeStyle = COLD.near;
    curl(c, p.x + 2, y - p.r * 1.0, p.r * 0.9, p.x % 2 ? 1 : -1);
  }
}

// ---- foreground: dark silhouettes at the screen's edges -----------------------------------

const FRONT_W = 1600;

function thickVine(g: Ctx, x: number, y: number, dx: number, dy: number, w: number): void {
  // A tapering vine made of strokes of falling width, ending in a curl.
  for (let i = 0; i < 4; i++) {
    g.lineWidth = w * (1 - i * 0.22);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + dx * 0.2, y + dy * 0.45, x - dx * 0.5, y + dy * 0.7, x + dx * (0.5 + i * 0.12), y + dy * (0.8 + i * 0.07));
    g.stroke();
  }
  g.lineWidth = Math.max(2, w * 0.3);
  g.beginPath();
  g.moveTo(x + dx * 0.74, y + dy * 0.98);
  g.bezierCurveTo(x + dx * 1.1, y + dy * 1.1, x + dx * 1.2, y + dy * 0.78, x + dx * 0.9, y + dy * 0.75);
  g.stroke();
  for (let i = 1; i <= 3; i++) {
    const lx = x + dx * (0.2 + i * 0.08);
    const ly = y + dy * (0.2 + i * 0.22);
    g.beginPath();
    g.moveTo(lx, ly);
    g.quadraticCurveTo(lx + 26, ly - 8, lx + 40, ly + 12);
    g.quadraticCurveTo(lx + 16, ly + 18, lx, ly);
    g.fill();
  }
}

function paintFront(c: Ctx): void {
  rimmed(c, COLD.front, withAlpha(COLD.rim, 0.5), (g) => {
    // A stone gate post with a ball cap, wrapped in ivy.
    const px = 58;
    g.fillRect(px - 26, H - 330, 52, 330);
    g.fillRect(px - 32, H - 342, 64, 16);
    g.beginPath();
    g.arc(px, H - 358, 16, 0, Math.PI * 2);
    g.fill();
    thickVine(g, px - 30, H - 260, -4, 120, 7);
    // Hanging vines from the top, at the right edge and the left.
    thickVine(g, 900, -10, -60, 150, 12);
    thickVine(g, 330, -10, 50, 120, 11);
    thickVine(g, 1260, -10, 80, 140, 11);
    thickVine(g, 1480, -10, -90, 110, 9);
    // A second post.
    g.fillRect(1180 - 22, H - 300, 44, 300);
    g.fillRect(1180 - 28, H - 312, 56, 14);
  });
}

function paintGrass(c: Ctx): void {
  rimmed(c, COLD.front, withAlpha(COLD.rim, 0.4), (g) => {
    for (let i = 0; i < 36; i++) {
      const x = i * 27 + hash(i, 40) * 12;
      const h = 14 + hash(i, 41) * 26;
      g.beginPath();
      g.moveTo(x, H);
      g.quadraticCurveTo(x + 4 - hash(i, 42) * 14, H - h * 0.6, x + 8 - hash(i, 43) * 22, H - h);
      g.quadraticCurveTo(x + 7, H - h * 0.5, x + 13, H);
      g.fill();
    }
  });
}

/** Foreground silhouettes pass in front at the screen edges only, never over the lane the ghost and the stones use. */
export function drawPatchFront(ctx: Ctx, s: ArtState): void {
  if (s.flat) return;
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec * 1.15;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 96, H);
  ctx.rect(W - 120, 0, 120, 56);
  ctx.clip();
  tile(scroll, FRONT_W, (dx) => blit(ctx, 'patch-front', FRONT_W, H, dx, 0, paintFront));
  ctx.restore();
  // Grass blades along the very bottom, in front of everything.
  tile(scroll * 1.1, W, (dx) => blit(ctx, 'patch-grass', W, H, dx, 0, paintGrass));
  // A vignette: the corners fall away into the dark. Soft, still, and light enough to keep text above 4.5:1.
  ctx.fillStyle = radial(ctx, W / 2, H * 0.45, H * 0.45, W * 0.72, [
    { at: 0, colour: 'rgba(2, 3, 12, 0)' },
    { at: 1, colour: 'rgba(2, 3, 12, 0.5)' },
  ]);
  ctx.fillRect(0, 0, W, H);
}

// ---- arena -------------------------------------------------------------------------------

function paintArena(c: Ctx): void {
  // A ring of tall dead cornstalks: thick at the sides, a few behind the boss.
  rimmed(c, COLD.mid, withAlpha(COLD.rim, 0.5), (g) => {
    g.lineCap = 'round';
    const at = [18, 52, 88, 128, 170, 214, 258, 560, 610, 940, 905, 868, 830, 795];
    at.forEach((x, i) => {
      const h = 210 + hash(i, 50) * 110;
      const lean = (x < W / 2 ? 1 : -1) * (0.04 + hash(i, 51) * 0.08);
      g.save();
      g.translate(x, BASE);
      g.rotate(lean);
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -h);
      g.stroke();
      for (let j = 0; j < 4; j++) {
        const y = -h * (0.35 + j * 0.16);
        const side = j % 2 ? 1 : -1;
        g.beginPath();
        g.moveTo(0, y);
        g.quadraticCurveTo(side * 40, y - 30, side * 62, y + 26 + j * 6);
        g.quadraticCurveTo(side * 30, y - 6, 0, y + 4);
        g.fill();
      }
      g.beginPath();
      g.moveTo(-4, -h);
      g.quadraticCurveTo(0, -h - 36, 6, -h - 4);
      g.fill();
      g.restore();
    });
  });
}

/** The raised mound the Pumpkin King stands on, at (x, groundY). */
export const MOUND_HEIGHT = 30;
export function drawMound(ctx: Ctx, x: number, groundY: number): void {
  ctx.save();
  ctx.fillStyle = linear(ctx, 0, groundY - MOUND_HEIGHT, 0, groundY + 10, [
    { at: 0, colour: '#161b46' },
    { at: 1, colour: '#0a0c24' },
  ]);
  ctx.beginPath();
  ctx.moveTo(x - 190, groundY + 4);
  ctx.bezierCurveTo(x - 140, groundY - 6, x - 100, groundY - MOUND_HEIGHT, x, groundY - MOUND_HEIGHT);
  ctx.bezierCurveTo(x + 100, groundY - MOUND_HEIGHT, x + 140, groundY - 6, x + 190, groundY + 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = withAlpha(COLD.rim, 0.5);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 120, groundY - 12);
  ctx.bezierCurveTo(x - 90, groundY - MOUND_HEIGHT + 2, x - 40, groundY - MOUND_HEIGHT - 1, x + 10, groundY - MOUND_HEIGHT - 1);
  ctx.stroke();
  // Roots and small pumpkins at its foot.
  ctx.strokeStyle = '#0a0c24';
  ctx.lineWidth = 4;
  for (let i = 0; i < 5; i++) {
    const rx = x - 80 + i * 40;
    ctx.beginPath();
    ctx.moveTo(rx, groundY - MOUND_HEIGHT + 6);
    ctx.quadraticCurveTo(rx + (i - 2) * 22, groundY - 6, rx + (i - 2) * 34, groundY + 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ---- particles ----------------------------------------------------------------------------

/** Fireflies and drifting seed fluff. Still, and dimmer, with reduced motion. */
function drawParticles(ctx: Ctx, s: ArtState): void {
  ctx.save();
  for (let i = 0; i < 16; i++) {
    const t = s.reducedMotion ? 0 : s.nowMs;
    const x = hash(i, 60) * W + Math.sin(t / (3600 + hash(i, 61) * 3000) + i) * 22;
    const y = BASE - 50 - hash(i, 62) * 190 + Math.cos(t / (4300 + hash(i, 63) * 3000) + i * 2) * 14;
    // 0.1 Hz at most, and a gentle range: a glow that breathes, never a flash.
    const a = s.reducedMotion ? 0.32 : 0.34 + 0.16 * Math.sin(t / 1700 + i * 1.9);
    ctx.fillStyle = radial(ctx, x, y, 0.5, 8, [
      { at: 0, colour: withAlpha('#ffd57a', a) },
      { at: 1, colour: withAlpha('#ffd57a', 0) },
    ]);
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = withAlpha('#dfe3ff', 0.22);
  for (let i = 0; i < 12; i++) {
    const t = s.reducedMotion ? 0 : s.nowMs / 1000;
    const x = (((hash(i, 70) * W + t * (6 + hash(i, 71) * 6)) % W) + W) % W;
    const y = (((hash(i, 72) * (BASE - 60) + t * (4 + hash(i, 73) * 5)) % (BASE - 60)) + BASE - 60) % (BASE - 60);
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  ctx.restore();
}

// ---- all the layers -------------------------------------------------------------------------

function fog(ctx: Ctx, top: number, bottom: number, alpha: number): void {
  ctx.fillStyle = linear(ctx, 0, top, 0, bottom, [
    { at: 0, colour: withAlpha(COLD.fog, 0) },
    { at: 0.7, colour: withAlpha(COLD.fog, alpha) },
    { at: 1, colour: withAlpha(COLD.fog, alpha * 0.6) },
  ]);
  ctx.fillRect(0, top, W, bottom - top);
}

/** The five layers, far to near, with fog between them. Each lighter and softer the further it is. */
export function drawPatchLayers(ctx: Ctx, s: ArtState): void {
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec;
  const layer = (key: string, speed: number, paint: (c: Ctx) => void): void => tile(scroll * speed, W, (dx) => blit(ctx, key, W, H, dx, 0, paint));
  layer('patch-far', 0.05, paintFar);
  fog(ctx, BASE - 190, BASE - 70, 0.16);
  layer('patch-hills', 0.12, paintHills);
  fog(ctx, BASE - 120, BASE - 20, 0.12);
  if (s.arena) layer('patch-arena', 0.22, paintArena);
  else layer('patch-mid', 0.22, paintMid);
  fog(ctx, BASE - 80, BASE, 0.12);
  layer('patch-near', 0.45, paintNear);
  drawParticles(ctx, s);
}

/** The layers, far to near, for the report. */
export const PATCH_LAYERS = ['sky', 'far hill, church, dead tree', 'second ridge with far lights', 'fence and scarecrows', 'vines and pumpkins', 'foreground silhouettes'] as const;
