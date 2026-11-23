import { blit, hash, linear, radial, tile, withAlpha, type Ctx } from '../gfx';
import type { ArtState } from '../art';
import { BASE, fog, glow, H, moon, ridge, ridgePath, ridgeRim, rimmed, shafts, specks, stars, W, wob } from './common-stages-2-4';

// Stage 4, The Old Gate, drawn in code. One cold hue (a bruised violet-grey, the colour of old iron under a night
// sky), small warm lights (torches in braziers, a keep window, the furnace behind the gate, the lantern). Depth by
// layers and fog:
//
//   sky + moon + thin cloud + moon shafts
//   far     jagged mountains with a distant keep         (lightest, lowest contrast)
//   fog
//   hills   a curtain wall with battlements, towers, torches and tattered banners
//   fog
//   mid     an iron fence of tall spears, a gatehouse tower and two braziers (in the arena: the great gate itself,
//           portcullis half raised, a furnace glowing behind it)
//   fog
//   near    barrels, a broken cart wheel, a chain pile, stakes, torch stands
//   (obstacles, ghost)
//   front   massive gate piers with spiked finials and chains at the screen edges, then a vignette
//
// Static layers are painted once to offscreen canvases. Everything stands still with reduced motion. Embers rise
// slowly from the braziers, a torch halo breathes at under a fifth of a hertz, and nothing ever flashes.

const COLD = {
  skyTop: '#07061a',
  skyMid: '#14123a',
  skyHorizon: '#34305a',
  far: '#2c2c58',
  farLow: '#1e1e44',
  hills: '#1a1a42',
  mid: '#101030',
  near: '#090920',
  front: '#030310',
  rim: '#8a8fd0',
  fog: '#a6a8e0',
  amber: '#ff8a3d',
};
const MOON = { x: 610, y: 104 };

// ---- the sky ---------------------------------------------------------------------------

