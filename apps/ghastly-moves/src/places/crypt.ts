import { blit, hash, linear, radial, tile, withAlpha, type Ctx } from '../gfx';
import type { ArtState } from '../art';
import { BASE, fog, glow, H, moon, ridge, ridgePath, ridgeRim, rimmed, shafts, specks, stars, W, wob } from './common-stages-2-4';

// Stage 2, Crypt Steps, drawn in code. One cold hue (slate teal, the cold of old stone), small warm lights
// (candles on the columns, a lit crypt door, the lantern). Depth by layers and fog:
//
//   sky + low moon + cloud wisps + moon shafts
//   far     ridge with a mausoleum and cypress trees         (lightest, lowest contrast)
//   fog
//   hills   a nearer ridge of crosses, headstones and a weeping angel, with far candles
//   fog
//   mid     a ruined arcade of pointed arches with candle sconces (in the boss arena: one huge arch and heavy pillars)
//   fog
//   near    leaning slabs, skull heaps, candle stubs, an iron fence
//   (obstacles, ghost)
//   front   dark pillars and hanging chains at the screen edges, then a vignette
//
// Static layers are painted once to offscreen canvases. Everything stands still with reduced motion. The only
// slow change is dust, and a candle halo that breathes at under a fifth of a hertz. Nothing flashes.

const COLD = {
  skyTop: '#04090f',
  skyMid: '#0b1a28',
  skyHorizon: '#213a4a',
  far: '#1f3a4c',
  farLow: '#152a3a',
  hills: '#142a3a',
  mid: '#0c1927',
  near: '#070f19',
  front: '#02050a',
  rim: '#6fa6c0',
  fog: '#8fbbd0',
  amber: '#ff9a4d',
};
const MOON = { x: 640, y: 112 };

// ---- the sky ---------------------------------------------------------------------------

