import { blit, hash, linear, radial, tile, withAlpha, type Ctx } from '../gfx';
import type { ArtState } from '../art';
import { BASE, beads, fog, glow, H, lamp, moon, orbWeb, ridge, ridgePath, ridgeRim, rimmed, shafts, specks, stars, W, wob } from './common-stages-5-7';

// Stage 5, Haunted Mill, drawn in code. One cold hue (midnight navy-indigo), one warm accent (lamp gold in the
// mill's windows and a lantern on a post), silver-lilac rim light, and spider silk everywhere. Layers, far to near:
//
//   sky + low moon + two wisps of cloud + moon shafts
//   far     ridge with two windmills (the sails stand still) and tall poplars
//   fog
//   hills   a nearer ridge: haystacks, a crooked footbridge, a cottage with a lit window, a big dewy orb web
//   fog
//   mid     the mill: a tall weatherboard house, a great water wheel, a hoist beam and a hanging sack, lit windows
//           (in the boss arena: the inside of the mill, a huge cog wheel, timber posts, light through the planks, a web)
//   fog
//   near    barrels, flour sacks, a stack of millstones, web strands, a lantern post
//   (obstacles, ghost)
//   front   rafters and hanging web strands at the screen edges, then a vignette
//
// Static layers are painted once to offscreen canvases. Everything stands still with reduced motion. The only slow
// change is flour dust, and a lamp halo that breathes at under a fifth of a hertz. Nothing flashes.

const COLD = {
  skyTop: '#04061a',
  skyMid: '#0c1334',
  skyHorizon: '#27346a',
  far: '#202c5a',
  farLow: '#16204a',
  hills: '#141d44',
  mid: '#0b1233',
  near: '#060a20',
  front: '#02030e',
  rim: '#9fb2f0',
  fog: '#9fb2e6',
  gold: '#ffc658',
  silk: '#d4d8ff',
};
const MOON = { x: 250, y: 118 };

// ---- the sky -----------------------------------------------------------------------------