export function drawGateSky(ctx: Ctx, s: ArtState): void {
  ctx.fillStyle = linear(ctx, 0, 0, 0, BASE, [
    { at: 0, colour: COLD.skyTop },
    { at: 0.55, colour: COLD.skyMid },
    { at: 1, colour: COLD.skyHorizon },
  ]);
  ctx.fillRect(0, 0, W, H);
  stars(ctx, 44, BASE - 210, '#e6e4ff');
  const mx = s.arena ? 380 : MOON.x;
  const my = s.arena ? 150 : MOON.y;
  const r = s.arena ? 62 : 34;
  moon(ctx, mx, my, r, s.pulse, '#cfd0ff');
  ctx.save();
  ctx.translate(mx - r * 0.1, my + r * 0.5);
  ctx.rotate(-0.07);
  ctx.scale(1, 0.1);
  ctx.fillStyle = radial(ctx, 0, 0, 0, r * 1.7, [
    { at: 0, colour: withAlpha('#c9caf5', 0.3) },
    { at: 0.6, colour: withAlpha('#c9caf5', 0.12) },
    { at: 1, colour: withAlpha('#c9caf5', 0) },
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  shafts(ctx, mx, my + r * 0.5, '#b8baf2', [[mx - 160, 70], [mx - 330, 100], [mx + 90, 70]], 0.08);
}

// ---- shared shapes -------------------------------------------------------------------------

function battlements(g: Ctx, x0: number, x1: number, y: number, h: number, step: number): void {
  for (let x = x0; x < x1; x += step) g.fillRect(x, y - h, step * 0.55, h + 1);
}

function tower(g: Ctx, x: number, base: number, w: number, h: number, roof: boolean): void {
  g.fillRect(x - w / 2, base - h, w, h);
  g.fillRect(x - w / 2 - 4, base - h - 6, w + 8, 8);
  if (roof) {
    g.beginPath();
    g.moveTo(x - w / 2 - 6, base - h - 6);
    g.lineTo(x, base - h - w * 1.1);
    g.lineTo(x + w / 2 + 6, base - h - 6);
    g.closePath();
    g.fill();
  } else battlements(g, x - w / 2 - 4, x + w / 2 + 4, base - h - 6, 9, 10);
}

function torch(c: Ctx, x: number, y: number, size: number): void {
  glow(c, x, y - 6, size * 4.2, COLD.amber, 0.4);
  c.fillStyle = '#1b130f';
  c.fillRect(x - 1.6, y, 3.2, size * 1.8);
  c.fillStyle = withAlpha('#ffb978', 0.95);
  c.beginPath();
  c.ellipse(x, y - 3, size * 0.4, size * 0.9, 0, 0, Math.PI * 2);
  c.fill();
}

// ---- far layer: mountains and a keep -------------------------------------------------------

const FAR = { a: [30, 14, 6], k: [2, 4, 9], p: [1.1, 2.4, 0.7] };
const farY = (x: number): number => ridge(x, BASE - 130, FAR.a, FAR.k, FAR.p);

function paintFar(c: Ctx): void {
  c.fillStyle = linear(c, 0, BASE - 200, 0, BASE, [
    { at: 0, colour: COLD.far },
    { at: 1, colour: COLD.farLow },
  ]);
  ridgePath(c, farY, BASE);
  c.fill();
  ridgeRim(c, farY, withAlpha(COLD.rim, 0.4), 1.6);
  rimmed(c, COLD.far, withAlpha(COLD.rim, 0.55), (g) => {
    // A distant keep: a square block, a tall round tower and two thin turrets with cone roofs.
    const kx = 260;
    const ky = farY(kx) + 6;
    g.fillRect(kx - 50, ky - 46, 100, 46);
    battlements(g, kx - 50, kx + 50, ky - 46, 8, 10);
    tower(g, kx - 56, ky, 24, 96, true);
    tower(g, kx + 54, ky, 22, 120, true);
    g.fillRect(kx - 14, ky - 110, 28, 66);
    g.beginPath();
    g.moveTo(kx - 20, ky - 110);
    g.lineTo(kx, ky - 150);
    g.lineTo(kx + 20, ky - 110);
    g.fill();
    g.fillRect(kx - 1, ky - 170, 2, 22);
    // A dead pine or two on the mountain.
    for (const x of [640, 700, 820]) {
      g.beginPath();
      g.moveTo(x - 10, farY(x) + 8);
      g.lineTo(x, farY(x) - 70);
      g.lineTo(x + 10, farY(x) + 8);
      g.fill();
    }
  });
  const kx = 260;
  const ky = farY(kx) + 6;
  glow(c, kx, ky - 80, 20, COLD.amber, 0.4);
  c.fillStyle = withAlpha('#ffc58a', 0.85);
  c.fillRect(kx - 2, ky - 86, 4, 8);
}

// ---- the curtain wall -------------------------------------------------------------------------

const WALL_Y = BASE - 100;

function paintHills(c: Ctx): void {
  // Foothills under the wall.
  const hill = (x: number): number => ridge(x, BASE - 62, [12, 6], [3, 8], [0.8, 2.0]);
  c.fillStyle = COLD.hills;
  ridgePath(c, hill, BASE);
  c.fill();
  rimmed(c, COLD.hills, withAlpha(COLD.rim, 0.5), (g) => {
    // The wall: a long band with battlements, a walkway line, and square towers every few hundred px.
    g.fillRect(0, WALL_Y, W, BASE - WALL_Y);
    battlements(g, 0, W, WALL_Y, 12, 22);
    for (const x of [140, 460, 780]) tower(g, x, BASE, 52, 150, false);
    // Arrow slits.
    // (cut as dark slots below)
  });
  c.fillStyle = withAlpha('#05051a', 0.7);
  for (let x = 40; x < W; x += 60) c.fillRect(x, WALL_Y + 26, 3, 16);
  for (const x of [140, 460, 780]) c.fillRect(x - 2, BASE - 150 + 30, 4, 20);
  // Banners hanging from the towers: tall, tattered at the foot.
  rimmed(c, '#14123a', withAlpha(COLD.rim, 0.4), (g) => {
    for (const x of [100, 500, 740]) {
      g.beginPath();
      g.moveTo(x - 12, WALL_Y + 6);
      g.lineTo(x + 12, WALL_Y + 6);
      g.lineTo(x + 12, WALL_Y + 70);
      g.lineTo(x + 5, WALL_Y + 58);
      g.lineTo(x, WALL_Y + 76);
      g.lineTo(x - 6, WALL_Y + 60);
      g.lineTo(x - 12, WALL_Y + 72);
      g.closePath();
      g.fill();
    }
  });
  for (const x of [60, 290, 620, 900]) torch(c, x, WALL_Y + 20, 5);
}

// ---- mid layer: fence, gatehouse, braziers ---------------------------------------------------

function brazier(c: Ctx, x: number): void {
  // A bowl on three legs, with fire above it: warm, a halo, never a flicker (the halo breathes in particles()).
  rimmed(c, COLD.mid, withAlpha(COLD.rim, 0.5), (g) => {
    g.beginPath();
    g.moveTo(x - 24, BASE - 66);
    g.quadraticCurveTo(x, BASE - 44, x + 24, BASE - 66);
    g.closePath();
    g.fill();
    g.fillRect(x - 3, BASE - 52, 6, 52);
    g.beginPath();
    g.moveTo(x - 20, BASE);
    g.lineTo(x - 3, BASE - 40);
    g.lineTo(x + 3, BASE - 40);
    g.lineTo(x + 20, BASE);
    g.fill();
  });
  glow(c, x, BASE - 82, 70, COLD.amber, 0.32);
  c.fillStyle = withAlpha('#ff9a50', 0.95);
  c.beginPath();
  c.moveTo(x - 16, BASE - 66);
  c.quadraticCurveTo(x - 12, BASE - 92, x, BASE - 106);
  c.quadraticCurveTo(x + 10, BASE - 90, x + 16, BASE - 66);
  c.closePath();
  c.fill();
  c.fillStyle = withAlpha('#ffe1a8', 0.95);
  c.beginPath();
  c.moveTo(x - 7, BASE - 66);
  c.quadraticCurveTo(x - 4, BASE - 84, x, BASE - 92);
  c.quadraticCurveTo(x + 5, BASE - 82, x + 7, BASE - 66);
  c.fill();
}

function paintMid(c: Ctx): void {
  rimmed(c, COLD.mid, withAlpha(COLD.rim, 0.5), (g) => {
    // An iron fence of tall spears and two rails, across the whole tile.
    g.fillRect(0, BASE - 130, W, 5);
    g.fillRect(0, BASE - 54, W, 5);
    for (let x = 6; x < W; x += 26) {
      if (Math.abs(x - 480) < 90) continue;
      const h = 168 + (hash(x, 70) > 0.8 ? 12 : 0);
      g.fillRect(x, BASE - h, 4, h);
      g.beginPath();
      g.moveTo(x - 3, BASE - h);
      g.lineTo(x + 2, BASE - h - 20);
      g.lineTo(x + 7, BASE - h);
      g.closePath();
      g.fill();
      // A bent bar here and there.
      if (hash(x, 71) > 0.92) g.fillRect(x + 4, BASE - h + 20, 10, 3);
    }
    // The gatehouse: a squat tower with arrow slits and a shut door.
    g.fillRect(480 - 70, BASE - 200, 140, 200);
    battlements(g, 480 - 78, 480 + 78, BASE - 200, 14, 24);
    g.fillRect(480 - 78, BASE - 208, 156, 8);
  });
  // The door and the slits are dark; the door has a strip of furnace light at its foot.
  c.fillStyle = '#04040f';
  c.beginPath();
  c.moveTo(480 - 28, BASE);
  c.lineTo(480 - 28, BASE - 90);
  c.quadraticCurveTo(480, BASE - 130, 480 + 28, BASE - 90);
  c.lineTo(480 + 28, BASE);
  c.fill();
  for (const dx of [-40, 40]) c.fillRect(480 + dx - 2, BASE - 170, 4, 26);
  c.fillStyle = withAlpha(COLD.amber, 0.5);
  c.fillRect(480 - 26, BASE - 3, 52, 3);
  brazier(c, 250);
  brazier(c, 740);
}

/** The boss's arena: the great gate, big and close, a rusted portcullis half raised and a furnace behind it. */
function paintArena(c: Ctx): void {
  const gx = 700;
  glow(c, gx, BASE - 60, 240, COLD.amber, 0.26);
  // The furnace light behind the gate, in the opening.
  c.fillStyle = linear(c, 0, BASE - 260, 0, BASE, [
    { at: 0, colour: '#05051a' },
    { at: 1, colour: withAlpha('#d9622a', 0.85) },
  ]);
  c.beginPath();
  c.moveTo(gx - 130, BASE);
  c.lineTo(gx - 130, BASE - 200);
  c.quadraticCurveTo(gx, BASE - 330, gx + 130, BASE - 200);
  c.lineTo(gx + 130, BASE);
  c.fill();
  rimmed(c, COLD.mid, withAlpha(COLD.rim, 0.5), (g) => {
    // The gatehouse walls either side of the opening, with battlements and a pointed lintel.
    g.fillRect(gx - 240, BASE - 300, 110, 300);
    g.fillRect(gx + 130, BASE - 300, 110, 300);
    battlements(g, gx - 250, gx - 120, BASE - 300, 16, 26);
    battlements(g, gx + 120, gx + 250, BASE - 300, 16, 26);
    g.beginPath();
    g.moveTo(gx - 140, BASE - 190);
    g.quadraticCurveTo(gx - 120, BASE - 318, gx, BASE - 340);
    g.quadraticCurveTo(gx + 120, BASE - 318, gx + 140, BASE - 190);
    g.lineTo(gx + 160, BASE - 190);
    g.lineTo(gx + 160, BASE - 320);
    g.lineTo(gx - 160, BASE - 320);
    g.lineTo(gx - 160, BASE - 190);
    g.closePath();
    g.fill();
    // The portcullis, raised halfway: vertical bars, three crossbars, spiked feet.
    g.fillRect(gx - 130, BASE - 238, 260, 6);
    g.fillRect(gx - 130, BASE - 178, 260, 5);
    g.fillRect(gx - 130, BASE - 118, 260, 5);
    for (let x = gx - 124; x <= gx + 124; x += 22) {
      g.fillRect(x, BASE - 250, 5, 144);
      g.beginPath();
      g.moveTo(x - 2, BASE - 106);
      g.lineTo(x + 2.5, BASE - 84);
      g.lineTo(x + 7, BASE - 106);
      g.fill();
    }
    // Chains from the portcullis up into the dark.
    g.lineWidth = 3;
    for (const dx of [-90, 90]) {
      g.beginPath();
      g.moveTo(gx + dx, BASE - 250);
      g.lineTo(gx + dx, BASE - 330);
      g.stroke();
    }
  });
  brazier(c, 460);
  brazier(c, 900);
  for (const x of [gx - 190, gx + 190]) torch(c, x, BASE - 170, 6);
}

// ---- near layer ---------------------------------------------------------------------------------

function wheel(g: Ctx, x: number, y: number, r: number, broken: boolean): void {
  g.lineWidth = 4;
  g.beginPath();
  g.arc(x, y, r, broken ? 0.3 : 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 3;
  for (let k = 0; k < 8; k++) {
    if (broken && k === 3) continue;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos((k * Math.PI) / 4) * r, y + Math.sin((k * Math.PI) / 4) * r);
    g.stroke();
  }
  g.beginPath();
  g.arc(x, y, 5, 0, Math.PI * 2);
  g.fill();
}

function paintNear(c: Ctx): void {
  const lit = withAlpha(COLD.rim, 0.55);
  rimmed(c, COLD.near, lit, (g) => {
    // Barrels with iron hoops.
    for (const [x, h] of [[60, 40], [92, 32], [820, 44]] as const) {
      g.beginPath();
      g.moveTo(x - 15, BASE + 1);
      g.quadraticCurveTo(x - 20, BASE - h / 2, x - 15, BASE - h);
      g.lineTo(x + 15, BASE - h);
      g.quadraticCurveTo(x + 20, BASE - h / 2, x + 15, BASE + 1);
      g.closePath();
      g.fill();
    }
    // A broken cart wheel leaning on a post.
    g.lineCap = 'round';
    g.save();
    g.translate(580, BASE - 28);
    wheel(g, 0, 0, 28, true);
    g.restore();
    g.fillRect(606, BASE - 14, 38, 6);
    // Sharpened stakes.
    for (let i = 0; i < 6; i++) {
      const x = 330 + i * 15;
      g.save();
      g.translate(x, BASE + 2);
      g.rotate(-0.25 + i * 0.12);
      g.beginPath();
      g.moveTo(-3, 0);
      g.lineTo(-3, -34 - (i % 2) * 8);
      g.lineTo(0, -44 - (i % 2) * 8);
      g.lineTo(3, -34 - (i % 2) * 8);
      g.lineTo(3, 0);
      g.fill();
      g.restore();
    }
    // A pile of chain: small links in a heap.
    g.lineWidth = 2.4;
    for (let k = 0; k < 14; k++) {
      g.beginPath();
      g.ellipse(180 + wob(k, 72, 40), BASE - 4 - hash(k, 73) * 8, 6, 3.4, wob(k, 74, 3), 0, Math.PI * 2);
      g.stroke();
    }
    // Rubble.
    for (let i = 0; i < 10; i++) {
      g.beginPath();
      g.ellipse(700 + wob(i, 75, 120), BASE - 2, 6 + hash(i, 76) * 8, 4 + hash(i, 77) * 4, 0, Math.PI, 0);
      g.fill();
    }
  });
  // Torch stands: a pole, a small flame and a halo.
  for (const x of [20, 430, 900]) {
    rimmed(c, COLD.near, lit, (g) => g.fillRect(x - 2, BASE - 62, 4, 64));
    torch(c, x, BASE - 66, 6);
  }
}

// ---- foreground ---------------------------------------------------------------------------------

const FRONT_W = 1600;

function paintFront(c: Ctx): void {
  rimmed(c, COLD.front, withAlpha(COLD.rim, 0.5), (g) => {
    // Massive gate piers: a tall square shaft, a cap, and a spiked finial.
    for (const x of [50, 1180]) {
      g.fillRect(x - 30, 90, 60, H - 90);
      g.fillRect(x - 40, 76, 80, 18);
      g.fillRect(x - 36, H - 30, 72, 30);
      g.beginPath();
      g.moveTo(x - 14, 76);
      g.lineTo(x, 20);
      g.lineTo(x + 14, 76);
      g.closePath();
      g.fill();
    }
    // Chains and a hanging lantern cage (dark).
    g.lineWidth = 3;
    for (const [x, len] of [[880, 150], [1330, 180], [1500, 120]] as const) {
      g.beginPath();
      g.moveTo(x, -4);
      g.lineTo(x, len);
      g.stroke();
      for (let y = 14; y < len; y += 16) g.strokeRect(x - 3, y, 6, 10);
    }
    g.strokeRect(1320, 180, 22, 32);
  });
}

/** Foreground silhouettes pass in front at the screen's edges only, never over the lane the ghost and the stones use. */
export function drawGateFront(ctx: Ctx, s: ArtState): void {
  if (s.flat) return;
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec * 1.15;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 40, H);
  ctx.clip();
  tile(scroll, FRONT_W, (dx) => blit(ctx, 'gate-front', FRONT_W, H, dx, 0, paintFront));
  ctx.restore();
  ctx.fillStyle = radial(ctx, W / 2, H * 0.45, H * 0.45, W * 0.72, [
    { at: 0, colour: 'rgba(3, 3, 14, 0)' },
    { at: 1, colour: 'rgba(3, 3, 14, 0.5)' },
  ]);
  ctx.fillRect(0, 0, W, H);
}

// ---- the cobbles --------------------------------------------------------------------------------

const PATH_H = 156;
const PATH_TOP = 16;

function paintPath(c: Ctx): void {
  const o = PATH_TOP;
  c.fillStyle = linear(c, 0, o, 0, PATH_H, [
    { at: 0, colour: '#2e2c52' },
    { at: 0.25, colour: '#201e3c' },
    { at: 0.6, colour: '#12112a' },
    { at: 1, colour: '#060612' },
  ]);
  c.fillRect(0, o, W, PATH_H - o);
  // Cobbles: rounded stones in staggered rows, lit on top and dark in the joints. The rows grow nearer to the bottom.
  let y = o + 2;
  for (let row = 0; row < 6; row++) {
    const hRow = 9 + row * 5;
    const wStone = [24, 30, 32, 40, 48, 60][row]!;
    for (let x = -((row % 2) * wStone * 0.5); x < W; x += wStone) {
      const j = hash(row * 100 + x, 78);
      c.fillStyle = withAlpha('#06061a', 0.45);
      c.beginPath();
      c.ellipse(x + wStone / 2, y + hRow / 2 + 1, wStone / 2, hRow / 2, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = withAlpha('#4a477c', 0.28 + j * 0.12);
      c.beginPath();
      c.ellipse(x + wStone / 2, y + hRow / 2, wStone / 2 - 2, hRow / 2 - 1.5, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = withAlpha('#b4b8ff', 0.2);
      c.lineWidth = 1.1;
      c.beginPath();
      c.ellipse(x + wStone / 2, y + hRow / 2, wStone / 2 - 2, hRow / 2 - 1.5, 0, 1.15 * Math.PI, 1.85 * Math.PI);
      c.stroke();
    }
    y += hRow;
    if (y > PATH_H) break;
  }
  c.fillStyle = linear(c, 0, o, 0, o + 8, [
    { at: 0, colour: withAlpha('#b4b8ff', 0.2) },
    { at: 1, colour: withAlpha('#b4b8ff', 0) },
  ]);
  c.fillRect(0, o, W, 8);
  // Wheel ruts, ash and a few dropped coins' worth of glint.
  c.lineCap = 'round';
  for (const ry of [o + 40, o + 70]) {
    c.strokeStyle = 'rgba(3, 3, 12, 0.3)';
    c.lineWidth = 4;
    c.beginPath();
    for (let px = 0; px <= W; px += 10) (px === 0 ? c.moveTo(px, ry + Math.sin(px * 0.02) * 1.6) : c.lineTo(px, ry + Math.sin(px * 0.02) * 1.6));
    c.stroke();
  }
  c.fillStyle = '#040410';
  for (let i = 0; i < 50; i++) {
    const x = hash(i, 170) * (W - 12);
    const h = 5 + hash(i, 171) * 10;
    c.beginPath();
    c.moveTo(x, PATH_H);
    c.quadraticCurveTo(x + 2 - hash(i, 172) * 8, PATH_H - h * 0.6, x + 4 - hash(i, 173) * 10, PATH_H - h);
    c.quadraticCurveTo(x + 5, PATH_H - h * 0.5, x + 9, PATH_H);
    c.fill();
  }
}

/** The cobbles under the ghost: cached once, scrolls with the level, still with reduced motion. */
export function drawGateGround(ctx: Ctx, s: ArtState): void {
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec;
  tile(scroll, W, (dx) => blit(ctx, 'gate-path', W, PATH_H, dx, s.groundY - PATH_TOP, paintPath));
}

// ---- particles ------------------------------------------------------------------------------------

/** Embers rising from the braziers, and a little ash. Still, and dimmer, with reduced motion. */
function particles(ctx: Ctx, s: ArtState): void {
  ctx.save();
  for (let i = 0; i < 16; i++) {
    const t = s.reducedMotion ? 0 : s.nowMs / 1000;
    const span = 200;
    const rise = ((hash(i, 80) * span + t * (8 + hash(i, 81) * 8)) % span + span) % span;
    const x = hash(i, 82) * W + Math.sin(t * 0.5 + i) * 10;
    const y = BASE - 60 - rise;
    const a = (s.reducedMotion ? 0.5 : 0.7) * (1 - rise / span);
    ctx.fillStyle = withAlpha('#ffb066', a);
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
  specks(ctx, s, 12, '#d8d9ff', 0.18, 1);
}

// ---- all the layers ------------------------------------------------------------------------------

export function drawGateLayers(ctx: Ctx, s: ArtState): void {
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec;
  const layer = (key: string, speed: number, paint: (c: Ctx) => void): void => tile(scroll * speed, W, (dx) => blit(ctx, key, W, H, dx, 0, paint));
  layer('gate-far', 0.05, paintFar);
  fog(ctx, COLD.fog, BASE - 190, BASE - 70, 0.16);
  layer('gate-hills', 0.12, paintHills);
  fog(ctx, COLD.fog, BASE - 120, BASE - 20, 0.13);
  layer(s.arena ? 'gate-arena' : 'gate-mid', 0.22, s.arena ? paintArena : paintMid);
  fog(ctx, COLD.fog, BASE - 80, BASE, 0.12);
  layer('gate-near', 0.45, paintNear);
  particles(ctx, s);
}

/** The layers, far to near, for the report. */
export const GATE_LAYERS = ['sky, moon, thin cloud, shafts', 'jagged mountains with a distant keep', 'curtain wall, towers, torches, banners', 'iron fence, gatehouse, braziers (arena: the great gate with a furnace behind)', 'barrels, broken wheel, chains, stakes, torch stands', 'foreground gate piers and chains'] as const;
