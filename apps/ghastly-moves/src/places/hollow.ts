import { blit, hash, linear, radial, tile, withAlpha, type Ctx } from '../gfx';
import type { ArtState } from '../art';
import { arch, BASE, fog, glow, H, lamp, moon, ridge, ridgePath, ridgeRim, rimmed, shafts, specks, stars, W, wob } from './common-stages-5-7';

// Stage 6, The Hollow, drawn in code. One cold hue (desaturated steel-cyan mist: the greyest place in the game), one
// warm accent (an amber glow from the door of the great tree), pale cyan rim light, and small cold cyan lights in the
// mushrooms. Layers, far to near:
//
//   sky + a blurred moon behind the canopy + wide shafts
//   far     thin dead trunks in heavy fog
//   fog
//   hills   giant arching roots, a fallen log, glowing mushrooms
//   fog
//   mid     the Hollow tree: a huge trunk with an amber doorway, hanging roots (in the boss arena: the doorway is
//           a vast cavity behind the Wraith, ringed by roots)
//   fog
//   near    low roots, ferns, pale fungus shelves, small bones, mushroom clusters with halos
//   (obstacles, ghost)
//   front   hanging roots and fern fronds at the screen edges, then a vignette
//
// Static layers are painted once to offscreen canvases. Everything stands still with reduced motion. The only slow
// change is spores drifting up, and a door glow that breathes at under a fifth of a hertz. Nothing flashes.

const COLD = {
  skyTop: '#04070c',
  skyMid: '#0d1824',
  skyHorizon: '#2f4a5c',
  far: '#1a2e3e',
  farLow: '#132634',
  hills: '#112433',
  mid: '#0b1923',
  near: '#060e15',
  front: '#02050a',
  rim: '#a6dff2',
  fog: '#b0d0de',
  amber: '#ffa85a',
  cyan: '#7cf0ff',
};

// ---- the sky -----------------------------------------------------------------------------

function paintCanopy(c: Ctx): void {
  // Branches and leaf clumps reaching in from the top: a dark, ragged ceiling that the moon shines through.
  c.fillStyle = '#03060a';
  c.beginPath();
  c.moveTo(0, 0);
  for (let x = 0; x <= W; x += 16) c.lineTo(x, 34 + 40 * Math.sin(x / 90 + 1) + 26 * Math.sin(x / 31) + hash(x, 5) * 18);
  c.lineTo(W, 0);
  c.closePath();
  c.fill();
  c.strokeStyle = '#03060a';
  c.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const x = hash(i, 6) * W;
    const y = 40 + hash(i, 7) * 40;
    c.lineWidth = 4 - (i % 3);
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + wob(i, 8, 90), y + 30, x + wob(i, 9, 150), y + 60 + hash(i, 10) * 30);
    c.stroke();
  }
}

export function drawHollowSky(ctx: Ctx, s: ArtState): void {
  ctx.fillStyle = linear(ctx, 0, 0, 0, BASE, [
    { at: 0, colour: COLD.skyTop },
    { at: 0.55, colour: COLD.skyMid },
    { at: 1, colour: COLD.skyHorizon },
  ]);
  ctx.fillRect(0, 0, W, H);
  stars(ctx, 26, 120, '#e0f2ff', 40);
  const mx = s.arena ? 360 : 300;
  const my = s.arena ? 110 : 96;
  const r = s.arena ? 58 : 40;
  // A moon seen through mist: softer, with a wide halo.
  moon(ctx, mx, my, r, s.pulse, '#bde6f6', '#e8f2f4', '#b8cfd8');
  shafts(ctx, mx, my + r * 0.4, '#bfe8f6', [[mx - 220, 80], [mx - 60, 70], [mx + 110, 90], [mx + 300, 100]], 0.07);
  blit(ctx, 'hollow-canopy', W, 140, 0, 0, paintCanopy);
}

// ---- far layer: thin dead trunks ---------------------------------------------------------------

