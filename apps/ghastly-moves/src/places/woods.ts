import { blit, hash, linear, radial, tile, withAlpha, type Ctx } from '../gfx';
import type { ArtState } from '../art';
import { BASE, fog, glow, H, moon, ridge, ridgePath, ridgeRim, rimmed, shafts, specks, stars, W, wob } from './common-stages-2-4';

// Stage 3, Whispering Woods, drawn in code. One cold hue (deep green-teal, the colour of wet leaves at night),
// small warm lights (fireflies, a hut window, glowing mushroom caps, the lantern). Depth by layers and fog:
//
//   sky + moon behind thin cloud + wide god-rays
//   far     a pale ridge of pines                       (lightest, lowest contrast)
//   fog
//   hills   darker pines with a crooked hut and its lit window
//   fog
//   mid     huge gnarled trunks with knot-faces, hanging moss, arching roots (in the arena: a ring of trees round a clearing)
//   fog
//   near    ferns, mushrooms (some lit), a fallen log
//   (obstacles, ghost)
//   front   a dark trunk and leaning branches at the screen edges, then a vignette
//
// Static layers are painted once to offscreen canvases. Everything stands still with reduced motion. Fireflies
// breathe at under a tenth of a hertz and nothing ever flashes.

const COLD = {
  skyTop: '#03100f',
  skyMid: '#0a2422',
  skyHorizon: '#1c4440',
  far: '#1b4540',
  farLow: '#12332f',
  hills: '#10322f',
  mid: '#0a201f',
  near: '#06130f',
  front: '#020806',
  rim: '#74c0a6',
  fog: '#92d2c0',
  amber: '#ffd27a',
};
const MOON = { x: 560, y: 100 };

// ---- the sky ---------------------------------------------------------------------------