export function drawMillSky(ctx: Ctx, s: ArtState): void {
  ctx.fillStyle = linear(ctx, 0, 0, 0, BASE, [
    { at: 0, colour: COLD.skyTop },
    { at: 0.55, colour: COLD.skyMid },
    { at: 1, colour: COLD.skyHorizon },
  ]);
  ctx.fillRect(0, 0, W, H);
  stars(ctx, 46, BASE - 190, '#dfe6ff', 20);
  const mx = s.arena ? 470 : MOON.x;
  const my = s.arena ? 150 : MOON.y;
  const r = s.arena ? 66 : 34;
  moon(ctx, mx, my, r, s.pulse, '#b9c7ff', '#f3f1e6', '#cfd3e6');
  ctx.save();
  for (const [dy, len, a] of [[0.45, 1.8, 0.26], [0.8, 2.4, 0.16]] as const) {
    ctx.save();
    ctx.translate(mx + r * 0.2, my + r * dy);
    ctx.rotate(0.03);
    ctx.scale(1, 0.1);
    ctx.fillStyle = radial(ctx, 0, 0, 0, r * len, [
      { at: 0, colour: withAlpha('#aebbee', a) },
      { at: 0.6, colour: withAlpha('#aebbee', a * 0.4) },
      { at: 1, colour: withAlpha('#aebbee', 0) },
    ]);
    ctx.beginPath();
    ctx.arc(0, 0, r * len, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  shafts(ctx, mx, my + r * 0.5, '#aebbee', [[mx + 120, 70], [mx + 330, 90], [mx - 40, 50]], 0.07);
}

// ---- far layer: ridge, windmills, poplars ----------------------------------------------------

const FAR = { a: [20, 10, 5], k: [2, 5, 11], p: [0.6, 1.9, 0.3] };
const farY = (x: number): number => ridge(x, BASE - 130, FAR.a, FAR.k, FAR.p);

function windmill(g: Ctx, x: number, base: number, h: number, sail: number, rot: number): void {
  const k = h / 120;
  g.beginPath();
  g.moveTo(x - 24 * k, base);
  g.lineTo(x - 13 * k, base - h);
  g.lineTo(x + 13 * k, base - h);
  g.lineTo(x + 24 * k, base);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(x - 17 * k, base - h);
  g.lineTo(x, base - h - 28 * k);
  g.lineTo(x + 17 * k, base - h);
  g.closePath();
  g.fill();
  g.fillRect(x - 28 * k, base - 4, 56 * k, 8);
  // Four sails: a long arm and a latticed frame on one side of it, standing still.
  for (let i = 0; i < 4; i++) {
    g.save();
    g.translate(x, base - h + 4);
    g.rotate(rot + (i * Math.PI) / 2);
    g.fillRect(0, -1.5, sail, 3);
    g.fillRect(sail * 0.2, -sail * 0.19, sail * 0.8, 2);
    g.fillRect(sail * 0.2, -sail * 0.19, 2, sail * 0.19);
    g.fillRect(sail - 2, -sail * 0.19, 2, sail * 0.19);
    for (let j = 0; j < 7; j++) g.fillRect(sail * 0.24 + j * sail * 0.105, -sail * 0.19, 1.4, sail * 0.19);
    g.restore();
  }
  g.beginPath();
  g.arc(x, base - h + 4, 5 * k, 0, Math.PI * 2);
  g.fill();
}

function poplar(g: Ctx, x: number, base: number, h: number): void {
  g.beginPath();
  g.moveTo(x - h * 0.06, base);
  g.bezierCurveTo(x - h * 0.13, base - h * 0.4, x - h * 0.06, base - h * 0.8, x, base - h);
  g.bezierCurveTo(x + h * 0.06, base - h * 0.8, x + h * 0.13, base - h * 0.4, x + h * 0.06, base);
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
  ridgeRim(c, farY, withAlpha(COLD.rim, 0.42), 1.5);
  rimmed(c, COLD.far, withAlpha(COLD.rim, 0.5), (g) => {
    windmill(g, 640, farY(640) + 6, 124, 78, 0.5);
    windmill(g, 842, farY(842) + 6, 84, 52, 0.12);
    for (const [x, h] of [[70, 130], [104, 104], [150, 140], [400, 118], [430, 140], [470, 100], [760, 110]] as const) poplar(g, x, farY(x) + 8, h);
  });
  // A tiny lit window in the big windmill's tower.
  glow(c, 640, farY(640) - 40, 20, COLD.gold, 0.34);
  c.fillStyle = withAlpha('#ffe2a0', 0.85);
  c.fillRect(638, farY(640) - 44, 4, 7);
}

// ---- second ridge: haystacks, a bridge, a cottage, a web -----------------------------------------

const HILLS = { a: [16, 8, 4], k: [3, 6, 13], p: [1.1, 0.2, 2.4] };
const hillY = (x: number): number => ridge(x, BASE - 70, HILLS.a, HILLS.k, HILLS.p);

function haystack(g: Ctx, x: number, base: number, w: number): void {
  g.beginPath();
  g.moveTo(x - w, base);
  g.quadraticCurveTo(x - w * 0.9, base - w * 1.1, x, base - w * 1.25);
  g.quadraticCurveTo(x + w * 0.9, base - w * 1.1, x + w, base);
  g.closePath();
  g.fill();
}

function paintHills(c: Ctx): void {
  c.fillStyle = COLD.hills;
  ridgePath(c, hillY, BASE);
  c.fill();
  ridgeRim(c, hillY, withAlpha(COLD.rim, 0.3), 1.4);
  rimmed(c, COLD.hills, withAlpha(COLD.rim, 0.5), (g) => {
    for (const [x, w] of [[96, 30], [140, 22], [520, 28], [880, 26]] as const) haystack(g, x, hillY(x) + 8, w);
    // A crooked footbridge: a hump of planks on two posts, with a rail.
    const bx = 330;
    const by = hillY(bx) + 6;
    g.beginPath();
    g.moveTo(bx - 80, by);
    g.quadraticCurveTo(bx, by - 46, bx + 80, by);
    g.lineTo(bx + 80, by + 8);
    g.quadraticCurveTo(bx, by - 36, bx - 80, by + 8);
    g.fill();
    for (let i = -3; i <= 3; i++) g.fillRect(bx + i * 24 - 1.5, by - 44 + Math.abs(i * i) * 3.8 - 26 + 18, 3, 26);
    g.fillRect(bx - 50, by - 12, 4, 20);
    g.fillRect(bx + 46, by - 12, 4, 20);
    // The cottage: a crooked box, a steep roof and a chimney.
    const cx = 700;
    const cy = hillY(cx) + 8;
    g.save();
    g.translate(cx, cy);
    g.rotate(-0.025);
    g.fillRect(-46, -52, 92, 52);
    g.beginPath();
    g.moveTo(-58, -50);
    g.lineTo(0, -98);
    g.lineTo(58, -50);
    g.closePath();
    g.fill();
    g.fillRect(24, -102, 12, 30);
    g.restore();
    // Two poles, and the big web between them.
    g.fillRect(180 - 3, hillY(180) - 90, 6, 100);
    g.fillRect(260 - 3, hillY(260) - 100, 6, 108);
  });
  // The web, strung high between the poles: pale, thin, with dew.
  const wx = 220;
  const wy = hillY(220) - 56;
  orbWeb(c, wx, wy, 46, 11, 5, withAlpha(COLD.silk, 0.34), 3);
  beads(c, [[wx + 14, wy - 12], [wx - 22, wy + 8], [wx + 5, wy + 24], [wx - 6, wy - 28], [wx + 30, wy + 12]], withAlpha('#ffffff', 0.7));
  // The cottage window and a far lantern.
  const cx = 700;
  const cy = hillY(cx) + 8;
  glow(c, cx - 14, cy - 28, 26, COLD.gold, 0.4);
  c.fillStyle = withAlpha('#ffd98a', 0.9);
  c.fillRect(cx - 19, cy - 34, 10, 12);
  glow(c, 880, hillY(880) - 10, 16, COLD.gold, 0.34);
}

// ---- mid layer: the mill ---------------------------------------------------------------------

function waterWheel(g: Ctx, x: number, y: number, r: number): void {
  g.save();
  g.translate(x, y);
  g.lineWidth = 5;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(0, 0, r * 0.82, 0, Math.PI * 2);
  g.lineWidth = 3;
  g.stroke();
  g.lineWidth = 4;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.2;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    g.stroke();
    // A paddle on the rim.
    g.save();
    g.translate(Math.cos(a) * r, Math.sin(a) * r);
    g.rotate(a);
    g.fillRect(-2, -8, 14, 16);
    g.restore();
  }
  g.beginPath();
  g.arc(0, 0, r * 0.14, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function paintMid(c: Ctx): void {
  const lit = withAlpha(COLD.rim, 0.5);
  const gx = 440;
  const top = BASE - 250;
  rimmed(c, COLD.mid, lit, (g) => {
    g.fillRect(0, BASE - 20, W, 20);
    // The mill house: tall, narrower at the top, weatherboards, a steep roof.
    g.beginPath();
    g.moveTo(gx, BASE - 20);
    g.lineTo(gx + 8, top + 30);
    g.lineTo(gx + 214, top + 30);
    g.lineTo(gx + 222, BASE - 20);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(gx - 10, top + 36);
    g.lineTo(gx + 111, top - 38);
    g.lineTo(gx + 232, top + 36);
    g.closePath();
    g.fill();
    g.fillRect(gx + 150, top - 52, 16, 44);
    // The hoist: a beam out of the loft, a pulley, a rope and a sack.
    g.fillRect(gx + 200, top + 8, 100, 6);
    g.fillRect(gx + 292, top + 8, 6, 16);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(gx + 270, top + 14);
    g.lineTo(gx + 270, top + 84);
    g.stroke();
    g.beginPath();
    g.ellipse(gx + 270, top + 100, 14, 18, 0, 0, Math.PI * 2);
    g.fill();
    // The great wheel on the house's left side, half in the dark water.
    g.strokeStyle = COLD.mid;
    waterWheel(g, gx - 24, BASE - 74, 78);
    // A granary on stilts, to the left, and a squat silo.
    g.fillRect(90, BASE - 150, 110, 80);
    g.beginPath();
    g.moveTo(80, BASE - 148);
    g.lineTo(145, BASE - 192);
    g.lineTo(210, BASE - 148);
    g.closePath();
    g.fill();
    for (const sx of [100, 136, 172, 196]) g.fillRect(sx, BASE - 72, 6, 56);
    g.fillRect(776, BASE - 160, 70, 142);
    g.beginPath();
    g.arc(811, BASE - 160, 35, Math.PI, 0);
    g.fill();
    // Weatherboard lines, in a slightly lighter dark, are painted below with the windows.
  });
  c.save();
  c.strokeStyle = withAlpha('#1d2a64', 0.5);
  c.lineWidth = 1.2;
  for (let y = top + 44; y < BASE - 24; y += 12) {
    c.beginPath();
    c.moveTo(gx + 6 + ((y - top) / 230) * 2, y);
    c.lineTo(gx + 216 - ((y - top) / 230) * 2, y);
    c.stroke();
  }
  c.restore();
  // Windows: lit gold, with halos. A door, low, with a bigger glow.
  for (const [wx, wy, w, h] of [[gx + 40, top + 66, 22, 30], [gx + 100, top + 66, 22, 30], [gx + 160, top + 66, 22, 30], [gx + 70, top + 140, 20, 28], [gx + 140, top + 140, 20, 28]] as const) {
    glow(c, wx + w / 2, wy + h / 2, 38, COLD.gold, 0.3);
    c.fillStyle = withAlpha('#ffd98a', 0.92);
    c.fillRect(wx, wy, w, h);
    c.fillStyle = '#10163a';
    c.fillRect(wx + w / 2 - 1, wy, 2, h);
    c.fillRect(wx, wy + h / 2 - 1, w, 2);
  }
  glow(c, gx + 111, BASE - 56, 56, COLD.gold, 0.26);
  c.fillStyle = withAlpha('#ffcf7a', 0.85);
  c.beginPath();
  c.moveTo(gx + 93, BASE - 20);
  c.lineTo(gx + 93, BASE - 62);
  c.quadraticCurveTo(gx + 111, BASE - 80, gx + 129, BASE - 62);
  c.lineTo(gx + 129, BASE - 20);
  c.fill();
  // A web in the gap between the granary and the house, and one in the hoist.
  orbWeb(c, 340, BASE - 120, 54, 12, 6, withAlpha(COLD.silk, 0.3), 9);
  beads(c, [[354, BASE - 134], [318, BASE - 112], [340, BASE - 84], [366, BASE - 108]], withAlpha('#ffffff', 0.65));
  glow(c, 145, BASE - 108, 22, COLD.gold, 0.3);
  c.fillStyle = withAlpha('#ffd98a', 0.85);
  c.fillRect(138, BASE - 114, 14, 14);
}

/** The boss's arena: the inside of the mill. A huge cog wheel behind the Miller, timber posts, light between the planks. */
function paintArena(c: Ctx): void {
  // Back wall: dark planks with thin slits of light.
  c.fillStyle = withAlpha('#050921', 0.9);
  c.fillRect(0, 0, W, BASE);
  for (let x = 20; x < W; x += 46) {
    c.fillStyle = withAlpha('#0d1440', 0.9);
    c.fillRect(x, 0, 2, BASE);
    if (hash(x, 90) > 0.55) {
      c.fillStyle = linear(c, 0, 0, 0, BASE, [
        { at: 0, colour: withAlpha('#ffd98a', 0.0) },
        { at: 0.4, colour: withAlpha('#ffd98a', 0.14) },
        { at: 1, colour: withAlpha('#ffd98a', 0.02) },
      ]);
      c.fillRect(x + 2, 0, 3, BASE);
    }
  }
  glow(c, 640, 250, 220, COLD.gold, 0.2);
  rimmed(c, COLD.mid, withAlpha(COLD.rim, 0.5), (g) => {
    // The cog wheel: a ring, spokes and big square teeth.
    g.save();
    g.translate(640, 236);
    g.lineWidth = 16;
    g.beginPath();
    g.arc(0, 0, 138, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 10;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * 138, Math.sin(a) * 138);
      g.stroke();
    }
    for (let i = 0; i < 24; i++) {
      g.save();
      g.rotate((i / 24) * Math.PI * 2);
      g.fillRect(138, -9, 20, 18);
      g.restore();
    }
    g.beginPath();
    g.arc(0, 0, 26, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // Timber posts and a crossbeam.
    for (const x of [40, 130, 880]) g.fillRect(x - 16, 0, 32, BASE);
    g.fillRect(0, 54, W, 20);
    // A hanging sack and a rope.
    g.fillRect(310, 74, 2, 80);
    g.beginPath();
    g.ellipse(311, 176, 16, 24, 0, 0, Math.PI * 2);
    g.fill();
  });
  // A huge web filling the top-right corner.
  orbWeb(c, 930, 20, 190, 14, 8, withAlpha(COLD.silk, 0.28), 4);
}

// ---- near layer ------------------------------------------------------------------------------

function paintNear(c: Ctx): void {
  const lit = withAlpha(COLD.rim, 0.55);
  rimmed(c, COLD.near, lit, (g) => {
    // Barrels: a bulging body with two hoops.
    for (const [x, h] of [[74, 56], [102, 46], [610, 58], [900, 52]] as const) {
      g.beginPath();
      g.moveTo(x - 17, BASE + 2);
      g.quadraticCurveTo(x - 24, BASE - h * 0.5, x - 16, BASE - h);
      g.lineTo(x + 16, BASE - h);
      g.quadraticCurveTo(x + 24, BASE - h * 0.5, x + 17, BASE + 2);
      g.closePath();
      g.fill();
    }
    // Flour sacks: lumpy, leaning, with a tied neck.
    for (const [x, lean] of [[300, -0.1], [330, 0.08], [316, 0], [790, 0.1], [818, -0.06]] as const) {
      g.save();
      g.translate(x, BASE + 2);
      g.rotate(lean);
      g.beginPath();
      g.moveTo(-17, 0);
      g.quadraticCurveTo(-22, -26, -10, -38);
      g.lineTo(-6, -46);
      g.lineTo(6, -46);
      g.lineTo(10, -38);
      g.quadraticCurveTo(22, -26, 17, 0);
      g.closePath();
      g.fill();
      g.restore();
    }
    // A stack of three millstones, set on edge, leaning on a post.
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.ellipse(520 + i * 5, BASE - 14 - i * 22, 36 - i * 2, 12, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillRect(488, BASE - 80, 8, 80);
    // A lantern post: a thin pole and a cage.
    g.fillRect(168, BASE - 124, 4, 126);
    g.fillRect(160, BASE - 134, 20, 4);
    g.fillRect(163, BASE - 132, 14, 16);
    // A cart wheel against the wall.
    g.lineWidth = 4;
    g.beginPath();
    g.arc(700, BASE - 34, 34, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      g.beginPath();
      g.moveTo(700, BASE - 34);
      g.lineTo(700 + Math.cos(a) * 34, BASE - 34 + Math.sin(a) * 34);
      g.stroke();
    }
  });
  glow(c, 170, BASE - 124, 36, COLD.gold, 0.4);
  c.fillStyle = withAlpha('#ffe0ae', 0.95);
  c.beginPath();
  c.ellipse(170, BASE - 124, 3, 6, 0, 0, Math.PI * 2);
  c.fill();
  // Silk strands from the post to the barrels and the sacks: thin pale lines that sag.
  c.strokeStyle = withAlpha(COLD.silk, 0.3);
  c.lineWidth = 1;
  for (const [x0, y0, x1, y1] of [[170, BASE - 130, 102, BASE - 48], [170, BASE - 130, 330, BASE - 34], [610, BASE - 58, 520, BASE - 62], [330, BASE - 36, 520, BASE - 62]] as const) {
    c.beginPath();
    c.moveTo(x0, y0);
    c.quadraticCurveTo((x0 + x1) / 2 + wob(x0, 7, 10), (y0 + y1) / 2 + 22, x1, y1);
    c.stroke();
  }
}

// ---- foreground ----------------------------------------------------------------------------

const FRONT_W = 1600;

function paintFront(c: Ctx): void {
  rimmed(c, COLD.front, withAlpha(COLD.rim, 0.5), (g) => {
    // Two heavy timber posts with a slanted brace, and a rafter along the top.
    for (const x of [40, 1220]) {
      g.fillRect(x - 24, 0, 48, H);
      g.fillRect(x - 32, H - 30, 64, 30);
    }
    g.beginPath();
    g.moveTo(64, 120);
    g.lineTo(150, 0);
    g.lineTo(168, 0);
    g.lineTo(82, 138);
    g.closePath();
    g.fill();
    g.fillRect(0, 0, FRONT_W, 12);
  });
  // Strands of silk hanging from the rafter, each with a bead.
  c.strokeStyle = withAlpha(COLD.silk, 0.36);
  c.lineWidth = 1.2;
  for (const [x, len] of [[120, 120], [880, 150], [1300, 190], [1440, 110]] as const) {
    c.beginPath();
    c.moveTo(x, 0);
    c.quadraticCurveTo(x + 8, len / 2, x + 2, len);
    c.stroke();
    beads(c, [[x + 2, len]], withAlpha('#ffffff', 0.7));
  }
  orbWeb(c, 64, 8, 100, 9, 5, withAlpha(COLD.silk, 0.3), 12);
}

/** Foreground silhouettes pass in front at the screen's edges only, never over the lane the ghost and the stones use. */
export function drawMillFront(ctx: Ctx, s: ArtState): void {
  if (s.flat) return;
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec * 1.15;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 40, H);
  ctx.rect(W - 120, 0, 120, 56);
  ctx.clip();
  tile(scroll, FRONT_W, (dx) => blit(ctx, 'mill-front', FRONT_W, H, dx, 0, paintFront));
  ctx.restore();
  ctx.fillStyle = radial(ctx, W / 2, H * 0.45, H * 0.45, W * 0.72, [
    { at: 0, colour: 'rgba(2, 3, 14, 0)' },
    { at: 1, colour: 'rgba(2, 3, 14, 0.5)' },
  ]);
  ctx.fillRect(0, 0, W, H);
}

// ---- the plank dock -----------------------------------------------------------------------------

const PATH_H = 156;
const PATH_TOP = 16;

function paintPath(c: Ctx): void {
  const o = PATH_TOP;
  c.fillStyle = linear(c, 0, o, 0, PATH_H, [
    { at: 0, colour: '#2c3566' },
    { at: 0.25, colour: '#1e2650' },
    { at: 0.6, colour: '#111838' },
    { at: 1, colour: '#070a1c' },
  ]);
  c.fillRect(0, o, W, PATH_H - o);
  // Planks in rows, each row a little deeper than the last, with staggered joints and nails.
  let y = o;
  for (let row = 0; row < 5; row++) {
    const hRow = 12 + row * 9;
    const wPlank = 150 + row * 30;
    for (let x = -((row * 53) % wPlank); x < W; x += wPlank) {
      c.fillStyle = withAlpha('#04061a', 0.45);
      c.fillRect(x + wPlank - 2, y, 2, hRow);
      c.fillStyle = withAlpha('#c9d4ff', 0.35);
      c.fillRect(x + 6, y + hRow * 0.45, 2, 2);
      c.fillRect(x + wPlank - 10, y + hRow * 0.45, 2, 2);
    }
    c.fillStyle = withAlpha('#04061a', 0.5);
    c.fillRect(0, y + hRow - 2, W, 2);
    c.fillStyle = withAlpha('#a9b8f0', 0.14);
    c.fillRect(0, y + 1, W, 1.4);
    y += hRow;
  }
  c.fillStyle = linear(c, 0, o, 0, o + 8, [
    { at: 0, colour: withAlpha('#b4c2ff', 0.24) },
    { at: 1, colour: withAlpha('#b4c2ff', 0) },
  ]);
  c.fillRect(0, o, W, 8);
  // Grain in the wood, and flour dusted across.
  c.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const x = hash(i, 130) * W;
    const y0 = o + 6 + hash(i, 131) * 100;
    c.strokeStyle = 'rgba(2, 4, 16, 0.4)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x, y0);
    c.lineTo(x + 20 + hash(i, 132) * 30, y0 + wob(i, 133, 3));
    c.stroke();
  }
  for (let i = 0; i < 110; i++) {
    c.fillStyle = withAlpha('#e8ecff', 0.05 + hash(i, 134) * 0.09);
    c.beginPath();
    c.ellipse(hash(i, 135) * W, o + 4 + hash(i, 136) ** 1.4 * (PATH_H - o - 10), 2 + hash(i, 137) * 6, 1, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#04061a';
  for (let i = 0; i < 40; i++) {
    const x = hash(i, 170) * (W - 12);
    const h = 5 + hash(i, 171) * 12;
    c.beginPath();
    c.moveTo(x, PATH_H);
    c.quadraticCurveTo(x + 2 - hash(i, 172) * 8, PATH_H - h * 0.6, x + 4 - hash(i, 173) * 10, PATH_H - h);
    c.quadraticCurveTo(x + 5, PATH_H - h * 0.5, x + 9, PATH_H);
    c.fill();
  }
}

export function drawMillGround(ctx: Ctx, s: ArtState): void {
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec;
  tile(scroll, W, (dx) => blit(ctx, 'mill-path', W, PATH_H, dx, s.groundY - PATH_TOP, paintPath));
}

// ---- all the layers ----------------------------------------------------------------------------

export function drawMillLayers(ctx: Ctx, s: ArtState): void {
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec;
  const layer = (key: string, speed: number, paint: (c: Ctx) => void): void => tile(scroll * speed, W, (dx) => blit(ctx, key, W, H, dx, 0, paint));
  layer('mill-far', 0.05, paintFar);
  fog(ctx, COLD.fog, BASE - 190, BASE - 70, 0.16);
  layer('mill-hills', 0.12, paintHills);
  fog(ctx, COLD.fog, BASE - 120, BASE - 20, 0.12);
  layer(s.arena ? 'mill-arena' : 'mill-mid', 0.22, s.arena ? paintArena : paintMid);
  fog(ctx, COLD.fog, BASE - 80, BASE, 0.1);
  layer('mill-near', 0.45, paintNear);
  specks(ctx, s, 26, '#e8ecff', 0.22, -1, 1.8);
  // The lantern's halo breathes on top of the cached one, in step with the near layer.
  if (!s.arena) tile(scroll * 0.45, W, (dx) => lamp(ctx, s, 170 + dx, BASE - 124, 4, COLD.gold, 1));
}

/** The layers, far to near, for the report. */
export const MILL_LAYERS = ['sky, low moon, cloud wisps, shafts', 'ridge with two windmills and poplars', 'haystacks, footbridge, cottage with lit window, dewy orb web', 'the mill house, water wheel, hoist, lit windows (arena: inside, cog wheel, timber, giant web)', 'barrels, sacks, millstones, lantern post, silk strands', 'edge timber posts, rafter and hanging silk'] as const;