function paintFar(c: Ctx): void {
  const ground = (x: number): number => BASE - 124 + 12 * Math.sin((2 * Math.PI * 3 * x) / W + 0.8);
  c.fillStyle = linear(c, 0, BASE - 190, 0, BASE, [
    { at: 0, colour: COLD.far },
    { at: 1, colour: COLD.farLow },
  ]);
  ridgePath(c, ground, BASE);
  c.fill();
  rimmed(c, COLD.far, withAlpha(COLD.rim, 0.4), (g) => {
    for (let i = 0; i < 26; i++) {
      const x = i * 38 + hash(i, 20) * 26;
      const w = 4 + hash(i, 21) * 9;
      const lean = wob(i, 22, 26);
      g.beginPath();
      g.moveTo(x - w, ground(x) + 6);
      g.lineTo(x - w * 0.5 + lean, 0);
      g.lineTo(x + w * 0.5 + lean, 0);
      g.lineTo(x + w, ground(x) + 6);
      g.closePath();
      g.fill();
      // A bare branch or two.
      for (const b of [0.3, 0.55]) {
        if (hash(i, 23 + b * 10) < 0.5) continue;
        const by = ground(x) - (ground(x) * b);
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(x + lean * (1 - b), by);
        g.lineTo(x + (hash(i, 24) > 0.5 ? 1 : -1) * (24 + hash(i, 25) * 24) + lean, by - 30 - hash(i, 26) * 22);
        g.stroke();
      }
    }
  });
}

// ---- second layer: arching roots, a log, mushrooms --------------------------------------------

const HILLS = { a: [15, 8, 4], k: [3, 7, 12], p: [2.2, 0.5, 1.4] };
const hillY = (x: number): number => ridge(x, BASE - 66, HILLS.a, HILLS.k, HILLS.p);

function mushroom(g: Ctx, x: number, y: number, r: number, lean: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(lean);
  g.fillRect(-r * 0.12, -r * 0.9, r * 0.24, r * 0.9);
  g.beginPath();
  g.ellipse(0, -r * 0.9, r * 0.8, r * 0.5, 0, Math.PI, 0);
  g.closePath();
  g.fill();
  g.restore();
}

function paintHills(c: Ctx): void {
  c.fillStyle = COLD.hills;
  ridgePath(c, hillY, BASE);
  c.fill();
  ridgeRim(c, hillY, withAlpha(COLD.rim, 0.3), 1.4);
  rimmed(c, COLD.hills, withAlpha(COLD.rim, 0.45), (g) => {
    // Great roots that arch up out of the ground and back in.
    g.lineCap = 'round';
    for (const [x, span, h, w] of [[120, 180, 110, 16], [430, 150, 90, 13], [790, 210, 130, 18]] as const) {
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x - span / 2, hillY(x - span / 2) + 10);
      g.bezierCurveTo(x - span * 0.35, hillY(x) - h * 1.5, x + span * 0.35, hillY(x) - h * 1.4, x + span / 2, hillY(x + span / 2) + 10);
      g.stroke();
      g.lineWidth = w * 0.45;
      g.beginPath();
      g.moveTo(x - span * 0.1, hillY(x) - h * 1.05);
      g.quadraticCurveTo(x - span * 0.3, hillY(x) - h * 0.5, x - span * 0.28, hillY(x) + 8);
      g.stroke();
    }
    // A fallen log with a broken end.
    const lx = 600;
    const ly = hillY(lx) + 4;
    g.beginPath();
    g.moveTo(lx - 90, ly);
    g.lineTo(lx - 88, ly - 26);
    g.lineTo(lx + 70, ly - 22);
    g.quadraticCurveTo(lx + 92, ly - 24, lx + 94, ly - 6);
    g.lineTo(lx + 88, ly);
    g.closePath();
    g.fill();
  });
  // Mushrooms with a small cold light: bioluminescence. A cap, a stem, a halo.
  for (const [x, r, lean] of [[40, 16, -0.2], [66, 11, 0.1], [260, 14, 0.15], [350, 10, -0.1], [520, 18, -0.15], [545, 10, 0.2], [700, 13, 0.1], [900, 16, -0.12]] as const) {
    const y = hillY(x) + 8;
    glow(c, x, y - r * 0.9, r * 2.6, COLD.cyan, 0.22);
    c.fillStyle = withAlpha('#2a6a7a', 0.95);
    mushroom(c, x, y, r, lean);
    c.fillStyle = withAlpha(COLD.cyan, 0.55);
    c.beginPath();
    c.ellipse(x + lean * 4, y - r * 1.15, r * 0.5, r * 0.12, 0, 0, Math.PI * 2);
    c.fill();
  }
}

// ---- mid layer: the Hollow tree -----------------------------------------------------------------