export function drawCryptSky(ctx: Ctx, s: ArtState): void {
  ctx.fillStyle = linear(ctx, 0, 0, 0, BASE, [
    { at: 0, colour: COLD.skyTop },
    { at: 0.55, colour: COLD.skyMid },
    { at: 1, colour: COLD.skyHorizon },
  ]);
  ctx.fillRect(0, 0, W, H);
  stars(ctx, 40, BASE - 200);
  const mx = s.arena ? 560 : MOON.x;
  const my = s.arena ? 160 : MOON.y;
  const r = s.arena ? 70 : 36;
  moon(ctx, mx, my, r, s.pulse, '#bfe0f2');
  // Two thin wisps of cloud across the moon's lower half: pale, soft at both ends, never a dark bar.
  ctx.save();
  for (const [dy, len, a] of [[0.38, 1.7, 0.3], [0.7, 2.3, 0.18]] as const) {
    ctx.save();
    ctx.translate(mx - r * 0.2, my + r * dy);
    ctx.rotate(-0.04);
    ctx.scale(1, 0.1);
    ctx.fillStyle = radial(ctx, 0, 0, 0, r * len, [
      { at: 0, colour: withAlpha('#b9d6e8', a) },
      { at: 0.6, colour: withAlpha('#b9d6e8', a * 0.4) },
      { at: 1, colour: withAlpha('#b9d6e8', 0) },
    ]);
    ctx.beginPath();
    ctx.arc(0, 0, r * len, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  shafts(ctx, mx, my + r * 0.5, '#a9d0e6', [[mx - 170, 70], [mx - 340, 100], [mx + 40, 60]], 0.08);
}

// ---- helpers for stone ------------------------------------------------------------------

/** A pointed (gothic) arch between x0 and x1, springing at `spring` and peaking at `apex`. */
function arch(g: Ctx, x0: number, x1: number, spring: number, apex: number): void {
  const mid = (x0 + x1) / 2;
  g.moveTo(x0, spring);
  g.quadraticCurveTo(x0 + (mid - x0) * 0.1, apex + (spring - apex) * 0.45, mid, apex);
  g.quadraticCurveTo(x1 - (x1 - mid) * 0.1, apex + (spring - apex) * 0.45, x1, spring);
}

function column(g: Ctx, x: number, base: number, h: number, w: number): void {
  g.fillRect(x - w / 2, base - h, w, h);
  g.fillRect(x - w * 0.75, base - h - 8, w * 1.5, 10); // capital
  g.fillRect(x - w * 0.7, base - 10, w * 1.4, 10); // plinth
}

function cross(g: Ctx, x: number, y: number, h: number, lean: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(lean);
  g.fillRect(-2.5, -h, 5, h);
  g.fillRect(-h * 0.3, -h * 0.78, h * 0.6, 4.5);
  g.restore();
}

// ---- far layer: ridge, mausoleum, cypresses --------------------------------------------------

const FAR = { a: [22, 11, 5], k: [2, 5, 11], p: [1.4, 0.7, 2.3] };
const farY = (x: number): number => ridge(x, BASE - 136, FAR.a, FAR.k, FAR.p);

function cypress(g: Ctx, x: number, base: number, h: number): void {
  g.beginPath();
  g.moveTo(x - h * 0.1, base);
  g.bezierCurveTo(x - h * 0.2, base - h * 0.45, x - h * 0.05, base - h * 0.8, x, base - h);
  g.bezierCurveTo(x + h * 0.05, base - h * 0.8, x + h * 0.2, base - h * 0.45, x + h * 0.1, base);
  g.closePath();
  g.fill();
}

function paintFar(c: Ctx): void {
  c.fillStyle = linear(c, 0, BASE - 190, 0, BASE, [
    { at: 0, colour: COLD.far },
    { at: 1, colour: COLD.farLow },
  ]);
  ridgePath(c, farY, BASE);
  c.fill();
  ridgeRim(c, farY, withAlpha(COLD.rim, 0.45), 1.6);
  rimmed(c, COLD.far, withAlpha(COLD.rim, 0.55), (g) => {
    // The mausoleum: a stepped base, four columns, a pediment, a low dome.
    const mx = 330;
    const my = farY(mx) + 5;
    g.fillRect(mx - 78, my - 8, 156, 8);
    g.fillRect(mx - 68, my - 16, 136, 8);
    g.fillRect(mx - 56, my - 70, 112, 54);
    for (const dx of [-50, -18, 18, 50]) g.fillRect(mx + dx - 3, my - 70, 6, 54);
    g.beginPath();
    g.moveTo(mx - 66, my - 70);
    g.lineTo(mx, my - 100);
    g.lineTo(mx + 66, my - 70);
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(mx, my - 100, 20, Math.PI, 0);
    g.fill();
    g.fillRect(mx - 1.5, my - 136, 3, 18);
    g.fillRect(mx - 7, my - 130, 14, 3);
    // Cypresses: tall, thin and dark.
    for (const [x, h] of [[90, 120], [128, 150], [190, 100], [520, 130], [556, 105], [790, 150], [830, 118], [880, 140]] as const) cypress(g, x, farY(x) + 10, h);
    // A far iron fence: a row of thin spears along the ridge.
    for (let x = 220; x < 460; x += 14) {
      g.fillRect(x, farY(x) - 16 + 4, 2, 18);
      g.beginPath();
      g.moveTo(x - 2, farY(x) - 12);
      g.lineTo(x + 1, farY(x) - 24);
      g.lineTo(x + 4, farY(x) - 12);
      g.fill();
    }
  });
  // The crypt door in the mausoleum: a small warm light, with a halo.
  const mx = 330;
  const my = farY(mx) + 5;
  glow(c, mx, my - 30, 30, COLD.amber, 0.36);
  c.fillStyle = withAlpha('#ffc58a', 0.8);
  c.beginPath();
  c.moveTo(mx - 7, my - 16);
  c.lineTo(mx - 7, my - 38);
  c.quadraticCurveTo(mx, my - 50, mx + 7, my - 38);
  c.lineTo(mx + 7, my - 16);
  c.fill();
}

// ---- second ridge: crosses, headstones, the angel ------------------------------------------

const HILLS = { a: [18, 8, 4], k: [3, 7, 13], p: [0.4, 2.0, 1.2] };
const hillY = (x: number): number => ridge(x, BASE - 74, HILLS.a, HILLS.k, HILLS.p);

function angel(g: Ctx, x: number, base: number, h: number): void {
  // A pedestal, a robed figure with bowed head and two folded wings.
  g.fillRect(x - 14, base - h * 0.2, 28, h * 0.2);
  g.beginPath();
  g.moveTo(x - 10, base - h * 0.2);
  g.lineTo(x - 6, base - h * 0.72);
  g.lineTo(x + 6, base - h * 0.72);
  g.lineTo(x + 10, base - h * 0.2);
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(x + 1, base - h * 0.8, h * 0.07, 0, Math.PI * 2);
  g.fill();
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(x + side * 4, base - h * 0.68);
    g.quadraticCurveTo(x + side * h * 0.34, base - h * 0.78, x + side * h * 0.3, base - h * 0.26);
    g.quadraticCurveTo(x + side * h * 0.14, base - h * 0.5, x + side * 4, base - h * 0.4);
    g.closePath();
    g.fill();
  }
}

function paintHills(c: Ctx): void {
  c.fillStyle = COLD.hills;
  ridgePath(c, hillY, BASE);
  c.fill();
  ridgeRim(c, hillY, withAlpha(COLD.rim, 0.3), 1.4);
  rimmed(c, COLD.hills, withAlpha(COLD.rim, 0.5), (g) => {
    for (let i = 0; i < 13; i++) {
      const x = 30 + i * 72 + wob(i, 11, 26);
      if (Math.abs(x - 700) < 40) continue;
      const y = hillY(x) + 6 + hash(i, 12) * 12;
      if (i % 3 === 0) cross(g, x, y, 34 + hash(i, 13) * 16, wob(i, 14, 0.3));
      else {
        // A headstone: a round-topped slab, leaning.
        g.save();
        g.translate(x, y);
        g.rotate(wob(i, 15, 0.3));
        g.beginPath();
        g.moveTo(-9, 0);
        g.lineTo(-9, -24);
        g.quadraticCurveTo(0, -36, 9, -24);
        g.lineTo(9, 0);
        g.fill();
        g.restore();
      }
    }
    angel(g, 700, hillY(700) + 10, 96);
  });
  // Candles left at far graves: tiny warm lights.
  for (const x of [118, 262, 470, 604, 848]) glow(c, x, hillY(x) + 16, 16, COLD.amber, 0.4);
  c.fillStyle = withAlpha('#ffc58a', 0.8);
  for (const x of [118, 262, 470, 604, 848]) c.fillRect(x - 1, hillY(x) + 13, 2, 5);
}

// ---- mid layer: the ruined arcade ----------------------------------------------------------

function paintMid(c: Ctx): void {
  const lit = withAlpha(COLD.rim, 0.5);
  const spacing = 160;
  rimmed(c, COLD.mid, lit, (g) => {
    g.lineWidth = 12;
    g.lineCap = 'butt';
    // A low wall joins the columns' feet.
    g.fillRect(0, BASE - 26, W, 26);
    for (let i = 0; i <= 6; i++) {
      const x = i * spacing;
      {
        column(g, x, BASE - 26, 170 + (i === 2 ? -64 : 0), 24);
        // Broken columns end in a jagged stump; the others carry an arch to the next.
        if (i === 2) {
          g.beginPath();
          g.moveTo(x - 12, BASE - 26 - 106);
          g.lineTo(x - 3, BASE - 26 - 124);
          g.lineTo(x + 4, BASE - 26 - 112);
          g.lineTo(x + 12, BASE - 26 - 120);
          g.lineTo(x + 12, BASE - 26 - 100);
          g.fill();
        }
      }
      if (i < 6 && i !== 1 && i !== 2 && i !== 4) {
        g.beginPath();
        arch(g, x, x + spacing, BASE - 26 - 178, BASE - 26 - 250);
        g.lineWidth = 16;
        g.stroke();
      }
    }
    // A piece of the broken arch, hanging from the next column.
    g.beginPath();
    arch(g, spacing * 4, spacing * 4 + 70, BASE - 26 - 178, BASE - 26 - 216);
    g.lineWidth = 16;
    g.stroke();
    // Ivy hanging from an arch.
    g.lineWidth = 2.5;
    g.lineCap = 'round';
    for (const ax of [spacing * 0.5, spacing * 3.5, spacing * 5.5]) {
      for (let k = -3; k <= 3; k++) {
        g.beginPath();
        g.moveTo(ax + k * 12, BASE - 26 - 228 + Math.abs(k) * 7);
        g.lineTo(ax + k * 12 + wob(k + ax, 21, 8), BASE - 26 - 200 + hash(k + ax, 22) * 36);
        g.stroke();
      }
    }
  });
  // Candle sconces on three columns: a small warm light and a halo.
  for (const i of [0, 3, 5]) {
    const x = i * spacing + 14;
    glow(c, x, BASE - 26 - 108, 34, COLD.amber, 0.42);
    c.fillStyle = '#1a1210';
    c.fillRect(x - 5, BASE - 26 - 104, 10, 3);
    c.fillStyle = withAlpha('#ffd9a8', 0.95);
    c.beginPath();
    c.ellipse(x, BASE - 26 - 113, 2.4, 5, 0, 0, Math.PI * 2);
    c.fill();
  }
}

/** The boss's arena: one huge arch behind the Warden, heavy pillars either side, steps going down. */
function paintArena(c: Ctx): void {
  // A warm light spills out of the arch from the crypt below.
  glow(c, 700, BASE - 120, 200, COLD.amber, 0.22);
  rimmed(c, COLD.mid, withAlpha(COLD.rim, 0.5), (g) => {
    for (const x of [40, 130, 866, 940]) {
      column(g, x, BASE, 300, 40);
      g.fillRect(x - 30, BASE - 316, 60, 10);
    }
    // The great arch: two thick jambs and a pointed head.
    g.lineWidth = 26;
    g.lineCap = 'butt';
    g.beginPath();
    arch(g, 540, 860, BASE - 20, BASE - 350);
    g.stroke();
    g.fillRect(540 - 13, BASE - 20, 26, 20);
    g.fillRect(860 - 13, BASE - 20, 26, 20);
    // Steps leading down into the dark, at the foot of the arch.
    for (let i = 0; i < 4; i++) g.fillRect(560 + i * 8, BASE - 8 + i * 0, 240 - i * 16, 8);
    // Chains hanging from the arch's head.
    g.lineWidth = 3;
    for (const dx of [-60, 0, 60]) {
      g.beginPath();
      g.moveTo(700 + dx, BASE - 330 + Math.abs(dx) * 0.4);
      g.lineTo(700 + dx + wob(dx, 31, 6), BASE - 330 + 90 + Math.abs(dx));
      g.stroke();
    }
  });
  // The inside of the arch is dark, with the warm light low down.
  c.save();
  c.globalCompositeOperation = 'destination-over';
  c.fillStyle = withAlpha('#02060c', 0.8);
  c.beginPath();
  arch(c, 553, 847, BASE - 20, BASE - 336);
  c.lineTo(847, BASE);
  c.lineTo(553, BASE);
  c.fill();
  c.restore();
}

// ---- near layer -----------------------------------------------------------------------------

function skull(g: Ctx, x: number, y: number, r: number): void {
  g.beginPath();
  g.arc(x, y - r * 0.2, r, Math.PI, 0);
  g.lineTo(x + r * 0.7, y + r * 0.7);
  g.lineTo(x - r * 0.7, y + r * 0.7);
  g.closePath();
  g.fill();
}

function paintNear(c: Ctx): void {
  const lit = withAlpha(COLD.rim, 0.55);
  rimmed(c, COLD.near, lit, (g) => {
    // Leaning slabs and cracked crosses on the ground line.
    for (let i = 0; i < 9; i++) {
      const x = 30 + i * 108 + wob(i, 41, 34);
      g.save();
      g.translate(x, BASE + 2);
      g.rotate(wob(i, 42, 0.5));
      if (i % 3 === 1) {
        g.fillRect(-3, -50 - hash(i, 43) * 20, 6, 60);
        g.fillRect(-16, -40 - hash(i, 43) * 20, 32, 6);
      } else {
        const h = 26 + hash(i, 44) * 26;
        g.beginPath();
        g.moveTo(-14, 0);
        g.lineTo(-14, -h);
        g.lineTo(-6, -h - 6);
        g.lineTo(4, -h + 2);
        g.lineTo(14, -h - 4);
        g.lineTo(14, 0);
        g.fill();
      }
      g.restore();
    }
    // An iron fence at the edge of the path: thin posts with spear tips and a rail.
    g.fillRect(0, BASE - 22, W, 3);
    for (let x = 10; x < W; x += 24) {
      if (hash(x, 45) > 0.86) continue;
      g.fillRect(x, BASE - 36, 3, 38);
      g.beginPath();
      g.moveTo(x - 2, BASE - 36);
      g.lineTo(x + 1.5, BASE - 48);
      g.lineTo(x + 5, BASE - 36);
      g.fill();
    }
    // Heaps of skulls.
    for (const [x, n] of [[250, 4], [620, 3], [880, 4]] as const) {
      for (let k = 0; k < n; k++) skull(g, x + k * 13 - n * 6, BASE - 6 - (k % 2) * 8, 7);
    }
  });
  // Candle stubs with a warm halo.
  for (const x of [170, 440, 760]) {
    glow(c, x, BASE - 14, 26, COLD.amber, 0.4);
    c.fillStyle = '#2a211c';
    c.fillRect(x - 4, BASE - 12, 8, 12);
    c.fillStyle = withAlpha('#ffe0ae', 0.95);
    c.beginPath();
    c.ellipse(x, BASE - 17, 2.2, 5, 0, 0, Math.PI * 2);
    c.fill();
  }
}

// ---- foreground ----------------------------------------------------------------------------

const FRONT_W = 1600;

function paintFront(c: Ctx): void {
  rimmed(c, COLD.front, withAlpha(COLD.rim, 0.5), (g) => {
    // Two thick pillars with square caps, and a half-arch springing from the first.
    for (const x of [48, 1180]) {
      g.fillRect(x - 28, 0, 56, H);
      g.fillRect(x - 38, 60, 76, 18);
      g.fillRect(x - 36, H - 26, 72, 26);
    }
    g.beginPath();
    arch(g, 48, 330, 80, -40);
    g.lineWidth = 22;
    g.stroke();
    // Chains.
    g.lineWidth = 3;
    for (const [x, len] of [[900, 150], [1320, 190], [1480, 120]] as const) {
      g.beginPath();
      g.moveTo(x, -4);
      g.lineTo(x, len);
      g.stroke();
      for (let y = 14; y < len; y += 16) g.strokeRect(x - 3, y, 6, 10);
    }
    // Cobwebs in the top corner of the arch.
    g.lineWidth = 1.2;
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      g.moveTo(80, 0);
      g.lineTo(80 + Math.cos(0.4 + k * 0.3) * 120, Math.sin(0.4 + k * 0.3) * 120);
      g.stroke();
    }
  });
}