export function drawWoodsSky(ctx: Ctx, s: ArtState): void {
  ctx.fillStyle = linear(ctx, 0, 0, 0, BASE, [
    { at: 0, colour: COLD.skyTop },
    { at: 0.55, colour: COLD.skyMid },
    { at: 1, colour: COLD.skyHorizon },
  ]);
  ctx.fillRect(0, 0, W, H);
  stars(ctx, 30, BASE - 230, '#e2fff4');
  const mx = s.arena ? 470 : MOON.x;
  const my = s.arena ? 150 : MOON.y;
  const r = s.arena ? 66 : 34;
  moon(ctx, mx, my, r, s.pulse, '#c9f3e3');
  // A thin cloud across the moon's lower half.
  ctx.save();
  ctx.translate(mx - r * 0.1, my + r * 0.5);
  ctx.rotate(-0.05);
  ctx.scale(1, 0.1);
  ctx.fillStyle = radial(ctx, 0, 0, 0, r * 1.8, [
    { at: 0, colour: withAlpha('#bfeede', 0.3) },
    { at: 0.6, colour: withAlpha('#bfeede', 0.12) },
    { at: 1, colour: withAlpha('#bfeede', 0) },
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // God-rays through the canopy: four wide, soft slants.
  shafts(ctx, mx, my + r * 0.5, '#bfeede', [[mx - 120, 80], [mx - 300, 110], [mx + 60, 70], [mx + 220, 90]], 0.075);
}

// ---- pines --------------------------------------------------------------------------------

function pine(g: Ctx, x: number, base: number, h: number, w: number): void {
  // Five stacked, drooping tiers: a tree of triangles.
  g.fillRect(x - 2, base - h * 0.2, 4, h * 0.2);
  const tiers = 5;
  for (let t = 0; t < tiers; t++) {
    const y1 = base - h * (0.12 + (t / tiers) * 0.82);
    const y0 = base - h * (0.12 + ((t + 1.6) / tiers) * 0.82);
    const ww = w * (1 - t / (tiers + 0.6));
    g.beginPath();
    g.moveTo(x - ww, y1);
    g.lineTo(x, Math.max(y0, base - h));
    g.lineTo(x + ww, y1);
    g.lineTo(x + ww * 0.4, y1 - 3);
    g.lineTo(x, y1 + 2);
    g.lineTo(x - ww * 0.4, y1 - 3);
    g.closePath();
    g.fill();
  }
}

// ---- far layer ------------------------------------------------------------------------------

const FAR = { a: [20, 9, 4], k: [2, 6, 12], p: [0.9, 2.1, 0.5] };
const farY = (x: number): number => ridge(x, BASE - 120, FAR.a, FAR.k, FAR.p);

function paintFar(c: Ctx): void {
  c.fillStyle = linear(c, 0, BASE - 190, 0, BASE, [
    { at: 0, colour: COLD.far },
    { at: 1, colour: COLD.farLow },
  ]);
  ridgePath(c, farY, BASE);
  c.fill();
  ridgeRim(c, farY, withAlpha(COLD.rim, 0.4), 1.5);
  rimmed(c, COLD.far, withAlpha(COLD.rim, 0.5), (g) => {
    for (let i = 0; i < 24; i++) {
      const x = 14 + i * 40 + wob(i, 51, 20);
      pine(g, x, farY(x) + 8, 70 + hash(i, 52) * 70, 14 + hash(i, 53) * 8);
    }
  });
}

// ---- second ridge: darker pines and the hut ---------------------------------------------------

const HILLS = { a: [16, 8, 3], k: [3, 7, 13], p: [2.0, 0.3, 1.5] };
const hillY = (x: number): number => ridge(x, BASE - 66, HILLS.a, HILLS.k, HILLS.p);

function paintHills(c: Ctx): void {
  c.fillStyle = COLD.hills;
  ridgePath(c, hillY, BASE);
  c.fill();
  ridgeRim(c, hillY, withAlpha(COLD.rim, 0.3), 1.4);
  rimmed(c, COLD.hills, withAlpha(COLD.rim, 0.45), (g) => {
    for (let i = 0; i < 14; i++) {
      const x = 20 + i * 68 + wob(i, 54, 24);
      if (Math.abs(x - 300) < 70) continue;
      pine(g, x, hillY(x) + 12, 100 + hash(i, 55) * 80, 20 + hash(i, 56) * 10);
    }
    // A crooked hut with a steep roof and a leaning chimney.
    const hx = 300;
    const hy = hillY(hx) + 6;
    g.fillRect(hx - 30, hy - 34, 60, 34);
    g.beginPath();
    g.moveTo(hx - 42, hy - 32);
    g.lineTo(hx - 4, hy - 82);
    g.lineTo(hx + 44, hy - 30);
    g.closePath();
    g.fill();
    g.save();
    g.translate(hx + 20, hy - 60);
    g.rotate(0.12);
    g.fillRect(-4, -24, 8, 26);
    g.restore();
  });
  // The hut's window: warm, with a halo.
  const hx = 300;
  const hy = hillY(hx) + 6;
  glow(c, hx - 8, hy - 18, 34, COLD.amber, 0.45);
  c.fillStyle = withAlpha('#ffe3a8', 0.92);
  c.fillRect(hx - 14, hy - 24, 12, 12);
  c.fillStyle = '#10110d';
  c.fillRect(hx - 9, hy - 24, 2, 12);
  c.fillRect(hx - 14, hy - 19, 12, 2);
}

// ---- mid layer: the trunks -------------------------------------------------------------------

/** A trunk with a flared root and a knot-face: two hollows and a mouth that you only see if you look. */
function trunk(g: Ctx, x: number, base: number, h: number, w: number, lean: number, face: boolean, seed: number): void {
  g.save();
  g.translate(x, base);
  g.rotate(lean);
  g.beginPath();
  g.moveTo(-w * 1.5, 2);
  g.bezierCurveTo(-w * 0.9, -h * 0.06, -w * 0.58, -h * 0.1, -w * 0.52, -h * 0.3);
  g.bezierCurveTo(-w * 0.5, -h * 0.7, -w * 0.4, -h * 0.9, -w * 0.3, -h);
  g.lineTo(w * 0.3, -h);
  g.bezierCurveTo(w * 0.42, -h * 0.9, w * 0.5, -h * 0.7, w * 0.54, -h * 0.3);
  g.bezierCurveTo(w * 0.6, -h * 0.1, w * 0.9, -h * 0.06, w * 1.5, 2);
  g.closePath();
  g.fill();
  // Branches: a few thick arms reaching out and up, each splitting once.
  g.lineCap = 'round';
  for (let b = 0; b < 3; b++) {
    const side = b % 2 ? 1 : -1;
    const y = -h * (0.72 + b * 0.09);
    const len = 70 + hash(seed + b, 57) * 50;
    g.lineWidth = w * 0.34;
    g.beginPath();
    g.moveTo(side * w * 0.3, y);
    g.quadraticCurveTo(side * len * 0.6, y - 22, side * len, y - 46 - hash(seed + b, 58) * 24);
    g.stroke();
    g.lineWidth = w * 0.16;
    g.beginPath();
    g.moveTo(side * len * 0.62, y - 24);
    g.lineTo(side * (len * 0.6 + 22), y - 66);
    g.stroke();
  }
  // Hanging moss.
  g.lineWidth = 2;
  for (let k = 0; k < 7; k++) {
    const mx = side(k) * (30 + k * 9);
    g.beginPath();
    g.moveTo(mx, -h * 0.78 - k * 4);
    g.lineTo(mx + wob(k + seed, 59, 6), -h * 0.78 + 20 + hash(k + seed, 60) * 40);
    g.stroke();
  }
  g.restore();
  if (face) {
    // The knot-face is cut out of the trunk in the sky's colour at low alpha: dark hollows with a pale lower lip.
    g.save();
    g.translate(x, base);
    g.rotate(lean);
    g.fillStyle = 'rgba(2, 8, 7, 0.78)';
    for (const ex of [-w * 0.16, w * 0.16]) {
      g.beginPath();
      g.ellipse(ex, -h * 0.5, w * 0.07, w * 0.12, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.ellipse(0, -h * 0.4, w * 0.12, w * 0.07, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = withAlpha(COLD.rim, 0.3);
    g.lineWidth = 1.2;
    g.beginPath();
    g.ellipse(0, -h * 0.4, w * 0.12, w * 0.07, 0, 0.2 * Math.PI, 0.8 * Math.PI);
    g.stroke();
    g.restore();
  }
}
const side = (k: number): number => (k % 2 ? 1 : -1);

function paintMid(c: Ctx): void {
  rimmed(c, COLD.mid, withAlpha(COLD.rim, 0.5), (g) => {
    g.fillRect(0, BASE - 14, W, 14);
    const spots: [number, number, number, number, boolean][] = [
      [110, 300, 38, -0.02, true],
      [330, 250, 24, 0.03, false],
      [520, 330, 42, 0.02, true],
      [740, 260, 28, -0.04, false],
      [880, 300, 34, 0.02, false],
    ];
    spots.forEach(([x, h, w, lean, face], i) => trunk(g, x, BASE, h, w, lean, face, i * 7));
  });
}

/** The boss's arena: a ring of old trees round a clearing, with a fairy ring of pale mushrooms where the Witch stands. */
function paintArena(c: Ctx): void {
  // The clearing lets the moon's light fall on the ground in front of the Witch.
  glow(c, 700, BASE - 30, 220, '#c9f3e3', 0.12);
  rimmed(c, COLD.mid, withAlpha(COLD.rim, 0.5), (g) => {
    g.fillRect(0, BASE - 14, W, 14);
    const spots: [number, number, number, number, boolean][] = [
      [60, 360, 50, -0.04, true],
      [210, 300, 34, 0.05, false],
      [420, 250, 26, 0.0, false],
      [880, 360, 50, 0.04, true],
      [560, 270, 28, -0.03, false],
    ];
    spots.forEach(([x, h, w, lean, face], i) => trunk(g, x, BASE, h, w, lean, face, i * 5 + 1));
    // A toadstool ring: low caps in a half circle round where the Witch stands.
    for (let k = 0; k < 9; k++) {
      const ang = Math.PI + (k / 8) * Math.PI;
      const x = 700 + Math.cos(ang) * 230;
      const y = BASE - 4 + Math.sin(ang) * 14;
      g.beginPath();
      g.ellipse(x, y - 5, 9 + (k % 3) * 2, 6, 0, Math.PI, 0);
      g.fill();
      g.fillRect(x - 2, y - 5, 4, 7);
    }
  });
  for (let k = 0; k < 9; k += 2) {
    const ang = Math.PI + (k / 8) * Math.PI;
    glow(c, 700 + Math.cos(ang) * 230, BASE - 12 + Math.sin(ang) * 14, 20, COLD.amber, 0.28);
  }
}

// ---- near layer -------------------------------------------------------------------------------

function fern(g: Ctx, x: number, base: number, h: number): void {
  for (let k = -3; k <= 3; k++) {
    const ang = -Math.PI / 2 + k * 0.34;
    const len = h * (1 - Math.abs(k) * 0.1);
    g.lineWidth = 2.2;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, base);
    g.quadraticCurveTo(x + Math.cos(ang) * len * 0.6, base + Math.sin(ang) * len * 0.8, x + Math.cos(ang + 0.5 * Math.sign(k || 1)) * len, base + Math.sin(ang) * len * 0.9 + len * 0.25);
    g.stroke();
    for (let j = 1; j <= 4; j++) {
      const u = j / 5;
      const px = x + Math.cos(ang) * len * 0.7 * u;
      const py = base + Math.sin(ang) * len * 0.8 * u;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + 6 * Math.sign(k || 1), py - 4);
      g.lineTo(px + 1, py + 3);
      g.fill();
    }
  }
}

function mushroom(g: Ctx, x: number, base: number, r: number): void {
  g.fillRect(x - r * 0.18, base - r * 0.9, r * 0.36, r * 0.9);
  g.beginPath();
  g.ellipse(x, base - r * 0.9, r, r * 0.6, 0, Math.PI, 0);
  g.fill();
}

function paintNear(c: Ctx): void {
  const lit = withAlpha(COLD.rim, 0.55);
  rimmed(c, COLD.near, lit, (g) => {
    for (const [x, h] of [[40, 40], [200, 54], [370, 44], [520, 58], [690, 46], [830, 52]] as const) fern(g, x, BASE + 2, h);
    // A fallen log with a broken end.
    g.beginPath();
    g.moveTo(560, BASE + 1);
    g.lineTo(560, BASE - 20);
    g.quadraticCurveTo(640, BASE - 30, 724, BASE - 18);
    g.lineTo(728, BASE + 1);
    g.closePath();
    g.fill();
    // Dark mushrooms.
    for (const [x, r] of [[120, 11], [132, 7], [455, 12], [790, 9], [900, 11]] as const) mushroom(g, x, BASE + 1, r);
  });
  // Glowing mushrooms: the caps are lit from below, warm, with a halo.
  for (const [x, r] of [[290, 13], [305, 8], [640, 12]] as const) {
    glow(c, x, BASE - r, r * 3.4, COLD.amber, 0.38);
    rimmed(c, '#2a2412', withAlpha('#ffe3a8', 0.8), (g) => mushroom(g, x, BASE + 1, r));
    c.fillStyle = withAlpha('#ffe3a8', 0.85);
    c.beginPath();
    c.ellipse(x, BASE - r * 0.9, r * 0.9, r * 0.14, 0, 0, Math.PI);
    c.fill();
  }
}

// ---- foreground ------------------------------------------------------------------------------

const FRONT_W = 1600;

function leafy(g: Ctx, x: number, y: number, len: number, ang: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(10, len * 0.45, 0, len);
  g.quadraticCurveTo(-10, len * 0.45, 0, 0);
  g.fill();
  g.restore();
}

function paintFront(c: Ctx): void {
  rimmed(c, COLD.front, withAlpha(COLD.rim, 0.5), (g) => {
    // A thick dark trunk at the left and another further on, with roots clawing at the ground.
    for (const x of [40, 1190]) {
      g.beginPath();
      g.moveTo(x - 60, H);
      g.bezierCurveTo(x - 36, H - 60, x - 34, H - 200, x - 26, 0);
      g.lineTo(x + 26, 0);
      g.bezierCurveTo(x + 34, H - 200, x + 38, H - 60, x + 70, H);
      g.closePath();
      g.fill();
    }
    // Hanging branches with drooping leaves.
    g.lineCap = 'round';
    for (const [x, dx, dy, w] of [[860, -80, 130, 12], [340, 60, 110, 10], [1300, 90, 120, 11], [1500, -70, 100, 9]] as const) {
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x, -10);
      g.bezierCurveTo(x + dx * 0.2, dy * 0.4, x + dx * 0.9, dy * 0.7, x + dx, dy);
      g.stroke();
      for (let k = 0; k < 6; k++) leafy(g, x + dx * (0.3 + k * 0.12), dy * (0.3 + k * 0.12), 22 + hash(k + x, 61) * 10, (k % 2 ? 0.6 : -0.6) + wob(k, 62, 0.5));
    }
  });
}

function paintLitter(c: Ctx): void {
  rimmed(c, COLD.front, withAlpha(COLD.rim, 0.4), (g) => {
    for (let i = 0; i < 34; i++) {
      const x = i * 28 + hash(i, 63) * 12;
      const h = 12 + hash(i, 64) * 22;
      g.beginPath();
      g.moveTo(x, H);
      g.quadraticCurveTo(x + 4 - hash(i, 65) * 14, H - h * 0.6, x + 8 - hash(i, 66) * 22, H - h);
      g.quadraticCurveTo(x + 7, H - h * 0.5, x + 13, H);
      g.fill();
    }
  });
}

/** Foreground silhouettes pass in front at the edges only, never over the lane the ghost and the stones use. */
export function drawWoodsFront(ctx: Ctx, s: ArtState): void {
  if (s.flat) return;
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec * 1.15;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 40, H);
  ctx.clip();
  tile(scroll, FRONT_W, (dx) => blit(ctx, 'woods-front', FRONT_W, H, dx, 0, paintFront));
  ctx.restore();
  tile(scroll * 1.1, W, (dx) => blit(ctx, 'woods-litter', W, H, dx, 0, paintLitter));
  ctx.fillStyle = radial(ctx, W / 2, H * 0.45, H * 0.45, W * 0.72, [
    { at: 0, colour: 'rgba(1, 8, 6, 0)' },
    { at: 1, colour: 'rgba(1, 8, 6, 0.5)' },
  ]);
  ctx.fillRect(0, 0, W, H);
}

// ---- the leaf path -----------------------------------------------------------------------------

const PATH_H = 156;
const PATH_TOP = 16;

function paintPath(c: Ctx): void {
  const o = PATH_TOP;
  c.fillStyle = linear(c, 0, o, 0, PATH_H, [
    { at: 0, colour: '#26402e' },
    { at: 0.22, colour: '#1a2e22' },
    { at: 0.6, colour: '#0e1b14' },
    { at: 1, colour: '#050a07' },
  ]);
  c.fillRect(0, o, W, PATH_H - o);
  c.fillStyle = linear(c, 0, o, 0, o + 8, [
    { at: 0, colour: withAlpha('#9fe6cc', 0.2) },
    { at: 1, colour: withAlpha('#9fe6cc', 0) },
  ]);
  c.fillRect(0, o, W, 8);
  // Moss patches: soft, lighter, in clumps.
  for (let i = 0; i < 18; i++) {
    const x = hash(i, 130) * W;
    const y = o + 8 + hash(i, 131) * 60;
    c.fillStyle = withAlpha('#4a7a4c', 0.2);
    c.beginPath();
    c.ellipse(x, y, 20 + hash(i, 132) * 26, 5 + hash(i, 133) * 6, 0, 0, Math.PI * 2);
    c.fill();
  }
  // Fallen leaves, each a small pointed ellipse at its own angle.
  for (let i = 0; i < 120; i++) {
    const x = hash(i, 134) * W;
    const y = o + 3 + hash(i, 135) ** 1.5 * (PATH_H - o - 10);
    c.save();
    c.translate(x, y);
    c.rotate(hash(i, 136) * Math.PI);
    c.fillStyle = hash(i, 137) < 0.55 ? withAlpha('#06100b', 0.45) : withAlpha('#8fb07a', 0.14);
    c.beginPath();
    c.ellipse(0, 0, 3 + hash(i, 138) * 3, 1.5, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  // Roots crossing the path: dark, with a pale lower lip.
  c.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const x = 30 + i * 220 + hash(i, 139) * 30;
    const y = o + 24 + hash(i, 140) * 40;
    for (const [dy, colour, width] of [[0, 'rgba(3, 8, 5, 0.6)', 5], [3, withAlpha('#9fe6cc', 0.1), 1.4]] as const) {
      c.strokeStyle = colour;
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(x, y + dy);
      c.bezierCurveTo(x + 40, y - 10 + dy, x + 80, y + 14 + dy, x + 150, y + 2 + dy);
      c.stroke();
    }
  }
  // Short grass tufts on the top edge, dark with a cool rim.
  for (let i = 0; i < 30; i++) {
    const x = 6 + hash(i, 160) * (W - 40);
    for (let b = 0; b < 3; b++) {
      const h = 5 + hash(i * 7 + b, 162) * 8;
      const lean = (b - 1) * 3.4;
      for (const [dx, dy, colour] of [[0.8, -0.8, withAlpha('#7fd0b0', 0.4)], [0, 0, '#07110b']] as const) {
        c.strokeStyle = colour;
        c.lineWidth = 1.7;
        c.beginPath();
        c.moveTo(x + b * 2 + dx, o + 2 + dy);
        c.quadraticCurveTo(x + b * 2 + lean * 0.4 + dx, o - h * 0.6 + dy, x + b * 2 + lean + dx, o - h + dy);
        c.stroke();
      }
    }
  }
  c.fillStyle = '#040806';
  for (let i = 0; i < 60; i++) {
    const x = hash(i, 170) * (W - 12);
    const h = 8 + hash(i, 171) * 16;
    c.beginPath();
    c.moveTo(x, PATH_H);
    c.quadraticCurveTo(x + 2 - hash(i, 172) * 8, PATH_H - h * 0.6, x + 4 - hash(i, 173) * 10, PATH_H - h);
    c.quadraticCurveTo(x + 5, PATH_H - h * 0.5, x + 9, PATH_H);
    c.fill();
  }
}

/** The mossy path under the ghost: cached once, scrolls with the level, still with reduced motion. */
export function drawWoodsGround(ctx: Ctx, s: ArtState): void {
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec;
  tile(scroll, W, (dx) => blit(ctx, 'woods-path', W, PATH_H, dx, s.groundY - PATH_TOP, paintPath));
}

// ---- particles --------------------------------------------------------------------------------

/** Fireflies, drifting pollen and one or two leaves coming down. Still, and dimmer, with reduced motion. */
function particles(ctx: Ctx, s: ArtState): void {
  ctx.save();
  for (let i = 0; i < 18; i++) {
    const t = s.reducedMotion ? 0 : s.nowMs;
    const x = hash(i, 80) * W + Math.sin(t / (3800 + hash(i, 81) * 3000) + i) * 24;
    const y = BASE - 40 - hash(i, 82) * 200 + Math.cos(t / (4500 + hash(i, 83) * 3000) + i * 2) * 14;
    const a = s.reducedMotion ? 0.32 : 0.34 + 0.16 * Math.sin(t / 1700 + i * 1.9);
    ctx.fillStyle = radial(ctx, x, y, 0.5, 8, [
      { at: 0, colour: withAlpha('#ffe08a', a) },
      { at: 1, colour: withAlpha('#ffe08a', 0) },
    ]);
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  specks(ctx, s, 14, '#e6fff2', 0.2, 1);
  // Three leaves falling very slowly.
  ctx.save();
  ctx.fillStyle = withAlpha('#0a1a12', 0.9);
  for (let i = 0; i < 3; i++) {
    const t = s.reducedMotion ? 0 : s.nowMs / 1000;
    const span = BASE - 40;
    const y = ((hash(i, 90) * span + t * (10 + i * 3)) % span) + 0;
    const x = hash(i, 91) * W + Math.sin(t * 0.6 + i) * 20;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.5 + i);
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ---- all the layers -----------------------------------------------------------------------------

export function drawWoodsLayers(ctx: Ctx, s: ArtState): void {
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec;
  const layer = (key: string, speed: number, paint: (c: Ctx) => void): void => tile(scroll * speed, W, (dx) => blit(ctx, key, W, H, dx, 0, paint));
  layer('woods-far', 0.05, paintFar);
  fog(ctx, COLD.fog, BASE - 190, BASE - 70, 0.16);
  layer('woods-hills', 0.12, paintHills);
  fog(ctx, COLD.fog, BASE - 120, BASE - 20, 0.14);
  layer(s.arena ? 'woods-arena' : 'woods-mid', 0.22, s.arena ? paintArena : paintMid);
  fog(ctx, COLD.fog, BASE - 80, BASE, 0.12);
  layer('woods-near', 0.45, paintNear);
  particles(ctx, s);
}

/** The layers, far to near, for the report. */
export const WOODS_LAYERS = ['sky, moon behind cloud, god-rays', 'pale pine ridge', 'darker pines with a crooked hut and lit window', 'gnarled trunks with knot-faces and moss (arena: ring of trees and toadstools)', 'ferns, mushrooms (some lit), fallen log', 'foreground trunks and hanging branches'] as const;