function trunk(g: Ctx, cx: number, base: number, wBase: number, wTop: number): void {
  g.beginPath();
  g.moveTo(cx - wBase / 2 - 60, base);
  g.bezierCurveTo(cx - wBase / 2 - 10, base - 30, cx - wBase / 2 + 4, base - 90, cx - wTop / 2, base - 180);
  g.lineTo(cx - wTop / 2 - 4, -10);
  g.lineTo(cx + wTop / 2 + 4, -10);
  g.lineTo(cx + wTop / 2, base - 180);
  g.bezierCurveTo(cx + wBase / 2 - 4, base - 90, cx + wBase / 2 + 10, base - 30, cx + wBase / 2 + 60, base);
  g.closePath();
  g.fill();
}

function paintMid(c: Ctx): void {
  const cx = 560;
  const lit = withAlpha(COLD.rim, 0.5);
  rimmed(c, COLD.mid, lit, (g) => {
    g.fillRect(0, BASE - 18, W, 18);
    trunk(g, cx, BASE - 10, 230, 190);
    // Roots splaying from the foot: long curves that end in points.
    g.lineCap = 'round';
    for (const [dx, reach, lift] of [[-110, -150, 36], [-70, -110, 22], [100, 150, 40], [60, 110, 24]] as const) {
      g.lineWidth = 15;
      g.beginPath();
      g.moveTo(cx + dx, BASE - 40);
      g.quadraticCurveTo(cx + dx + reach * 0.5, BASE - 18 - lift, cx + dx + reach, BASE - 2);
      g.stroke();
    }
    // Big branches that reach out from the top of the screen, with roots hanging from them.
    g.lineWidth = 24;
    g.beginPath();
    g.moveTo(cx - 90, 40);
    g.quadraticCurveTo(cx - 230, 40, cx - 400, 96);
    g.stroke();
    g.beginPath();
    g.moveTo(cx + 90, 20);
    g.quadraticCurveTo(cx + 220, 24, cx + 380, 70);
    g.stroke();
    g.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const x = cx + (i < 6 ? -(120 + i * 48) : 100 + (i - 6) * 46);
      const y = i < 6 ? 52 + i * 8 : 28 + (i - 6) * 8;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + wob(i, 31, 14), y + 40 + hash(i, 32) * 30, x + wob(i, 33, 10), y + 70 + hash(i, 34) * 70);
      g.stroke();
    }
  });
  // The doorway: a tall arch cut in the trunk, glowing amber from inside, with a ladder of three rungs.
  const dx = cx;
  const top = BASE - 170;
  glow(c, dx, BASE - 80, 110, COLD.amber, 0.26);
  c.fillStyle = linear(c, 0, top, 0, BASE - 12, [
    { at: 0, colour: withAlpha('#ffb066', 0.85) },
    { at: 1, colour: withAlpha('#ff8a3d', 0.95) },
  ]);
  // A rounded doorway: straight jambs, then a soft pointed head.
  c.beginPath();
  c.moveTo(dx - 40, BASE - 12);
  c.lineTo(dx - 40, top + 70);
  c.bezierCurveTo(dx - 40, top + 24, dx - 14, top + 4, dx, top);
  c.bezierCurveTo(dx + 14, top + 4, dx + 40, top + 24, dx + 40, top + 70);
  c.lineTo(dx + 40, BASE - 12);
  c.closePath();
  c.fill();
  c.fillStyle = withAlpha('#1a0e08', 0.9);
  c.fillRect(dx - 3, top + 40, 6, BASE - 12 - top - 40);
  for (let i = 0; i < 3; i++) c.fillRect(dx - 24, BASE - 40 - i * 30, 48, 3);
  // A little lantern on a hook beside the door.
  c.fillStyle = '#0b1923';
  c.fillRect(dx + 54, BASE - 128, 2, 20);
  glow(c, dx + 55, BASE - 100, 24, COLD.amber, 0.4);
  c.fillStyle = withAlpha('#ffe0ae', 0.95);
  c.beginPath();
  c.ellipse(dx + 55, BASE - 100, 3, 6, 0, 0, Math.PI * 2);
  c.fill();
}