/** Foreground silhouettes pass in front at the screen's edges only, never over the lane the ghost and the stones use. */
export function drawCryptFront(ctx: Ctx, s: ArtState): void {
  if (s.flat) return;
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec * 1.15;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 40, H);
  ctx.clip();
  tile(scroll, FRONT_W, (dx) => blit(ctx, 'crypt-front', FRONT_W, H, dx, 0, paintFront));
  ctx.restore();
  ctx.fillStyle = radial(ctx, W / 2, H * 0.45, H * 0.45, W * 0.72, [
    { at: 0, colour: 'rgba(2, 6, 12, 0)' },
    { at: 1, colour: 'rgba(2, 6, 12, 0.5)' },
  ]);
  ctx.fillRect(0, 0, W, H);
}

// ---- the flagstone path --------------------------------------------------------------------

const PATH_H = 156;
const PATH_TOP = 16;

function paintPath(c: Ctx): void {
  const o = PATH_TOP;
  c.fillStyle = linear(c, 0, o, 0, PATH_H, [
    { at: 0, colour: '#2a3d4c' },
    { at: 0.25, colour: '#1d2d3a' },
    { at: 0.6, colour: '#111d28' },
    { at: 1, colour: '#070c12' },
  ]);
  c.fillRect(0, o, W, PATH_H - o);
  // Flagstones in staggered rows, each row a little deeper and wider than the last: a stair going down.
  let y = o;
  for (let row = 0; row < 5; row++) {
    const hRow = 12 + row * 9;
    const wStone = [60, 80, 96, 120, 160][row]!;
    for (let x = -((row * 40) % wStone); x < W; x += wStone) {
      c.fillStyle = withAlpha('#06101a', 0.38);
      c.fillRect(x, y + hRow - 2, wStone, 2);
      c.fillRect(x + wStone - 2, y, 2, hRow);
    }
    c.fillStyle = withAlpha('#9fc6dc', 0.16);
    c.fillRect(0, y + 1, W, 1.4);
    y += hRow;
  }
  c.fillStyle = linear(c, 0, o, 0, o + 8, [
    { at: 0, colour: withAlpha('#a9d0e6', 0.22) },
    { at: 1, colour: withAlpha('#a9d0e6', 0) },
  ]);
  c.fillRect(0, o, W, 8);
  // Cracks and moss specks.
  c.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const x = hash(i, 130) * W;
    const y0 = o + 6 + hash(i, 131) * 70;
    c.strokeStyle = 'rgba(3, 7, 12, 0.5)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x, y0);
    c.lineTo(x + 8 + hash(i, 132) * 10, y0 + 5);
    c.lineTo(x + 14 + hash(i, 133) * 14, y0 + 2);
    c.stroke();
  }
  for (let i = 0; i < 90; i++) {
    c.fillStyle = hash(i, 134) < 0.5 ? withAlpha('#06101a', 0.4) : withAlpha('#7fb0c8', 0.12);
    c.beginPath();
    c.ellipse(hash(i, 135) * W, o + 4 + hash(i, 136) ** 1.5 * (PATH_H - o - 10), 1 + hash(i, 137) * 2.4, 0.8, 0, 0, Math.PI * 2);
    c.fill();
  }
  // Dark grass and rubble where the stone ends.
  c.fillStyle = '#05090e';
  for (let i = 0; i < 60; i++) {
    const x = hash(i, 170) * (W - 12);
    const h = 6 + hash(i, 171) * 14;
    c.beginPath();
    c.moveTo(x, PATH_H);
    c.quadraticCurveTo(x + 2 - hash(i, 172) * 8, PATH_H - h * 0.6, x + 4 - hash(i, 173) * 10, PATH_H - h);
    c.quadraticCurveTo(x + 5, PATH_H - h * 0.5, x + 9, PATH_H);
    c.fill();
  }
}