/** The boss's arena: the doorway is a vast cavity behind the Wraith, ringed by roots, with mist pouring out. */
function paintArena(c: Ctx): void {
  const cx = 700;
  rimmed(c, COLD.mid, withAlpha(COLD.rim, 0.5), (g) => {
    // The trunk fills the right two thirds of the screen, so the cavity is cut from it.
    // The trunk: its left edge bulges and flares out into roots at the foot.
    g.beginPath();
    g.moveTo(320, BASE);
    g.bezierCurveTo(420, BASE - 30, 470, BASE - 160, 450, BASE - 260);
    g.bezierCurveTo(436, BASE - 330, 470, 40, 480, -10);
    g.lineTo(W + 10, -10);
    g.lineTo(W + 10, BASE);
    g.closePath();
    g.fill();
    g.lineWidth = 18;
    g.lineCap = 'round';
    for (const [x0, x1] of [[40, 180], [120, 40], [860, 940]] as const) {
      g.beginPath();
      g.moveTo(x0, 0);
      g.quadraticCurveTo(x0 + wob(x0, 3, 80), 180, x1, 300 + wob(x0, 4, 80));
      g.stroke();
    }
  });
  // The cavity: a tall oval-arch, dark inside, with a pale cold light low in it and the amber at its heart.
  c.save();
  c.fillStyle = linear(c, 0, 40, 0, BASE, [
    { at: 0, colour: '#04090f' },
    { at: 0.5, colour: '#163042' },
    { at: 1, colour: '#2d5466' },
  ]);
  c.beginPath();
  arch(c, cx - 150, cx + 150, BASE, 70);
  c.lineTo(cx + 150, BASE);
  c.closePath();
  c.fill();
  glow(c, cx, BASE - 90, 190, COLD.amber, 0.2);
  glow(c, cx, BASE - 30, 240, '#9fe7ff', 0.14);
  // The cavity's rim catches the light: a pale line round the opening.
  c.strokeStyle = withAlpha(COLD.rim, 0.45);
  c.lineWidth = 2;
  c.beginPath();
  arch(c, cx - 150, cx + 150, BASE, 70);
  c.stroke();
  c.restore();
  // Roots grown across the cavity's rim: a ring of curved teeth.
  c.strokeStyle = COLD.mid;
  c.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + 0.25 + (i / 8) * (Math.PI - 0.5);
    const x0 = cx + Math.cos(a) * 160;
    const y0 = BASE - 40 + Math.sin(a) * 330;
    c.lineWidth = 11 - (i % 3) * 2;
    c.beginPath();
    c.moveTo(x0, y0);
    c.quadraticCurveTo(x0 + Math.cos(a + 1.6) * 40, y0 + Math.sin(a + 1.6) * 40, x0 - Math.cos(a) * 46 + wob(i, 5, 14), y0 - Math.sin(a) * 40 + 28);
    c.stroke();
  }
  glow(c, 120, BASE - 70, 80, COLD.amber, 0.12);
}

// ---- near layer ------------------------------------------------------------------------------

function fern(g: Ctx, x: number, base: number, h: number, lean: number): void {
  g.lineCap = 'round';
  for (let k = -3; k <= 3; k++) {
    const a = -Math.PI / 2 + k * 0.32 + lean;
    const len = h * (1 - Math.abs(k) * 0.12);
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(x, base);
    const ex = x + Math.cos(a) * len;
    const ey = base + Math.sin(a) * len;
    g.quadraticCurveTo(x + Math.cos(a) * len * 0.5, base + Math.sin(a) * len * 0.5 - 6, ex, ey + 8);
    g.stroke();
    // Leaflets along the frond.
    for (let j = 1; j < 6; j++) {
      const px = x + (ex - x) * (j / 6);
      const py = base + (ey - base) * (j / 6) - Math.sin((j / 6) * Math.PI) * 4;
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + 7 * (1 - j / 7), py + 6);
      g.moveTo(px, py);
      g.lineTo(px - 7 * (1 - j / 7), py + 6);
      g.stroke();
    }
  }
}

function paintNear(c: Ctx): void {
  const lit = withAlpha(COLD.rim, 0.55);
  rimmed(c, COLD.near, lit, (g) => {
    // Low roots that cross the path's edge, and ferns.
    g.lineCap = 'round';
    for (const [x, w] of [[60, 120], [330, 160], [640, 130], [850, 150]] as const) {
      g.lineWidth = 12;
      g.beginPath();
      g.moveTo(x - w / 2, BASE + 4);
      g.quadraticCurveTo(x, BASE - 38 - hash(x, 40) * 14, x + w / 2, BASE + 4);
      g.stroke();
    }
    for (const [x, h, l] of [[28, 50, 0.2], [210, 44, -0.15], [470, 52, 0.1], [740, 46, -0.2], [920, 54, 0.15]] as const) fern(g, x, BASE + 2, h, l);
    // Pale fungus shelves on a stump, and a few small bones.
    g.beginPath();
    g.moveTo(560, BASE + 2);
    g.lineTo(556, BASE - 40);
    g.lineTo(600, BASE - 42);
    g.lineTo(604, BASE + 2);
    g.fill();
    for (const [y, w] of [[-18, 22], [-32, 16]] as const) {
      g.beginPath();
      g.ellipse(604, BASE + y, w, 5, 0, -Math.PI * 0.1, Math.PI * 1.05);
      g.fill();
    }
    g.lineWidth = 4;
    for (const [x, a] of [[400, 0.2], [415, -0.3], [780, 0.1]] as const) {
      g.beginPath();
      g.moveTo(x - 12, BASE - 4 + a * 10);
      g.lineTo(x + 12, BASE - 6 - a * 10);
      g.stroke();
    }
  });
  // Mushroom clusters with halos: the cold lights nearest the ghost.
  for (const [x, r] of [[140, 14], [160, 9], [520, 12], [700, 15], [716, 9]] as const) {
    glow(c, x, BASE - r * 0.8, r * 3, COLD.cyan, 0.26);
    c.fillStyle = '#10333f';
    mushroom(c, x, BASE + 2, r, wob(x, 8, 0.4));
    c.fillStyle = withAlpha(COLD.cyan, 0.6);
    c.beginPath();
    c.ellipse(x, BASE - r * 1.1, r * 0.5, r * 0.12, 0, 0, Math.PI * 2);
    c.fill();
  }
}

// ---- foreground ----------------------------------------------------------------------------

const FRONT_W = 1600;

function paintFront(c: Ctx): void {
  rimmed(c, COLD.front, withAlpha(COLD.rim, 0.5), (g) => {
    g.lineCap = 'round';
    // A root arch down the left edge, and hanging roots across the top.
    g.lineWidth = 34;
    g.beginPath();
    g.moveTo(20, -10);
    g.quadraticCurveTo(10, 200, 26, H);
    g.stroke();
    g.lineWidth = 20;
    g.beginPath();
    g.moveTo(0, 30);
    g.quadraticCurveTo(110, 40, 190, 0);
    g.stroke();
    g.lineWidth = 3;
    for (const [x, len] of [[700, 120], [820, 170], [940, 90], [1260, 150], [1340, 200], [1500, 110]] as const) {
      g.beginPath();
      g.moveTo(x, -4);
      g.quadraticCurveTo(x + wob(x, 3, 20), len / 2, x + wob(x, 4, 16), len);
      g.stroke();
    }
    // Fern fronds at the foot of the left edge.
    fern(g, 30, H + 4, 90, 0.3);
    fern(g, 1240, H + 4, 100, -0.2);
  });
}

export function drawHollowFront(ctx: Ctx, s: ArtState): void {
  if (s.flat) return;
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec * 1.15;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 40, H);
  ctx.rect(W - 120, 0, 120, 56);
  ctx.clip();
  tile(scroll, FRONT_W, (dx) => blit(ctx, 'hollow-front', FRONT_W, H, dx, 0, paintFront));
  ctx.restore();
  ctx.fillStyle = radial(ctx, W / 2, H * 0.45, H * 0.45, W * 0.72, [
    { at: 0, colour: 'rgba(2, 5, 10, 0)' },
    { at: 1, colour: 'rgba(2, 5, 10, 0.5)' },
  ]);
  ctx.fillRect(0, 0, W, H);
}

// ---- the mossy floor ---------------------------------------------------------------------------

const PATH_H = 156;
const PATH_TOP = 16;