/** The flagstones under the ghost: cached once, scrolls with the level, still with reduced motion. */
export function drawCryptGround(ctx: Ctx, s: ArtState): void {
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec;
  tile(scroll, W, (dx) => blit(ctx, 'crypt-path', W, PATH_H, dx, s.groundY - PATH_TOP, paintPath));
}

// ---- all the layers ----------------------------------------------------------------------------

export function drawCryptLayers(ctx: Ctx, s: ArtState): void {
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec;
  const layer = (key: string, speed: number, paint: (c: Ctx) => void): void => tile(scroll * speed, W, (dx) => blit(ctx, key, W, H, dx, 0, paint));
  layer('crypt-far', 0.05, paintFar);
  fog(ctx, COLD.fog, BASE - 190, BASE - 70, 0.16);
  layer('crypt-hills', 0.12, paintHills);
  fog(ctx, COLD.fog, BASE - 120, BASE - 20, 0.12);
  layer(s.arena ? 'crypt-arena' : 'crypt-mid', 0.22, s.arena ? paintArena : paintMid);
  fog(ctx, COLD.fog, BASE - 80, BASE, 0.12);
  layer('crypt-near', 0.45, paintNear);
  specks(ctx, s, 22, '#cfe6f2', 0.2, 1);
}

/** The layers, far to near, for the report. */
export const CRYPT_LAYERS = ['sky, low moon, cloud wisps, shafts', 'ridge with mausoleum and cypresses', 'crosses, headstones, weeping angel, far candles', 'ruined arcade with candle sconces (arena: great arch)', 'slabs, skull heaps, iron fence, candle stubs', 'foreground pillars and chains'] as const;