function paintPath(c: Ctx): void {
  const o = PATH_TOP;
  c.fillStyle = linear(c, 0, o, 0, PATH_H, [
    { at: 0, colour: '#2f4756' },
    { at: 0.25, colour: '#213645' },
    { at: 0.6, colour: '#12202b' },
    { at: 1, colour: '#070e14' },
  ]);
  c.fillRect(0, o, W, PATH_H - o);
  // Root lines running across the floor, and pale lichen patches.
  c.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const x = hash(i, 200) * W;
    const y0 = o + 10 + hash(i, 201) * 100;
    c.strokeStyle = withAlpha('#050b10', 0.5);
    c.lineWidth = 2 + hash(i, 202) * 3;
    c.beginPath();
    c.moveTo(x, y0);
    c.quadraticCurveTo(x + 40, y0 + wob(i, 203, 20), x + 90 + hash(i, 204) * 60, y0 + wob(i, 205, 14));
    c.stroke();
    c.strokeStyle = withAlpha('#b0e0f0', 0.1);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x, y0 - 2);
    c.quadraticCurveTo(x + 40, y0 - 2 + wob(i, 203, 20), x + 90 + hash(i, 204) * 60, y0 - 2 + wob(i, 205, 14));
    c.stroke();
  }
  c.fillStyle = linear(c, 0, o, 0, o + 8, [
    { at: 0, colour: withAlpha('#bfe8f6', 0.22) },
    { at: 1, colour: withAlpha('#bfe8f6', 0) },
  ]);
  c.fillRect(0, o, W, 8);
  for (let i = 0; i < 120; i++) {
    c.fillStyle = hash(i, 210) < 0.5 ? withAlpha('#050b10', 0.4) : withAlpha('#9fd8e8', 0.1);
    c.beginPath();
    c.ellipse(hash(i, 211) * W, o + 4 + hash(i, 212) ** 1.5 * (PATH_H - o - 10), 1 + hash(i, 213) * 4, 0.9, 0, 0, Math.PI * 2);
    c.fill();
  }
  // Leaf litter: tiny pale slivers.
  for (let i = 0; i < 60; i++) {
    c.save();
    c.translate(hash(i, 220) * W, o + 6 + hash(i, 221) * (PATH_H - o - 16));
    c.rotate(hash(i, 222) * Math.PI);
    c.fillStyle = withAlpha('#7fa6b4', 0.16);
    c.beginPath();
    c.ellipse(0, 0, 4, 1.4, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  c.fillStyle = '#04090e';
  for (let i = 0; i < 50; i++) {
    const x = hash(i, 230) * (W - 12);
    const h = 5 + hash(i, 231) * 12;
    c.beginPath();
    c.moveTo(x, PATH_H);
    c.quadraticCurveTo(x + 2 - hash(i, 232) * 8, PATH_H - h * 0.6, x + 4 - hash(i, 233) * 10, PATH_H - h);
    c.quadraticCurveTo(x + 5, PATH_H - h * 0.5, x + 9, PATH_H);
    c.fill();
  }
}

export function drawHollowGround(ctx: Ctx, s: ArtState): void {
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec;
  tile(scroll, W, (dx) => blit(ctx, 'hollow-path', W, PATH_H, dx, s.groundY - PATH_TOP, paintPath));
}

// ---- all the layers ----------------------------------------------------------------------------

export function drawHollowLayers(ctx: Ctx, s: ArtState): void {
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec;
  const layer = (key: string, speed: number, paint: (c: Ctx) => void): void => tile(scroll * speed, W, (dx) => blit(ctx, key, W, H, dx, 0, paint));
  layer('hollow-far', 0.05, paintFar);
  fog(ctx, COLD.fog, BASE - 230, BASE - 60, 0.24);
  layer('hollow-hills', 0.12, paintHills);
  fog(ctx, COLD.fog, BASE - 140, BASE - 20, 0.16);
  layer(s.arena ? 'hollow-arena' : 'hollow-mid', 0.22, s.arena ? paintArena : paintMid);
  fog(ctx, COLD.fog, BASE - 90, BASE, 0.14);
  layer('hollow-near', 0.45, paintNear);
  specks(ctx, s, 30, '#bdeeff', 0.3, 2.4, 1.8);
  // The door's lantern breathes on top of the cached one (mid layer, speed 0.22).
  if (!s.arena) tile(scroll * 0.22, W, (dx) => lamp(ctx, s, 615 + dx, BASE - 100, 3.5, COLD.amber, 2));
}

/** The layers, far to near, for the report. */
export const HOLLOW_LAYERS = ['sky, moon behind the canopy, shafts', 'thin dead trunks in fog', 'arching roots, fallen log, glowing mushrooms', 'the Hollow tree with its amber door (arena: a vast cavity ringed by roots)', 'low roots, ferns, fungus shelves, bones, mushroom clusters', 'hanging roots and ferns at the edges'] as const;
